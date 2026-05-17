import type { Action, ModelProvider } from "@pumpworld/protocol";

export interface BrainRequest {
  pillId: string;
  systemPrompt: string;
  perception: string;
  /** Free-text instruction appended after perception, e.g. "Your turn — choose ONE action." */
  question: string;
  /** Hard token cap for the response. */
  maxTokens: number;
  /** Deterministic seed if the provider supports it. */
  seed?: number;
}

export interface BrainResponse {
  thought: string;
  action: Action;
  inputTokens?: number;
  outputTokens?: number;
}

export interface BrainProvider {
  readonly id: ModelProvider;
  readonly model: string;
  isAvailable(): boolean;
  decide(req: BrainRequest): Promise<BrainResponse>;
}
