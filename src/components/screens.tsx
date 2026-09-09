"use client";
import { useEffect, useState } from "react";
import { Btn, Panel, Toggle } from "./ui";
import type { TKey, Lang } from "@/game/i18n";
import type { Mode } from "@/game/types";
import { CAMPAIGN_LEVELS } from "@/game/constants";
import { ACHIEVEMENTS, totalStars, type AchievementId, type Progress } from "@/game/storage";
import { fetchLeaderboard, fetchStats, type LeaderboardEntry, type Stats } from "@/lib/api-client";
import { msUntilNextDay, todayKey, dailyIndex } from "@/game/rng";

type T = (k: TKey) => string;

function useCountdown() {
  const [ms, setMs] = useState(() => msUntilNextDay());
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilNextDay()), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useAnimatedNumber(target: number) {
  const [v, setV] = useState(target);
  useEffect(() => {
    let raf = 0;
    const start = v, t0 = performance.now(), dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setV(Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return v;
}

// ─────────────────────────── MENU ───────────────────────────
export function MenuScreen({
  t, progress, onPlay, onLevels, onEndless, onDaily, onLeaderboard, onSettings,
}: {
  t: T;
  progress: Progress;
  onPlay: () => void;
  onLevels: () => void;
  onEndless: () => void;
  onDaily: () => void;
  onLeaderboard: () => void;
  onSettings: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const countdown = useCountdown();
  const today = todayKey();
  const dailyDone = !!progress.daily[today];
  useEffect(() => {
    let alive = true;
    const load = () => fetchStats().then((s) => alive && setStats(s)).catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const popped = useAnimatedNumber(Math.max(stats?.popped ?? 0, progress.totalPopped));

  return (
    <div className="flex h-full w-full flex-col items-center justify-between overflow-y-auto px-5 pb-6 pt-8 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex items-center justify-center gap-2">
          {["#FF3B5C", "#FFD60A", "#30D158", "#0A84FF", "#BF5AF2"].map((c, i) => (
            <span
              key={c}
              className="inline-block h-6 w-6 rounded-full shadow-[inset_-3px_-3px_6px_rgba(0,0,0,0.35),inset_3px_3px_6px_rgba(255,255,255,0.6)] animate-[float_2.4s_ease-in-out_infinite]"
              style={{ background: c, animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <h1 className="bg-gradient-to-br from-white via-fuchsia-200 to-violet-300 bg-clip-text text-5xl font-black tracking-tight text-transparent drop-shadow-[0_4px_30px_rgba(200,120,255,0.5)]">
          Bubble Galaxy
        </h1>
        <p className="mt-2 text-sm text-white/60">{t("tagline")}</p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-white/70">
          <span className="rounded-full bg-white/10 px-3 py-1">⭐ {totalStars(progress)}/{CAMPAIGN_LEVELS * 3}</span>
          <span className={`rounded-full px-3 py-1 ${progress.streak > 0 ? "bg-orange-500/30 text-orange-200" : "bg-white/10"}`}>
            🔥 {t("streak")}: {progress.streak} {t("days")}
          </span>
        </div>
      </div>

      <div className="my-6 grid w-full max-w-sm gap-3">
        <button onClick={onPlay} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 p-[2px] shadow-[0_10px_40px_rgba(168,85,247,0.45)] transition active:scale-[0.98]">
          <div className="flex items-center justify-between rounded-[22px] bg-[#141a45]/40 px-5 py-4 backdrop-blur">
            <div className="text-left">
              <div className="text-xl font-black">▶ {t("play")}</div>
              <div className="text-xs text-white/70">
                {t("level")} {progress.unlocked} · {t("campaignSub")}
              </div>
            </div>
            <span className="text-3xl transition group-hover:translate-x-1">🚀</span>
          </div>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <ModeCard icon="🗺️" title={t("campaign")} sub={`${Object.keys(progress.stars).length}/${CAMPAIGN_LEVELS}`} onClick={onLevels} />
          <ModeCard icon="♾️" title={t("endless")} sub={`${t("best")}: ${progress.bestEndless.toLocaleString()}`} onClick={onEndless} />
        </div>
        <button
          onClick={onDaily}
          className={`relative overflow-hidden rounded-3xl border px-5 py-4 text-left transition active:scale-[0.98] ${
            dailyDone ? "border-emerald-400/40 bg-emerald-500/10" : "border-amber-300/40 bg-gradient-to-r from-amber-500/20 to-orange-500/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black">
                📅 {t("daily")} <span className="text-white/50">#{dailyIndex()}</span>
              </div>
              <div className="text-xs text-white/70">
                {dailyDone ? `✅ ${t("dailyDone")}: ${progress.daily[today].score.toLocaleString()}` : t("dailySub")}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {t("nextDailyIn")} {countdown}
                {stats?.dailyLeader && <> · 👑 {stats.dailyLeader.nickname} {stats.dailyLeader.score.toLocaleString()}</>}
              </div>
            </div>
            {!dailyDone && <span className="animate-pulse text-2xl">✨</span>}
          </div>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Btn variant="secondary" onClick={onLeaderboard}>
            🏆 {t("leaderboard")}
          </Btn>
          <Btn variant="secondary" onClick={onSettings}>
            ⚙️ {t("settings")}
          </Btn>
        </div>
      </div>

      <div className="text-center text-xs text-white/50">
        <div className="text-base font-black text-white/80 tabular-nums">🫧 {popped.toLocaleString()}</div>
        <div>
          {t("worldPopped")} · {stats?.players ?? 0} {t("players")}
        </div>
      </div>
    </div>
  );
}

function ModeCard({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.98]">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 font-black">{title}</div>
      <div className="text-[11px] text-white/60">{sub}</div>
    </button>
  );
}

// ─────────────────────────── LEVEL SELECT ───────────────────────────
export function LevelSelect({ t, progress, onPick, onBack }: { t: T; progress: Progress; onPick: (l: number) => void; onBack: () => void }) {
  return (
    <div className="flex h-full w-full flex-col text-white">
      <Header title={t("campaign")} onBack={onBack} right={`⭐ ${totalStars(progress)}`} />
      <div className="grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto px-4 pb-8 sm:grid-cols-5">
        {Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1).map((l) => {
          const locked = l > progress.unlocked;
          const st = progress.stars[l] ?? 0;
          const current = l === progress.unlocked;
          return (
            <button
              key={l}
              disabled={locked}
              onClick={() => onPick(l)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border text-lg font-black transition active:scale-95 ${
                locked
                  ? "border-white/5 bg-white/5 text-white/25"
                  : current
                    ? "border-amber-300/60 bg-gradient-to-br from-fuchsia-500/40 to-violet-600/40 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                    : "border-white/10 bg-white/10 hover:bg-white/15"
              }`}
            >
              {locked ? "🔒" : l}
              {!locked && (
                <div className="mt-0.5 text-[10px] leading-none">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={i <= st ? "text-amber-300" : "text-white/20"}>
                      ★
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── LEADERBOARD ───────────────────────────
export function LeaderboardScreen({
  t, progress, initialMode, initialLevel, onBack,
}: {
  t: T;
  progress: Progress;
  initialMode: Mode;
  initialLevel?: number;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [level, setLevel] = useState(initialLevel ?? Math.max(1, progress.unlocked - 1));
  const [state, setState] = useState<{ key: string; data: { entries: LeaderboardEntry[]; totalPlayers: number } | null; err: boolean }>({ key: "", data: null, err: false });
  const queryKey = `${mode}:${level}:${progress.playerId ?? ""}`;
  useEffect(() => {
    let alive = true;
    fetchLeaderboard(mode, { level: mode === "campaign" ? level : undefined, playerId: progress.playerId })
      .then((d) => alive && setState({ key: queryKey, data: d, err: false }))
      .catch(() => alive && setState({ key: queryKey, data: null, err: true }));
    return () => {
      alive = false;
    };
  }, [mode, level, progress.playerId, queryKey]);
  const fresh = state.key === queryKey;
  const data = fresh ? state.data : null;
  const err = fresh && state.err;

  const tabs: [Mode, string][] = [["daily", t("today")], ["endless", t("endless")], ["campaign", t("campaign")]];
  return (
    <div className="flex h-full w-full flex-col text-white">
      <Header title={t("leaderboard")} onBack={onBack} right={data ? `${data.totalPlayers} ${t("players")}` : ""} />
      <div className="mx-4 mb-3 grid grid-cols-3 rounded-2xl bg-white/5 p-1">
        {tabs.map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-xl py-2 text-sm font-bold transition ${mode === m ? "bg-white/15 shadow" : "text-white/60"}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === "campaign" && (
        <div className="mx-4 mb-3 flex items-center gap-2">
          <span className="text-sm text-white/60">{t("level")}</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="rounded-xl bg-white/10 px-3 py-1.5 text-sm font-bold text-white outline-none">
            {Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l} className="text-slate-900">
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {!data && !err && <div className="py-10 text-center text-white/50">{t("loading")}</div>}
        {err && <div className="py-10 text-center text-white/50">{t("offline")}</div>}
        {data && data.entries.length === 0 && <div className="py-10 text-center text-white/50">{t("noScores")}</div>}
        <div className="space-y-1.5">
          {data?.entries.map((e) => (
            <div
              key={e.playerId + e.rank}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${e.isMe ? "border border-amber-300/50 bg-amber-400/15" : "bg-white/5"}`}
            >
              <div className={`w-8 text-center text-lg font-black ${e.rank <= 3 ? "text-amber-300" : "text-white/60"}`}>
                {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : e.rank}
              </div>
              <div className="flex-1 truncate font-semibold">
                {e.nickname} {e.isMe && <span className="text-xs text-amber-300">({t("you")})</span>}
              </div>
              <div className="text-right">
                <div className="font-black tabular-nums">{e.score.toLocaleString()}</div>
                <div className="text-[10px] text-white/50">
                  {mode === "endless" ? `${t("wave")} ${e.level}` : `${t("combo")} x${e.maxCombo}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── SETTINGS ───────────────────────────
export function SettingsScreen({
  t, progress, lang, onLang, onSetting, onRename, onBack,
}: {
  t: T;
  progress: Progress;
  lang: Lang;
  onLang: (l: Lang) => void;
  onSetting: (k: "sound" | "music" | "haptics", v: boolean) => void;
  onRename: (n: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const [name, setName] = useState(progress.nickname ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex h-full w-full flex-col text-white">
      <Header title={t("settings")} onBack={onBack} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8">
        <Panel className="space-y-2">
          <Toggle on={progress.settings.sound} onChange={(v) => onSetting("sound", v)} label={`🔊 ${t("sound")}`} />
          <Toggle on={progress.settings.music} onChange={(v) => onSetting("music", v)} label={`🎵 ${t("music")}`} />
          <Toggle on={progress.settings.haptics} onChange={(v) => onSetting("haptics", v)} label={`📳 ${t("haptics")}`} />
          <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
            <span className="font-semibold">🌐 {t("language")}</span>
            <div className="flex rounded-xl bg-white/10 p-1">
              {(["ru", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => onLang(l)} className={`rounded-lg px-3 py-1 text-sm font-bold uppercase ${lang === l ? "bg-white/20" : "text-white/50"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="mb-2 font-bold">👤 {t("nickname")}</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-fuchsia-400"
              placeholder={t("yourName")}
            />
            <Btn
              disabled={saving || name.trim().length < 2}
              onClick={async () => {
                setSaving(true);
                const ok = await onRename(name.trim());
                setMsg(ok ? "✓" : "✗");
                setSaving(false);
                setTimeout(() => setMsg(null), 1500);
              }}
            >
              {msg ?? t("save")}
            </Btn>
          </div>
        </Panel>
        <Panel>
          <div className="mb-2 font-bold">🏅 {t("achievements")}</div>
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((a: AchievementId) => {
              const got = progress.achievements.includes(a);
              return (
                <div key={a} className={`rounded-2xl px-3 py-2 text-sm ${got ? "bg-amber-400/15 text-amber-100" : "bg-white/5 text-white/40"}`}>
                  {got ? "🏆" : "🔒"} {t(`achv_${a}` as TKey)}
                </div>
              );
            })}
          </div>
        </Panel>
        <div className="text-center text-xs text-white/40">
          {t("popped")}: {progress.totalPopped.toLocaleString()} · v1.0
        </div>
      </div>
    </div>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: string }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 pt-4">
      <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg hover:bg-white/20" aria-label="back">
        ←
      </button>
      <div className="text-lg font-black">{title}</div>
      <div className="min-w-10 text-right text-xs text-white/60">{right}</div>
    </div>
  );
}
