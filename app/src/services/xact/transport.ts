import { XactTransport, XactExportPayload, XactTransportResult } from './types';

/**
 * Placeholder transport until XactAnalysis API credentials/docs arrive.
 *
 * To wire the real integration, implement XactTransport (auth, payload
 * mapping to their schema, attachment upload) and swap it in here — nothing
 * else in the app changes.
 */
class NotConfiguredTransport implements XactTransport {
  readonly name = 'xactanalysis-stub';
  readonly configured = false;

  async send(payload: XactExportPayload): Promise<XactTransportResult> {
    return {
      ok: false,
      message:
        `XactAnalysis API is not configured yet. Payload ready: claim ${payload.claimNumber}, ` +
        `${payload.attachments.length} attachments, ${payload.answers.length} answers, ${payload.notes.length} notes.`,
    };
  }
}

let transport: XactTransport = new NotConfiguredTransport();

export function getXactTransport(): XactTransport {
  return transport;
}

export function setXactTransport(t: XactTransport): void {
  transport = t;
}
