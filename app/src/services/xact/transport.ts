import { XactTransport, XactExportPayload, XactTransportResult } from './types';

/**
 * Placeholder transport until XactAnalysis API credentials/docs arrive.
 *
 * To wire the real integration, implement XactTransport (auth, payload
 * mapping to their schema, attachment upload) and swap it in here — nothing
 * else in the app changes.
 *
 * XACT INTEGRATION CHECKLIST (pending Verisk provisioning):
 *  - Register InspectPro's source code with Verisk. Incoming photos are
 *    stamped with this in Xact (the current vendor app shows "SWA" as its
 *    source). Ours must be registered so submitted media reads "InspectPro".
 *  - Confirm the delivery path: live REST (per-file upload, one request per
 *    attachment) vs. XactDocuments/ESX package (XACTDOC XML + image bundle).
 *  - Capture the XactNet transaction / assignment ID on each claim so photos
 *    post against the right claim (today claims key off the typed number).
 *
 * INBOUND ASSIGNMENTS (the other direction): when the live Xact feed is
 * wired, each new assignment maps into ClaimInfo and calls
 * store.createAssignment(claim, { assignedAt, scheduledAt, source: 'xact' }).
 * That drops it into the Pending tab exactly like the manual "+ Assignment"
 * path, so the accept/deny/schedule/submit lifecycle is already in place.
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
