import { Inspection, ClaimInfo, ClaimStatus } from '../../types';

/** The Postgres `claims` row shape (snake_case, flat + a `state` blob). */
export interface ClaimRow {
  id: string;
  owner_id?: string;
  org_id?: string | null;
  flow_id: string;
  status: ClaimStatus;
  source: 'xact' | 'manual';
  claim_number: string;
  insured: string;
  loss_address: string;
  carrier: string;
  adjuster: string;
  inspector: string;
  inspector_contact: string;
  inspection_type: string;
  date_of_loss: string;
  structure_type: string;
  stories: string;
  other_structures: string;
  assigned_at: string | null;
  scheduled_at: string | null;
  accepted_at: string | null;
  submitted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  state: InspectionState;
  device_updated_at: string;
}

/** Everything app-shaped that doesn't need its own column rides in `state`.
 *  Photo binaries are NOT here — only their metadata; images sync in the blob
 *  slice. */
interface InspectionState {
  createdAt: string;
  seen?: boolean;
  answers: Inspection['answers'];
  notes: Inspection['notes'];
  instances: Inspection['instances'];
  skipped: Inspection['skipped'];
  sectionSkipped: Inspection['sectionSkipped'];
  sketches: Inspection['sketches'];
  documents: Inspection['documents'];
  photos: Inspection['photos'];
}

const nn = (v: string | undefined): string | null => (v && v.length ? v : null);

/** Inspection (device) -> claims row (server). */
export function inspectionToRow(insp: Inspection, ownerId: string, orgId?: string | null): ClaimRow {
  const c: ClaimInfo = insp.claim;
  return {
    id: insp.id,
    owner_id: ownerId,
    org_id: orgId ?? null,
    flow_id: insp.flowId,
    status: insp.status,
    source: insp.source,
    claim_number: c.claimNumber ?? '',
    insured: c.insured ?? '',
    loss_address: c.lossAddress ?? '',
    carrier: c.carrier ?? '',
    adjuster: c.adjuster ?? '',
    inspector: c.inspector ?? '',
    inspector_contact: c.inspectorContact ?? '',
    inspection_type: c.inspectionType ?? '',
    date_of_loss: c.dateOfLoss ?? '',
    structure_type: c.structureType ?? '',
    stories: c.stories ?? '',
    other_structures: c.otherStructures ?? '',
    assigned_at: nn(insp.assignedAt),
    scheduled_at: nn(insp.scheduledAt),
    accepted_at: nn(insp.acceptedAt),
    submitted_at: nn(insp.submittedAt),
    declined_at: nn(insp.declinedAt),
    decline_reason: nn(insp.declineReason),
    device_updated_at: insp.updatedAt,
    state: {
      createdAt: insp.createdAt,
      seen: insp.seen,
      answers: insp.answers,
      notes: insp.notes,
      instances: insp.instances,
      skipped: insp.skipped,
      sectionSkipped: insp.sectionSkipped,
      sketches: insp.sketches,
      documents: insp.documents,
      photos: insp.photos,
    },
  };
}

/** claims row (server) -> Inspection (device). */
export function rowToInspection(row: ClaimRow): Inspection {
  const s = row.state ?? ({} as InspectionState);
  return {
    id: row.id,
    createdAt: s.createdAt ?? row.device_updated_at,
    updatedAt: row.device_updated_at,
    flowId: row.flow_id,
    source: row.source,
    status: row.status,
    seen: s.seen,
    assignedAt: row.assigned_at ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    declinedAt: row.declined_at ?? undefined,
    declineReason: row.decline_reason ?? undefined,
    claim: {
      claimNumber: row.claim_number,
      insured: row.insured,
      lossAddress: row.loss_address,
      carrier: row.carrier,
      adjuster: row.adjuster,
      inspector: row.inspector,
      inspectorContact: row.inspector_contact,
      inspectionType: row.inspection_type,
      dateOfLoss: row.date_of_loss,
      structureType: row.structure_type,
      stories: row.stories,
      otherStructures: row.other_structures,
    },
    answers: s.answers ?? {},
    notes: s.notes ?? {},
    instances: s.instances ?? {},
    skipped: s.skipped ?? {},
    sectionSkipped: s.sectionSkipped ?? {},
    sketches: s.sketches ?? [],
    documents: s.documents ?? [],
    photos: s.photos ?? [],
  };
}
