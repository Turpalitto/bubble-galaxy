"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BubbleEngine } from "@/game/engine";
import { render } from "@/game/render";
import { LOGICAL_H, LOGICAL_W, SHOOTER_Y, R } from "@/game/constants";
import { audio, haptic } from "@/game/audio";
import type { Booster, EngineSnapshot, LevelConfig } from "@/game/types";
import type { TKey } from "@/game/i18n";
import { buildShareText, share } from "@/game/share";
import { Btn, Overlay, Panel, Stars, Toggle } from "./ui";
import type { Lang } from "@/game/i18n";

export interface GameResult {
  mode: LevelConfig["mode"];
  level: number;
  score: number;
  stars: number;
  maxCombo: number;
  popped: number;
  won: boolean;
  wave: number;
}

interface Props {
  cfg: LevelConfig;
  lang: Lang;
  t: (k: TKey) => string;
  boosters: Record<Booster, number>;
  settings: { sound: boolean; music: boolean; haptics: boolean };
  best: number;
  streak: number;
  dailyOfficial: boolean;
  onUseBooster: (b: Booster) => void;
  onFinished: (r: GameResult) => { newRecord: boolean; rewards: Partial<Record<Booster, number>> };
  onSubmit: (r: GameResult) => Promise<number | null>;
  onSetting: (k: "sound" | "music" | "haptics", v: boolean) => void;
  onExit: () => void;
  onNext: () => void;
  onRetry: () => void;
  onLeaderboard: () => void;
  hasNext: boolean;
}

const BOOSTER_ICON: Record<Booster, string> = { bomb: "💣", rainbow: "🌈", laser: "🎯" };

