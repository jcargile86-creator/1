# Roadmap: InspectPro

**Created:** 2026-07-05
**Phases:** 5 (v1)

## Phase 1 — Foundation: data model, carrier flow engine, section navigation
**Requirements:** INSP-01..04, FLOW-01..03
**Goal:** App scaffold (Expo + TypeScript), local persistence, the default Patriot/Allstate
flow encoded as data, inspection creation, and the section grid where an inspector can enter
any section.
**Done when:** Create an inspection, see all sections with progress, data survives app restart.

## Phase 2 — Guided camera capture
**Requirements:** CAM-01..05
**Goal:** Persistent camera with next-shot label overlay, auto-advance, skip/back/retake,
extra photos with editable captions, timestamp + section/prompt tagging, repeatable sub-flows
(rooms, slopes, facets).
**Done when:** A full section can be shot hands-on-camera without leaving the viewfinder.

## Phase 3 — Questions, notes & diagrams
**Requirements:** QNA-01..03
**Goal:** Question sets rendered from flow config (general, per-slope conditions, subrogation,
roof data), notes everywhere, sketch canvas for diagrams attached to the report.
**Done when:** Wrap-up section completable entirely in-app.

## Phase 4 — PDF report generation
**Requirements:** RPT-01..02
**Goal:** Offline HTML→PDF matching the Patriot template (cover, summary, roof assessment form,
questions, interior findings, 2-photo sheets, subrogation/closing) with share sheet.
**Done when:** Generated PDF is visually faithful to docs/templates/patriot-inspection-report-template.pdf.

## Phase 5 — XactAnalysis export layer
**Requirements:** XACT-01
**Goal:** Adapter mapping inspection → XactAnalysis payload (documents, photos, notes),
transport stubbed; wire real API when credentials/docs arrive.
**Done when:** Export produces a validated payload + attachment manifest ready for the real API.

---
*Last updated: 2026-07-05 after roadmap creation*
