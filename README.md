# MetricMech

Free engineering reference site for manufacturing quality and production engineers.
Calculators · Standards · GD&T · Articles · Templates.

Cross-promotes CadNexa (https://cadnexa.com).

## Stack
Static HTML / CSS / JS. No build step. Deploys to Vercel.

## Live calculators (32)
Tolerance Stack-Up, Cp/Cpk, CadNexa ROI, COPQ, Surface Finish,
Position Tolerance, ISO 286 Fits, Cycle Time/Cost, AS9102 Form 3,
PPAP Checklist, Thread Pitch, Bend Allowance/K-factor,
Speeds & Feeds, OEE, Gauge R&R Type 1, Hardness Conversion,
Spur Gear, Engineering Unit Converter, AQL Sampling, Beam Deflection,
Bolt Torque, DPMO/Sigma, EOQ, FMEA-RPN, Takt Time, V-Belt Drive,
Welding Heat Input, Material Weight, Drill Size Chart,
Motor HP/Power, Pump Power, Press/Interference Fit.

## Final-Stage upgrades (Apr 2026)
- Unified SVG capability chart (Freedman-Diaconis bins, smooth bell, USL/LSL labeled, color-coded zones)
- Structured PDF engineering report (Inputs → Result → Interpretation → Visualization)
- Hero with urgency badge + branded CTA
- Tier-aware CTA (good / marginal / critical) and Continue Analysis chips
- 32/32 calculators with 340–537 word SEO content blocks

## Elite-Stage upgrades (May 2026)
- **Decision confidence**: sample-size-driven confidence % displayed on verdict pill (chart + PDF)
- **What-if simulator**: live sliders for mean shift and σ scaling — Cp/Cpk and Δ recalc instantly
- **Data quality warnings**: low n, range/σ outliers, off-center process, gauge ratio < 6× — auto-detected
- **Audit-ready PDF**: unique report ID (e.g. `MM-MONQPM04-UDGH`), date, time, source, footer ID echo
- **Smart CTA logic**: 3-tier branched (Generate FAI / Strengthen / Fix in CadNexa)
- **Workflow chips**: tier-aware Continue Analysis (Submit / Tighten / Root-cause)
- **Save & compare**: localStorage-backed study history with Δ vs current run
- **Tool relationship system**: every calculator links to related tools (already deployed)
- **Authority signals**: "Standards-aligned · Used in real manufacturing · Audit-ready output" cards
- **Beginner / Expert mode**: persistent toggle hides/shows formulas + stat tables
- **Performance**: 120ms input debounce on data paste; SVG chart pre-sized; PDF JPEG-compressed (28 MB → 380 KB)

## CadNexa funnel
Every calculator and article has at least one topic-matched CadNexa CTA.
Sticky scroll CTA appears after 45 seconds OR 60% scroll, dismissable per session.
