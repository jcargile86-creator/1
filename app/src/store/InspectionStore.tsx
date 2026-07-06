import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Paths } from 'expo-file-system';
import { Inspection, ClaimInfo } from '../types';
import { DEFAULT_FLOW_ID, getFlow } from '../flows';

const INDEX_KEY = 'inspectpro/index';
const itemKey = (id: string) => `inspectpro/inspection/${id}`;

interface StoreShape {
  loading: boolean;
  inspections: Inspection[];
  createInspection: (claim: ClaimInfo, flowId?: string) => Promise<Inspection>;
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
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const idxRaw = await AsyncStorage.getItem(INDEX_KEY);
        const ids: string[] = idxRaw ? JSON.parse(idxRaw) : [];
        const rows = await AsyncStorage.multiGet(ids.map(itemKey));
        const items = rows
          .map(([, v]) => (v ? (JSON.parse(v) as Inspection) : null))
          .filter((x): x is Inspection => !!x)
          // migrate records saved before newer fields existed
          .map((x) => rebaseInspection({ ...x, sectionSkipped: x.sectionSkipped ?? {}, documents: x.documents ?? [] }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setInspections(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (items: Inspection[]) => {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(items.map((i) => i.id)));
  }, []);

  const createInspection = useCallback(
    async (claim: ClaimInfo, flowId: string = DEFAULT_FLOW_ID) => {
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
    [persist],
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
    () => ({ loading, inspections, createInspection, updateInspection, deleteInspection, getInspection }),
    [loading, inspections, createInspection, updateInspection, deleteInspection, getInspection],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspections(): StoreShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspections must be used within InspectionProvider');
  return ctx;
}
