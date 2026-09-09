import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { json } from "@/lib/server-utils";
import { SCORE_CAPS } from "@/game/constants";

export const dynamic = "force-dynamic";

const MODES = ["campaign", "endless", "daily"] as const;
type Mode = (typeof MODES)[number];

interface Body {
  token?: string;
  mode?: Mode;
  score?: number;
  level?: number;
  maxCombo?: number;
  popped?: number;
  dailyDate?: string;
}

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as Body;
    if (!b.token || typeof b.token !== "string") return json({ error: "unauthorized" }, 401);
    if (!b.mode || !MODES.includes(b.mode)) return json({ error: "bad_mode" }, 400);
    const score = Math.floor(Number(b.score));
    const level = Math.max(0, Math.floor(Number(b.level ?? 0)));
    const maxCombo = Math.max(0, Math.min(999, Math.floor(Number(b.maxCombo ?? 0))));
    const popped = Math.max(0, Math.min(100000, Math.floor(Number(b.popped ?? 0))));
    if (!Number.isFinite(score) || score < 0 || score > SCORE_CAPS[b.mode]) return json({ error: "bad_score" }, 400);
    // Sanity: score can't exceed what popped bubbles could plausibly produce.
    if (score > popped * 100 * 10 + 20000) return json({ error: "implausible" }, 400);

    const [player] = await db.select().from(players).where(eq(players.token, b.token)).limit(1);
    if (!player) return json({ error: "unauthorized" }, 401);

    // Throttle: one submission per 3 seconds per player
    const [recent] = await db
      .select({ id: scores.id })
      .from(scores)
      .where(and(eq(scores.playerId, player.id), gt(scores.createdAt, new Date(Date.now() - 3000))))
      .limit(1);
    if (recent) return json({ error: "too_fast" }, 429);

    let dailyDate: string | null = null;
    if (b.mode === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      if (b.dailyDate !== today) return json({ error: "daily_expired" }, 400);
      dailyDate = today;
      const [existing] = await db
        .select({ id: scores.id })
        .from(scores)
        .where(and(eq(scores.playerId, player.id), eq(scores.mode, "daily"), eq(scores.dailyDate, today)))
        .limit(1);
      if (existing) return json({ error: "already_played" }, 409);
    }

    const [row] = await db
      .insert(scores)
      .values({ playerId: player.id, mode: b.mode, score, level, maxCombo, popped, dailyDate })
      .returning({ id: scores.id });

    await db
      .update(players)
      .set({
        totalPopped: sql`${players.totalPopped} + ${popped}`,
        gamesPlayed: sql`${players.gamesPlayed} + 1`,
        lastSeenAt: new Date(),
      })
      .where(eq(players.id, player.id));

    // Rank: count of players with a better best score in this mode/date/level.
    const cond = [eq(scores.mode, b.mode)];
    if (b.mode === "daily" && dailyDate) cond.push(eq(scores.dailyDate, dailyDate));
    if (b.mode === "campaign") cond.push(eq(scores.level, level));
    const [r] = await db
      .select({ rank: sql<number>`count(distinct ${scores.playerId})` })
      .from(scores)
      .where(and(...cond, gt(scores.score, score)));

    return json({ id: row.id, rank: Number(r?.rank ?? 0) + 1 });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}

export async function GET() {
  const rows = await db.select({ id: scores.id }).from(scores).orderBy(desc(scores.createdAt)).limit(1);
  return json({ ok: true, latest: rows[0]?.id ?? null });
}