export default function GameView(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BubbleEngine | null>(null);
  const pausedRef = useRef(false);
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<(GameResult & { newRecord: boolean; rewards: Partial<Record<Booster, number>>; rank: number | null; submitting: boolean }) | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tutorialStep, setTutorialStep] = useState(p.cfg.tutorial ? 1 : 0);
  const [scoreBump, setScoreBump] = useState(0);
  const [size, setSize] = useState({ w: LOGICAL_W, h: LOGICAL_H });
  const pointerDown = useRef(false);
  const { t } = p;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // ── engine lifecycle ──
  useEffect(() => {
    const engine = new BubbleEngine(p.cfg);
    engineRef.current = engine;
    setSnap(engine.snapshot());
    setResult(null);
    setPaused(false);
    pausedRef.current = false;
    let finished = false;

    const off = engine.on((e) => {
      switch (e.type) {
        case "shoot":
          audio.shoot();
          break;
        case "bounce":
          audio.bounce();
          break;
        case "stick":
          audio.stick();
          break;
        case "pop":
          audio.pop(e.combo, e.count);
          if (e.special === "bomb") audio.explode();
          if (e.special === "lightning") audio.zap();
          if (p.settings.haptics) haptic(e.special ? [20, 30, 40] : 12);
          setScoreBump((s) => s + 1);
          setTutorialStep((s) => (s === 1 ? 2 : s === 2 ? 0 : s));
          break;
        case "fall":
          audio.fall(e.count);
          break;
        case "fever":
          audio.feverStart();
          audio.setFever(true);
          if (p.settings.haptics) haptic([30, 40, 30, 40, 60]);
          break;
        case "wave":
          audio.wave();
          break;
        case "won":
        case "lost": {
          if (finished) break;
          finished = true;
          audio.setFever(false);
          if (e.type === "won") {
            audio.win();
            if (p.settings.haptics) haptic([40, 60, 40, 60, 120]);
          } else {
            audio.lose();
            if (p.settings.haptics) haptic(200);
          }
          const r: GameResult = {
            mode: p.cfg.mode,
            level: p.cfg.level,
            score: engine.score,
            stars: engine.stars,
            maxCombo: engine.maxCombo,
            popped: engine.popped,
            won: e.type === "won",
            wave: engine.wave,
          };
          const { newRecord, rewards } = p.onFinished(r);
          setTimeout(() => {
            const shouldSubmit = p.dailyOfficial;
            setResult({ ...r, newRecord, rewards, rank: null, submitting: shouldSubmit });
            if (shouldSubmit) void p.onSubmit(r).then((rank) => setResult((cur) => (cur ? { ...cur, rank, submitting: false } : cur)));
          }, 900);
          break;
        }
      }
    });

    // ── loop ──
    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = (now - last) / 1000;
      last = now;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!pausedRef.current) engine.update(dt);
      if (engine.fever !== audio.fever) audio.setFever(engine.fever);
      render(ctx, engine, now / 1000);
      hudAcc += dt;
      if (hudAcc > 0.12) {
        hudAcc = 0;
        setSnap(engine.snapshot());
      }
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden && engine.status !== "won" && engine.status !== "lost") {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      off();
      document.removeEventListener("visibilitychange", onVis);
      audio.setFever(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.cfg]);

  // ── resize ──
  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current, canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const rect = wrap.getBoundingClientRect();
      const scale = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${LOGICAL_W * scale}px`;
      canvas.style.height = `${LOGICAL_H * scale}px`;
      setSize({ w: LOGICAL_W * scale, h: LOGICAL_H * scale });
      canvas.width = Math.round(LOGICAL_W * scale * dpr);
      canvas.height = Math.round(LOGICAL_H * scale * dpr);
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  // ── input ──
  const toLogical = (ev: { clientX: number; clientY: number }) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * LOGICAL_W, y: ((ev.clientY - r.top) / r.height) * LOGICAL_H };
  };
  const onPointerDown = (ev: React.PointerEvent) => {
    audio.unlock();
    if (paused || result) return;
    pointerDown.current = true;
    const { x, y } = toLogical(ev);
    engineRef.current?.setAim(x, y);
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    if (paused || result) return;
    if (ev.pointerType === "touch" && !pointerDown.current) return;
    const { x, y } = toLogical(ev);
    engineRef.current?.setAim(x, y);
  };
  const onPointerUp = (ev: React.PointerEvent) => {
    if (!pointerDown.current) return;
    pointerDown.current = false;
    if (paused || result) return;
    const e = engineRef.current;
    if (!e) return;
    const { x, y } = toLogical(ev);
    if (y > SHOOTER_Y - R * 1.6) {
      e.swap();
      audio.click();
      return;
    }
    e.setAim(x, y);
    e.shoot();
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === "Space") {
        ev.preventDefault();
        engineRef.current?.swap();
      }
      if (ev.code === "Escape" || ev.code === "KeyP") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const togglePause = () => {
    if (result) return;
    const e = engineRef.current;
    if (!e || e.status === "won" || e.status === "lost") return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const activateBooster = (b: Booster) => {
    const e = engineRef.current;
    if (!e || p.boosters[b] <= 0) return;
    if (e.applyBooster(b)) {
      p.onUseBooster(b);
      audio.click();
    }
  };

  const doShare = async () => {
    if (!result) return;
    const text = buildShareText({
      mode: result.mode,
      score: result.score,
      level: result.mode === "endless" ? result.wave : result.level,
      stars: result.stars,
      maxCombo: result.maxCombo,
      streak: p.streak,
      dailyIndex: result.level,
      lang: p.lang,
    });
    const r = await share(text);
    if (r === "copied") showToast(t("copied"));
  };

  const s = snap;
  const modeLabel = useMemo(() => {
    if (p.cfg.mode === "campaign") return `${t("level")} ${p.cfg.level}`;
    if (p.cfg.mode === "daily") return `${t("dailyNo")}${p.cfg.level}`;
    return `${t("wave")} ${s?.wave ?? 1}`;
  }, [p.cfg, s?.wave, t]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="touch-none select-none rounded-none sm:rounded-3xl sm:shadow-[0_0_80px_rgba(120,80,255,0.25)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointerDown.current = false)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: size.w, height: size.h }}>
          <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-2 text-white">
            <button
              onClick={togglePause}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg backdrop-blur hover:bg-white/20"
              aria-label={t("pause")}
            >
              ⏸
            </button>
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase tracking-widest text-white/60">{modeLabel}</div>
              <div key={scoreBump} className="text-2xl font-black tabular-nums drop-shadow animate-[bump_0.25s_ease-out]">
                {(s?.score ?? 0).toLocaleString()}
              </div>
              {s && s.combo > 1 && (
                <div className="mt-0.5 rounded-full bg-amber-400/90 px-2 py-0.5 text-[11px] font-black text-slate-900 animate-[bump_0.25s_ease-out]">
                  {t("combo")} x{s.combo}
                </div>
              )}
            </div>
            <div className="flex min-w-[64px] flex-col items-end rounded-xl bg-white/10 px-2 py-1 backdrop-blur">
              {p.cfg.mode === "endless" ? (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-white/60">{t("nextWave")}</div>
                  <div className="text-lg font-black tabular-nums">{s?.shotsToNextWave ?? 0}</div>
                </>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-white/60">{t("shots")}</div>
                  <div className={`text-lg font-black tabular-nums ${s && s.shotsLeft <= 5 ? "text-rose-400" : ""}`}>{s?.shotsLeft ?? 0}</div>
                </>
              )}
            </div>
          </div>

          {s?.fever && (
            <div className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center">
              <div className="animate-pulse bg-gradient-to-r from-pink-400 via-amber-300 to-pink-400 bg-clip-text text-4xl font-black text-transparent drop-shadow-[0_0_20px_rgba(255,120,200,0.8)]">
                {t("fever")}
              </div>
              <div className="mx-auto mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-gradient-to-r from-pink-400 to-amber-300" style={{ width: `${(s.feverTime / 8) * 100}%` }} />
              </div>
            </div>
          )}

          {tutorialStep > 0 && !result && (
            <div className="absolute left-1/2 top-[52%] w-[85%] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/60 px-4 py-3 text-center text-sm font-semibold text-white backdrop-blur animate-[fadeIn_0.4s_ease-out]">
              {tutorialStep === 1 ? t("tutorial") : t("tutorial2")}
            </div>
          )}

          {/* boosters */}
          <div className="pointer-events-auto absolute bottom-2 left-2 flex gap-2">
            {(["bomb", "rainbow", "laser"] as Booster[]).map((b) => {
              const active = (b === "laser" && (s?.laserShots ?? 0) > 0) || (b !== "laser" && s?.currentSpecial === b);
              return (
                <button
                  key={b}
                  onClick={() => activateBooster(b)}
                  disabled={p.boosters[b] <= 0 || !!result}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-xl backdrop-blur transition active:scale-95 disabled:opacity-35 ${
                    active ? "border-amber-300 bg-amber-400/30 shadow-[0_0_16px_rgba(251,191,36,0.6)]" : "border-white/15 bg-white/10"
                  }`}
                  title={t(b === "bomb" ? "boostBomb" : b === "rainbow" ? "boostRainbow" : "boostLaser")}
                >
                  {BOOSTER_ICON[b]}
                  <span className="absolute -right-1 -top-1 rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-black text-white">{p.boosters[b]}</span>
                </button>
              );
            })}
          </div>

          {toast && (
            <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg animate-[fadeIn_0.2s_ease-out]">
              {toast}
            </div>
          )}
        </div>
      </div>

      {/* Pause */}
      {paused && !result && (
        <Overlay>
          <Panel className="w-full max-w-xs text-white">
            <h2 className="mb-4 text-center text-2xl font-black">{t("pause")}</h2>
            <div className="mb-4 space-y-2">
              <Toggle on={p.settings.sound} onChange={(v) => p.onSetting("sound", v)} label={`🔊 ${t("sound")}`} />
              <Toggle on={p.settings.music} onChange={(v) => p.onSetting("music", v)} label={`🎵 ${t("music")}`} />
            </div>
            <div className="grid gap-2">
              <Btn onClick={togglePause}>{t("resume")}</Btn>
              <Btn variant="secondary" onClick={p.onRetry}>
                {t("restart")}
              </Btn>
              <Btn variant="ghost" onClick={p.onExit}>
                {t("menu")}
              </Btn>
            </div>
          </Panel>
        </Overlay>
      )}

      {/* Result */}
      {result && (
        <Overlay>
          <Panel className="w-full max-w-sm text-center text-white">
            {result.won && <Confetti />}
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">{modeLabel}</div>
            <h2 className="mt-1 text-3xl font-black">
              {result.mode === "daily" ? t("dailyResult") : result.won ? t("levelComplete") : t("gameOver")}
            </h2>
            {result.mode === "campaign" && result.won && (
              <div className="mt-3">
                <Stars n={result.stars} size="text-5xl" />
              </div>
            )}
            {result.newRecord && (
              <div className="mx-auto mt-3 inline-block rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-1 text-sm font-black text-slate-900 shadow-lg animate-[bump_0.4s_ease-out]">
                🏆 {t("newRecord")}
              </div>
            )}
            <div className="mt-4 text-5xl font-black tabular-nums tracking-tight">{result.score.toLocaleString()}</div>
            <div className="mt-1 text-sm text-white/60">
              {t("best")}: {Math.max(p.best, result.score).toLocaleString()}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Stat label={t("maxCombo")} value={`x${result.maxCombo}`} />
              <Stat label={t("popped")} value={String(result.popped)} />
              <Stat
                label={t("rank")}
                value={result.submitting ? "…" : result.rank ? `#${result.rank}` : "—"}
              />
            </div>
            {Object.keys(result.rewards).length > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                <span className="text-white/60">{t("boosters")}:</span>
                {(Object.entries(result.rewards) as [Booster, number][]).map(([b, n]) => (
                  <span key={b} className="rounded-full bg-white/10 px-2 py-0.5 font-bold">
                    {BOOSTER_ICON[b]} +{n}
                  </span>
                ))}
              </div>
            )}
            {result.mode === "daily" && !p.dailyOfficial && <div className="mt-2 text-xs text-white/50">{t("practice")}</div>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {result.won && p.hasNext && result.mode === "campaign" ? (
                <Btn variant="gold" className="col-span-2" onClick={p.onNext}>
                  {t("next")} →
                </Btn>
              ) : null}
              <Btn variant="secondary" onClick={p.onRetry}>
                ↻ {t("retry")}
              </Btn>
              <Btn onClick={doShare}>📤 {t("share")}</Btn>
              <Btn variant="ghost" onClick={p.onLeaderboard}>
                🏆 {t("leaderboard")}
              </Btn>
              <Btn variant="ghost" onClick={p.onExit}>
                {t("menu")}
              </Btn>
            </div>
          </Panel>
        </Overlay>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.12}s`,
        color: ["#FF3B5C", "#FF9F0A", "#FFD60A", "#30D158", "#0A84FF", "#BF5AF2"][i % 6],
        rot: (i * 53) % 360,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {pieces.map((c, i) => (
        <span
          key={i}
          className="absolute -top-3 block h-3 w-2 animate-[confetti_1.8s_ease-in_forwards]"
          style={{ left: c.left, background: c.color, animationDelay: c.delay, transform: `rotate(${c.rot}deg)` }}
        />
      ))}
    </div>
  );
}
