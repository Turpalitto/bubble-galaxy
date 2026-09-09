import type { Lang } from "./i18n";
import type { Mode } from "./types";

export interface ShareData {
  mode: Mode;
  score: number;
  level: number;
  stars?: number;
  maxCombo: number;
  streak?: number;
  dailyIndex?: number;
  lang: Lang;
}

function comboBar(c: number): string {
  const n = Math.max(1, Math.min(10, c));
  return "🟣".repeat(n) + "⚫".repeat(10 - n);
}

export function buildShareText(d: ShareData): string {
  const url = typeof window !== "undefined" ? window.location.origin : "";
  const ru = d.lang === "ru";
  const lines: string[] = [];
  if (d.mode === "daily") {
    lines.push(`🫧 Bubble Galaxy — ${ru ? "Дейли" : "Daily"} #${d.dailyIndex ?? d.level}`);
    lines.push(`🏆 ${d.score.toLocaleString()} ${ru ? "очков" : "pts"}`);
    lines.push(`${comboBar(d.maxCombo)} ${ru ? "комбо" : "combo"} x${d.maxCombo}`);
    if (d.streak && d.streak > 1) lines.push(`🔥 ${ru ? "стрик" : "streak"}: ${d.streak}`);
    lines.push(ru ? "Сможешь больше? 👇" : "Can you beat it? 👇");
  } else if (d.mode === "endless") {
    lines.push(`🫧 Bubble Galaxy — ${ru ? "Бесконечный" : "Endless"}`);
    lines.push(`🌊 ${ru ? "Волна" : "Wave"} ${d.level} · 🏆 ${d.score.toLocaleString()}`);
    lines.push(`${comboBar(d.maxCombo)} x${d.maxCombo}`);
    lines.push(ru ? "Побей мой рекорд 👇" : "Beat my record 👇");
  } else {
    const stars = "⭐".repeat(d.stars ?? 0) + "☆".repeat(3 - (d.stars ?? 0));
    lines.push(`🫧 Bubble Galaxy — ${ru ? "Уровень" : "Level"} ${d.level} ${stars}`);
    lines.push(`🏆 ${d.score.toLocaleString()} · ${ru ? "комбо" : "combo"} x${d.maxCombo}`);
    lines.push(ru ? "Залетай 👇" : "Join me 👇");
  }
  lines.push(url);
  return lines.join("\n");
}

export async function share(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
  } catch {
    /* user cancelled → fall through to copy */
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
