import type { LeaderboardData } from '../utils/leaderboard';
import type { GameLang } from '../utils/i18n';
import { t, localeOf } from '../utils/i18n';

export type LeaderboardTab = 'campaign' | 'endless' | 'daily';

interface LeaderboardPanelProps {
  lang: GameLang;
  data: LeaderboardData | null;
  loading: boolean;
  tab: LeaderboardTab;
  onTabChange: (tab: LeaderboardTab) => void;
  onBack: () => void;
  onRefresh: () => void;
}

export default function LeaderboardPanel({
  lang,
  data,
  loading,
  tab,
  onTabChange,
  onBack,
  onRefresh,
}: LeaderboardPanelProps) {
  const loc = localeOf(lang);
  const tabLabels: Record<LeaderboardTab, string> = {
    campaign: t('lbCampaign', lang),
    endless: t('lbEndless', lang),
    daily: t('lbDaily', lang),
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#0d0221]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={onBack}
          className="text-purple-300 hover:text-white text-sm font-bold px-3 py-1.5 rounded-xl bg-white/10 border border-white/10"
        >
          ← {t('back', lang)}
        </button>
        <div className="text-white font-black text-lg">🏆 {t('records', lang)}</div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-purple-300 hover:text-white text-sm font-bold px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 disabled:opacity-50"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      <div className="flex gap-2 px-4 mb-3">
        {(['campaign', 'endless', 'daily'] as const).map((key) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === key
                ? 'bg-purple-600 text-white border border-purple-400/50'
                : 'bg-white/5 text-purple-400 border border-white/10'
            }`}
          >
            {tabLabels[key]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading && !data && (
          <div className="text-center text-purple-400 py-12 text-sm animate-pulse">{t('loading', lang)}</div>
        )}

        {data && (
          <div className="max-w-sm mx-auto">
            {data.userRank != null && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 mb-3 text-center">
                <div className="text-yellow-400 text-xs font-bold uppercase tracking-widest">{t('yourRank', lang)}</div>
                <div className="text-white font-black text-xl">
                  #{data.userRank}
                  {data.userScore != null && (
                    <span className="text-purple-300 text-sm font-bold ml-2">
                      {data.userScore.toLocaleString(loc)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {data.entries.length === 0 ? (
                <div className="text-center text-purple-400 py-8 text-sm">{t('noEntries', lang)}</div>
              ) : (
                data.entries.map((e) => (
                  <div
                    key={`${e.rank}-${e.name}`}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 ${
                      e.isUser ? 'bg-purple-600/20' : ''
                    }`}
                  >
                    <span
                      className={`w-7 text-center font-black text-sm ${
                        e.rank === 1 ? 'text-yellow-400' : e.rank === 2 ? 'text-gray-300' : e.rank === 3 ? 'text-orange-400' : 'text-purple-500'
                      }`}
                    >
                      {e.rank}
                    </span>
                    <span className={`flex-1 text-sm truncate ${e.isUser ? 'text-white font-bold' : 'text-purple-200'}`}>
                      {e.name}
                    </span>
                    <span className="text-white font-bold text-sm tabular-nums">
                      {e.score.toLocaleString(loc)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <p className="text-purple-600 text-[10px] text-center mt-3 px-2">
              {t('lbHintId', lang).replace('{id}', getLeaderboardId(tab))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function getLeaderboardId(tab: LeaderboardTab): string {
  if (tab === 'endless') return 'bubbleGalaxyEndless';
  if (tab === 'daily') return 'bubbleGalaxyDaily';
  return 'bubbleGalaxy';
}
