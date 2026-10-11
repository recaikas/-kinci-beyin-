import type { CharacterInput, GameAction } from "@kader/engine";
import type { GameView, JournalEntry } from "@kader/game";

export interface CampaignSummary {
  id: string;
  title: string;
  turnCount: number;
  updatedAt: string;
  player: { name: string; level: number; classKey: string | null; raceKey: string | null; alive: boolean } | null;
}

export interface CampaignData {
  id: string;
  view: GameView;
  journal: JournalEntry[];
}

export type TurnResponse =
  | { status: "resolved"; entry: JournalEntry; view: GameView; ai: boolean }
  | { status: "clarify"; question: string }
  | { status: "rejected"; reason: string }
  | { status: "out_of_character"; summary: string };

export interface NewCampaign {
  templateKey: string;
  title?: string;
  character: CharacterInput;
  rollToken?: string;
}

export interface Backend {
  mode: "local" | "online";
  /** Anlatıcı yapay zekâsı etkin mi (yerelde kullanıcı anahtarı; çevrimiçinde sunucu). */
  aiLabel(): string;
  listCampaigns(): Promise<CampaignSummary[]>;
  rollAbilities(): Promise<{ values: number[]; token?: string }>;
  createCampaign(input: NewCampaign): Promise<CampaignData>;
  getCampaign(id: string): Promise<CampaignData>;
  playTurn(id: string, input: { text: string } | { action: GameAction; text?: string }): Promise<TurnResponse>;
  deleteCampaign(id: string): Promise<void>;
}

export class BackendError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
  }
}
