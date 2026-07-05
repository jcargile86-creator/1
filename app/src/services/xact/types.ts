/**
 * XactAnalysis integration contract.
 *
 * The payload shape below is our internal, carrier-neutral representation of
 * a completed inspection. When XactAnalysis API credentials/docs arrive, a
 * real transport maps/ships this payload (likely XACTDOC XML or their REST
 * ingestion endpoint) without touching the rest of the app.
 */

export interface XactAttachment {
  /** Local file URI (photo, PDF report, diagram render). */
  uri: string;
  fileName: string;
  mimeType: string;
  /** Photo caption / document description shown to the desk adjuster. */
  description: string;
  takenAt?: string;
}

export interface XactNote {
  category: 'inspector-summary' | 'lower-elevations' | 'roof' | 'section' | 'general';
  title: string;
  body: string;
}

export interface XactAnswer {
  section: string;
  instance?: string;
  question: string;
  answer: string;
}

export interface XactExportPayload {
  claimNumber: string;
  insured: string;
  lossAddress: string;
  carrier: string;
  adjuster: string;
  inspector: string;
  inspectionType: string;
  dateOfLoss: string;
  serviceDate: string;
  notes: XactNote[];
  answers: XactAnswer[];
  attachments: XactAttachment[];
}

export interface XactTransportResult {
  ok: boolean;
  message: string;
  /** Remote identifiers once the real API responds. */
  remoteId?: string;
}

export interface XactTransport {
  readonly name: string;
  readonly configured: boolean;
  send(payload: XactExportPayload): Promise<XactTransportResult>;
}
