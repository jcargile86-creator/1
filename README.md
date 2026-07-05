# InspectPro — Home Inspection App for Insurance Claims

Mobile app (Expo / React Native) that guides field inspectors through carrier-specific
photo/data capture and turns the inspection into a branded PDF report matching the Patriot
Claims template. Built with the [GSD](https://github.com/gsd-build/get-shit-done) spec-driven
workflow — planning lives in `.planning/`, and the `/gsd-*` Claude Code commands are installed
in `.claude/`.

## How it works for the inspector

1. **Create an inspection** — claim number, insured, address, carrier flow.
2. **Sections grid** — Arrival, Interior, Lower Elevations (F/L/B/R), Roof Eave, Roof
   Overview & Components, Test Squares, Wind & Tree Impact, Questions & Wrap-Up. Tap any
   section to start there; progress shows per tile.
3. **Guided camera** — opens with the next shot's label at the top (e.g. *"Front Slope Test
   Square Q4"*) plus a protocol hint, auto-advances after each capture, and **stays open until
   you tap ✕**. Skip/back/extra-shot/detail-caption controls are glove-friendly.
4. **Questions, notes & diagrams** — flow-defined question sets (general, roof data, per-room
   findings, subrogation), free notes per section, and a finger-sketch diagram pad.
5. **Generate PDF Report** — offline, matching the Patriot template (cover → summary → roof
   assessment → questions → interior findings → diagrams → 2-photo sheets → subrogation).
6. **XactAnalysis export** — adapter builds the payload today; real transport plugs in when
   API credentials arrive (`app/src/services/xact/`).

## Repo layout

| Path | What |
|------|------|
| `app/` | Expo app (TypeScript) |
| `app/src/flows/patriot-allstate.ts` | **Default carrier flow as data** — sections, prompts, hints, question sets |
| `app/src/screens/CameraScreen.tsx` | Persistent guided camera |
| `app/src/report/` | HTML → PDF report generator |
| `app/src/services/xact/` | XactAnalysis adapter + stubbed transport |
| `docs/source/default-flow-spec.md` | Distilled inspection flow from training transcripts |
| `docs/source/report-template-structure.md` | PDF template page-by-page analysis |
| `docs/templates/` | Patriot Claims report template PDF |
| `.planning/` | GSD project docs (PROJECT, REQUIREMENTS, ROADMAP, STATE) |

## Run it

```bash
cd app
npm install
npx expo start        # scan QR with Expo Go (camera requires a real device)
```

Adding a carrier: copy `app/src/flows/patriot-allstate.ts`, adjust sections/prompts/questions,
register it in `app/src/flows/index.ts`. No other code changes needed.
