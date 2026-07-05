import { Inspection, answerKey } from '../../types';
import { FlowDef } from '../../flows/types';
import { resolveLabel } from '../../flows/queue';
import { XactExportPayload, XactAnswer, XactNote, XactAttachment } from './types';

/** Maps a completed inspection into the XactAnalysis-ready payload. */
export function toXactPayload(insp: Inspection, flow: FlowDef, reportPdfUri?: string): XactExportPayload {
  const answers: XactAnswer[] = [];
  for (const section of flow.sections) {
    for (const q of section.questions ?? []) {
      const v = insp.answers[answerKey(section.id, q.id)];
      if (v !== undefined && v !== '') {
        answers.push({ section: section.title, question: q.text, answer: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) });
      }
    }
    if (section.instanceQuestions && section.repeat) {
      for (const inst of insp.instances[section.id] ?? []) {
        for (const q of section.instanceQuestions) {
          const v = insp.answers[answerKey(section.id, q.id, inst)];
          if (v !== undefined && v !== '') {
            answers.push({ section: section.title, instance: inst, question: q.text, answer: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v) });
          }
        }
      }
    }
  }

  const notes: XactNote[] = [];
  const summary = insp.answers[answerKey('wrapup', 'inspectorSummary')];
  if (summary) notes.push({ category: 'inspector-summary', title: 'Inspector Summary', body: String(summary) });
  for (const [key, body] of Object.entries(insp.notes)) {
    if (body.trim()) notes.push({ category: 'section', title: `Notes — ${key}`, body });
  }

  const attachments: XactAttachment[] = insp.photos.map((p) => ({
    uri: p.uri,
    fileName: `${p.id}.jpg`,
    mimeType: 'image/jpeg',
    description: p.caption,
    takenAt: p.takenAt,
  }));
  if (reportPdfUri) {
    attachments.unshift({
      uri: reportPdfUri,
      fileName: `Inspection-Report-${insp.claim.claimNumber || insp.id.slice(0, 8)}.pdf`,
      mimeType: 'application/pdf',
      description: 'Inspection Report (PDF)',
    });
  }

  return {
    claimNumber: insp.claim.claimNumber,
    insured: insp.claim.insured,
    lossAddress: insp.claim.lossAddress,
    carrier: insp.claim.carrier,
    adjuster: insp.claim.adjuster,
    inspector: insp.claim.inspector,
    inspectionType: insp.claim.inspectionType,
    dateOfLoss: insp.claim.dateOfLoss,
    serviceDate: insp.createdAt,
    notes,
    answers,
    attachments,
  };
}

/** Basic completeness validation before export. */
export function validatePayload(p: XactExportPayload): string[] {
  const problems: string[] = [];
  if (!p.claimNumber) problems.push('Missing claim number');
  if (!p.insured) problems.push('Missing insured name');
  if (!p.lossAddress) problems.push('Missing loss address');
  if (p.attachments.length === 0) problems.push('No photos or documents attached');
  return problems;
}
