import { Flashcard, ReviewRating, FSRSRatingOption, CardState, FSRSState } from '../types';

/**
 * Standard FSRS-4.5 17-Parameter Weights
 * Open-Spaced-Repetition research standard
 */
export const DEFAULT_FSRS_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, // w0-w3: Initial stability for [Again, Hard, Good, Easy]
  7.1949, 0.5345,                     // w4-w5: Initial difficulty params
  1.4604, 0.0046,                     // w6-w7: Difficulty delta & mean reversion
  1.54575, 0.1192, 1.01925,           // w8-w10: Stability growth (recall)
  1.9395, 0.11, 0.29605, 0.22695,     // w11-w14: Stability collapse (lapse)
  0.2315, 2.9898                      // w15-w16: Hard & Easy stability multipliers
];

/**
 * FSRS power decay constant
 */
export const DECAY_FACTOR = 19 / 81;

/**
 * Factor derived such that R(S, S) = 0.9 (90% retention at elapsed time t = S)
 * 0.9 = (1 + FACTOR)^(-DECAY_FACTOR) => FACTOR = 0.9^(-1 / DECAY_FACTOR) - 1
 */
export const FACTOR = Math.pow(0.9, -1 / DECAY_FACTOR) - 1;

export const DEFAULT_REQUEST_RETENTION = 0.9;

/**
 * Backward compatibility wrapper for existing imports
 */
export const DEFAULT_WEIGHTS = {
  w0: DEFAULT_FSRS_WEIGHTS[0],
  w1: DEFAULT_FSRS_WEIGHTS[1],
  w2: DEFAULT_FSRS_WEIGHTS[2],
  w3: DEFAULT_FSRS_WEIGHTS[3],
  w4: DEFAULT_FSRS_WEIGHTS[4],
  requestRetention: DEFAULT_REQUEST_RETENTION,
};

export { FSRSState };

/**
 * Calculates initial stability S0(G) for a new card.
 * G in {1: Again, 2: Hard, 3: Good, 4: Easy} -> w0..w3
 */
export function initStability(rating: ReviewRating, w = DEFAULT_FSRS_WEIGHTS): number {
  return Math.max(0.1, w[rating - 1]);
}

/**
 * Calculates initial difficulty D0(G) for a new card.
 * D0(G) = w4 - exp(w5 * (G - 1)) + 1, clamped to [1, 10]
 */
export function initDifficulty(rating: ReviewRating, w = DEFAULT_FSRS_WEIGHTS): number {
  const d0 = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
  return Math.min(10, Math.max(1, d0));
}

/**
 * Calculates next difficulty D'(D, G) with mean reversion.
 * delta D = -w6 * (G - 3)
 * next_d = d + delta D
 * D' = w7 * D0(3) + (1 - w7) * next_d, clamped to [1, 10]
 */
export function nextDifficulty(d: number, rating: ReviewRating, w = DEFAULT_FSRS_WEIGHTS): number {
  const deltaD = -w[6] * (rating - 3);
  const nextD = d + deltaD;
  const d0Good = initDifficulty(3, w); // Mean reversion target D0(Good)
  const revertedD = w[7] * d0Good + (1 - w[7]) * nextD;
  return Math.min(10, Math.max(1, revertedD));
}

/**
 * Retrievability R(t, S) using the FSRS power-law forgetting curve.
 * R(t, S) = (1 + FACTOR * (t / S))^(-DECAY_FACTOR)
 */
export function calculateRetrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + FACTOR * (t / stability), -DECAY_FACTOR);
}

/**
 * Next stability S'r after successful recall (Hard, Good, Easy).
 * S'r = S * (1 + exp(w8) * (11 - D) * S^(-w9) * (exp((1 - R) * w10) - 1) * multiplier)
 * where multiplier is w15 for Hard, 1.0 for Good, w16 for Easy.
 */
export function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: ReviewRating,
  w = DEFAULT_FSRS_WEIGHTS
): number {
  let hardEasyMultiplier = 1.0;
  if (rating === 2) {
    hardEasyMultiplier = w[15]; // Hard multiplier (0.2315)
  } else if (rating === 4) {
    hardEasyMultiplier = w[16]; // Easy multiplier (2.9898)
  }

  const recallGrowth =
    Math.exp(w[8]) *
    (11 - d) *
    Math.pow(Math.max(0.1, s), -w[9]) *
    (Math.exp((1 - r) * w[10]) - 1) *
    hardEasyMultiplier;

  return Math.max(s, s * (1 + recallGrowth));
}

/**
 * Next stability S'f after a lapse / forgotten review (Again).
 * S'f = w11 * D^(-w12) * ((S + 1)^w13 - 1) * exp((1 - R) * w14)
 * Clamped so it cannot exceed prior stability, with a lower bound of 0.1.
 */
export function nextForgetStability(
  d: number,
  s: number,
  r: number,
  w = DEFAULT_FSRS_WEIGHTS
): number {
  const stability =
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14]);

  return Math.min(s, Math.max(0.1, stability));
}

