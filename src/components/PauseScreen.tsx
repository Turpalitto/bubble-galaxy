import type { GameLang } from '../utils/i18n';
import { t } from '../utils/i18n';

interface PauseScreenProps {
  lang: GameLang;
  onResume: () => void;
  onMenu: () => void;
  onRestart: () => void;
}

export default function PauseScreen({ lang, onResume, onMenu, onRestart }: PauseScreenProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-[#1a0533] to-[#0d0221] border border-purple-500/30 rounded-3xl p-8 mx-4 text-center max-w-xs w-full shadow-2xl">
        <div className="text-5xl mb-4">⏸️</div>
        <h2 className="text-3xl font-black text-white mb-6">{t('pause', lang)}</h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-lg py-4 rounded-2xl transition-all active:scale-95 shadow-lg"
          >
            ▶ {t('resume', lang)}
          </button>
          <button
            onClick={onRestart}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/10"
          >
            🔄 {t('restart', lang)}
          </button>
          <button
            onClick={onMenu}
            className="w-full bg-white/5 hover:bg-white/10 text-purple-300 font-bold py-3 rounded-2xl transition-all active:scale-95 border border-white/5"
          >
            🏠 {t('mainMenu', lang)}
          </button>
        </div>

        <div className="mt-6 bg-white/5 rounded-xl p-3">
          <p className="text-purple-400 text-xs">💡 {t('pauseTip', lang)}</p>
        </div>
      </div>
    </div>
  );
}
