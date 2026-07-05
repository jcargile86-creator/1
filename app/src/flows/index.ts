import { FlowDef } from './types';
import { patriotAllstateFlow } from './patriot-allstate';

const flows: Record<string, FlowDef> = {
  [patriotAllstateFlow.id]: patriotAllstateFlow,
};

export const DEFAULT_FLOW_ID = patriotAllstateFlow.id;

export function getFlow(id: string): FlowDef {
  return flows[id] ?? patriotAllstateFlow;
}

export function listFlows(): FlowDef[] {
  return Object.values(flows);
}
