import type { GameLang } from '../utils/i18n';
import { t, localeOf } from '../utils/i18n';

interface GameOverScreenProps {
  lang: GameLang;
  score: number;
  highScore: number;
  level: number;
  onRestart: () => void;
  onMenu: () => void;
  onWatchAd: () => void;
  adAvailable: boolean;
}

export default function GameOverScreen({
  lang,
  score,
  highScore,
  level,
  onRestart,
  onMenu,
  onWatchAd,
  adAvailable,
}: GameOverScreenProps) {
  const isNewRecord = score >= highScore && score > 0;
  const loc = localeOf(lang);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1a0533] to-[#0d0221] border border-red-500/30 rounded-3xl p-8 mx-4 text-center max-w-sm w-full shadow-2xl shadow-red-900/30">
        <div className="text-6xl mb-4 animate-pulse">💀</div>

        <h2 className="text-3xl font-black text-white mb-1">{t('gameOver', lang)}</h2>
        <p className="text-red-300 text-sm mb-6">{t('gameOverHint', lang)}</p>

        <div className="bg-white/5 rounded-2xl p-4 mb-4">
          <div className="text-purple-300 text-xs uppercase tracking-widest mb-1">{t('result', lang)}</div>
          <div className="text-4xl font-black text-white">{score.toLocaleString(loc)}</div>
          {isNewRecord && (
            <div className="mt-2 bg-yellow-400/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full inline-block">
              🏆 {t('newRecord', lang)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-purple-400 text-xs">{t('level', lang)}</div>
            <div className="text-white font-black text-xl">{level + 1}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-purple-400 text-xs">{t('record', lang)}</div>
            <div className="text-yellow-400 font-black text-xl">{highScore.toLocaleString(loc)}</div>
          </div>
        </div>

        {adAvailable && (
          <button
            onClick={onWatchAd}
            className="w-full mb-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-sm py-3 rounded-2xl transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
          >
            <span>📺</span>
            <span>{t('watchAdReward', lang)}</span>
          </button>
        )}

        <div className="flex gap-3">
          <button
            onClick={onMenu}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
          >
            🏠 {t('menu', lang)}
          </button>
          <button
            onClick={onRestart}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black py-3 rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            🔄 {t('again', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
