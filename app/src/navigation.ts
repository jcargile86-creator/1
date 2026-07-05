export type RootStackParamList = {
  Home: undefined;
  NewInspection: undefined;
  Inspection: { id: string };
  Section: { id: string; sectionId: string };
  Camera: { id: string; sectionId?: string; instance?: string; startKey?: string };
  Questions: { id: string; sectionId: string; instance?: string };
  Sketch: { id: string; sketchId?: string };
};
