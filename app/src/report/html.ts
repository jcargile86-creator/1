import { Inspection, PhotoRecord, answerKey, SKETCH_W, SKETCH_H } from '../types';
import { FlowDef, QuestionDef } from '../flows/types';
import { branding } from './branding';

/**
 * Builds the report HTML replicating the Patriot Claims template
 * (docs/source/report-template-structure.md): cover → inspection summary →
 * roof assessment → general questions → interior findings → diagrams →
 * photo sheets (2/page) → subrogation + closing.
 */

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fmtStamp = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export interface PhotoSource {
  /** photo id → data URI (or file URI) usable in <img src> */
  resolve: (photo: PhotoRecord) => string;
}

function ans(insp: Inspection, sectionId: string, qId: string, instance?: string): string {
  const v = insp.answers[answerKey(sectionId, qId, instance)];
  if (v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function headerBand(insp: Inspection): string {
  return `<div class="band">
    <div class="band-left"><b>Inspection Report</b><br/>Service Date: ${esc(fmtDate(insp.createdAt))}<br/>Claim Number: ${esc(insp.claim.claimNumber)}<br/>Insured: ${esc(insp.claim.insured)}</div>
    <div class="band-center"><div class="logo">${esc(branding.company)}</div></div>
    <div class="band-right"><b>Corporate Office:</b><br/>${branding.addressLines.map(esc).join('<br/>')}<br/>${esc(branding.phone)}<br/>${esc(branding.email)}</div>
  </div>`;
}

function footerBand(insp: Inspection, pageNo: number): string {
  return `<div class="foot">
    <div>Claim Number: ${esc(insp.claim.claimNumber)}<br/>Inspection Type: ${esc(insp.claim.inspectionType)}</div>
    <div class="foot-page">~ ${pageNo} ~</div>
  </div>`;
}

function page(insp: Inspection, pageNo: number, body: string): string {
  return `<div class="page">${headerBand(insp)}<div class="content">${body}</div>${footerBand(insp, pageNo)}</div>`;
}

function coverPage(insp: Inspection, coverImg: string | null): string {
  return `<div class="page cover">
    <div class="cover-topband"></div>
    <div class="cover-body">
      <div class="logo-big">${esc(branding.company)}</div>
      <div class="tagline">${esc(branding.tagline)}</div>
      <h1>INSPECTION REPORT</h1>
      ${coverImg ? `<img class="cover-photo" src="${coverImg}"/>` : ''}
      <table class="cover-claim">
        <tr><td class="k">CLAIM NUMBER:</td><td>${esc(insp.claim.claimNumber)}</td></tr>
        <tr><td class="k">INSURED:</td><td>${esc(insp.claim.insured)}</td></tr>
        <tr><td class="k">LOSS ADDRESS:</td><td>${esc(insp.claim.lossAddress)}</td></tr>
      </table>
      <p class="prepared">PROFESSIONALLY PREPARED BY ${esc(branding.company.toUpperCase())}<br/>${esc(fmtDate(insp.createdAt))}<br/>${esc(insp.claim.inspector)}, INSPECTOR</p>
    </div>
    <div class="cover-botband">${esc(branding.website)}<br/>${esc(branding.phone)}</div>
  </div>`;
}

function summaryPage(insp: Inspection, pageNo: number): string {
  const c = insp.claim;
  const body = `
    <h2>INSPECTION SUMMARY</h2>
    <table class="grid">
      <tr><th>CLAIM NUMBER</th><th>INSPECTION DATE</th><th>INSPECTION TYPE</th><th>DATE OF LOSS</th></tr>
      <tr><td>${esc(c.claimNumber)}</td><td>${esc(new Date(insp.createdAt).toLocaleDateString('en-US'))}</td><td>${esc(c.inspectionType)}</td><td>${esc(c.dateOfLoss)}</td></tr>
      <tr><th>INSURED</th><th>LOSS ADDRESS</th><th>STRUCTURE TYPE</th><th>STORIES</th></tr>
      <tr><td>${esc(c.insured)}</td><td>${esc(c.lossAddress)}</td><td>${esc(c.structureType)}</td><td>${esc(c.stories)}</td></tr>
      <tr><th>CARRIER</th><th>ADJUSTER</th><th>INSPECTOR</th><th>INSPECTOR CONTACT</th></tr>
      <tr><td>${esc(c.carrier)}</td><td>${esc(c.adjuster)}</td><td>${esc(c.inspector)}</td><td>${esc(c.inspectorContact)}</td></tr>
      <tr><th colspan="4">OTHER STRUCTURES</th></tr>
      <tr><td colspan="4">${esc(c.otherStructures)}</td></tr>
    </table>
    <h3>INSPECTOR SUMMARY:</h3><div class="notebox">${esc(ans(insp, 'wrapup', 'inspectorSummary'))}</div>
    <h3>LOWER ELEVATIONS:</h3><div class="notebox">${esc(ans(insp, 'wrapup', 'lowerElevationsNote') || insp.notes['elevations'] || '')}</div>
    <h3>ROOF:</h3><div class="notebox">${esc(ans(insp, 'wrapup', 'roofNote') || insp.notes['roof-overview'] || '')}</div>`;
  return page(insp, pageNo, body);
}

function roofAssessmentPage(insp: Inspection, flow: FlowDef, pageNo: number): string {
  const slopes = insp.instances['test-squares'] ?? ['Front', 'Left', 'Back', 'Right'];
  const facets = insp.instances['wind'] ?? [];
  const tsRows = slopes
    .map((s) => {
      const size = ans(insp, 'test-squares', 'tsSize', s) || '—';
      const hail = ans(insp, 'test-squares', 'hailCount', s) || '0';
      const windForSlope = facets
        .filter((f) => f.toLowerCase().startsWith(s[0].toLowerCase()))
        .reduce((sum, f) => sum + (Number(ans(insp, 'wind', 'windCount', f)) || 0), 0);
      return `<tr><td>${esc(s[0])}:</td><td>${esc(size)}</td><td>Count: ${esc(hail)}</td><td>Count: ${windForSlope}</td></tr>`;
    })
    .join('');

  const conds: [string, string][] = [
    ['Blisters', 'condBlisters'], ['Cup Curl', 'condCupCurl'], ['Deck Rot', 'condDeckRot'],
    ['Granule Loss', 'condGranuleLoss'], ['Manufacturer Defects', 'condMfrDefects'], ['Mechanical', 'condMechanical'],
    ['Nail Pops', 'condNailPops'], ['Prior Repairs', 'condPriorRepairs'], ['Thermal Cracking', 'condThermalCracking'],
  ];
  const condRows = conds
    .map(([label, qid]) => {
      const v = ans(insp, 'wrapup', qid).toUpperCase();
      const cell = (dir: string) => (v.includes(dir) || v.includes('ALL') ? '✓' : '');
      return `<tr><td class="k">${label}</td><td>${cell('F')}</td><td>${cell('L')}</td><td>${cell('B')}</td><td>${cell('R')}</td></tr>`;
    })
    .join('');

  const elevs = insp.instances['elevations'] ?? [];
  const gutterRows = elevs
    .map((e) => `<tr><td class="k">${esc(e[0])}:</td><td>${esc(ans(insp, 'elevations', 'gutters', e) || '—')}</td><td>${esc(ans(insp, 'elevations', 'downspouts', e) || '—')}</td></tr>`)
    .join('');

  const body = `
    <h2>ROOF ASSESSMENT</h2>
    <table class="grid halves">
      <tr><th>ROOF TYPE</th><th>WHO WAS ON THE ROOF</th></tr>
      <tr><td>${esc(ans(insp, 'roof-overview', 'mainMaterial'))} — ${esc(ans(insp, 'roof-overview', 'roofType'))}<br/>
      Estimated Age: ${esc(ans(insp, 'roof-overview', 'roofAge'))} · Predom Pitch: ${esc(ans(insp, 'roof-eave', 'predomPitch'))}<br/>
      Stories: ${esc(ans(insp, 'roof-overview', 'stories'))} · Layers: ${esc(ans(insp, 'roof-eave', 'layers'))} (${esc(ans(insp, 'roof-eave', 'layerType') || 'N/A')})</td>
      <td>${esc(ans(insp, 'arrival', 'whoOnRoof'))}<br/>Aerial Measurements: ${esc(ans(insp, 'roof-overview', 'aerialMeasurements'))}<br/>Front of House Direction: ${esc(ans(insp, 'arrival', 'frontDirection'))}</td></tr>
      <tr><th>RIDGE / HIP / VALLEY</th><th>RIDGE VENT</th></tr>
      <tr><td>Ridge: ${esc(ans(insp, 'roof-overview', 'ridgeMaterial'))} · Hips: ${esc(ans(insp, 'roof-overview', 'hipMaterial'))} · Valley: ${esc(ans(insp, 'roof-overview', 'valleyType'))}</td>
      <td>${esc(ans(insp, 'roof-overview', 'ridgeVentLF'))} LF total</td></tr>
    </table>
    <table class="grid">
      <tr><th>SLOPE</th><th>TEST SQUARE SIZE</th><th>POTENTIAL HAIL</th><th>POTENTIAL WIND</th></tr>
      ${tsRows}
    </table>
    <div class="cols">
      <table class="grid"><tr><th class="k">ROOF CONDITIONS</th><th>F</th><th>L</th><th>B</th><th>R</th></tr>${condRows}</table>
      <table class="grid"><tr><th>ELEV</th><th>GUTTER</th><th>DOWNSPOUT</th></tr>${gutterRows || '<tr><td colspan="3">—</td></tr>'}</table>
    </div>
    <h3>ROOF COMPONENTS</h3>
    <div class="notebox">
      <b>Eave Depth</b> - ${esc(ans(insp, 'roof-eave', 'eaveDepth'))} Inches<br/>
      <b>Drip Edge</b> - Material: ${esc(ans(insp, 'roof-eave', 'dripEdgeMaterial'))} - Painted: ${esc(ans(insp, 'roof-eave', 'dripEdgePainted'))} - Locations: ${esc(ans(insp, 'roof-eave', 'dripEdgeLocations'))} - Gutter through drip edge: ${esc(ans(insp, 'roof-eave', 'gutterThroughDrip'))}<br/>
      <b>Underlayment</b> - ${esc(ans(insp, 'roof-eave', 'underlaymentType'))} - Layer Count: ${esc(ans(insp, 'roof-eave', 'layers'))}<br/>
      <b>Ice & Water Shield</b> - ${esc(ans(insp, 'roof-eave', 'iceWaterShield'))}
    </div>`;
  return page(insp, pageNo, body);
}

function questionsPage(insp: Inspection, pageNo: number): string {
  const rows: [string, string][] = [
    ['Was the named insured home?', ans(insp, 'arrival', 'insuredPresent')],
    ['Did you get on the roof?', ans(insp, 'wrapup', 'gotOnRoof')],
    ['Did the roof have potential hail or wind damage?', ans(insp, 'wrapup', 'potentialDamage')],
    ['Is potential collateral damage consistent with report?', ans(insp, 'wrapup', 'collateralConsistent')],
  ];
  const matching = [
    ['Roof age range (matching states)', ans(insp, 'wrapup', 'matchingAgeRange')],
    ['Facets uniform in appearance prior to loss?', ans(insp, 'wrapup', 'matchingUniform')],
  ].filter(([, v]) => v);
  const body = `
    <h2>General Inspection Questions</h2>
    <table class="qtable">${rows.map(([q, a]) => `<tr><td>${esc(q)}</td><td class="ans">${esc(a || '—')}</td></tr>`).join('')}</table>
    ${matching.length ? `<h2 style="margin-top:24px">Matching States</h2><table class="qtable">${matching.map(([q, a]) => `<tr><td>${esc(q)}</td><td class="ans">${esc(a)}</td></tr>`).join('')}</table>` : ''}`;
  return page(insp, pageNo, body);
}

function interiorPages(insp: Inspection, flow: FlowDef, startPage: number): { html: string; nextPage: number } {
  const rooms = insp.instances['interior'] ?? [];
  const section = flow.sections.find((s) => s.id === 'interior');
  if (!rooms.length || !section) return { html: '', nextPage: startPage };
  let pageNo = startPage;
  const chunks: string[] = [];
  for (let i = 0; i < rooms.length; i += 3) {
    const body =
      `<h2>MAIN DWELLING INTERIOR FINDINGS SHEET</h2>` +
      rooms
        .slice(i, i + 3)
        .map((room) => {
          const q = (qid: string) => esc(ans(insp, 'interior', qid, room) || '');
          return `<table class="grid room">
          <tr><td class="k">Room Name:</td><td>${esc(room)}</td><td class="k">Perimeter:</td><td>${q('perimeter')}</td><td class="k">Baseboards</td><td>${q('baseboards')}</td></tr>
          <tr><td class="k">Ttl Ceiling SqFt:</td><td>${q('ttlCeilingSqFt')}</td><td class="k">Ttl Wall SqFt:</td><td>${q('ttlWallSqFt')}</td><td class="k">Crown Molding</td><td>${q('crownMolding')}</td></tr>
          <tr><td class="k">Ceiling Height:</td><td>${q('ceilingHeight')}</td><td class="k">Affected Ceiling SqFt:</td><td>${q('affCeilingSqFt')}</td><td class="k">Ceiling Fans</td><td>${q('ceilingFans')}</td></tr>
          <tr><td class="k">Affected Wall SqFt:</td><td>${q('affWallSqFt')}</td><td class="k">Vent / Light Count:</td><td>${q('ventCount') || q('lightCount') ? `${q('ventCount') || '—'} / ${q('lightCount') || '—'}` : ''}</td><td class="k">Wall Texture:</td><td>${q('wallTexture')}</td></tr>
          <tr><td class="k">Window Count:</td><td>${q('windowCount')}</td><td class="k">Smoke Detector:</td><td>${q('smokeDetector')}</td><td class="k">Ceiling Texture:</td><td>${q('ceilingTexture')}</td></tr>
          <tr><td class="k">Room Notes:</td><td colspan="5">${q('roomNotes')}</td></tr>
        </table>`;
        })
        .join('');
    chunks.push(page(insp, pageNo, body));
    pageNo += 1;
  }
  return { html: chunks.join(''), nextPage: pageNo };
}

function sketchPages(insp: Inspection, startPage: number): { html: string; nextPage: number } {
  if (!insp.sketches.length) return { html: '', nextPage: startPage };
  let pageNo = startPage;
  const chunks = insp.sketches.map((s) => {
    const body = `<h2>DIAGRAM — ${esc(s.name)}</h2>
      <svg class="sketch" viewBox="0 0 ${SKETCH_W} ${SKETCH_H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${SKETCH_W}" height="${SKETCH_H}" fill="white" stroke="#d7d9e0"/>
        ${s.paths.map((d) => `<path d="${esc(d)}" stroke="${branding.navy}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      </svg>`;
    const html = page(insp, pageNo, body);
    pageNo += 1;
    return html;
  });
  return { html: chunks.join(''), nextPage: pageNo };
}

function photoPages(insp: Inspection, flow: FlowDef, src: PhotoSource, startPage: number): { html: string; nextPage: number } {
  // Report order = flow order (photos within a prompt keep capture order).
  const order = new Map<string, number>();
  let n = 0;
  for (const s of flow.sections) {
    order.set(s.id, n);
    n += 1;
  }
  const photos = [...insp.photos].sort((a, b) => {
    const sa = order.get(a.sectionId) ?? 99;
    const sb = order.get(b.sectionId) ?? 99;
    if (sa !== sb) return sa - sb;
    return a.takenAt.localeCompare(b.takenAt);
  });
  if (!photos.length) return { html: '', nextPage: startPage };

  let pageNo = startPage;
  const chunks: string[] = [];
  for (let i = 0; i < photos.length; i += 2) {
    const pair = photos.slice(i, i + 2);
    const body =
      `<h2>INSPECTION PHOTO SHEET</h2>` +
      pair
        .map(
          (p) => `<div class="photo-row">
            <div class="photo-wrap"><img src="${src.resolve(p)}"/><div class="stamp">${esc(fmtStamp(p.takenAt))}</div></div>
            <div class="photo-label"><b>${esc(p.caption)}</b>${p.instance ? `<br/><span class="sub">${esc(flowNoun(flow, p.sectionId))}: ${esc(p.instance)}</span>` : ''}</div>
          </div>`,
        )
        .join('');
    chunks.push(page(insp, pageNo, body));
    pageNo += 1;
  }
  return { html: chunks.join(''), nextPage: pageNo };
}

function flowNoun(flow: FlowDef, sectionId: string): string {
  return flow.sections.find((s) => s.id === sectionId)?.repeat?.noun ?? 'Area';
}

function closingPage(insp: Inspection, pageNo: number): string {
  const subro: [string, string][] = [
    ['Improper nail/staple size', ans(insp, 'wrapup', 'subroNailSize')],
    ['Nail/staple not on nail line', ans(insp, 'wrapup', 'subroNailLine')],
    ['Improper fasteners installed', ans(insp, 'wrapup', 'subroFasteners')],
    ['Improper shingle exposure', ans(insp, 'wrapup', 'subroExposure')],
    ['Manufacturer defects', ans(insp, 'wrapup', 'subroMfrDefects')],
  ];
  const body = `
    <h2>Subrogation Opportunities</h2>
    <table class="qtable">${subro.map(([q, a]) => `<tr><td>${esc(q)}</td><td class="ans">${esc(a || 'No')}</td></tr>`).join('')}</table>
    <div class="closing">
      <p>This Inspection Report has been proudly prepared by <b>${esc(branding.company)}.</b></p>
      <p class="office"><b>${esc(branding.company.toUpperCase())} CORPORATE OFFICE</b><br/>${branding.addressLines.map(esc).join('<br/>')}</p>
      <div class="phoneband">${esc(branding.phone)}</div>
      <p>${esc(branding.email)}</p>
      <p>REQUEST AN INSPECTION ON OUR WEBSITE AT <b><u>${esc(branding.website.toUpperCase())}</u></b></p>
      <div class="reqbtn">Request Inspection</div>
    </div>`;
  return page(insp, pageNo, body);
}

export function buildReportHtml(insp: Inspection, flow: FlowDef, src: PhotoSource): string {
  const coverPhoto = insp.photos.find((p) => p.promptId === 'front-of-house') ?? insp.photos[0] ?? null;
  let pageNo = 1;
  const summary = summaryPage(insp, pageNo++);
  const roof = roofAssessmentPage(insp, flow, pageNo++);
  const questions = questionsPage(insp, pageNo++);
  const interior = interiorPages(insp, flow, pageNo);
  pageNo = interior.nextPage;
  const sketches = sketchPages(insp, pageNo);
  pageNo = sketches.nextPage;
  const photos = photoPages(insp, flow, src, pageNo);
  pageNo = photos.nextPage;
  const closing = closingPage(insp, pageNo);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css()}</style></head><body>
    ${coverPage(insp, coverPhoto ? src.resolve(coverPhoto) : null)}
    ${summary}${roof}${questions}${interior.html}${sketches.html}${photos.html}${closing}
  </body></html>`;
}

function css(): string {
  const navy = branding.navy;
  const red = branding.red;
  return `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color:#22243a; font-size:11px; }
  .page { page-break-after: always; position: relative; min-height: 96vh; display:flex; flex-direction:column; }
  .band { display:flex; justify-content:space-between; align-items:center; background:${navy}; color:#fff; padding:10px 18px; font-size:9px; line-height:1.5; }
  .band-left b { font-size:12px; }
  .band-right { text-align:right; }
  .logo, .logo-big { font-weight:800; font-family: Georgia, 'Times New Roman', serif; }
  .logo { font-size:16px; }
  .content { flex:1; padding: 16px 22px; }
  .foot { display:flex; justify-content:space-between; align-items:center; background:${navy}; color:#fff; padding:10px 18px; font-size:10px; }
  .foot-page { background:#fff; color:${navy}; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; font-weight:700; }
  h1 { color:${navy}; font-size:22px; letter-spacing:1px; margin: 12px 0; }
  h2 { color:${navy}; font-size:13px; margin-bottom:8px; text-transform:uppercase; }
  h3 { color:${navy}; font-size:11px; margin:12px 0 4px; }
  .cover { text-align:center; }
  .cover-topband { background:${navy}; height:90px; }
  .cover-body { flex:1; padding:26px; }
  .logo-big { font-size:34px; color:${navy}; }
  .tagline { font-family: Georgia, serif; font-style: italic; color:${navy}; margin-bottom:10px; }
  .cover-photo { width:230px; height:300px; object-fit:cover; margin:8px auto; display:block; }
  .cover-claim { margin: 12px auto; font-size:11px; }
  .cover-claim .k { text-align:right; font-weight:700; padding-right:8px; }
  .prepared { margin-top:14px; font-size:11px; line-height:1.6; }
  .cover-botband { background:${navy}; color:#fff; padding:14px; font-size:11px; line-height:1.6; }
  table.grid { width:100%; border-collapse:collapse; margin-bottom:10px; }
  table.grid th { background:${navy}; color:#fff; font-size:9px; padding:5px; border:1px solid ${navy}; }
  table.grid td { border:1px solid #9aa; padding:5px; text-align:center; font-size:10px; }
  table.grid td.k { text-align:left; font-weight:600; }
  table.room { margin-bottom:14px; }
  table.room td { text-align:left; }
  .cols { display:flex; gap:10px; }
  .cols table { flex:1; }
  .notebox { border:1px solid #c3c6d4; border-radius:8px; padding:10px; min-height:52px; font-size:11px; line-height:1.5; margin-bottom:6px; white-space:pre-wrap; }
  table.qtable { width:100%; border-collapse:collapse; }
  table.qtable td { border:1px solid #c3c6d4; padding:7px 9px; font-size:11px; }
  table.qtable td.ans { width:60px; text-align:center; font-weight:700; }
  .photo-row { display:flex; align-items:flex-start; gap:16px; margin: 10px 0 18px; }
  .photo-wrap { position:relative; width:300px; }
  .photo-wrap img { width:300px; height:400px; object-fit:cover; display:block; }
  .stamp { position:absolute; left:6px; bottom:6px; background:rgba(0,0,0,0.65); color:#fff; font-size:10px; font-weight:700; padding:2px 6px; }
  .photo-label { flex:1; font-size:11px; padding-top:130px; }
  .photo-label .sub { color:#555; font-size:10px; }
  .sketch { width:58%; display:block; margin: 8px auto; }
  .closing { text-align:center; margin-top:60px; font-size:12px; line-height:1.7; }
  .closing .office { margin-top:18px; }
  .phoneband { background:${navy}; color:#fff; padding:4px; width:60%; margin:8px auto; font-size:10px; }
  .reqbtn { background:${red}; color:#fff; display:inline-block; padding:8px 18px; margin-top:8px; font-weight:700; border-radius:2px; }
  `;
}
