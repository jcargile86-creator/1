export interface ClaimInfo {
  claimNumber: string;
  insured: string;
  lossAddress: string;
  carrier: string;
  adjuster: string;
  inspector: string;
  inspectorContact: string;
  inspectionType: string;
  dateOfLoss: string;
  structureType: string;
  stories: string;
  otherStructures: string;
}

export interface PhotoRecord {
  id: string;
  /** file:// URI inside the app's document directory */
  uri: string;
  sectionId: string;
  promptId?: string;
  instance?: string;
  /** Caption base from the prompt label; inspector can append measurements/adjectives. */
  caption: string;
  takenAt: string; // ISO
}

export interface DocumentRecord {
  id: string;
  /** file:// URI inside the app's document directory */
  uri: string;
  name: string;
  mimeType: string;
  addedAt: string; // ISO
}

export interface SketchRecord {
  id: string;
  name: string;
  /** SVG path `d` strings drawn on a 1000x1400 canvas. */
  paths: string[];
  createdAt: string;
}

export type AnswerValue = string | number | boolean;

export interface Inspection {
  id: string;
  createdAt: string;
  updatedAt: string;
  flowId: string;
  claim: ClaimInfo;
  photos: PhotoRecord[];
  /** answers keyed by `sectionId:questionId` or `sectionId:instance:questionId` */
  answers: Record<string, AnswerValue>;
  /** notes keyed by sectionId (plus 'general') */
  notes: Record<string, string>;
  /** user-managed instances per repeating section (rooms, facets...) */
  instances: Record<string, string[]>;
  /** prompt keys (`sectionId:instance?:promptId`) the inspector skipped */
  skipped: Record<string, boolean>;
  /** whole sections marked Not Applicable (e.g. Interior on an exterior-only claim) */
  sectionSkipped: Record<string, boolean>;
  sketches: SketchRecord[];
  /** uploaded documents: Sketch AR screenshots, CAD markups, receipts... */
  documents: DocumentRecord[];
}

/** Sketch canvas coordinate space — sketches are stored normalized to this. */
export const SKETCH_W = 1000;
export const SKETCH_H = 1400;

export const promptKey = (sectionId: string, promptId: string, instance?: string) =>
  instance ? `${sectionId}:${instance}:${promptId}` : `${sectionId}:${promptId}`;

export const answerKey = (sectionId: string, questionId: string, instance?: string) =>
  instance ? `${sectionId}:${instance}:${questionId}` : `${sectionId}:${questionId}`;
