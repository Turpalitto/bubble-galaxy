/**
 * Platform adapter — isolates portal SDKs (Yandex Games, Poki, CrazyGames).
 * Web build uses the no-op implementation; swap `platform` for an SDK-backed one when publishing.
 */
export interface PlatformAdapter {
  name: string;
  ready(): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  showInterstitial(): Promise<void>;
  showRewarded(): Promise<boolean>;
}

const webPlatform: PlatformAdapter = {
  name: "web",
  async ready() {},
  gameplayStart() {},
  gameplayStop() {},
  async showInterstitial() {},
  async showRewarded() {
    return true;
  },
};

export const platform: PlatformAdapter = webPlatform;
