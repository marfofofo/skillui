export type Agent = "claude_code" | "codex";

export const AGENT_LABEL: Record<Agent, string> = {
  claude_code: "CLAUDE CODE",
  codex: "CODEX",
};

export type Profile = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type Friend = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_live: boolean;
  agent: Agent | null;
};

export type Suggestion = {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  mutual_count: number;
  mutual_sample: string[];
};

export type Relationship =
  | "self"
  | "friend"
  | "request_sent"
  | "request_received"
  | "blocked"
  | "none";

export type FriendRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
};

export type Device = {
  id: string;
  label: string | null;
  agent: Agent | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export type ReportReason =
  | "impersonation"
  | "harassment"
  | "spam"
  | "sexual_content"
  | "hate"
  | "other";
