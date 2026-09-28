export type GoalRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';

export interface NexusGoal {
  goal_id: string;
  project_id: string;
  objective: string;
  scope: string[];
  out_of_scope: string[];
  requirements: string[];
  constraints: string[];
  assumptions: string[];
  acceptance_criteria: string[];
  risk: GoalRisk;
  required_gates: string[];
  definition_of_done: string[];
}
