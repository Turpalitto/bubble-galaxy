import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { sql } from "drizzle-orm";
import { json } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [tot] = (
      await db.execute(sql`
        select coalesce(sum(total_popped),0)::bigint as popped,
               count(*)::int as players,
               coalesce(sum(games_played),0)::bigint as games
        from ${players}`)
    ).rows as Array<{ popped: string; players: number; games: string }>;
    const today = new Date().toISOString().slice(0, 10);
    const [leader] = (
      await db.execute(sql`
        select p.nickname, s.score from ${scores} s join ${players} p on p.id = s.player_id
        where s.mode = 'daily' and s.daily_date = ${today}::date
        order by s.score desc limit 1`)
    ).rows as Array<{ nickname: string; score: number }>;
    return json({
      popped: Number(tot?.popped ?? 0),
      players: Number(tot?.players ?? 0),
      games: Number(tot?.games ?? 0),
      dailyLeader: leader ? { nickname: leader.nickname, score: Number(leader.score) } : null,
    });
  } catch (e) {
    console.error(e);
    return json({ popped: 0, players: 0, games: 0, dailyLeader: null });
  }
}
