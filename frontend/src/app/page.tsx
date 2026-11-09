import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export default function HomePage() { return <AppShell><section className="surface welcome"><p className="eyebrow">YOUR RESOLUTION WORKSPACE</p><h1 className="page-title">Every claim. A clear next step.</h1><p className="page-subtitle">Track your refund request and the evidence behind each decision.</p><Link className="button" href="/claims">View claims</Link></section></AppShell>; }
