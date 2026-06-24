import { useState, useCallback, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import MenuScreen from './components/MenuScreen';
import GameOverScreen from './components/GameOverScreen';
import LevelCompleteScreen from './components/LevelCompleteScreen';
import PauseScreen from './components/PauseScreen';
import AchievementToastStack, { achievementToToast, type ToastItem } from './components/AchievementToast';
import ViewportBackdrop from './components/ViewportBackdrop';
import Preloader from './components/Preloader';
import { getLeaderboardId, type LeaderboardTab } from './components/LeaderboardPanel';
import {
  LEVELS,
  ENDLESS_LEVEL_IDX,
  DAILY_LEVEL_IDX,
  ENDLESS_SHOTS_PER_WAVE,
} from './game/constants';
import { getMaxShots } from './game/engine';
import { isDailyCompleted, markDailyCompleted } from './utils/dailyChallenge';
import { loadLocalProgress, normalizeProgress, saveLocalProgress } from './utils/progress';
import { fetchLeaderboard, submitLeaderboardScore, type LeaderboardData, type LeaderboardsApi } from './utils/leaderboard';
import { sound } from './utils/sound';
import { applyDocumentLang, resolveLang, type GameLang } from './utils/i18n';
import {
  initYandexSdk,
  getYandexSdk,
  signalLoadingReady,
  gameplayStart,
  gameplayStop,
  getSdkLang,
  loadPlayerData,
  savePlayerData,
  showFullscreenAd,
  showRewardedAd,
  requestAuth,
  isPlayerAuthorized,
  subscribeToSdkEvents,
  unsubscribeFromSdkEvents,
} from './utils/yandexSdk';
import type { GameState, GameData, PlayerProgress, LevelSessionStats } from './game/types';

const PROGRESS_KEYS = [
  'highScore', 'unlockedLevels', 'levelStars', 'totalBubblesPopped',
  'achievements', 'campaignComplete', 'endlessHighScore',
] as const;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [progress, setProgress] = useState<PlayerProgress>(loadLocalProgress);
  const [gameData, setGameData] = useState<GameData>({
    score: 0, level: 0,
    shotsLeft: LEVELS[0].maxShots,
    highScore: loadLocalProgress().highScore,
    combo: 0, stars: 0,
  });
  const [adAvailable, setAdAvailable] = useState(true);
  const [reserveColor, setReserveColor] = useState('');
  const [dailyPending, setDailyPending] = useState(!isDailyCompleted());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lbData, setLbData] = useState<LeaderboardData | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbTab, setLbTab] = useState<LeaderboardTab>('campaign');
  const [lang, setLang] = useState<GameLang>(resolveLang());
  const [appReady, setAppReady] = useState(false);
  const [playerAuthorized, setPlayerAuthorized] = useState(false);

  const progressRef = useRef<PlayerProgress>(loadLocalProgress());
  const gameStateRef = useRef(gameState);
  const swapRef = useRef<(() => void) | null>(null);
  const gameReadySentRef = useRef(false);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const signalGameReady = useCallback(() => {
    if (gameReadySentRef.current) return;
    gameReadySentRef.current = true;
    signalLoadingReady();
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    if (progressRef.current.achievements.includes(id)) return;
    const toast = achievementToToast(id, lang);
    if (!toast) return;
    const achievements = [...progressRef.current.achievements, id];
    const merged = { ...progressRef.current, achievements };
    progressRef.current = merged;
    setProgress(merged);
    saveLocalProgress(merged);
    setToasts((prev) => [...prev, toast]);
    sound.playAchievement();
    savePlayerData(merged, true);
  }, [lang]);

  const checkBubbleAchievements = useCallback((total: number) => {
    if (total >= 100) unlockAchievement('bubbles_100');
    if (total >= 1000) unlockAchievement('bubbles_1000');
  }, [unlockAchievement]);

  const saveProgress = useCallback(async (updates: Partial<PlayerProgress> = {}, flush = true) => {
    const merged: PlayerProgress = { ...progressRef.current, ...updates };
    progressRef.current = merged;
    setProgress(merged);
    saveLocalProgress(merged);
    checkBubbleAchievements(merged.totalBubblesPopped);
    await savePlayerData(merged, flush);
  }, [checkBubbleAchievements]);

  const loadProgress = useCallback(async (): Promise<PlayerProgress> => {
    const data = await loadPlayerData([...PROGRESS_KEYS]);
    if (data) {
      const loaded = normalizeProgress(data as Partial<PlayerProgress>);
      progressRef.current = loaded;
      setProgress(loaded);
      saveLocalProgress(loaded);
      return loaded;
    }
    return loadLocalProgress();
  }, []);

  const loadLeaderboard = useCallback(async (tab: LeaderboardTab) => {
    setLbLoading(true);
    const boardId = getLeaderboardId(tab);
    const userScore =
      tab === 'endless' ? progressRef.current.endlessHighScore : progressRef.current.highScore;
    const data = await fetchLeaderboard(
      getYandexSdk()?.leaderboards as LeaderboardsApi | undefined,
      boardId,
      userScore
    );
    setLbData(data);
    setLbLoading(false);
  }, []);

  const handleLeaderboardTabChange = useCallback((tab: LeaderboardTab) => {
    setLbTab(tab);
    loadLeaderboard(tab);
  }, [loadLeaderboard]);

  const handleOpenLeaderboard = useCallback(() => {
    loadLeaderboard(lbTab);
  }, [lbTab, loadLeaderboard]);

  const handleLeaderboardAuth = useCallback(async () => {
    const ok = await requestAuth();
    setPlayerAuthorized(ok);
    if (ok) loadLeaderboard(lbTab);
  }, [lbTab, loadLeaderboard]);

  useEffect(() => {
    initYandexSdk()
      .then(async () => {
        const sdkLang = resolveLang(getSdkLang());
        setLang(sdkLang);
        applyDocumentLang(sdkLang);

        subscribeToSdkEvents({
          onPause: () => {
            gameplayStop();
            sound.pauseForAd();
            if (gameStateRef.current === 'playing') {
              setGameState('paused');
            }
          },
          onResume: () => {
            sound.resumeAfterAd();
            if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
              gameplayStart();
            }
          },
        });

        const p = await loadProgress();
        setGameData((prev) => ({ ...prev, highScore: p.highScore }));
        setPlayerAuthorized(await isPlayerAuthorized());
        setAppReady(true);
        signalGameReady();
      })
      .catch(() => {
        applyDocumentLang(resolveLang());
        setAppReady(true);
        signalGameReady();
      });

    return () => {
      unsubscribeFromSdkEvents();
    };
  }, [loadProgress, signalGameReady]);

  useEffect(() => {
    const interval = setInterval(() => saveProgress({}, false), 120000);
    return () => clearInterval(interval);
  }, [saveProgress]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameplayStart();
      sound.startAmbient();
    } else {
      gameplayStop();
      sound.stopAmbient();
    }
  }, [gameState]);

  const pauseOnBlur = useCallback(() => {
    gameplayStop();
    sound.pauseForAd();
    if (gameStateRef.current === 'playing') {
      setGameState('paused');
    }
  }, []);

  const resumeOnFocus = useCallback(() => {
    sound.resumeAfterAd();
    if (gameStateRef.current === 'paused') {
      setGameState('playing');
      gameplayStart();
    } else if (gameStateRef.current === 'playing') {
      gameplayStart();
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseOnBlur();
      else resumeOnFocus();
    };
    const onBlur = () => pauseOnBlur();
    const onFocus = () => resumeOnFocus();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [pauseOnBlur, resumeOnFocus]);

  const pauseForAd = useCallback(() => {
    gameplayStop();
    sound.pauseForAd();
  }, []);

  const resumeAfterAd = useCallback((resumeGameplay: boolean) => {
    sound.resumeAfterAd();
    if (resumeGameplay && gameStateRef.current === 'playing') {
      gameplayStart();
    }
  }, []);

  const handleWatchAd = useCallback(() => {
    showRewardedAd(
      () => {
        setGameData((prev) => ({ ...prev, shotsLeft: prev.shotsLeft + 5 }));
        setAdAvailable(false);
        setTimeout(() => setAdAvailable(true), 60000);
      },
      {
        onOpen: pauseForAd,
        onClose: () => {
          setGameState('playing');
          resumeAfterAd(true);
        },
        onError: () => {
          setGameState('playing');
          resumeAfterAd(true);
        },
      }
    );
  }, [pauseForAd, resumeAfterAd]);

  const submitScore = useCallback((score: number, lb = 'bubbleGalaxy') => {
    submitLeaderboardScore(getYandexSdk()?.leaderboards as LeaderboardsApi | undefined, lb, score);
  }, []);

  const startGame = useCallback((level = 0, keepScore = false) => {
    sound.unlock();
    const maxShots = level === ENDLESS_LEVEL_IDX ? ENDLESS_SHOTS_PER_WAVE : getMaxShots(level);
    setGameData((prev) => ({
      ...prev,
      level,
      score: keepScore ? prev.score : 0,
      shotsLeft: maxShots,
      combo: 0,
      stars: 0,
    }));
    setGameState('playing');
  }, []);

  const handleScoreUpdate = useCallback((score: number, combo: number, shotsLeft: number) => {
    if (combo >= 3) unlockAchievement('combo_3');
    if (combo >= 5) unlockAchievement('combo_5');
    setGameData((prev) => {
      const newHigh = score > prev.highScore ? score : prev.highScore;
      if (newHigh > prev.highScore) saveProgress({ highScore: newHigh }, true);
      return { ...prev, score, combo, shotsLeft, highScore: newHigh };
    });
  }, [unlockAchievement, saveProgress]);

  const handleConsecutiveHits = useCallback((hits: number) => {
    if (hits >= 10) unlockAchievement('sniper_10');
  }, [unlockAchievement]);

  const handleLevelStats = useCallback((stats: LevelSessionStats) => {
    if (stats.misses === 0 && stats.maxCombo > 0) unlockAchievement('perfect_level');
    if (stats.maxCombo >= 5) unlockAchievement('combo_5');
  }, [unlockAchievement]);

  const handleBubblesPopped = useCallback((count: number) => {
    const total = progressRef.current.totalBubblesPopped + count;
    saveProgress({ totalBubblesPopped: total }, false);
  }, [saveProgress]);

  const handleGameOver = useCallback(() => {
    setGameState('gameOver');
    gameplayStop();
    const score = gameData.score;
    const updates: Partial<PlayerProgress> = {
      highScore: Math.max(score, progressRef.current.highScore),
    };
    if (gameData.level === ENDLESS_LEVEL_IDX) {
      updates.endlessHighScore = Math.max(score, progressRef.current.endlessHighScore);
      submitScore(score, 'bubbleGalaxyEndless');
      if (score >= 10000) unlockAchievement('endless_10k');
    }
    saveProgress(updates, true);
    setTimeout(() => {
      showFullscreenAd({
        onOpen: pauseForAd,
        onClose: () => resumeAfterAd(false),
        onError: () => resumeAfterAd(false),
      });
    }, 1000);
  }, [gameData.score, gameData.level, saveProgress, submitScore, unlockAchievement, pauseForAd, resumeAfterAd]);

  const handleLevelComplete = useCallback((stars: number) => {
    const level = gameData.level;
    const levelStars = [...progressRef.current.levelStars];
    if (level >= 0 && level < LEVELS.length) {
      levelStars[level] = Math.max(levelStars[level] ?? 0, stars);
    }
    const unlocked = Math.max(progressRef.current.unlockedLevels, level + 1);
    const campaignComplete = level === LEVELS.length - 1 || progressRef.current.campaignComplete;

    setGameData((prev) => ({ ...prev, stars }));
    saveProgress({ unlockedLevels: unlocked, levelStars, campaignComplete }, true);
    submitScore(gameData.score);

    if (level === DAILY_LEVEL_IDX) {
      markDailyCompleted();
      setDailyPending(false);
      submitScore(gameData.score, 'bubbleGalaxyDaily');
      unlockAchievement('daily_done');
    }
    if (level === LEVELS.length - 1) {
      unlockAchievement('campaign_clear');
    }

    setGameState('levelComplete');
    gameplayStop();

    if ((level + 1) % 2 === 0 && level < LEVELS.length - 1) {
      showFullscreenAd({
        onOpen: pauseForAd,
        onClose: () => resumeAfterAd(false),
        onError: () => resumeAfterAd(false),
      });
    }
  }, [gameData.level, gameData.score, saveProgress, submitScore, unlockAchievement, pauseForAd, resumeAfterAd]);

  const handleNextLevel = useCallback(() => {
    if (gameData.level === DAILY_LEVEL_IDX || gameData.level === ENDLESS_LEVEL_IDX) {
      setGameState('menu');
      return;
    }
    const next = gameData.level + 1;
    if (next >= LEVELS.length) {
      startGame(ENDLESS_LEVEL_IDX);
      return;
    }
    startGame(next);
  }, [gameData.level, startGame]);

  const handleResume = useCallback(() => {
    setGameState('playing');
    gameplayStart();
    sound.unlock();
  }, []);

  const handleMenu = useCallback(() => {
    setGameState('menu');
    gameplayStop();
  }, []);

  const isPlaying = gameState === 'playing' || gameState === 'paused' ||
    gameState === 'gameOver' || gameState === 'levelComplete';

  const levelDisplay = gameData.level === ENDLESS_LEVEL_IDX ? '∞'
    : gameData.level === DAILY_LEVEL_IDX ? '📅'
    : String(gameData.level + 1);

  const isCampaignComplete = gameData.level === LEVELS.length - 1;

  if (!appReady) {
    return <Preloader />;
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-start overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #0d0221 0%, #150830 50%, #0a1628 100%)' }}
    >
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 10%, rgba(168,85,247,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(56,189,248,0.06) 0%, transparent 45%)' }}
      />

      <AchievementToastStack
        lang={lang}
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {gameState === 'menu' && (
        <MenuScreen
          lang={lang}
          highScore={progress.highScore}
          dailyPending={dailyPending}
          progress={progress}
          achievementCount={progress.achievements.length}
          onSelectLevel={(lvl) => startGame(lvl)}
          onTapToPlay={() => startGame(0)}
          onEndless={() => startGame(ENDLESS_LEVEL_IDX)}
          onDaily={() => { if (!isDailyCompleted()) startGame(DAILY_LEVEL_IDX); }}
          leaderboardData={lbData}
          leaderboardLoading={lbLoading}
          leaderboardTab={lbTab}
          onLeaderboardTabChange={handleLeaderboardTabChange}
          onOpenLeaderboard={handleOpenLeaderboard}
          onRefreshLeaderboard={() => loadLeaderboard(lbTab)}
          onLeaderboardAuth={handleLeaderboardAuth}
          playerAuthorized={playerAuthorized}
        />
      )}

      {isPlaying && (
        <>
          <ViewportBackdrop />
          <div className="relative w-full h-full flex flex-col items-center z-10">
            <div className="w-full z-10 pt-safe pt-1" style={{ maxWidth: 480 }}>
              <HUD
                lang={lang}
                score={gameData.score}
                highScore={gameData.highScore}
                level={levelDisplay}
                shotsLeft={gameData.shotsLeft}
                combo={gameData.combo}
                reserveColor={reserveColor}
                dailyPending={dailyPending && gameData.level !== DAILY_LEVEL_IDX}
                onPause={() => { setGameState('paused'); gameplayStop(); }}
                onSwap={() => swapRef.current?.()}
              />
            </div>

          <div className="flex-1 w-full flex items-center justify-center pb-1 px-1 min-h-0" style={{ maxWidth: 480 }} data-game-area>
            <GameCanvas
              gameData={gameData}
              lang={lang}
              onScoreUpdate={handleScoreUpdate}
              onGameOver={handleGameOver}
              onLevelComplete={handleLevelComplete}
              onBubblesPopped={handleBubblesPopped}
              onLevelStats={handleLevelStats}
              onConsecutiveHits={handleConsecutiveHits}
              isPaused={gameState !== 'playing'}
              onReserveColorChange={setReserveColor}
              swapRef={swapRef}
            />
          </div>

          {gameState === 'paused' && (
            <PauseScreen
              lang={lang}
              onResume={handleResume}
              onMenu={handleMenu}
              onRestart={() => startGame(gameData.level)}
            />
          )}
          {gameState === 'gameOver' && (
            <GameOverScreen
              lang={lang}
              score={gameData.score}
              highScore={gameData.highScore}
              level={gameData.level}
              onRestart={() => startGame(gameData.level)}
              onMenu={handleMenu}
              onWatchAd={handleWatchAd}
              adAvailable={adAvailable}
            />
          )}
          {gameState === 'levelComplete' && (
            <LevelCompleteScreen
              lang={lang}
              score={gameData.score}
              level={gameData.level}
              stars={gameData.stars}
              onNext={handleNextLevel}
              onMenu={handleMenu}
              onEndless={() => startGame(ENDLESS_LEVEL_IDX)}
              isLastLevel={gameData.level >= LEVELS.length - 1 && gameData.level !== DAILY_LEVEL_IDX}
              isCampaignComplete={isCampaignComplete}
            />
          )}
          </div>
        </>
      )}
    </div>
  );
}
