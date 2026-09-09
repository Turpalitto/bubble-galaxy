import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isUuid, json } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") ?? "endless";
    if (!["campaign", "endless", "daily"].includes(mode)) return json({ error: "bad_mode" }, 400);
    const date = url.searchParams.get("date");
    const level = Number(url.searchParams.get("level") ?? 0);
    const playerId = url.searchParams.get("playerId");

    const filters = [sql`s.mode = ${mode}::game_mode`];
    if (mode === "daily") {
      const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      filters.push(sql`s.daily_date = ${d}::date`);
    }
    if (mode === "campaign" && level > 0) filters.push(sql`s.level = ${level}`);
    const where = sql.join(filters, sql` and `);

    const rows = await db.execute(sql`
      with best as (
        select distinct on (s.player_id) s.player_id, s.score, s.level, s.max_combo, s.created_at
        from ${scores} s
        where ${where}
        order by s.player_id, s.score desc, s.created_at asc
      ),
      ranked as (
        select b.*, p.nickname, row_number() over (order by b.score desc, b.created_at asc) as rank
        from best b join ${players} p on p.id = b.player_id
      )
      select * from ranked where rank <= 50
      ${isUuid(playerId) ? sql`or player_id = ${playerId}::uuid` : sql``}
      order by rank asc
    `);

    const list = (rows.rows as Array<Record<string, unknown>>).map((r) => ({
      rank: Number(r.rank),
      playerId: String(r.player_id),
      nickname: String(r.nickname),
      score: Number(r.score),
      level: Number(r.level),
      maxCombo: Number(r.max_combo),
      isMe: isUuid(playerId) && r.player_id === playerId,
    }));

    const [countRow] = (
      await db.execute(sql`select count(distinct s.player_id) as c from ${scores} s where ${where}`)
    ).rows as Array<{ c: string }>;

    return json({ entries: list, totalPlayers: Number(countRow?.c ?? 0) });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}
