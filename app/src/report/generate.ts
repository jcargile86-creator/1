import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Directory, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Inspection } from '../types';
import { FlowDef } from '../flows/types';
import { buildReportHtml, PhotoSource } from './html';

/** PDF embeds are downscaled print copies — the untouched full-resolution
 *  originals stay on disk for the XactAnalysis photo export. */
const PRINT_WIDTH = 1000;
const PRINT_QUALITY = 0.55;
/** Parallel downscales per batch — keeps peak native memory bounded. */
const BATCH = 6;

function printCopy(inspectionId: string, imageId: string): File {
  const dir = new Directory(Paths.document, 'photos', inspectionId);
  dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${imageId}-print.jpg`);
}

/** Downscale one image to print size, caching the copy next to the photo
 *  files so regenerating the report doesn't redo the work. */
async function toPrintDataUri(inspectionId: string, imageId: string, sourceUri: string): Promise<string | null> {
  const cached = printCopy(inspectionId, imageId);
  try {
    if (cached.exists) return `data:image/jpeg;base64,${cached.base64Sync()}`;
  } catch {
    // unreadable cache — regenerate below
  }
  try {
    const image = await ImageManipulator.manipulate(sourceUri).resize({ width: PRINT_WIDTH }).renderAsync();
    const saved = await image.saveAsync({ compress: PRINT_QUALITY, format: SaveFormat.JPEG });
    try {
      new File(saved.uri).move(cached);
    } catch {
      // cache write failed — read straight from the render output
      return `data:image/jpeg;base64,${new File(saved.uri).base64Sync()}`;
    }
    return `data:image/jpeg;base64,${cached.base64Sync()}`;
  } catch {
    return null;
  }
}

/**
 * Renders the inspection report to PDF (offline, on-device) and opens the
 * share sheet. Returns the final PDF path.
 */
export async function generateReport(inspection: Inspection, flow: FlowDef): Promise<string> {
  // expo-print renders local file URIs unreliably across platforms — embed
  // photos as base64 data URIs, downscaled so a 100+ photo report stays a
  // reasonable file size.
  const cache = new Map<string, string>();
  const images: { id: string; candidates: (string | undefined)[] }[] = [
    ...inspection.photos.map((p) => ({ id: p.id, candidates: [p.uri, p.previewUri] })),
    ...inspection.documents
      .filter((d) => d.mimeType.startsWith('image/'))
      .map((d) => ({ id: d.id, candidates: [d.uri] })),
  ];
  for (let i = 0; i < images.length; i += BATCH) {
    await Promise.all(
      images.slice(i, i + BATCH).map(async ({ id, candidates }) => {
        for (const uri of candidates) {
          if (!uri) continue;
          const data = await toPrintDataUri(inspection.id, id, uri);
          if (data) {
            cache.set(id, data);
            return;
          }
        }
        // Last resort: embed an original as-is rather than drop the photo.
        for (const uri of candidates) {
          if (!uri) continue;
          try {
            cache.set(id, `data:image/jpeg;base64,${new File(uri).base64Sync()}`);
            return;
          } catch {
            // try the next candidate
          }
        }
      }),
    );
  }

  const src: PhotoSource = {
    resolve: (photo) => cache.get(photo.id) ?? photo.uri,
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
