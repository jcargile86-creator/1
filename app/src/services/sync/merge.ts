import { Inspection } from '../../types';

/** Reconcile local and remote claim lists with last-writer-wins on
 *  updatedAt (document-level). Good enough for the spine: a claim is worked
 *  on one device at a time. Finer-grained field merging comes later if
 *  concurrent editing becomes real. */
export function mergeByUpdatedAt(local: Inspection[], remote: Inspection[]): Inspection[] {
  const byId = new Map<string, Inspection>();
  for (const i of local) byId.set(i.id, i);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || r.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byId.set(r.id, r);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
