import { randomBytes } from "crypto";

const BAD_WORDS = ["fuck", "shit", "bitch", "хуй", "пизд", "ебат", "ебан", "сука", "блят", "nigg", "cunt"];

export function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\p{L}\p{N} _\-.!]/gu, "").trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 16) return null;
  const lower = cleaned.toLowerCase();
  if (BAD_WORDS.some((w) => lower.includes(w))) return null;
  return cleaned;
}

export function randomNickname(): string {
  const adj = ["Космо", "Нео", "Астро", "Гипер", "Ультра", "Мега", "Турбо", "Стар"];
  const noun = ["навт", "пилот", "ковбой", "лис", "кот", "дракон", "феникс", "рейнджер"];
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function makeToken(): string {
  return randomBytes(24).toString("hex");
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
