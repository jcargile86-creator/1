# Requirements: InspectPro

**Defined:** 2026-07-05
**Core Value:** Make the inspection effortless for the inspector: open the camera, follow the labels, and the report builds itself.

## v1 Requirements

### Inspections

- [ ] **INSP-01**: Inspector can create an inspection with claim number, insured, loss address, carrier, adjuster, inspection type, date of loss, structure type, stories
- [ ] **INSP-02**: Inspection is divided into sections (Arrival, Interior, Elevations F/L/B/R, Roof Eave, Roof Components, Test Squares, Wind, Questions & Wrap-Up) shown as a tappable grid with per-section progress
- [ ] **INSP-03**: Inspector can start capture from any section, in any order
- [ ] **INSP-04**: All data and photos persist locally, offline

### Guided Camera

- [ ] **CAM-01**: Starting an inspection (or tapping a section) opens the camera with the next photo prompt/label displayed at the top
- [ ] **CAM-02**: Camera stays open, auto-advancing to the next prompt after each capture, until the inspector explicitly exits
- [ ] **CAM-03**: Inspector can skip a prompt, go back, or retake
- [ ] **CAM-04**: Inspector can add extra unprompted photos with editable ALDD-style captions and append measurements/condition adjectives
- [ ] **CAM-05**: Photos are timestamped and tagged with section + prompt label

### Carrier Flows

- [ ] **FLOW-01**: Default Patriot/Allstate wind-hail flow encoded as data per docs/source/default-flow-spec.md
- [ ] **FLOW-02**: Flow definition is carrier-pluggable (sections, prompts, questions swappable without code changes)
- [ ] **FLOW-03**: Repeatable sub-flows supported (per-room interior, per-slope test squares, per-facet wind)

### Questions, Notes & Diagrams

- [ ] **QNA-01**: Questions section renders the flow's question sets (general, shingle conditions per slope, subrogation, roof data)
- [ ] **QNA-02**: Inspector can attach free-text notes to any section and the overall inspection
- [ ] **QNA-03**: Inspector can draw simple diagrams (finger/stylus sketch with labels) and attach them to the inspection

### Report

- [ ] **RPT-01**: Generate a PDF matching the Patriot template: cover, inspection summary, roof assessment form, general questions, interior findings sheets, photo sheets (2/page, timestamped, labeled), subrogation + closing
- [ ] **RPT-02**: PDF generation works offline and can be shared (email/airdrop/files)

### XactAnalysis

- [ ] **XACT-01**: Export layer maps a completed inspection to an XactAnalysis-ready payload behind an adapter interface with a stubbed transport (real API wiring when credentials arrive)

## v2 Requirements

### Sync & Team

- **SYNC-01**: Cloud backup/sync of inspections
- **SYNC-02**: Claim assignment inbox (pull claims from dispatch)

### Capture Enhancements

- **CAP-01**: Quick-caption builder (structure/slope/damage/photo-type/distance chips)
- **CAP-02**: Text-replacement shortcuts library
- **CAP-03**: Voice-to-caption

### Report Enhancements

- **RPTV2-01**: Per-carrier report templates
- **RPTV2-02**: CAD sketch markup tool (aerial image annotation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Estimate writing (Xactimate) | Documentation app; estimating stays at the desk |
| AR measurement | Xactimate mobile Sketch AR already covers this; accept screenshots instead |
| Desk-adjuster portal | Inspector-side only for v1 |
| In-app claim scheduling/confirmation calls | Process handled via existing channels |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INSP-01..04 | Phase 1 | Pending |
| FLOW-01..03 | Phase 1 | Pending |
| CAM-01..05 | Phase 2 | Pending |
| QNA-01..03 | Phase 3 | Pending |
| RPT-01..02 | Phase 4 | Pending |
| XACT-01 | Phase 5 | Pending |

**Coverage:** v1 requirements: 18 total — mapped: 18 — unmapped: 0 ✓

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 after initial definition*
