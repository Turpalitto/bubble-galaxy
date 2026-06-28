import type { PlayerProgress } from '../game/types';

export interface YandexSDK {
  adv: {
    showRewardedVideo: (opts: {
      callbacks?: {
        onOpen?: () => void;
        onRewarded?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (e: Error) => void;
      };
    }) => void;
    showFullscreenAdv: (opts: {
      callbacks?: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (e: Error) => void;
        onOffline?: () => void;
      };
    }) => void;
    showBannerAdv?: () => Promise<{ stickyAdvIsShowing?: boolean }>;
    hideBannerAdv?: () => Promise<void>;
    getBannerAdvStatus?: () => Promise<{ stickyAdvIsShowing?: boolean }>;
  };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  environment?: { i18n?: { lang: string } };
  auth?: { openAuthDialog: () => Promise<unknown> };
  getPlayer: (opts?: { signed?: boolean }) => Promise<YaPlayer>;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  leaderboards?: {
    getEntries?: (
      name: string,
      opts: { quantityTop: number; includeUser: boolean; quantityAround?: number }
    ) => Promise<LeaderboardData>;
    getLeaderboardEntries?: (
      name: string,
      opts: { quantityTop: number; includeUser: boolean; quantityAround?: number }
    ) => Promise<LeaderboardData>;
    setScore?: (name: string, score: number) => Promise<unknown>;
    setLeaderboardScore?: (name: string, score: number) => Promise<unknown>;
  };
  on?: (event: string, callback: () => void) => void;
  off?: (event: string, callback: () => void) => void;
}

export interface YaPlayer {
  setData(data: Record<string, unknown>, flush?: boolean): Promise<unknown>;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  isAuthorized?: () => boolean;
  getName?: () => string;
  getUniqueID?: () => string;
}

export interface LeaderboardEntry {
  rank: number;
  score: number;
  name: string;
}

export interface LeaderboardData {
  entries?: LeaderboardEntry[];
}

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
  }
}

let sdkInstance: YandexSDK | null = null;
let sdkPauseHandler: (() => void) | null = null;
let sdkResumeHandler: (() => void) | null = null;

export async function initYandexSdk(): Promise<YandexSDK | null> {
  if (sdkInstance) return sdkInstance;
  if (!window.YaGames) return null;
  try {
    sdkInstance = await window.YaGames.init();
    return sdkInstance;
  } catch {
    return null;
  }
}

export function getYandexSdk(): YandexSDK | null {
  return sdkInstance;
}

export function signalLoadingReady(): void {
  sdkInstance?.features?.LoadingAPI?.ready();
}

export function gameplayStart(): void {
  sdkInstance?.features?.GameplayAPI?.start();
}

export function gameplayStop(): void {
  sdkInstance?.features?.GameplayAPI?.stop();
}

export function getSdkLang(): string | undefined {
  return sdkInstance?.environment?.i18n?.lang;
}

export async function loadPlayerData(keys: string[]): Promise<Record<string, unknown> | null> {
  if (!sdkInstance) return null;
  try {
    const player = await sdkInstance.getPlayer();
    return await player.getData(keys);
  } catch {
    return null;
  }
}

export async function savePlayerData(
  data: PlayerProgress | Record<string, unknown>,
  flush = true
): Promise<void> {
  if (!sdkInstance) return;
  try {
    const player = await sdkInstance.getPlayer();
    await player.setData(data as Record<string, unknown>, flush);
  } catch { /* guest */ }
}

export async function isPlayerAuthorized(): Promise<boolean> {
  if (!sdkInstance) return false;
  try {
    const player = await sdkInstance.getPlayer({ signed: false });
    if (typeof player.isAuthorized === 'function') return player.isAuthorized();
    const uid = typeof player.getUniqueID === 'function' ? player.getUniqueID() : '';
    return Boolean(uid);
  } catch {
    return false;
  }
}

export async function requestAuth(): Promise<boolean> {
  if (!sdkInstance?.auth) return false;
  try {
    const authorized = await isPlayerAuthorized();
    if (authorized) return true;
    await sdkInstance.auth.openAuthDialog();
    return await isPlayerAuthorized();
  } catch {
    return false;
  }
}

export async function canUseLeaderboards(): Promise<boolean> {
  if (!sdkInstance) return false;
  if (sdkInstance.isAvailableMethod) {
    try {
      return await sdkInstance.isAvailableMethod('leaderboards.setScore');
    } catch {
      return false;
    }
  }
  return !!sdkInstance.leaderboards;
}

