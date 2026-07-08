import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Paths } from 'expo-file-system';
import { Inspection, ClaimInfo, ClaimStatus } from '../types';
import { DEFAULT_FLOW_ID, getFlow } from '../flows';
import { useAuth } from './AuthStore';

export interface AssignmentMeta {
  assignedAt?: string;
  scheduledAt?: string;
  source?: 'xact' | 'manual';
}

/** Legacy (pre-accounts) index — adopted by the dev account on first load. */
const LEGACY_INDEX_KEY = 'inspectpro/index';
/** Each inspector's claims live under their own index. */
const indexKey = (userId: string) => `inspectpro/index/${userId}`;
const itemKey = (id: string) => `inspectpro/inspection/${id}`;

interface StoreShape {
  loading: boolean;
  inspections: Inspection[];
  /** Start a walk-in inspection immediately (status = in_progress). */
  createInspection: (claim: ClaimInfo, flowId?: string) => Promise<Inspection>;
  /** Intake a claim as a pending assignment (Xact feed or manual add). */
  createAssignment: (claim: ClaimInfo, meta?: AssignmentMeta, flowId?: string) => Promise<Inspection>;
  acceptInspection: (id: string) => Promise<Inspection | undefined>;
  declineInspection: (id: string, reason?: string) => Promise<Inspection | undefined>;
  submitInspection: (id: string) => Promise<Inspection | undefined>;
  markSeen: (id: string) => Promise<Inspection | undefined>;
  updateInspection: (id: string, mutate: (draft: Inspection) => void) => Promise<Inspection | undefined>;
  deleteInspection: (id: string) => Promise<void>;
  getInspection: (id: string) => Inspection | undefined;
}

const Ctx = createContext<StoreShape | null>(null);

function newId(): string {
  return Crypto.randomUUID();
}

/** iOS rotates the app container path on every install/update, breaking
 *  stored absolute file URIs. Rebase anything under Documents onto the
 *  current container. */
function rebaseUri<T extends string | undefined>(uri: T): T {
  if (!uri) return uri;
  const marker = '/Documents/';
  const i = uri.indexOf(marker);
  if (i === -1) return uri;
  const base = Paths.document.uri.endsWith('/') ? Paths.document.uri : `${Paths.document.uri}/`;
  return (base + uri.slice(i + marker.length)) as T;
}

function rebaseInspection(x: Inspection): Inspection {
  return {
    ...x,
    photos: x.photos.map((p) => ({ ...p, uri: rebaseUri(p.uri), previewUri: rebaseUri(p.previewUri) })),
    documents: (x.documents ?? []).map((d) => ({ ...d, uri: rebaseUri(d.uri) })),
  };
}

