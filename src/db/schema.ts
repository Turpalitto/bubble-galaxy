import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  timestamp,
  date,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const gameModeEnum = pgEnum("game_mode", ["campaign", "endless", "daily"]);

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: varchar("nickname", { length: 24 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  totalPopped: bigint("total_popped", { mode: "number" }).notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    mode: gameModeEnum("mode").notNull(),
    score: integer("score").notNull(),
    level: integer("level").notNull().default(0),
    dailyDate: date("daily_date"),
    maxCombo: integer("max_combo").notNull().default(0),
    popped: integer("popped").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scores_mode_score_idx").on(t.mode, t.score),
    index("scores_daily_idx").on(t.dailyDate, t.score),
    index("scores_player_idx").on(t.playerId),
  ],
);

export type Player = typeof players.$inferSelect;
export type Score = typeof scores.$inferSelect;
