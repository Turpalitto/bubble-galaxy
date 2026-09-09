"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { audio } from "@/game/audio";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-fuchsia-500 to-violet-600 text-white shadow-[0_8px_30px_rgba(168,85,247,0.45)] hover:brightness-110 border border-white/20",
  gold: "bg-gradient-to-b from-amber-300 to-orange-500 text-slate-900 shadow-[0_8px_30px_rgba(251,191,36,0.4)] hover:brightness-110 border border-white/30",
  secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/15 backdrop-blur",
  ghost: "bg-transparent text-white/80 hover:bg-white/10",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500 border border-white/15",
};

export function Btn({
  variant = "primary",
  className = "",
  children,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        audio.click();
        onClick?.(e);
      }}
      className={`select-none rounded-2xl px-5 py-3 text-base font-bold tracking-wide transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-[#0f1436]/85 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl ${className}`}>{children}</div>
  );
}

export function Stars({ n, size = "text-3xl" }: { n: number; size?: string }) {
  return (
    <div className={`flex justify-center gap-1 ${size}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block transition-all ${i <= n ? "text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-[pop_0.4s_ease-out]" : "text-white/20"}`}
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        audio.click();
        onChange(!on);
      }}
      className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-white"
    >
      <span className="font-semibold">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? "bg-emerald-400" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      {children}
    </div>
  );
}
