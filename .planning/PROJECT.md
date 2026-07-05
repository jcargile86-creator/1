# InspectPro — Home Inspection App for Insurance Claims

## What This Is

A mobile app for field inspectors performing insurance-claim home inspections (wind/hail, ladder assists, interior & exterior). It guides the inspector through a carrier-specific photo/data capture flow with a stay-open camera that shows what to shoot next, lets inspectors jump into any section to match their personal workflow, and turns the captured photos, measurements, questions, notes, and diagrams into a branded PDF inspection report matching the Patriot Claims template.

## Core Value

Make the inspection effortless for the inspector: open the camera, follow the labels, and the report builds itself.

## Business Context

- **Customer**: Field inspectors (Patriot Claims-style ladder assist / vendor photo appointment vendors) working claims for carriers like Allstate.
- **Revenue model**: Internal tooling — saves inspector time per claim and reduces desk-adjuster rework.
- **Success metric**: Time from arrival on site to submitted, review-ready PDF report.
- **Strategy notes**: Carrier flows are pluggable; default flow is the Patriot/Allstate protocol from training transcripts.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Guided camera capture with next-shot labels, persistent until dismissed
- [ ] Section-based inspection structure — start anywhere
- [ ] Default Patriot/Allstate flow encoded as data (carrier flows swappable)
- [ ] Questions section with notes and diagram/sketch support
- [ ] PDF report generation matching the Patriot Claims template
- [ ] XactAnalysis-ready export layer (transport stubbed until API credentials arrive)

### Out of Scope

- Xactimate estimate writing — the app documents; estimating stays at the desk.
- AR measurement (Sketch AR equivalent) — inspectors keep using Xactimate mobile's AR; app accepts screenshots/diagrams instead.
- Desk-adjuster review portal — v1 is inspector-side only.
- Offline map/weather integrations — not core to capture-to-report loop.

## Context

- Default flow derived from Patriot Claims Certified Inspector course transcripts (lower elevations/siding, roof inspections parts 1–3, ladder assists) — distilled in `docs/source/default-flow-spec.md`.
- Report format derived from a real 60-page Patriot Claims report (`docs/templates/patriot-inspection-report-template.pdf`) — structure documented in `docs/source/report-template-structure.md`.
- Photo labels follow the ALDD convention: Area, Location, Description, Detail — with condition adjectives and measurements in captions.
- Inspections happen on roofs in bright sun with gloves: UI must be large-touch-target, high-contrast, one-handed where possible.
- Photos are timestamped (burned into the report) and tagged to the section/prompt that captured them.

## Constraints

- **Tech stack**: Expo (React Native) + TypeScript — single codebase for iOS/Android, first-class camera, print-to-PDF via HTML templates.
- **Offline-first**: Rural loss sites often lack signal — all capture and PDF generation must work offline; sync/export when connected.
- **Integrations**: XactAnalysis API details not yet available — integration must be an adapter with a stubbed transport.
- **Branding**: Report must visually match Patriot Claims template (navy #1b1f4e, red accents, logo placeholders).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo React Native over native Swift/Kotlin | One codebase, expo-camera + expo-print cover core needs | — Pending |
| Carrier flow as JSON/TS data, not code | Each carrier differs; new flows without app releases | — Pending |
| PDF via HTML template + expo-print | Fastest path to pixel-close match of the Patriot template, offline-capable | — Pending |
| Local-first storage (SQLite + FileSystem) | Offline requirement; sync is a later phase | — Pending |
| Xact integration behind adapter interface | API credentials/docs pending from user | — Pending |

---
*Last updated: 2026-07-05 after project initialization*
