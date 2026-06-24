import { LEVELS } from '../game/constants';
import { isLevelUnlocked } from '../utils/progress';
import type { PlayerProgress } from '../game/types';
import type { GameLang } from '../utils/i18n';
import { t } from '../utils/i18n';

interface LevelSelectScreenProps {
  lang: GameLang;
  progress: PlayerProgress;
  onSelectLevel: (level: number) => void;
  onBack: () => void;
}

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className="text-[10px] leading-none"
          style={{ opacity: s <= count ? 1 : 0.25, filter: s <= count ? 'none' : 'grayscale(1)' }}
        >
          ⭐
        </span>
      ))}
    </div>
  );
}

export default function LevelSelectScreen({ lang, progress, onSelectLevel, onBack }: LevelSelectScreenProps) {
  const totalStars = progress.levelStars.reduce((a, b) => a + b, 0);
  const maxStars = LEVELS.length * 3;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0221]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={onBack}
          className="text-purple-300 hover:text-white text-sm font-bold px-3 py-1.5 rounded-xl bg-white/10 border border-white/10"
        >
          ← {t('back', lang)}
        </button>
        <div className="text-center">
          <div className="text-white font-black text-lg">{t('selectLevel', lang)}</div>
          <div className="text-purple-400 text-xs">
            ⭐ {totalStars} / {maxStars}
            {progress.campaignComplete && ` · ${t('campaignCleared', lang)}`}
          </div>
        </div>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
          {LEVELS.map((lvl, idx) => {
            const unlocked = isLevelUnlocked(idx, progress.unlockedLevels);
            const stars = progress.levelStars[idx] ?? 0;

            return (
              <button
                key={idx}
                disabled={!unlocked}
                onClick={() => unlocked && onSelectLevel(idx)}
                className={`relative flex flex-col items-center justify-center rounded-2xl p-3 min-h-[88px] border transition-all active:scale-95 ${
                  unlocked
                    ? 'bg-gradient-to-b from-purple-800/50 to-indigo-900/50 border-purple-500/40 hover:border-purple-400/70 hover:shadow-lg hover:shadow-purple-500/20'
                    : 'bg-white/5 border-white/10 cursor-not-allowed opacity-50'
                }`}
              >
                {!unlocked && (
                  <span className="absolute top-1.5 right-1.5 text-sm opacity-60">🔒</span>
                )}
                <span className={`text-2xl font-black ${unlocked ? 'text-white' : 'text-purple-600'}`}>
                  {idx + 1}
                </span>
                {unlocked && stars > 0 ? (
                  <StarRow count={stars} />
                ) : (
                  <span className="text-[9px] text-purple-500 mt-1 h-3">
                    {unlocked ? '—' : ''}
                  </span>
                )}
                <span className="text-[8px] text-purple-400 mt-1 text-center leading-tight opacity-70">
                  {lvl.maxShots}🎯
                </span>
              </button>
            );
          })}
        </div>

        {progress.campaignComplete && (
          <div className="mt-5 max-w-sm mx-auto bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-400/30 rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1">🌌</div>
            <div className="text-white font-bold text-sm">{t('levelSelectComplete', lang)}</div>
            <div className="text-purple-300 text-xs mt-1">{t('levelSelectCompleteHint', lang)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
