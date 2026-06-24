import type { PlayerProgress } from '../game/types';

export interface YaPlayer {
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  isAuthorized?: () => boolean;
  getName?: () => string;
}

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
      };
    }) => void;
  };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  environment?: { i18n?: { lang: string } };
  auth?: { openAuthDialog: () => Promise<void> };
  getPlayer: (opts?: { signed?: boolean }) => Promise<YaPlayer>;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  leaderboards?: {
    getEntries?: (
      name: string,
      opts: { quantityTop: number; includeUser: boolean; quantityAround?: number }
    ) => Promise<unknown>;
    getLeaderboardEntries?: (
      name: string,
      opts: { quantityTop: number; includeUser: boolean; quantityAround?: number }
    ) => Promise<unknown>;
    setScore?: (name: string, score: number) => Promise<void>;
    setLeaderboardScore?: (name: string, score: number) => Promise<void>;
  };
  on?: (event: string, callback: () => void) => void;
  off?: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<YandexSDK>;
    };
  }
}

let sdkInstance: YandexSDK | null = null;

// Хранение callback'ов для событий SDK
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
  sdkInstance?.features.LoadingAPI?.ready();
}

export function gameplayStart(): void {
  sdkInstance?.features.GameplayAPI?.start();
}

export function gameplayStop(): void {
  sdkInstance?.features.GameplayAPI?.stop();
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
  } catch {
    /* guest */
  }
}

export async function isPlayerAuthorized(): Promise<boolean> {
  if (!sdkInstance) return false;
  try {
    const player = await sdkInstance.getPlayer();
    return player.isAuthorized?.() ?? false;
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

/**
 * Подписка на события SDK: game_api_pause / game_api_resume
 * Согласно пункту 1.19.4 требований Яндекс Игр
 */
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
  } catch {
    /* ignore */
  }
  sdkPauseHandler = null;
  sdkResumeHandler = null;
}

export interface AdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: () => void;
}

export function showFullscreenAd(callbacks: AdCallbacks = {}): void {
  if (!sdkInstance) return;
  gameplayStop();
  sdkInstance.adv.showFullscreenAdv({
    callbacks: {
      onOpen: () => {
        gameplayStop();
        callbacks.onOpen?.();
      },
      onClose: (wasShown) => {
        callbacks.onClose?.(wasShown);
      },
      onError: () => {
        callbacks.onError?.();
      },
    },
  });
}

export function showRewardedAd(
  onReward: () => void,
  callbacks: AdCallbacks = {}
): void {
  if (!sdkInstance) {
    onReward();
    return;
  }
  gameplayStop();
  sdkInstance.adv.showRewardedVideo({
    callbacks: {
      onOpen: () => {
        gameplayStop();
        callbacks.onOpen?.();
      },
      onRewarded: () => onReward(),
      onClose: (wasShown) => {
        callbacks.onClose?.(wasShown);
      },
      onError: () => {
        callbacks.onError?.();
      },
    },
  });
}

export function setupPlatformGuards(): void {
  const block = (e: Event) => e.preventDefault();

  document.addEventListener('contextmenu', block);
  document.addEventListener('selectstart', block);
  document.addEventListener('dragstart', block);

  const preventScroll = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  document.addEventListener('touchmove', preventScroll, { passive: false });
}
