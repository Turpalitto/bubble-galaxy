import type { Mode } from "@/game/types";

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  level: number;
  maxCombo: number;
  isMe: boolean;
}

export interface Stats {
  popped: number;
  players: number;
  games: number;
  dailyLeader: { nickname: string; score: number } | null;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `http_${res.status}`);
  return data;
}

export function createPlayer(nickname?: string) {
  return req<{ id: string; nickname: string; token: string }>("/api/players", { method: "POST", body: JSON.stringify({ nickname }) });
}

export function renamePlayer(token: string, nickname: string) {
  return req<{ id: string; nickname: string }>("/api/players", { method: "PATCH", body: JSON.stringify({ token, nickname }) });
}

export function submitScore(body: {
  token: string;
  mode: Mode;
  score: number;
  level: number;
  maxCombo: number;
  popped: number;
  dailyDate?: string;
}) {
  return req<{ id: string; rank: number }>("/api/scores", { method: "POST", body: JSON.stringify(body) });
}

export function fetchLeaderboard(mode: Mode, opts: { date?: string; level?: number; playerId?: string | null } = {}) {
  const p = new URLSearchParams({ mode });
  if (opts.date) p.set("date", opts.date);
  if (opts.level) p.set("level", String(opts.level));
  if (opts.playerId) p.set("playerId", opts.playerId);
  return req<{ entries: LeaderboardEntry[]; totalPlayers: number }>(`/api/leaderboard?${p.toString()}`);
}

export function fetchStats() {
  return req<Stats>("/api/stats");
}
