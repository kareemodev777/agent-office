export type AgentRole = 'architect' | 'builder' | 'reviewer' | 'tester' | 'documenter' | null;

export interface AgentState {
  id: number;
  label: string;           // project name derived from path
  slug: string | null;     // human-readable session name from JSONL
  role: AgentRole;         // detected from Task tool descriptions
  gitBranch: string | null;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  activeSubagentToolIds: Map<string, Set<string>>;
  activeSubagentToolNames: Map<string, Map<string, string>>;
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
  // Cost & time tracking
  startedAt: number;       // Date.now() when agent was created
  lastActivityAt: number;  // Date.now() of last JSONL activity
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}
