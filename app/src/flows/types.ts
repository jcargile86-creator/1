/**
 * Carrier flow definitions.
 *
 * A flow is pure data: sections → photo prompts + question sets. Each carrier
 * gets its own flow file; the app renders whatever the flow describes, so new
 * carriers require no code changes.
 */

export type QuestionType = 'yesno' | 'text' | 'number' | 'choice' | 'multilineText';

export interface QuestionDef {
  id: string;
  text: string;
  type: QuestionType;
  choices?: string[];
  /** Group heading in the questions screen and the PDF (e.g. "Subrogation Opportunities"). */
  group?: string;
  /** For number questions: default the value to the count of photos taken on
   *  this prompt (same section/instance). Inspector edits to override. */
  autoFromPrompt?: string;
  /** Attach this question to a specific photo prompt — it renders alongside
   *  that item in the capture flow instead of the section's question list. */
  promptId?: string;
  /** Render this question inline at the top of its sub-section (e.g. test
   *  square size — it must be answered before quadrant prompts generate). */
  pinned?: boolean;
}

export interface PromptDef {
  id: string;
  /** Label shown at the top of the camera and used as the photo caption base.
   *  May contain `{instance}` which is replaced by the room/slope/facet name. */
  label: string;
  /** Overrides the caption base when it should differ from the menu label
   *  (e.g. quadrant close-ups caption without the word "condition" so the
   *  actual condition slots in). Supports `{instance}` like label. */
  caption?: string;
  /** Short guidance line under the label (what to include: tape measure, flash, angle...). */
  hint?: string;
  /** Prompts marked optional don't count against section completion. */
  optional?: boolean;
}

export interface RepeatDef {
  /** What each instance is called in the UI: "Room", "Slope", "Facet"... */
  noun: string;
  /** Instances pre-created for every inspection (e.g. Front/Left/Back/Right). */
  presets?: string[];
  /** Whether the inspector can add instances (rooms, facets). */
  addable?: boolean;
}

/** Top-level tab the section lives under, in natural inspection-walk order. */
export type AreaTab = 'start' | 'elevations' | 'roof' | 'inside' | 'wrapup';

export interface SectionDef {
  id: string;
  title: string;
  /** Short badge text (e.g. section number) shown on the grid tile. */
  icon: string;
  subtitle?: string;
  /** Which top tab this section belongs to (defaults to 'wrapup'). */
  area?: AreaTab;
  /** False = the section can never be marked N/A (e.g. Arrival). */
  skippable?: boolean;
  /** Dynamic quadrant prompts (test squares): generated per instance from the
   *  selected size — an overview + condition close-up pair per quadrant. */
  quadrants?: {
    /** Instance question whose answer selects the size. */
    sizeQuestionId: string;
    /** Generated prompts are inserted right after this prompt. */
    afterPromptId: string;
    /** Size key (first token of the answer) → quadrant count. */
    counts: Record<string, number>;
    defaultSize: string;
  };
  /** When set, the section's prompts/questions run once per instance. */
  repeat?: RepeatDef;
  prompts: PromptDef[];
  /** Section-level questions (asked once). */
  questions?: QuestionDef[];
  /** Questions asked per instance (e.g. interior findings sheet per room). */
  instanceQuestions?: QuestionDef[];
}

export interface FlowDef {
  id: string;
  carrier: string;
  name: string;
  description: string;
  sections: SectionDef[];
}
