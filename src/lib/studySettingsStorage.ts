import { Flashcard } from '../types';
import { formatDateKey } from './activityStorage';

export const DAILY_NEW_LIMIT_KEY = 'bleuolingo_daily_new_limit_v1';
export const RANDOMIZE_NEW_KEY = 'bleuolingo_randomize_new_v1';
export const NEW_CARDS_LOG_KEY = 'bleuolingo_new_cards_log_v1';
export const OVERRIDE_NEW_KEY = 'bleuolingo_override_new_v1';

export const DEFAULT_DAILY_NEW_LIMIT = 20; // 20 cards/day by default (0 = No limit)
export const DEFAULT_RANDOMIZE_NEW = false; // Deck order by default

export interface DailyNewCardsRecord {
  date: string;
  count: number;
}

export interface DailyOverrideRecord {
  date: string;
  count: number;
}

/**
 * Returns the user's configured daily new card limit.
 * 0 indicates 'No Limit' (unlimited).
 */
export function getDailyNewCardLimit(userId: string): number {
  if (typeof window === 'undefined') return DEFAULT_DAILY_NEW_LIMIT;
  try {
    const raw = localStorage.getItem(`${DAILY_NEW_LIMIT_KEY}_${userId}`);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_DAILY_NEW_LIMIT;
}

export function saveDailyNewCardLimit(userId: string, limit: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${DAILY_NEW_LIMIT_KEY}_${userId}`, String(Math.max(0, limit)));
  } catch {
    // Ignore error
  }
}

/**
 * Returns whether new cards should be presented in random order.
 */
export function getRandomizeNewCards(userId: string): boolean {
  if (typeof window === 'undefined') return DEFAULT_RANDOMIZE_NEW;
  try {
    const raw = localStorage.getItem(`${RANDOMIZE_NEW_KEY}_${userId}`);
    if (raw !== null) {
      return raw === 'true';
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_RANDOMIZE_NEW;
}

export function saveRandomizeNewCards(userId: string, randomize: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${RANDOMIZE_NEW_KEY}_${userId}`, String(randomize));
  } catch {
    // Ignore error
  }
}

/**
 * Returns how many new cards have been introduced today for this user.
 */
export function getNewCardsIntroducedToday(userId: string, dateKey = formatDateKey()): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${NEW_CARDS_LOG_KEY}_${userId}`);
    if (raw) {
      const log: Record<string, number> = JSON.parse(raw);
      return log[dateKey] || 0;
    }
  } catch {
    // Ignore error
  }
  return 0;
}

/**
 * Records that a new card was introduced today.
 */
export function recordNewCardIntroducedToday(
  userId: string,
  count: number = 1,
  dateKey = formatDateKey()
): number {
  if (typeof window === 'undefined') return count;
  try {
    const key = `${NEW_CARDS_LOG_KEY}_${userId}`;
    const raw = localStorage.getItem(key);
    let log: Record<string, number> = {};
    if (raw) {
      try {
        log = JSON.parse(raw);
      } catch {
        log = {};
      }
    }
    const updatedCount = (log[dateKey] || 0) + count;
    log[dateKey] = updatedCount;
    localStorage.setItem(key, JSON.stringify(log));
    return updatedCount;
  } catch {
    return count;
  }
}

/**
 * Clears today's recorded new cards introduced and overrides (used on deck reset).
 */
export function clearTodayNewCards(userId: string, dateKey = formatDateKey()): void {
  if (typeof window === 'undefined') return;
  try {
    const logKey = `${NEW_CARDS_LOG_KEY}_${userId}`;
    const rawLog = localStorage.getItem(logKey);
    if (rawLog) {
      const log = JSON.parse(rawLog);
      delete log[dateKey];
      localStorage.setItem(logKey, JSON.stringify(log));
    }
    const overrideKey = `${OVERRIDE_NEW_KEY}_${userId}`;
    localStorage.removeItem(overrideKey);
  } catch {
    // Ignore error
  }
}

/**
 * Returns today's active override count for new cards (extra cards permitted beyond the daily limit).
 */
export function getTodayNewCardsOverride(userId: string, dateKey = formatDateKey()): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(`${OVERRIDE_NEW_KEY}_${userId}`);
    if (raw) {
      const record: DailyOverrideRecord = JSON.parse(raw);
      if (record.date === dateKey) {
        return record.count || 0;
      }
    }
  } catch {
    // Ignore error
  }
  return 0;
}

/**
 * Increases today's override allowance by the given number of extra new cards.
 */
export function addTodayNewCardsOverride(
  userId: string,
  additionalCount: number,
  dateKey = formatDateKey()
): number {
  if (typeof window === 'undefined') return additionalCount;
  try {
    const key = `${OVERRIDE_NEW_KEY}_${userId}`;
    const current = getTodayNewCardsOverride(userId, dateKey);
    const updated = current + additionalCount;
    const record: DailyOverrideRecord = { date: dateKey, count: updated };
    localStorage.setItem(key, JSON.stringify(record));
    return updated;
  } catch {
    return additionalCount;
  }
}

/**
 * Deterministic pseudo-random string hash to stably shuffle cards for a session
 * without reshuffling on every component render.
 */
function stableCardHash(str: string, seed: string): number {
  const combined = `${str}:${seed}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  return hash;
}

export interface FilteredNewCardsResult {
  queueNewCards: Flashcard[];
  allNewCardsCount: number;
  remainingAllowance: number;
  introducedToday: number;
  totalDailyAllowance: number;
  isLimitReached: boolean;
  unintroducedCount: number;
}

/**
 * Calculates the available new cards for today taking into account:
 * 1. Daily limit (or 0 for unlimited)
 * 2. New cards introduced today
 * 3. Daily override allowance
 * 4. Randomization option (stably sorted with session salt)
 */
export function getAvailableNewCards(
  allCards: Flashcard[],
  dailyLimit: number,
  introducedToday: number,
  overrideToday: number,
  randomize: boolean,
  sessionSalt: string
): FilteredNewCardsResult {
  const allNewCards = allCards.filter((c) => c.state === 'new');
  const allNewCardsCount = allNewCards.length;

  let orderedNewCards: Flashcard[];
  if (randomize) {
    orderedNewCards = [...allNewCards].sort(
      (a, b) => stableCardHash(a.id, sessionSalt) - stableCardHash(b.id, sessionSalt)
    );
  } else {
    orderedNewCards = allNewCards;
  }

  // If dailyLimit is 0 -> No Limit
  if (dailyLimit === 0) {
    return {
      queueNewCards: orderedNewCards,
      allNewCardsCount,
      remainingAllowance: allNewCardsCount,
      introducedToday,
      totalDailyAllowance: Infinity,
      isLimitReached: false,
      unintroducedCount: 0,
    };
  }

  const totalDailyAllowance = dailyLimit + overrideToday;
  const remainingAllowance = Math.max(0, totalDailyAllowance - introducedToday);
  const isLimitReached = remainingAllowance <= 0 && allNewCardsCount > 0;
  const queueNewCards = orderedNewCards.slice(0, remainingAllowance);
  const unintroducedCount = Math.max(0, allNewCardsCount - queueNewCards.length);

  return {
    queueNewCards,
    allNewCardsCount,
    remainingAllowance,
    introducedToday,
    totalDailyAllowance,
    isLimitReached,
    unintroducedCount,
  };
}
