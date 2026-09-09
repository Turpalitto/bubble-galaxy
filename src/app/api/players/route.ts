import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { json, makeToken, randomNickname, sanitizeNickname } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { nickname?: string };
    const nickname = sanitizeNickname(body.nickname) ?? randomNickname();
    const token = makeToken();
    const [p] = await db.insert(players).values({ nickname, token }).returning({ id: players.id, nickname: players.nickname });
    return json({ id: p.id, nickname: p.nickname, token });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string; nickname?: string };
    if (!body.token) return json({ error: "unauthorized" }, 401);
    const nickname = sanitizeNickname(body.nickname);
    if (!nickname) return json({ error: "invalid_nickname" }, 400);
    const [p] = await db
      .update(players)
      .set({ nickname, lastSeenAt: new Date() })
      .where(eq(players.token, body.token))
      .returning({ id: players.id, nickname: players.nickname });
    if (!p) return json({ error: "not_found" }, 404);
    return json(p);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
}
