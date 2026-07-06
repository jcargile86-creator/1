import { FlowDef, SectionDef, PromptDef } from './types';
import { Inspection, promptKey, answerKey } from '../types';

/** A single camera stop: one prompt, resolved for a specific instance. */
export interface QueueItem {
  sectionId: string;
  sectionTitle: string;
  instance?: string;
  prompt: PromptDef;
  /** Prompt label with {instance} resolved — used as overlay + caption base. */
  label: string;
  key: string;
}

export function resolveLabel(prompt: PromptDef, instance?: string): string {
  return instance ? prompt.label.replace('{instance}', instance) : prompt.label;
}

function sectionInstances(section: SectionDef, inspection: Inspection): (string | undefined)[] {
  if (!section.repeat) return [undefined];
  const list = inspection.instances[section.id] ?? section.repeat.presets ?? [];
  return list.length ? list : [];
}

/** Quadrant prompt pairs generated from the slope's selected test-square
 *  size: each quadrant gets an overview then an immediate condition
 *  close-up, captioned "<slope> slope- <size> qN overview/condition". */
function quadrantPrompts(section: SectionDef, inspection: Inspection, instance: string): PromptDef[] {
  const cfg = section.quadrants!;
  const raw = inspection.answers[answerKey(section.id, cfg.sizeQuestionId, instance)];
  const size = (typeof raw === 'string' && raw ? raw : cfg.defaultSize).split(' ')[0];
  const count = cfg.counts[size] ?? cfg.counts[cfg.defaultSize.split(' ')[0]] ?? 0;
  const prompts: PromptDef[] = [];
  if (count === 0) {
    prompts.push({
      id: 'ts-cond-open',
      label: `${instance} slope- ${size} test square`,
      hint: 'No quadrants at this size — minimum two condition close-ups, one shingle exposure each. Add the condition (potential hail / potential granule loss...) to the caption.',
    });
    return prompts;
  }
  for (let n = 1; n <= count; n++) {
    prompts.push({
      id: `ts-q${n}-overview`,
      label: `${instance} slope- ${size} test square q${n} overview`,
      hint: `Full Q${n} section in frame`,
    });
    prompts.push({
      id: `ts-q${n}-condition`,
      label: `${instance} slope- ${size} test square q${n}`,
      hint: 'Condition close-up, one shingle exposure — add potential hail / potential granule loss to the caption. Underline hail hits, one per shingle.',
    });
  }
  return prompts;
}

/** Build the ordered camera queue for one section (or the whole flow).
 *  Whole-flow queues exclude sections marked N/A; an explicitly requested
 *  section is always included (the inspector chose to open it). */
export function buildQueue(flow: FlowDef, inspection: Inspection, sectionId?: string, onlyInstance?: string): QueueItem[] {
  const sections = sectionId
    ? flow.sections.filter((s) => s.id === sectionId)
    : flow.sections.filter((s) => !inspection.sectionSkipped?.[s.id]);
  const items: QueueItem[] = [];
  for (const s of sections) {
    const instances = onlyInstance !== undefined && s.repeat ? [onlyInstance] : sectionInstances(s, inspection);
    for (const inst of instances) {
      for (const p of s.prompts) {
        items.push({
          sectionId: s.id,
          sectionTitle: s.title,
          instance: inst,
          prompt: p,
          label: resolveLabel(p, inst),
          key: promptKey(s.id, p.id, inst),
        });
        if (s.quadrants && inst && p.id === s.quadrants.afterPromptId) {
          for (const qp of quadrantPrompts(s, inspection, inst)) {
            items.push({
              sectionId: s.id,
              sectionTitle: s.title,
              instance: inst,
              prompt: qp,
              label: qp.label,
              key: promptKey(s.id, qp.id, inst),
            });
          }
        }
      }
    }
  }
  return items;
}

export function isDone(inspection: Inspection, key: string): boolean {
  return inspection.skipped[key] === true || inspection.photos.some((ph) => photoKey(ph) === key);
}

function photoKey(ph: { sectionId: string; promptId?: string; instance?: string }): string | undefined {
  if (!ph.promptId) return undefined;
  return promptKey(ph.sectionId, ph.promptId, ph.instance);
}

/** First not-yet-captured, not-skipped item; falls back to the start. */
export function firstPendingIndex(queue: QueueItem[], inspection: Inspection): number {
  const idx = queue.findIndex((q) => !isDone(inspection, q.key));
  return idx === -1 ? 0 : idx;
}

export interface SectionProgress {
  total: number;
  captured: number;
  requiredTotal: number;
  requiredDone: number;
  /** Section was marked Not Applicable by the inspector. */
  notApplicable: boolean;
}

export function sectionProgress(flow: FlowDef, inspection: Inspection, sectionId: string): SectionProgress {
  const notApplicable = inspection.sectionSkipped?.[sectionId] === true;
  const queue = buildQueue(flow, inspection, sectionId);
  const captured = queue.filter((q) => inspection.photos.some((ph) => ph.sectionId === q.sectionId && ph.promptId === q.prompt.id && ph.instance === q.instance)).length;
  const required = queue.filter((q) => !q.prompt.optional);
  const requiredDone = required.filter((q) => isDone(inspection, q.key)).length;
  return { total: queue.length, captured, requiredTotal: required.length, requiredDone, notApplicable };
}

/** Index of the first item AFTER the current section+instance block, for the
 *  camera's one-tap "skip this category" control. Returns queue.length when
 *  nothing follows. */
export function nextSectionIndex(queue: QueueItem[], fromIndex: number): number {
  const cur = queue[fromIndex];
  if (!cur) return queue.length;
  for (let i = fromIndex + 1; i < queue.length; i++) {
    if (queue[i].sectionId !== cur.sectionId) return i;
  }
  return queue.length;
}
