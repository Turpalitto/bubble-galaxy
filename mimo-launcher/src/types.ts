export interface MimoModel {
  id: string;
  name: string;
  provider: string;
  status: string;
  reasoning: boolean;
}

export interface MimoAgent {
  id: string;
  role: "primary" | "subagent";
}

export interface MimoSession {
  id: string;
  title: string;
  date: string | null;
  raw: string;
}

export interface LaunchConfig {
  project: string;
  model: string;
  agent: string;
  prompt: string;
  session: string;
  continue: boolean;
  fork: boolean;
  trust: boolean;
  neverAsk: boolean;
}

export type TabId = "launch" | "quick" | "models" | "agents" | "sessions" | "settings";