export async function submitLeaderboardScore(name: string, score: number): Promise<void> {
  if (!sdkInstance?.leaderboards) return;
  try {
    if (sdkInstance.leaderboards.setLeaderboardScore) {
      await sdkInstance.leaderboards.setLeaderboardScore(name, score);
    } else if (sdkInstance.leaderboards.setScore) {
      await sdkInstance.leaderboards.setScore(name, score);
    }
  } catch { /* ignore */ }
}

export async function getLeaderboardEntries(
  name: string,
  quantityTop = 10,
  includeUser = true
): Promise<LeaderboardEntry[]> {
  if (!sdkInstance?.leaderboards) return [];
  try {
    const lb = sdkInstance.leaderboards;
    const opts = { quantityTop, includeUser, quantityAround: 3 };
    const data = lb.getLeaderboardEntries
      ? await lb.getLeaderboardEntries(name, opts)
      : lb.getEntries
        ? await lb.getEntries(name, opts)
        : { entries: [] };
    return (data.entries ?? []).map((e: LeaderboardEntry) => ({
      rank: e.rank,
      score: e.score,
      name: e.name || 'Player',
    }));
  } catch {
    return [];
  }
}

export function subscribeToSdkEvents(handlers: {
  onPause: () => void;
  onResume: () => void;
}): void {
  if (!sdkInstance?.on) return;
  sdkPauseHandler = handlers.onPause;
  sdkResumeHandler = handlers.onResume;
  try {
    sdkInstance.on('game_api_pause', sdkPauseHandler);
    sdkInstance.on('game_api_resume', sdkResumeHandler);
  } catch (e) {
    console.warn('[YandexSDK] Failed to subscribe to events:', e);
  }
}

export function unsubscribeFromSdkEvents(): void {
  if (!sdkInstance?.off || !sdkPauseHandler || !sdkResumeHandler) return;
  try {
    sdkInstance.off('game_api_pause', sdkPauseHandler);
    sdkInstance.off('game_api_resume', sdkResumeHandler);
  } catch { /* ignore */ }
  sdkPauseHandler = null;
  sdkResumeHandler = null;
}

export interface AdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (err?: Error) => void;
  onOffline?: () => void;
}

export function showFullscreenAd(callbacks: AdCallbacks = {}): void {
  if (!sdkInstance) {
    callbacks.onClose?.(false);
    return;
  }
  gameplayStop();
  sdkInstance.adv.showFullscreenAdv({
    callbacks: {
      onOpen: () => callbacks.onOpen?.(),
      onClose: (wasShown) => { gameplayStart(); callbacks.onClose?.(wasShown); },
      onError: (err) => { gameplayStart(); callbacks.onError?.(err); },
      onOffline: () => { gameplayStart(); callbacks.onOffline?.(); },
    },
  });
}

export function showRewardedAd(
  onReward: () => void,
  callbacks: AdCallbacks = {}
): void {
  if (!sdkInstance) { callbacks.onError?.(); return; }
  gameplayStop();
  sdkInstance.adv.showRewardedVideo({
    callbacks: {
      onOpen: () => callbacks.onOpen?.(),
      onRewarded: () => onReward(),
      onClose: () => { gameplayStart(); callbacks.onClose?.(true); },
      onError: () => { gameplayStart(); callbacks.onError?.(); },
    },
  });
}

// ============ Sticky-баннер ============

let bannerVisible = false;

export async function showStickyBanner(): Promise<void> {
  if (!sdkInstance?.adv?.showBannerAdv) return;
  try {
    const status = await sdkInstance.adv.getBannerAdvStatus?.();
    if (status?.stickyAdvIsShowing) { bannerVisible = true; return; }
    const res = await sdkInstance.adv.showBannerAdv();
    bannerVisible = Boolean(res?.stickyAdvIsShowing ?? true);
  } catch { /* ignore */ }
}

export async function hideStickyBanner(): Promise<void> {
  if (!sdkInstance?.adv?.hideBannerAdv || !bannerVisible) return;
  try { await sdkInstance.adv.hideBannerAdv(); } catch { /* ignore */ }
  bannerVisible = false;
}

export function setupPlatformGuards(): void {
  const block = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', block);
  document.addEventListener('selectstart', block);
  document.addEventListener('dragstart', block);
  // п.1.10.2 — блокируем ВСЕ браузерные жесты (scroll, pull-to-refresh, pinch-zoom)
  const preventScroll = (e: TouchEvent) => {
    e.preventDefault();
  };
  document.addEventListener('touchmove', preventScroll, { passive: false });
}