/**
 * Calculates scheduled interval (in days) from stability and target retention.
 * According to FSRS-4.5:
 * I(S, r) = (S / FACTOR) * (r^(-1 / DECAY_FACTOR) - 1)
 * At r = 0.90, interval = S exactly.
 */
export function calculateInterval(stability: number, targetRetention = DEFAULT_REQUEST_RETENTION): number {
  if (stability <= 0) return 1;
  const r = Math.min(0.98, Math.max(0.7, targetRetention));
  const interval = (stability / FACTOR) * (Math.pow(r, -1 / DECAY_FACTOR) - 1);
  return Math.max(0.01, interval);
}

/**
 * Applies deterministic interval fuzzing (anti-clustering) for cards with intervals >= 3 days.
 *
 * Edge case safeguards:
 * 1. Never applied to short learning/relearning intervals (< 3 days).
 * 2. Strictly bounded so fuzzed days >= 2, preventing any scheduled date in the past.
 */
export function applyIntervalFuzz(days: number, cardId: string, reps: number = 0): number {
  if (days < 3) return days;

  // Stable deterministic hash from card id and reps so preview matches actual schedule
  const key = `${cardId}-${reps}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const pseudoRand = ((Math.abs(hash) % 1000) / 1000) - 0.5; // -0.5 to +0.5
  const maxFuzz = Math.max(1, Math.round(days * 0.05)); // +/- 5% fuzz
  const delta = Math.round(pseudoRand * 2 * maxFuzz);

  // Strictly clamp to at least 2 days so due date is always safely in the future
  return Math.max(2, Math.round(days + delta));
}

export function formatInterval(days: number): string {
  if (days < 1 / (24 * 60)) {
    return '<1m';
  }
  if (days < 1 / 24) {
    const minutes = Math.round(days * 24 * 60);
    return `${Math.max(1, minutes)}m`;
  }
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  if (days < 30) {
    const d = Math.round(days);
    return `${d}d`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}mo`;
  }
  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

/**
 * Calculates updated card memory properties strictly adhering to FSRS-4.5 state machine:
 *
 * States:
 * - New (0): Never reviewed before.
 * - Learning (1): Initial short-term steps.
 * - Review (2): Fully graduated into long-term spaced repetition.
 * - Relearning (3): Lapsed from Review and undergoing recovery steps.
 *
 * Edge cases handled:
 * - FIRST REVIEW LAPSE: Failing a brand new or learning card is NOT a lapse.
 *   Lapses are only counted when a graduated Review card fails recall.
 * - DUE DATE PAST: Interval fuzzing and due timestamps are strictly clamped so
 *   due dates are always in the future (minimum 1 minute ahead even for micro-steps).
 */
