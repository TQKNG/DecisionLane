import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as redux from '@reduxjs/toolkit';
import * as query from '@reduxjs/toolkit/query/react';
const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
function loadModule(relativePath, mocks = {}, globals = {}) {
  const source = fs.readFileSync(path.join(TEST_DIRECTORY, '..', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }, URL, setTimeout: resolve => resolve(), structuredClone, Date, fetch: () => { throw new Error('Unexpected live request'); }, ...globals });
  return compiledModule.exports;
}
let demo;
beforeEach(() => { demo = loadModule('src/lib/data/demo.ts'); });
test('demo requests never call fetch and reset mutations', async () => {
  const claims = await demo.demoRequest('/v1/claims', {}, 'Customer', 'demo-customer');
  const created = await demo.demoRequest('/v1/claims', { method: 'POST', body: JSON.stringify({ order_id: 'TEST', requested_amount: '12.34', currency: 'CAD' }) }, 'Customer', 'demo-customer');
  await demo.demoRequest(`/v1/claims/${created.id}/submit`, { method: 'POST' }, 'Customer', 'demo-customer');
  assert.equal((await demo.demoRequest(`/v1/claims/${created.id}`, {}, 'Customer', 'demo-customer')).status, 'scanning');
  demo.resetDemo();
  assert.equal((await demo.demoRequest('/v1/claims', {}, 'Customer', 'demo-customer')).length, claims.length);
});
test('two approvals require distinct identities and do not confirm payment', async () => {
  const decide = identity => demo.demoRequest('/v1/reviews/RF-1042/decision', { method: 'POST', body: JSON.stringify({ decision: 'approve', comment: 'Evidence verified' }) }, 'Reviewer', identity);
  await decide('reviewer-a');
  await assert.rejects(decide('reviewer-a'), /distinct reviewer/);
  assert.equal((await demo.demoRequest('/v1/reviews/RF-1042', {}, 'Reviewer', 'reviewer-b')).claim.status, 'pending_approval');
  await decide('reviewer-b');
  const review = await demo.demoRequest('/v1/reviews/RF-1042', {}, 'Reviewer', 'reviewer-b');
  assert.equal(review.claim.status, 'approved');
  assert.equal(review.approvals.length, 2);
});
test('demo staff endpoints enforce roles', async () => {
  await assert.rejects(demo.demoRequest('/v1/admin/kpis', {}, 'Customer', 'customer'), /Administrator/);
  await assert.rejects(demo.demoRequest('/v1/reviews/RF-1042', {}, 'Customer', 'customer'), /Reviewer/);
});
test('a failed live request cannot fall back to demo', async () => {
  let demoCalls = 0;
  const transport = loadModule('src/lib/data/transport.ts', {
    '@/lib/auth': { AUTH_CONFIGURED: false },
    './demo': { demoRequest: () => { demoCalls++; } },
  });
  await assert.rejects(transport.transport({ mode: 'live', role: 'Customer', accountKey: 'anonymous' }, '/v1/claims'), /not configured/);
  assert.equal(demoCalls, 0);
});
test('RTK Query isolates records by authenticated account', async () => {
  const storeModule = loadModule('src/lib/store.ts', {
    '@reduxjs/toolkit': redux,
    '@reduxjs/toolkit/query/react': query,
    './data/transport': { transport: async session => [{ id: session.accountKey }] },
  });
  const store = storeModule.makeStore();
  const arg = { mode: 'live', role: 'Customer', path: '/v1/claims' };
  const first = store.dispatch(storeModule.refundApi.endpoints.claims.initiate({ ...arg, accountKey: 'account-a' }));
  const second = store.dispatch(storeModule.refundApi.endpoints.claims.initiate({ ...arg, accountKey: 'account-b' }));
  assert.equal((await first.unwrap())[0].id, 'account-a');
  assert.equal((await second.unwrap())[0].id, 'account-b');
  first.unsubscribe();
  second.unsubscribe();
  store.dispatch(storeModule.refundApi.util.resetApiState());
});
test('information responses are demo-only state transitions', async () => {
  await demo.demoRequest('/demo/claims/RF-1043/information', { method: 'POST', body: JSON.stringify({ response: 'The item label is visible in the additional evidence.' }) }, 'Customer', 'demo-customer');
  assert.equal((await demo.demoRequest('/v1/claims/RF-1043', {}, 'Customer', 'demo-customer')).status, 'processing');
  await assert.rejects(demo.demoRequest('/v1/claims/RF-1043/information', { method: 'POST' }, 'Customer', 'demo-customer'), /Unsupported/);
});

test('a configured live HTTP failure is surfaced without synthetic substitution', async () => {
  let demoCalls = 0;
  const transport = loadModule('src/lib/data/transport.ts', {
    '@/lib/auth': { AUTH_CONFIGURED: true, API_SCOPE: 'test-scope', MSAL_INSTANCE: {
      getAllAccounts: () => [{ homeAccountId: 'account-a' }],
      acquireTokenSilent: async () => ({ accessToken: 'synthetic-test-token' }),
    } },
    './demo': { demoRequest: () => { demoCalls++; } },
  }, { process: { env: { NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test' } }, fetch: async () => ({ ok: false, status: 503, text: async () => 'Service unavailable' }) });
  await assert.rejects(transport.transport({ mode: 'live', role: 'Customer', accountKey: 'account-a' }, '/v1/claims'), /503: Service unavailable/);
  assert.equal(demoCalls, 0);
});
test('draft recovery rejects malformed metadata and enforces monetary precision', () => {
  const types = loadModule('src/lib/types.ts');
  const draft = loadModule('src/features/customer/draft.ts', { '@/lib/types': types });
  const valid = { ...types.EMPTY_DRAFT, orderId: 'ORD-8201', amount: '12.34', reason: 'The package arrived damaged.', files: [{ id: 'evidence-1', name: 'receipt.pdf', type: 'application/pdf', size: 200, status: 'Ready to upload' }] };
  assert.equal(draft.parseDraft(JSON.stringify(valid)).orderId, 'ORD-8201');
  assert.throws(() => draft.parseDraft(JSON.stringify({ ...valid, files: [null] })), /could not be recovered/);
  assert.throws(() => draft.parseDraft(JSON.stringify({ ...valid, files: null })), /could not be recovered/);
  assert.equal(draft.validateDraft(valid), undefined);
  assert.match(draft.validateDraft({ ...valid, amount: '12.345' }), /decimal places/);
  assert.equal(draft.isSubmitted('draft'), false);
  assert.equal(draft.isSubmitted('uploading'), false);
  assert.equal(draft.isSubmitted('scanning'), true);
});
