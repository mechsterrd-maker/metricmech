# MetricMech

Free engineering reference site for manufacturing quality and production engineers.
Calculators · Standards · GD&T · Articles · Templates.

Cross-promotes CadNexa (https://cadnexa.com).

## Links
- **Live site: [metricmech.com](https://metricmech.com)**
- Calculators: <https://metricmech.com/calculators>
- Articles: <https://metricmech.com/articles>
- Companion tool — auto-ballooning & FAI reports: **[CadNexa](https://cadnexa.com)**

## Forum

Ask-and-answer forum at [metricmech.com/forum](https://metricmech.com/forum), backed by
Supabase (`forum_*` tables in the shared `loglinkr` project). Google + email-link sign-in,
voting, accepted answers, curated topics, reputation, and nightly static pre-rendering with
QAPage schema for SEO.

**Two dashboard steps are required before sign-in works — see [FORUM.md](FORUM.md).**

## Stack
Static HTML / CSS / JS. No build step. Deploys to Vercel.

## Live calculators (40)
Tolerance Stack-Up, Cp/Cpk, CadNexa ROI, COPQ, Surface Finish,
Position Tolerance, ISO 286 Fits, ISO 2768 General Tolerances,
Cycle Time/Cost, AS9102 Form 3, PPAP Checklist, Thread Pitch,
Bend Allowance/K-factor, Sheet Metal Gauge Chart,
Speeds & Feeds, OEE, Gauge R&R Type 1, Hardness Conversion,
Spur Gear, Engineering Unit Converter, AQL Sampling, Beam Deflection,
Bolt Torque, DPMO/Sigma, EOQ, FMEA-RPN, Takt Time, V-Belt Drive,
Welding Heat Input, Material Weight, Drill Size Chart,
Motor HP/Power, Pump Power, Press/Interference Fit,
Cylinder Force, Compression Spring, Bearing Life (L10), O-Ring Groove Design.

## Final-Stage upgrades (Apr 2026)
- Unified SVG capability chart (Freedman-Diaconis bins, smooth bell, USL/LSL labeled, color-coded zones)
- Structured PDF engineering report (Inputs → Result → Interpretation → Visualization)
- Hero with urgency badge + branded CTA
- Tier-aware CTA (good / marginal / critical) and Continue Analysis chips
- 34/34 calculators with 340–537 word SEO content blocks

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

## Aug 2026 — design & reference expansion (+6)
Six calculators added targeting high-volume mechanical-engineering search that the
quality/APQP-weighted original set did not cover:
`iso-2768` (general tolerances, 2768-1 + 2768-2), `cylinder-force` (hydraulic/pneumatic
force, speed, flow, rod buckling), `spring-calculator` (rate, Wahl stress, solid height),
`bearing-life` (ISO 281 L10/L10h), `oring-groove` (squeeze, gland fill, extrusion gap),
`sheet-metal-gauge` (gauge charts for steel/galv/stainless/aluminium).

## CadNexa funnel
Every calculator and article has at least one topic-matched CadNexa CTA.
Sticky scroll CTA appears after 45 seconds OR 60% scroll, dismissable per session.