export function calculateNextFSRSState(
  card: Flashcard,
  rating: ReviewRating,
  now = Date.now(),
  targetRetention = DEFAULT_REQUEST_RETENTION
): {
  state: CardState;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number;
  last_review: number;
  due: number;
} {
  const isNewCard = card.state === 'new' || card.reps === 0;
  let newState: CardState;
  let newStability: number;
  let newDifficulty: number;
  let newLapses = card.lapses || 0;
  let intervalDays: number;

  if (isNewCard) {
    // -------------------------------------------------------------
    // 1. New (0) -> First Encounter
    // -------------------------------------------------------------
    newDifficulty = initDifficulty(rating);
    newStability = initStability(rating);

    // Edge case: first review failure is NOT a lapse.
    // Lapses only count when a learned card is forgotten.
    if (rating === 1) {
      // Again: enter learning state, short step (10 minutes)
      newState = 'learning';
      intervalDays = 10 / (24 * 60);
    } else if (rating === 2) {
      // Hard: enter learning state, 1-day step
      newState = 'learning';
      intervalDays = 1;
    } else if (rating === 3) {
      // Good: graduate directly to review
      newState = 'review';
      intervalDays = Math.max(1, Math.round(calculateInterval(newStability, targetRetention)));
    } else {
      // Easy: graduate directly to review with high initial stability
      newState = 'review';
      intervalDays = Math.max(2, Math.round(calculateInterval(newStability, targetRetention)));
    }
  } else if (card.state === 'learning') {
    // -------------------------------------------------------------
    // 2. Learning (1) -> Initial Acquisition Steps
    // -------------------------------------------------------------
    newDifficulty = nextDifficulty(card.difficulty || initDifficulty(3), rating);

    // Edge case: failing in learning state is NOT a lapse
    if (rating === 1) {
      // Again: repeat learning step (10 minutes)
      newState = 'learning';
      newStability = initStability(1);
      intervalDays = 10 / (24 * 60);
    } else if (rating === 2) {
      // Hard: advance to 1-day step
      newState = 'learning';
      newStability = initStability(2);
      intervalDays = 1;
    } else if (rating === 3) {
      // Good: graduate into review
      newState = 'review';
      newStability = initStability(3);
      intervalDays = Math.max(1, Math.round(calculateInterval(newStability, targetRetention)));
    } else {
      // Easy: immediate graduation with easy stability boost
      newState = 'review';
      newStability = initStability(4);
      intervalDays = Math.max(2, Math.round(calculateInterval(newStability, targetRetention)));
    }
  } else if (card.state === 'review') {
    // -------------------------------------------------------------
    // 3. Review (2) -> Graduated Spaced Repetition
    // -------------------------------------------------------------
    const lastTime = card.lastReview ?? card.last_review ?? (card.due ? card.due - (card.stability || 1) * 86400000 : now);
    const elapsedDays = Math.max(0, (now - lastTime) / (1000 * 60 * 60 * 24));
    const retrievability = calculateRetrievability(elapsedDays, card.stability || 1);

    newDifficulty = nextDifficulty(card.difficulty || initDifficulty(3), rating);

    if (rating === 1) {
      // Failed recall in Review state -> TRUE LAPSE into Relearning (3)
      newState = 'relearning';
      newLapses += 1; // Increment lapse count
      newStability = nextForgetStability(newDifficulty, card.stability || 1, retrievability);
      intervalDays = 10 / (24 * 60); // 10-minute relearning recovery step
    } else {
      // Successful recall in Review state
      newState = 'review';
      newStability = nextRecallStability(newDifficulty, card.stability || 1, retrievability, rating);
      const rawInterval = calculateInterval(newStability, targetRetention);
      intervalDays = applyIntervalFuzz(Math.max(1, Math.round(rawInterval)), card.id, (card.reps || 0) + 1);
    }
  } else {
    // -------------------------------------------------------------
    // 4. Relearning (3) -> Post-Lapse Recovery Steps
    // -------------------------------------------------------------
    newDifficulty = nextDifficulty(card.difficulty || initDifficulty(3), rating);

    if (rating === 1) {
      // Again: repeat relearning step (do not increment lapse again in same session)
      newState = 'relearning';
      newStability = Math.max(0.1, (card.stability || 0.4) * 0.8);
      intervalDays = 10 / (24 * 60);
    } else if (rating === 2) {
      // Hard: repeat 1-day step
      newState = 'relearning';
      newStability = card.stability || initStability(2);
      intervalDays = 1;
    } else if (rating === 3) {
      // Good: successfully recovered, graduate back to Review (2)
      newState = 'review';
      newStability = Math.max(0.5, card.stability || initStability(3));
      const rawInterval = calculateInterval(newStability, targetRetention);
      intervalDays = Math.max(1, Math.round(rawInterval));
    } else {
      // Easy: immediate graduation back to Review with bonus stability
      newState = 'review';
      newStability = nextRecallStability(newDifficulty, card.stability || initStability(4), 1.0, 4);
      const rawInterval = calculateInterval(newStability, targetRetention);
      intervalDays = applyIntervalFuzz(Math.max(2, Math.round(rawInterval)), card.id, (card.reps || 0) + 1);
    }
  }

  // Calculate next due timestamp with strict safety clamp:
  // Must ALWAYS be in the future (minimum 1 minute ahead even for short intervals)
  const intervalMs = Math.round(intervalDays * 24 * 60 * 60 * 1000);
  const nextDue = Math.max(now + intervalMs, now + 60 * 1000);

  return {
    state: newState,
    stability: Number(newStability.toFixed(3)),
    difficulty: Number(newDifficulty.toFixed(2)),
    reps: (card.reps || 0) + 1,
    lapses: newLapses,
    lastReview: now,
    last_review: now,
    due: nextDue,
  };
}

export function getFSRSOptions(
  card: Flashcard,
  now = Date.now(),
  targetRetention = DEFAULT_REQUEST_RETENTION
): FSRSRatingOption[] {
  const ratings: ReviewRating[] = [1, 2, 3, 4];
  const labels: Record<ReviewRating, string> = {
    1: 'Again',
    2: 'Hard',
    3: 'Good',
    4: 'Easy',
  };
  const shortcuts: Record<ReviewRating, string> = {
    1: '1',
    2: '2',
    3: '3',
    4: '4',
  };
  const colorClasses: Record<ReviewRating, string> = {
    1: 'text-rose-600 hover:bg-rose-50 border-rose-200 active:border-rose-400',
    2: 'text-amber-600 hover:bg-amber-50 border-amber-200 active:border-amber-400',
    3: 'text-blue-600 hover:bg-blue-50 border-blue-200 active:border-blue-400',
    4: 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 active:border-emerald-400',
  };

  return ratings.map((r) => {
    const nextState = calculateNextFSRSState(card, r, now, targetRetention);
    const intervalDays = Math.max(0, (nextState.due - now) / (1000 * 60 * 60 * 24));
    return {
      rating: r,
      label: labels[r],
      intervalText: formatInterval(intervalDays),
      shortcut: shortcuts[r],
      colorClass: colorClasses[r],
    };
  });
}
