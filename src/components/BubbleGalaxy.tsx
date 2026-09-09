"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameView, { type GameResult } from "./GameView";
import { LeaderboardScreen, LevelSelect, MenuScreen, SettingsScreen } from "./screens";
import { campaignConfig, dailyConfig, endlessConfig } from "@/game/levels";
import { CAMPAIGN_LEVELS } from "@/game/constants";
import { detectLang, makeT, type Lang } from "@/game/i18n";
import { loadProgress, saveProgress, defaultProgress, type Progress, type AchievementId } from "@/game/storage";
import type { Booster, LevelConfig, Mode } from "@/game/types";
import { audio } from "@/game/audio";
import { createPlayer, renamePlayer, submitScore } from "@/lib/api-client";
import { todayKey } from "@/game/rng";
import { platform } from "@/game/platform";

type Screen =
  | { name: "menu" }
  | { name: "levels" }
  | { name: "game"; cfg: LevelConfig; attempt: number; official: boolean }
  | { name: "leaderboard"; mode: Mode; level?: number }
  | { name: "settings" };

export default function BubbleGalaxy() {
  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "menu" });
  const [achToast, setAchToast] = useState<string | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const p = loadProgress();
    setProgress(p);
    setHydrated(true);
    audio.setSound(p.settings.sound);
    audio.setMusic(false);
    audio.musicOn = p.settings.music;
    void platform.ready();
  }, []);
  useEffect(() => {
    if (hydrated) saveProgress(progress);
  }, [progress, hydrated]);

  const lang: Lang = progress.settings.lang ?? (hydrated ? detectLang() : "ru");
  const t = useMemo(() => makeT(lang), [lang]);

  const update = useCallback((fn: (p: Progress) => Progress) => setProgress((p) => fn(p)), []);

  const ensurePlayer = useCallback(async (): Promise<{ id: string; token: string } | null> => {
    const p = progressRef.current;
    if (p.playerId && p.token) return { id: p.playerId, token: p.token };
    try {
      const created = await createPlayer(p.nickname ?? undefined);
      const next = { ...progressRef.current, playerId: created.id, token: created.token, nickname: created.nickname };
      progressRef.current = next;
      setProgress(next);
      return { id: created.id, token: created.token };
    } catch {
      return null;
    }
  }, [update]);

  const unlockAch = (p: Progress, id: AchievementId, list: string[]): Progress => {
    if (p.achievements.includes(id)) return p;
    list.push(t(`achv_${id}`));
    return { ...p, achievements: [...p.achievements, id] };
  };

  // ── result handling (sync progress update) ──
  const onFinished = useCallback(
    (r: GameResult) => {
      let newRecord = false;
      const rewards: Partial<Record<Booster, number>> = {};
      const unlockedNames: string[] = [];
      const compute = (p0: Progress): Progress => {
        let p: Progress = { ...p0, totalPopped: p0.totalPopped + r.popped, gamesPlayed: p0.gamesPlayed + 1, stars: { ...p0.stars }, bestLevelScore: { ...p0.bestLevelScore }, boosters: { ...p0.boosters }, daily: { ...p0.daily } };
        if (r.mode === "campaign") {
          if (r.won) {
            const prevStars = p.stars[r.level] ?? 0;
            p.stars[r.level] = Math.max(prevStars, r.stars);
            if (r.level >= p.unlocked && r.level < CAMPAIGN_LEVELS) p.unlocked = r.level + 1;
            if (r.stars === 3 && prevStars < 3) {
              const b: Booster = (["bomb", "rainbow", "laser"] as Booster[])[r.level % 3];
              rewards[b] = (rewards[b] ?? 0) + 1;
            }
            if (r.level % 5 === 0) rewards.bomb = (rewards.bomb ?? 0) + 1;
          }
          if (r.score > (p.bestLevelScore[r.level] ?? 0)) {
            newRecord = (p.bestLevelScore[r.level] ?? 0) > 0;
            p.bestLevelScore[r.level] = r.score;
          }
          if (Object.values(p.stars).filter((s) => s === 3).length >= 10) p = unlockAch(p, "stars10", unlockedNames);
        } else if (r.mode === "endless") {
          if (r.score > p.bestEndless) {
            newRecord = p.bestEndless > 0;
            p.bestEndless = r.score;
          }
          p.bestEndlessWave = Math.max(p.bestEndlessWave, r.wave);
          if (r.wave >= 10) p = unlockAch(p, "wave10", unlockedNames);
          if (r.wave >= 5) rewards.rainbow = (rewards.rainbow ?? 0) + 1;
        } else {
          const key = todayKey();
          if (!p.daily[key]) {
            p.daily[key] = { score: r.score, combo: r.maxCombo, popped: r.popped };
            const y = new Date();
            y.setUTCDate(y.getUTCDate() - 1);
            const yesterday = todayKey(y);
            p.streak = p.lastDaily === yesterday ? p.streak + 1 : 1;
            p.lastDaily = key;
            rewards.laser = (rewards.laser ?? 0) + 1;
            if (p.streak >= 7) p = unlockAch(p, "streak7", unlockedNames);
          }
        }
        if (r.maxCombo >= 5) {
          p = unlockAch(p, "combo5", unlockedNames);
          p = unlockAch(p, "fever", unlockedNames);
        }
        if (p.totalPopped >= 1000) p = unlockAch(p, "pop1000", unlockedNames);
        for (const [b, n] of Object.entries(rewards) as [Booster, number][]) p.boosters[b] += n;
        return p;
      };
      const nextProgress = compute(progressRef.current);
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      if (unlockedNames.length) {
        setAchToast(`🏅 ${t("unlocked")}: ${unlockedNames.join(", ")}`);
        setTimeout(() => setAchToast(null), 3500);
      }
      return { newRecord, rewards };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update, t],
  );

  const onSubmit = useCallback(
    async (r: GameResult): Promise<number | null> => {
      const player = await ensurePlayer();
      if (!player) return null;
      try {
        const res = await submitScore({
          token: player.token,
          mode: r.mode,
          score: r.score,
          level: r.mode === "endless" ? r.wave : r.level,
          maxCombo: r.maxCombo,
          popped: r.popped,
          dailyDate: r.mode === "daily" ? todayKey() : undefined,
        });
        return res.rank;
      } catch {
        return null;
      }
    },
    [ensurePlayer],
  );

  const onSetting = (k: "sound" | "music" | "haptics", v: boolean) => {
    update((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));
    if (k === "sound") audio.setSound(v);
    if (k === "music") audio.setMusic(v);
  };

  const onRename = async (n: string) => {
    const player = await ensurePlayer();
    if (!player) return false;
    try {
      const r = await renamePlayer(player.token, n);
      update((p) => ({ ...p, nickname: r.nickname }));
      return true;
    } catch {
      return false;
    }
  };

  const startGame = (cfg: LevelConfig) => {
    audio.unlock();
    platform.gameplayStart();
    const official = cfg.mode !== "daily" || !progressRef.current.daily[todayKey()];
    setScreen({ name: "game", cfg, attempt: Date.now(), official });
  };
  const goMenu = () => {
    platform.gameplayStop();
    setScreen({ name: "menu" });
  };

  const today = todayKey();

  const shell = (children: React.ReactNode) => (
    <main className="fixed inset-0 flex items-center justify-center bg-[#070a1f] text-white">
      <div className="relative h-full w-full max-w-[520px] bg-gradient-to-b from-[#0b1030] via-[#141a4a] to-[#070a1f] sm:my-4 sm:h-[calc(100%-2rem)] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl">
        <div className="pointer-events-none absolute inset-0 overflow-hidden sm:rounded-3xl">
          <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-24 bottom-1/4 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        </div>
        <div className="relative h-full">{children}</div>
        {achToast && (
          <div className="absolute left-1/2 top-4 z-50 w-[90%] -translate-x-1/2 rounded-2xl bg-amber-300 px-4 py-2 text-center text-sm font-black text-slate-900 shadow-xl animate-[fadeIn_0.3s_ease-out]">
            {achToast}
          </div>
        )}
      </div>
    </main>
  );

  if (!hydrated) return shell(<div className="flex h-full items-center justify-center text-white/50">{t("loading")}</div>);

  switch (screen.name) {
    case "menu":
      return shell(
        <MenuScreen
          t={t}
          progress={progress}
          onPlay={() => startGame(campaignConfig(progress.unlocked))}
          onLevels={() => setScreen({ name: "levels" })}
          onEndless={() => startGame(endlessConfig())}
          onDaily={() => startGame(dailyConfig())}
          onLeaderboard={() => setScreen({ name: "leaderboard", mode: "daily" })}
          onSettings={() => setScreen({ name: "settings" })}
        />,
      );
    case "levels":
      return shell(<LevelSelect t={t} progress={progress} onPick={(l) => startGame(campaignConfig(l))} onBack={goMenu} />);
    case "leaderboard":
      return shell(<LeaderboardScreen t={t} progress={progress} initialMode={screen.mode} initialLevel={screen.level} onBack={goMenu} />);
    case "settings":
      return shell(
        <SettingsScreen t={t} progress={progress} lang={lang} onLang={(l) => update((p) => ({ ...p, settings: { ...p.settings, lang: l } }))} onSetting={onSetting} onRename={onRename} onBack={goMenu} />,
      );
    case "game": {
      const cfg = screen.cfg;
      const best = cfg.mode === "campaign" ? (progress.bestLevelScore[cfg.level] ?? 0) : cfg.mode === "endless" ? progress.bestEndless : (progress.daily[today]?.score ?? 0);
      return shell(
        <GameView
          key={`${cfg.mode}-${cfg.level}-${screen.attempt}`}
          cfg={cfg}
          lang={lang}
          t={t}
          boosters={progress.boosters}
          settings={progress.settings}
          best={best}
          streak={progress.streak}
          dailyOfficial={screen.official}
          hasNext={cfg.mode === "campaign" && cfg.level < CAMPAIGN_LEVELS}
          onUseBooster={(b) => update((p) => ({ ...p, boosters: { ...p.boosters, [b]: Math.max(0, p.boosters[b] - 1) } }))}
          onFinished={onFinished}
          onSubmit={onSubmit}
          onSetting={onSetting}
          onExit={goMenu}
          onNext={() => startGame(campaignConfig(cfg.level + 1))}
          onRetry={() => startGame(cfg.mode === "endless" ? endlessConfig() : cfg)}
          onLeaderboard={() => setScreen({ name: "leaderboard", mode: cfg.mode, level: cfg.level })}
        />,
      );
    }
  }
}
