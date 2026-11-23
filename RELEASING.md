# Releasing DecisionLane

DecisionLane uses [release-please](https://github.com/googleapis/release-please) to version releases, generate `CHANGELOG.md`, create tags, and publish GitHub Releases.
Versions follow [Semantic Versioning](https://semver.org/) and tags use the `v<major>.<minor>.<patch>` format.
The current version is tracked in `release-please-manifest.json` and written to `backend/pyproject.toml` and `frontend/package.json` when a release is prepared.

## Commit messages

Release notes are generated from the commits that land on `master`, or from the pull request titles used for squash merges.
Write those as [Conventional Commits](https://www.conventionalcommits.org/).
`fix:` produces a patch release, `feat:` produces a minor release, and `!` or a `BREAKING CHANGE:` footer produces a major release.
Before version 1.0.0, a breaking change produces a minor release instead.
Other types such as `docs:`, `test:`, and `chore:` do not trigger a release on their own.

## Review and publish a version

1. Merge changes to `master` as usual.
2. The `Release` workflow opens or updates a release pull request that bumps the version and updates `CHANGELOG.md`.
3. Review the release pull request: confirm the proposed version, read the generated changelog, and check that the included changes are ready to ship.
4. Merge the release pull request when you want to publish.
5. The `Release` workflow then creates the `v<version>` tag and the GitHub Release with the same notes.
6. Confirm the tag and the GitHub Release exist, then run any deployment described below.

To force a specific version, add a `Release-As: <version>` footer to a commit on `master`.
Do not edit `CHANGELOG.md` by hand; the next release pull request regenerates it.

## Deployment

Publishing a release does not start a deployment.
Deploy manually from `master` after CI passes: run [deploy-infra-dev.yml](.github/workflows/deploy-infra-dev.yml) when infrastructure changes, then run [deploy-dev.yml](.github/workflows/deploy-dev.yml).

## Repository settings

Enable **Settings > Actions > General > Allow GitHub Actions to create and approve pull requests** so the workflow can open the release pull request.
The workflow uses the default `GITHUB_TOKEN` with `contents: write` and `pull-requests: write` only.
Pull requests, tags, and releases created with `GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the release pull request.
Branch protection on `master` requires the `frontend` and `infrastructure` checks, so a maintainer must resolve this before the release pull request can merge.
To run CI on the release pull request, pass a GitHub App token or fine-grained token to the action's `token` input instead.
