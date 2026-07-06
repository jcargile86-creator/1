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
}

export interface PromptDef {
  id: string;
  /** Label shown at the top of the camera and used as the photo caption base.
   *  May contain `{instance}` which is replaced by the room/slope/facet name. */
  label: string;
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
