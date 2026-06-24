import type { GameLang } from '../utils/i18n';
import { t, localeOf } from '../utils/i18n';

interface LevelCompleteProps {
  lang: GameLang;
  score: number;
  level: number;
  stars: number;
  onNext: () => void;
  onMenu: () => void;
  onEndless?: () => void;
  isLastLevel: boolean;
  isCampaignComplete: boolean;
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className="text-4xl transition-all"
          style={{
            filter: s <= stars ? 'drop-shadow(0 0 8px gold)' : 'grayscale(1) opacity(0.3)',
            transform: s <= stars ? 'scale(1.15)' : 'scale(0.9)',
          }}
        >
          ⭐
        </div>
      ))}
    </div>
  );
}

export default function LevelCompleteScreen({
  lang,
  score,
  level,
  stars,
  onNext,
  onMenu,
  onEndless,
  isLastLevel,
  isCampaignComplete,
}: LevelCompleteProps) {
  const messages: [string, string][] = [
    [t('notBad', lang), ''],
    [t('great', lang), ''],
    [t('perfect', lang), ''],
  ];
  const [title] = messages[Math.min(stars - 1, 2)];
  const loc = localeOf(lang);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1a0533] to-[#0d0221] border border-purple-500/40 rounded-3xl p-8 mx-4 text-center max-w-sm w-full shadow-2xl shadow-purple-900/40">
        <div className="text-5xl mb-3">{isCampaignComplete ? '🌌' : '🎉'}</div>

        <h2 className="text-3xl font-black text-white mb-1">
          {isCampaignComplete ? t('campaignComplete', lang) : title}
        </h2>
        <p className="text-purple-300 text-sm mb-2">
          {isCampaignComplete ? t('campaignCompleteHint', lang) : ''}
        </p>
        <p className="text-purple-400 text-xs mb-5">{t('level', lang)} {level + 1} — {t('levelComplete', lang)}</p>

        <div className="mb-6">
          <StarRating stars={stars} />
        </div>

        <div className="bg-white/5 rounded-2xl p-4 mb-6">
          <div className="text-purple-300 text-xs uppercase tracking-widest mb-1">{t('finalScore', lang)}</div>
          <div className="text-4xl font-black text-white">{score.toLocaleString(loc)}</div>
        </div>

        {isCampaignComplete && onEndless ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onEndless}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black py-3.5 rounded-2xl transition-all active:scale-95 shadow-lg text-lg"
            >
              🌌 {t('endlessMode', lang)}
            </button>
            <button
              onClick={onMenu}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
            >
              🏠 {t('menu', lang)}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={onMenu}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
            >
              🏠 {t('menu', lang)}
            </button>
            <button
              onClick={onNext}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-3 rounded-2xl transition-all active:scale-95 shadow-lg"
            >
              {isLastLevel ? `🌌 ${t('endless', lang)}` : `▶ ${t('next', lang)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
