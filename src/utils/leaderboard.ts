import { isPlayerAuthorized, requestAuth, canUseLeaderboards } from './yandexSdk';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  isUser: boolean;
}

export interface LeaderboardData {
  title: string;
  entries: LeaderboardEntry[];
  userRank: number | null;
  userScore: number | null;
}

const MOCK_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, name: 'КосмоСтрелок', score: 48200, isUser: false },
  { rank: 2, name: 'ПузырьМастер', score: 41500, isUser: false },
  { rank: 3, name: 'Галактика99', score: 37800, isUser: false },
  { rank: 4, name: 'НоваБласт', score: 29100, isUser: false },
  { rank: 5, name: 'ЗвёздныйЛук', score: 22400, isUser: false },
];

interface YaLeaderboardEntry {
  rank: number;
  score: number;
  player?: { publicName?: string };
  extraData?: string;
}

interface YaLeaderboardResult {
  leaderboard?: { title?: { ru?: string; en?: string } };
  entries?: YaLeaderboardEntry[];
  userRank?: number;
  ranges?: { start: number; size: number }[];
}

type LeaderboardFetchOpts = {
  quantityTop: number;
  includeUser: boolean;
  quantityAround?: number;
};

export type LeaderboardsApi = {
  getEntries?: (name: string, opts: LeaderboardFetchOpts) => Promise<YaLeaderboardResult>;
  getLeaderboardEntries?: (name: string, opts: LeaderboardFetchOpts) => Promise<YaLeaderboardResult>;
  setScore?: (name: string, score: number) => Promise<void>;
  setLeaderboardScore?: (name: string, score: number) => Promise<void>;
};

async function fetchEntries(api: LeaderboardsApi, boardName: string): Promise<YaLeaderboardResult> {
  const opts: LeaderboardFetchOpts = {
    quantityTop: 10,
    includeUser: true,
    quantityAround: 3,
  };
  if (api.getEntries) return api.getEntries(boardName, opts);
  if (api.getLeaderboardEntries) return api.getLeaderboardEntries(boardName, opts);
  throw new Error('No leaderboard API');
}

export async function submitLeaderboardScore(
  api: LeaderboardsApi | undefined,
  boardName: string,
  score: number
): Promise<void> {
  if (!api || score <= 0) return;
  try {
    if (!(await canUseLeaderboards())) return;
    if (!(await isPlayerAuthorized())) {
      await requestAuth();
      if (!(await isPlayerAuthorized())) return;
    }
    if (api.setScore) await api.setScore(boardName, score);
    else if (api.setLeaderboardScore) await api.setLeaderboardScore(boardName, score);
  } catch { /* guest or board missing */ }
}

export async function fetchLeaderboard(
  api: LeaderboardsApi | undefined,
  boardName: string,
  userHighScore: number
): Promise<LeaderboardData> {
  if (!api) {
    return {
      title: boardName,
      entries: MOCK_ENTRIES,
      userRank: userHighScore > 0 ? 6 : null,
      userScore: userHighScore > 0 ? userHighScore : null,
    };
  }

  try {
    const result = await fetchEntries(api, boardName);

    const entries: LeaderboardEntry[] = (result.entries ?? []).map((e, i) => ({
      rank: e.rank ?? i + 1,
      name: e.player?.publicName || 'Player',
      score: e.score,
      isUser: result.userRank === e.rank,
    }));

    const userEntry = entries.find((e) => e.isUser);

    return {
      title: result.leaderboard?.title?.ru || boardName,
      entries,
      userRank: result.userRank ?? userEntry?.rank ?? null,
      userScore: userEntry?.score ?? null,
    };
  } catch {
    return {
      title: boardName,
      entries: MOCK_ENTRIES,
      userRank: null,
      userScore: null,
    };
  }
}
