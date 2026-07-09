import { Directory, File, Paths } from 'expo-file-system';

/** Move a captured photo from the camera cache into permanent app storage. */
export function persistPhoto(tempUri: string, inspectionId: string, photoId: string): string {
  const dir = new Directory(Paths.document, 'photos', inspectionId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${photoId}.jpg`);
  new File(tempUri).move(dest);
  return dest.uri;
}

/** Persist the lightweight viewfinder snapshot alongside the full photo. */
export function persistPreview(tempUri: string, inspectionId: string, photoId: string): string {
  const dir = new Directory(Paths.document, 'photos', inspectionId);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${photoId}-preview.jpg`);
  new File(tempUri).move(dest);
  return dest.uri;
}

export function deleteInspectionPhotos(inspectionId: string): void {
  const dir = new Directory(Paths.document, 'photos', inspectionId);
  try {
    if (dir.exists) dir.delete();
  } catch {
    // best-effort cleanup
  }
}

/** Delete one photo's on-device files (full-res, preview, print copy) after
 *  it's safely in XactAnalysis. The photo RECORD (caption/metadata) is kept;
 *  only the binaries go, to reclaim space. */
export function purgePhotoFiles(inspectionId: string, photoId: string): void {
  const dir = new Directory(Paths.document, 'photos', inspectionId);
  for (const name of [`${photoId}.jpg`, `${photoId}-preview.jpg`, `${photoId}-print.jpg`]) {
    try {
      const f = new File(dir, name);
      if (f.exists) f.delete();
    } catch {
      // best-effort — a missing file is already "purged"
    }
  }
}
