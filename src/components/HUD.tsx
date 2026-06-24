import { useEffect, useState } from 'react';
import { sound } from '../utils/sound';

import type { GameLang } from '../utils/i18n';
import { t, localeOf } from '../utils/i18n';

interface HUDProps {
  lang: GameLang;
  score: number;
  highScore: number;
  level: string;
  shotsLeft: number;
  combo: number;
  reserveColor?: string;
  dailyPending?: boolean;
  onPause: () => void;
  onSwap?: () => void;
}

export default function HUD({
  lang,
  score,
  highScore,
  level,
  shotsLeft,
  combo,
  reserveColor,
  dailyPending,
  onPause,
  onSwap,
}: HUDProps) {
  const [prevScore, setPrevScore] = useState(score);
  const [scoreAnim, setScoreAnim] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());

  useEffect(() => {
    if (score !== prevScore) {
      setScoreAnim(true);
      setPrevScore(score);
      const t = setTimeout(() => setScoreAnim(false), 400);
      return () => clearTimeout(t);
    }
  }, [score, prevScore]);

  const handleMute = () => {
    const isMuted = sound.toggleMute();
    setMuted(isMuted);
  };

  const loc = localeOf(lang);

  return (
    <div className="w-full max-w-[480px] mx-auto px-3 pt-2 pb-1">
      <div className="flex items-center justify-between gap-2">

        <div className="flex flex-col items-start min-w-[90px]">
          <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">{t('score', lang)}</div>
          <div
            className={`text-2xl font-black text-white leading-tight transition-transform duration-150 ${scoreAnim ? 'scale-125 text-yellow-300' : 'scale-100'}`}
            style={{ textShadow: scoreAnim ? '0 0 12px #ffcc00' : 'none' }}
          >
            {score.toLocaleString(loc)}
          </div>
          <div className="text-[10px] text-purple-500">
            🏆 {highScore.toLocaleString(loc)}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <div
            className="bg-gradient-to-r from-purple-800/60 to-indigo-800/60 backdrop-blur border border-purple-500/30 rounded-xl px-5 py-1.5 text-center shadow-lg"
            style={{ boxShadow: '0 0 12px rgba(168,85,247,0.2)' }}
          >
            <div className="text-[10px] text-purple-300 uppercase tracking-widest font-semibold">{t('level', lang)}</div>
            <div className="text-xl font-black text-white leading-tight">{level}</div>
          </div>

          {combo > 1 && (
            <div
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-[11px] rounded-full px-3 py-0.5 animate-pulse shadow-lg"
              style={{ boxShadow: '0 0 10px rgba(255,165,0,0.6)' }}
            >
              🔥 {t('combo', lang)} ×{combo}
            </div>
          )}

          {dailyPending && (
            <div className="text-[10px] text-cyan-400 font-semibold">📅 {t('dailyAvailable', lang)}</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 min-w-[75px]">
          <div className="flex items-center gap-1">
            <button
              onClick={handleMute}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 shadow text-sm"
              aria-label={muted ? t('muteOn', lang) : t('muteOff', lang)}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            {onSwap && (
              <button
                onClick={() => { sound.playUiClick(); onSwap(); }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 shadow text-sm"
                aria-label={t('swapBubbles', lang)}
              >
                ↔️
              </button>
            )}
            <button
              onClick={() => { sound.playUiClick(); onPause(); }}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all active:scale-90 shadow"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="4" width="5" height="16" rx="1.5" />
                <rect x="14" y="4" width="5" height="16" rx="1.5" />
              </svg>
            </button>
          </div>

          {reserveColor && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-purple-400">{t('reserve', lang)}</span>
              <div
                className="w-4 h-4 rounded-full border border-white/30"
                style={{
                  background: `radial-gradient(circle at 35% 35%, ${reserveColor}, ${reserveColor}88)`,
                  boxShadow: `0 0 6px ${reserveColor}66`,
                }}
              />
            </div>
          )}

          <div className="flex flex-col items-end">
            <div className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">{t('shots', lang)}</div>
            <div className="flex items-center gap-1">
              <span
                className={`text-xl font-black leading-tight ${shotsLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}
              >
                {shotsLeft}
              </span>
              <span className="text-base">🎯</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
