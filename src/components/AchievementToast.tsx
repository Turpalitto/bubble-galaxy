import { useEffect, useState } from 'react';
import { getAchievement } from '../game/achievements';
import type { GameLang } from '../utils/i18n';
import { t } from '../utils/i18n';

export interface ToastItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

interface AchievementToastStackProps {
  lang: GameLang;
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function Toast({ toast, lang, onDismiss }: { toast: ToastItem; lang: GameLang; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => setVisible(false), 3200);
    const remove = setTimeout(onDismiss, 3800);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 bg-gradient-to-r from-purple-900/95 to-indigo-900/95 border border-yellow-400/40 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-500 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="text-3xl flex-shrink-0">{toast.icon}</div>
      <div className="min-w-0">
        <div className="text-yellow-300 text-[10px] font-bold uppercase tracking-widest">{t('achievement', lang)}</div>
        <div className="text-white font-black text-sm leading-tight">{toast.title}</div>
        <div className="text-purple-300 text-xs truncate">{toast.description}</div>
      </div>
    </div>
  );
}

export default function AchievementToastStack({ lang, toasts, onDismiss }: AchievementToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-3 z-50 flex flex-col gap-2 max-w-[280px] pointer-events-none">
      {toasts.map((item) => (
        <Toast key={item.id} toast={item} lang={lang} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

export function achievementToToast(id: string, lang: GameLang): ToastItem | null {
  const def = getAchievement(id, lang);
  if (!def) return null;
  return { id: def.id, title: def.title, description: def.description, icon: def.icon };
}
