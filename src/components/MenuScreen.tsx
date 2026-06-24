import { useEffect, useRef, useState } from 'react';
import { BUBBLE_COLORS } from '../game/constants';
import type { PlayerProgress } from '../game/types';
import type { GameLang } from '../utils/i18n';
import { t, localeOf } from '../utils/i18n';
import LevelSelectScreen from './LevelSelectScreen';
import LeaderboardPanel, { type LeaderboardTab } from './LeaderboardPanel';
import type { LeaderboardData } from '../utils/leaderboard';

type MenuView = 'main' | 'levels' | 'leaderboard';

interface MenuScreenProps {
  lang: GameLang;
  highScore: number;
  dailyPending: boolean;
  progress: PlayerProgress;
  achievementCount: number;
  onSelectLevel: (level: number) => void;
  onEndless: () => void;
  onDaily: () => void;
  leaderboardData: LeaderboardData | null;
  leaderboardLoading: boolean;
  leaderboardTab: LeaderboardTab;
  onLeaderboardTabChange: (tab: LeaderboardTab) => void;
  onOpenLeaderboard: () => void;
  onRefreshLeaderboard: () => void;
}

export default function MenuScreen({
  lang,
  highScore,
  dailyPending,
  progress,
  achievementCount,
  onSelectLevel,
  onEndless,
  onDaily,
  leaderboardData,
  leaderboardLoading,
  leaderboardTab,
  onLeaderboardTabChange,
  onOpenLeaderboard,
  onRefreshLeaderboard,
}: MenuScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const [view, setView] = useState<MenuView>('main');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const bubbles = Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * canvas.height,
      r: 15 + Math.random() * 30,
      color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      speed: 0.4 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.3,
    }));

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubbles.forEach((b) => {
        b.y -= b.speed;
        b.x += b.drift;
        if (b.y < -b.r * 2) { b.y = canvas.height + b.r; b.x = Math.random() * canvas.width; }

        const alpha = Math.min(1, (canvas.height - b.y) / (canvas.height * 0.3)) * 0.25;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, b.color + 'cc');
        g.addColorStop(1, b.color + '44');
        ctx.fillStyle = g;
        ctx.shadowBlur = 15;
        ctx.shadowColor = b.color;
        ctx.fill();
        ctx.restore();
      });
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleOpenLeaderboard = () => {
    setView('leaderboard');
    onOpenLeaderboard();
  };

  const totalStars = progress.levelStars.reduce((a, b) => a + b, 0);
  const loc = localeOf(lang);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0d0221 0%, #1a0533 60%, #0a1628 100%)' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {view === 'levels' && (
        <LevelSelectScreen
          lang={lang}
          progress={progress}
          onSelectLevel={(lvl) => { onSelectLevel(lvl); setView('main'); }}
          onBack={() => setView('main')}
        />
      )}

      {view === 'leaderboard' && (
        <LeaderboardPanel
          lang={lang}
          data={leaderboardData}
          loading={leaderboardLoading}
          tab={leaderboardTab}
          onTabChange={onLeaderboardTabChange}
          onBack={() => setView('main')}
          onRefresh={onRefreshLeaderboard}
        />
      )}

      <div className={`relative z-10 flex flex-col items-center gap-3 px-6 py-5 w-full max-w-sm overflow-y-auto max-h-screen ${view !== 'main' ? 'hidden' : ''}`}>

        <div className="flex items-end justify-center gap-1.5">
          {[
            { c: '#FF3B5C', s: 22 }, { c: '#FFCC00', s: 30 }, { c: '#34C759', s: 24 },
            { c: '#007AFF', s: 28 }, { c: '#AF52DE', s: 20 },
          ].map((b, i) => (
            <div
              key={i}
              className="rounded-full animate-bounce"
              style={{
                width: b.s, height: b.s,
                background: `radial-gradient(circle at 35% 35%, ${b.c}ff, ${b.c}88)`,
                boxShadow: `0 0 15px ${b.c}88, inset 0 -3px 6px rgba(0,0,0,0.3)`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: '1.4s',
              }}
            />
          ))}
        </div>

        <div className="text-center">
          <div className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400 bg-clip-text text-transparent">
            BUBBLE
          </div>
          <div className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
            GALAXY
          </div>
          <p className="text-purple-400 text-xs mt-2 tracking-[0.3em] uppercase font-semibold">
            ✦ {t('subtitle', lang)} ✦
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full">
          <div className="bg-white/5 border border-yellow-500/20 rounded-xl p-2 text-center">
            <div className="text-[9px] text-yellow-500/70 uppercase font-bold">{t('record', lang)}</div>
            <div className="text-lg font-black text-yellow-400">{highScore.toLocaleString(loc)}</div>
          </div>
          <div className="bg-white/5 border border-purple-500/20 rounded-xl p-2 text-center">
            <div className="text-[9px] text-purple-400 uppercase font-bold">{t('stars', lang)}</div>
            <div className="text-lg font-black text-white">⭐ {totalStars}</div>
          </div>
          <div className="bg-white/5 border border-cyan-500/20 rounded-xl p-2 text-center">
            <div className="text-[9px] text-cyan-400 uppercase font-bold">{t('trophies', lang)}</div>
            <div className="text-lg font-black text-white">🏅 {achievementCount}</div>
          </div>
        </div>

        <button
          onClick={() => setView('levels')}
          className="relative w-full group"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 blur-xl opacity-50 group-hover:opacity-80 transition-opacity" />
          <div className="relative w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:from-purple-400 hover:via-pink-400 hover:to-indigo-400 text-white font-black text-xl py-3.5 rounded-2xl transition-all active:scale-95 border border-white/20 shadow-2xl">
            {progress.campaignComplete ? `🗺️ ${t('levels', lang)}` : `🚀 ${t('campaign', lang)}`}
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={onEndless}
            className="bg-gradient-to-r from-indigo-700/80 to-purple-700/80 hover:from-indigo-600 hover:to-purple-600 border border-indigo-400/30 text-white font-bold py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
          >
            🌌 {t('endless', lang)}
          </button>
          <button
            onClick={onDaily}
            disabled={!dailyPending}
            className={`font-bold py-2.5 rounded-2xl transition-all active:scale-95 text-sm border ${
              dailyPending
                ? 'bg-gradient-to-r from-cyan-700/80 to-blue-700/80 hover:from-cyan-600 hover:to-blue-600 border-cyan-400/30 text-white'
                : 'bg-white/5 border-white/10 text-purple-500 cursor-not-allowed'
            }`}
          >
            {dailyPending ? `📅 ${t('daily', lang)}` : `✅ ${t('dailyDone', lang)}`}
          </button>
        </div>

        <button
          onClick={handleOpenLeaderboard}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/15 text-purple-200 font-bold py-2.5 rounded-2xl transition-all active:scale-95 text-sm"
        >
          🏆 {t('leaderboard', lang)}
        </button>

        <div className="flex items-center gap-3 text-purple-600 text-xs pb-1">
          <span>{t('eightLevels', lang)}</span>
          <span>•</span>
          <span>{t('yandexGames', lang)}</span>
        </div>
      </div>
    </div>
  );
}
