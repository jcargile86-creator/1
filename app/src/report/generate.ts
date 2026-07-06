import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Directory, Paths } from 'expo-file-system';
import { Inspection, PhotoRecord } from '../types';
import { FlowDef } from '../flows/types';
import { buildReportHtml, PhotoSource } from './html';

/**
 * Renders the inspection report to PDF (offline, on-device) and opens the
 * share sheet. Returns the final PDF path.
 */
export async function generateReport(inspection: Inspection, flow: FlowDef): Promise<string> {
  // expo-print renders local file URIs unreliably across platforms — embed
  // photos as base64 data URIs. Prefer the screen-res preview snapshot:
  // it's print-sized, keeping the report HTML small enough to render.
  const cache = new Map<string, string>();
  const src: PhotoSource = {
    resolve: (photo: PhotoRecord) => {
      const hit = cache.get(photo.id);
      if (hit) return hit;
      for (const candidate of [photo.previewUri, photo.uri]) {
        if (!candidate) continue;
        try {
          const b64 = new File(candidate).base64Sync();
          const uri = `data:image/jpeg;base64,${b64}`;
          cache.set(photo.id, uri);
          return uri;
        } catch {
          // try the next candidate
        }
      }
      return photo.uri;
    },
  };

  const html = buildReportHtml(inspection, flow, src);
  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

  // Keep a named copy alongside the inspection's data.
  const dir = new Directory(Paths.document, 'reports');
  dir.create({ intermediates: true, idempotent: true });
  const name = `Inspection-Report-${inspection.claim.claimNumber || inspection.id.slice(0, 8)}.pdf`;
  const dest = new File(dir, name);
  try {
    if (dest.exists) dest.delete();
  } catch {
    // ignore — we'll overwrite via move below
  }
  new File(uri).move(dest);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, { mimeType: 'application/pdf', dialogTitle: name });
  }
  return dest.uri;
}