export function InspectionProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!userId) {
          if (!cancelled) setInspections([]);
          return;
        }
        // The dev account adopts any pre-accounts inspections on first run so
        // existing test data isn't stranded.
        if (currentUser?.isDev && !(await AsyncStorage.getItem(indexKey(userId)))) {
          const legacy = await AsyncStorage.getItem(LEGACY_INDEX_KEY);
          if (legacy) {
            await AsyncStorage.setItem(indexKey(userId), legacy);
            await AsyncStorage.removeItem(LEGACY_INDEX_KEY);
          }
        }
        const idxRaw = await AsyncStorage.getItem(indexKey(userId));
        const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];
        const rows = await AsyncStorage.multiGet(ids.map(itemKey));
        const items = rows
          .map(([, v]) => (v ? (JSON.parse(v) as Inspection) : null))
          .filter((x): x is Inspection => !!x)
          // migrate: pre-lifecycle records are in-progress manual walk-ins
          .map((x) =>
            rebaseInspection({
              ...x,
              sectionSkipped: x.sectionSkipped ?? {},
              documents: x.documents ?? [],
              source: x.source ?? 'manual',
              status: x.status ?? 'in_progress',
              assignedAt: x.assignedAt ?? x.createdAt,
              acceptedAt: x.acceptedAt ?? x.createdAt,
              seen: x.seen ?? true,
            }),
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (!cancelled) setInspections(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?.isDev]);

  const persist = useCallback(
    async (items: Inspection[]) => {
      if (!userId) return;
      await AsyncStorage.setItem(indexKey(userId), JSON.stringify(items.map((i) => i.id)));
    },
    [userId],
  );

  /** Default the inspector name/contact from the signed-in account. */
  const withInspector = useCallback(
    (claim: ClaimInfo): ClaimInfo => ({
      ...claim,
      inspector: claim.inspector || currentUser?.displayName || '',
      inspectorContact: claim.inspectorContact || currentUser?.contact || '',
    }),
    [currentUser?.displayName, currentUser?.contact],
  );

  const createInspection = useCallback(
    async (claimIn: ClaimInfo, flowId: string = DEFAULT_FLOW_ID) => {
      const claim = withInspector(claimIn);
      const flow = getFlow(flowId);
      const instances: Record<string, string[]> = {};
      for (const s of flow.sections) {
        if (s.repeat) instances[s.id] = [...(s.repeat.presets ?? [])];
      }
      const now = new Date().toISOString();
      const insp: Inspection = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        flowId: flow.id,
        claim,
        source: 'manual',
        status: 'in_progress',
        assignedAt: now,
        acceptedAt: now,
        seen: true,
        photos: [],
        answers: {},
        notes: {},
        instances,
        skipped: {},
        sectionSkipped: {},
        sketches: [],
        documents: [],
      };
      await AsyncStorage.setItem(itemKey(insp.id), JSON.stringify(insp));
      setInspections((prev) => {
        const next = [insp, ...prev];
        void persist(next);
        return next;
      });
      return insp;
    },
    [persist, withInspector],
  );

  const createAssignment = useCallback(
    async (claimIn: ClaimInfo, meta: AssignmentMeta = {}, flowId: string = DEFAULT_FLOW_ID) => {
      const claim = withInspector(claimIn);
      const flow = getFlow(flowId);
      const instances: Record<string, string[]> = {};
      for (const s of flow.sections) {
        if (s.repeat) instances[s.id] = [...(s.repeat.presets ?? [])];
      }
      const now = new Date().toISOString();
      const insp: Inspection = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        flowId: flow.id,
        claim,
        source: meta.source ?? 'manual',
        status: 'pending',
        assignedAt: meta.assignedAt ?? now,
        scheduledAt: meta.scheduledAt,
        seen: false,
        photos: [],
        answers: {},
        notes: {},
        instances,
        skipped: {},
        sectionSkipped: {},
        sketches: [],
        documents: [],
      };
      await AsyncStorage.setItem(itemKey(insp.id), JSON.stringify(insp));
      setInspections((prev) => {
        const next = [insp, ...prev];
        void persist(next);
        return next;
      });
      return insp;
    },
    [persist, withInspector],
  );

  const updateInspection = useCallback(
    async (id: string, mutate: (draft: Inspection) => void) => {
      let updated: Inspection | undefined;
      setInspections((prev) => {
        const next = prev.map((i) => {
          if (i.id !== id) return i;
          const draft: Inspection = JSON.parse(JSON.stringify(i));
          mutate(draft);
          draft.updatedAt = new Date().toISOString();
          updated = draft;
          return draft;
        });
        return next;
      });
      if (updated) await AsyncStorage.setItem(itemKey(id), JSON.stringify(updated));
      return updated;
    },
    [],
  );

  const setStatus = useCallback(
    (id: string, status: ClaimStatus, extra?: (d: Inspection) => void) =>
      updateInspection(id, (d) => {
        d.status = status;
        d.seen = true;
        extra?.(d);
      }),
    [updateInspection],
  );

  const acceptInspection = useCallback(
    (id: string) => setStatus(id, 'in_progress', (d) => { d.acceptedAt = new Date().toISOString(); }),
    [setStatus],
  );
  const declineInspection = useCallback(
    (id: string, reason?: string) =>
      setStatus(id, 'declined', (d) => {
        d.declinedAt = new Date().toISOString();
        if (reason) d.declineReason = reason;
      }),
    [setStatus],
  );
  const submitInspection = useCallback(
    (id: string) => setStatus(id, 'completed', (d) => { d.submittedAt = new Date().toISOString(); }),
    [setStatus],
  );
  const markSeen = useCallback(
    (id: string) => updateInspection(id, (d) => { d.seen = true; }),
    [updateInspection],
  );

  const deleteInspection = useCallback(
    async (id: string) => {
      await AsyncStorage.removeItem(itemKey(id));
      setInspections((prev) => {
        const next = prev.filter((i) => i.id !== id);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const getInspection = useCallback(
    (id: string) => inspections.find((i) => i.id === id),
    [inspections],
  );

  const value = useMemo(
    () => ({
      loading,
      inspections,
      createInspection,
      createAssignment,
      acceptInspection,
      declineInspection,
      submitInspection,
      markSeen,
      updateInspection,
      deleteInspection,
      getInspection,
    }),
    [loading, inspections, createInspection, createAssignment, acceptInspection, declineInspection, submitInspection, markSeen, updateInspection, deleteInspection, getInspection],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspections(): StoreShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspections must be used within InspectionProvider');
  return ctx;
}
