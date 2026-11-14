import Link from "next/link";

export function DecisionLaneBrand() {
    return <Link href="/" className="dl-brand" aria-label="Decision Lane home">
        <svg viewBox="0 0 70 42" aria-hidden="true" fill="none">
            <path d="M2 25h18c8 0 11-8 17-14 3-3 6-4 11-4h18" strokeWidth="3.3" strokeLinecap="round" />
            <path d="M2 25h20c8 0 11 8 17 12 3 2 7 2 12 2h15" strokeWidth="4.6" strokeLinecap="round" />
        </svg>
        <span>Decision Lane</span>
    </Link>;
}

export function DecisionLaneFlowArt() {
    return <svg className="dl-flow-art" viewBox="0 0 1200 390" preserveAspectRatio="none" aria-hidden="true" fill="none">
        <path className="main-path" d="M-15 340 C90 260 130 290 220 275 S310 220 380 225 S475 225 545 145 S625 180 700 130 S775 80 850 85 S935 20 1030 30 S1140 20 1215 -50" strokeWidth="4" />
        {[[220, 275], [380, 225], [545, 145], [700, 130], [850, 85], [1030, 30]].map(([cx, cy]) => <circle className="node" key={`${cx}-${cy}`} cx={cx} cy={cy} r="10" strokeWidth="2" />)}
        <g className="branch" strokeWidth="1.2">
            <path d="M220 275C260 190 260 180 310 180" /><path d="M220 275C275 320 290 322 340 322" />
            <path d="M380 225C430 270 455 275 490 270" /><path d="M545 145C560 90 575 80 620 80" />
            <path d="M700 130C750 170 770 175 800 170" /><path d="M850 85C865 35 885 15 925 10" />
        </g>
        {[[310, 180], [340, 322], [490, 270], [620, 80], [800, 170], [925, 10]].map(([cx, cy]) => <circle className="branch-node" key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" strokeWidth="1.2" />)}
    </svg>;
}
