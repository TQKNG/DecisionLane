import Link from "next/link";
import { DecisionLaneBrand, DecisionLaneFlowArt } from "@/components/decision-lane-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const FEATURES = [
    { title: "Connect your process", description: "Bring your data, policies, and business rules together.", icon: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></> },
    { title: "See the evidence", description: "Get AI-supported analysis with clear reasoning and citations.", icon: <><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 5 5" /></> },
    { title: "Decide with confidence", description: "Combine AI insight with human judgment to reach the right outcome.", icon: <path d="m4 12 5 5L20 6" /> },
];

export function LandingPage() {
    return <div className="dl-landing">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="dl-landing-nav"><DecisionLaneBrand /><div className="dl-landing-actions"><ThemeToggle /><Button asChild size="pill"><Link href="/sign-in">Get started</Link></Button></div></header>
        <main id="main-content">
            <section className="dl-landing-hero">
                <h1>Decisions,<br />made clearer.</h1>
                <p>Turn evidence, policy, and human judgment into a confident path forward.</p>
                <DecisionLaneFlowArt />
            </section>
            <section className="dl-features" aria-label="How DecisionLane works">
                {FEATURES.map((feature) => <article className="dl-feature" key={feature.title}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{feature.icon}</svg>
                    <div><h2>{feature.title}</h2><p>{feature.description}</p></div>
                </article>)}
            </section>
            <section className="dl-demo" aria-label="DecisionLane product preview">
                <aside className="dl-demo-cases"><h2>Cases</h2><span className="dl-badge" data-variant="accent">CLA-10457</span><p>Benefit eligibility</p><p>CLA-10456</p><p>CLA-10455</p></aside>
                <div className="dl-demo-detail">
                    <h2>CLA-10457</h2><p className="dl-demo-muted">Benefit eligibility</p>
                    <article className="dl-demo-suggestion"><span>✦ AI suggestion</span><h3>Approve</h3><p>Meets eligibility criteria under current policy.</p></article>
                    <div className="dl-demo-metrics">
                        {[ ["Eligibility", "92%", "✓"], ["Policy fit", "85%", "▤"], ["Risk", "Low", "i"] ].map(([label, value, icon]) => <div className="dl-demo-metric" key={label}><span aria-hidden="true">{icon}</span><div>{label}<strong>{value}</strong></div></div>)}
                    </div>
                    <p className="dl-demo-citations"><strong>Policy citations</strong><br />Policy 3.2.1 - Benefit eligibility criteria<br />Policy 4.1.4 - Approval conditions</p>
                    <div className="dl-demo-action"><Button asChild><Link href="/sign-in">Human review required</Link></Button></div>
                </div>
            </section>
            <section className="dl-quote"><blockquote>Aim for collaboration,<br />not supervision.</blockquote><p>Don Norman · The Human Side of Automation, 2014</p></section>
        </main>
        <footer className="dl-landing-footer"><DecisionLaneBrand /><span>© 2026 DecisionLane</span></footer>
    </div>;
}
