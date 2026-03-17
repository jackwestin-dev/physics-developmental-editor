export interface AnalyzeRequest {
  jackWestinText: string;
  resourceText: string;
}

export interface AnalyzeResponse {
  missingTopics: string[];
}

export interface GenerateRequest {
  jackWestinText: string;
  resourceText: string;
  missingTopics: string[];
}

export interface AgentState {
  jackWestinText: string;
  resourceText: string;
  missingTopics: string[] | null;
  finalText: string | null;
  status: "idle" | "analyzing" | "generating" | "done" | "error";
  error: string | null;
}
