# MetricMech Visual Upgrade — Verdict UI + Shared Design System

**Date:** 2 July 2026 · **Scope:** 107 HTML pages, net −1,268 lines (1,100 added / 2,368 duplicated removed)
**Untouched by design:** all formulas, calculation thresholds, SEO text, `<title>`/meta tags, JSON-LD schema, GA4 (G-SQ0H6965Z1), internal links. Verified per-file against git HEAD.

## Phase 1 — Shared design system

- **New [`assets/mm.css`](assets/mm.css)** (21 KB): `--mm-*` token palette on the Blueprint theme, plus reusable components — `.mm-card`, `.mm-btn`, `.mm-input` (44 px targets, focus ring), `.mm-verdict` (`.pass`/`.marginal`/`.fail`/`.info`), `.mm-badge`, `.mm-collapse`, `.mm-sticky-result`, `.mm-tablewrap` (scroll + edge fade), `.mm-card-icon`; blueprint grid as `body.mm-grid`; extended print stylesheet (results + inputs + site-URL footer only).
- **New [`assets/mm.js`](assets/mm.js)** (28 KB): `mmVerdict`, `mmCountUp` (400 ms, final value written synchronously so same-tick readers never see stale numbers; respects `prefers-reduced-motion`), `mmCopy`, `mmDebounce`, `mmCollapse`, and the `mmViz` SVG kit — `bell`, `gauge`, `scaleBar`, `compareBars`, `stack`, `fitDiagram`, `flowBar`, `sfBar`. All viewBox-responsive, Blueprint palette, labels ≥12 px, no libraries.
- **Automatic behaviors** (zero per-page code): `mmInterpret.render` is wrapped so each page's own verdict payload also renders the top banner + mobile sticky bar; debounced (150 ms) live recalc re-fires each control's existing handler on `input` (Calculate buttons remain as no-JS fallback); copy button on every `.result-big`; SEO/theory sections auto-wrapped in collapsibles (open ≥768 px, collapsed below — content never removed, and fully visible with JS disabled); wide tables auto-wrapped in scroll containers.
- **De-duplication:** removed the byte-identical inline `<style>` blocks from 47 article pages (3.7 KB each), 32 calculator pages (884 B), 4 reference pages (3.2 KB) — all now served once from mm.css. Every page links mm.css/mm.js.

## Phase 2 — Verdict UI on all 34 calculators

Every calculator now renders, in order: color-coded verdict banner (plain-English action sentence, driven by each page's **pre-existing** threshold logic), count-up headline number with copy button, a live inline-SVG visual fed by the already-computed values, then the secondary metrics grid, with theory/SEO below in collapsibles.

Visual per calculator (highlights): Cp/Cpk kept its existing capability chart; gauge-rr → %GRR zone dial (10/30 boundaries); tolerance-stack → contribution bars w/ WC-RSS markers; iso-286-fits kept its zone visualizer; press-fit → yield safety-factor bar; surface-finish → log Ra scale (mirror→rough); aql-sampling → lot→n→Ac/Re flow; oee → A/P/Q/OEE bars; dpmo-sigma → sigma scale; fmea-rpn & ppap → zone gauges; beam-deflection → deflection vs L/500–L/250; bolt-torque → preload/yield/break force ladder; forms 1–3 → completeness banners (+ pass/fail flow on Form 3). Unit-converter and drill-size-chart get neutral banners only (nothing honest to plot).

**Bug fixes required to make verdicts live** (DOM reads only — no threshold/wording changes): interpretation blocks on iso-286-fits, press-fit, v-belt, copq, hardness-conversion read element IDs that never existed (`#clrMin`, `#safetyFactor`, `#beltLen`, `#totalCopq`, `#hbOut`); corrected to the real IDs so the already-authored verdict logic executes. motor-hp's torque mode had no verdict path — added an informational banner from its computed values.

## Phase 3 — Homepage + listings

- 35 calculator cards on [calculators.html](calculators.html) each carry an inline line-style SVG icon (1.5 px stroke, blue, per-tool shapes) with hover lift + blue border shift.
- "Instant verdict" badge + pass/marginal/fail dot legend advertise the new UX on both index and calculators listing.
- Index hierarchy reordered per spec: hero → most-used calculators → modules → standards → templates → articles.
- 4 index cards that pointed at the generic listing now link to their dedicated pages (ISO 286, material-weight, gauge-rr, aql-sampling). Added the two missing AS9102 Form 1/2 cards.
- Tool count unified to the real page count **34** in all visible copy (index, calculators, about); filter chips now reflect true card counts (All 35 incl. the GD&T shortcut card; Quality 17). Head meta/schema left untouched per constraints.

## Phase 4 — Mobile

- `inputmode="decimal"` + `autocomplete="off"` baked into 132 number inputs across 27 pages (mm.js also patches dynamically-built inputs). No placeholder-only labels found.
- 44 px touch targets for all calculator inputs/selects/buttons (≤767 px).
- Sticky bottom verdict bar on <768 px: color dot + headline number, tap scrolls to results, auto-hides when results are on screen.
- Tables scroll horizontally with edge-fade masks instead of breaking layout.
- **360 px sweep of all 107 pages: zero horizontal overflow.** Fixed: grid children `min-width:auto` blowing out columns containing tables; `.std-grid`/`.article-grid`/`.search-row`/`.summary-stats-row` lacking mobile rules; 4 px header bleed.

## Phase 5 — QA results

- JSON-LD parses on all 107 pages; `<head>` byte-identical to git HEAD everywhere except the single mm.css link (whitespace-normalized check).
- Spot checks: Cpk logic verified (verdict tiers at the page's own 1.33/1.00 cutoffs); DPMO 120/(10 000×5)→2 400, σ 4.32 ✓; OEE 87.5×83.3×95 → 69.3 % ✓; bolt-torque μ 0.14→0.20 live-recalcs 30.8→42.4 N·m ✓.
- Verdict banner + SVG confirmed rendering on all 34 calculators (headless sweep).
- Internal link check: no new breakage. **Pre-existing** (in HEAD, left alone): `calculators/cp-cpk.html → control-chart.html`, `calculators/gauge-rr.html → measurement-uncertainty.html` point at pages that don't exist yet.
- Print stylesheet verified at CSS level (site chrome/CTAs/SEO hidden, results + inputs + metricmech.com footer shown); recommend one manual print-preview pass.
