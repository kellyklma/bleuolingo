import { Flashcard, ReviewRating, FSRSRatingOption } from '../types';

// Standard FSRS default parameters
const DEFAULT_WEIGHTS = {
  w0: 0.4, // Initial stability for Again
  w1: 1.2, // Initial stability for Hard
  w2: 3.2, // Initial stability for Good
  w3: 8.0, // Initial stability for Easy
  w4: 5.0, // Base difficulty
  w5: 1.0, // Difficulty step per rating difference
  factorHard: 1.2,
  factorGood: 2.5,
  factorEasy: 3.8,
  requestRetention: 0.9,
};

/**
 * Format interval (in days) into human-readable compact text (like Anki: 10m, 1d, 3d, 1mo)
 */
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
 * Calculates updated card memory properties using FSRS
 */
export function calculateNextFSRSState(
  card: Flashcard,
  rating: ReviewRating,
  now = Date.now()
): {
  state: Flashcard['state'];
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReview: number;
  due: number;
} {
  const isFirstReview = card.state === 'new' || card.reps === 0;
  let nextStability: number;
  let nextDifficulty: number;
  let nextState: Flashcard['state'] = card.state;
  let nextLapses = card.lapses;

  if (isFirstReview) {
    // Initial Review calculation
    switch (rating) {
      case 1: // Again
        nextStability = DEFAULT_WEIGHTS.w0; // ~0.4 days (or ~10m for immediate review)
        nextDifficulty = Math.min(10, Math.max(1, DEFAULT_WEIGHTS.w4 + 2.5));
        nextState = 'learning';
        nextLapses += 1;
        break;
      case 2: // Hard
        nextStability = DEFAULT_WEIGHTS.w1;
        nextDifficulty = Math.min(10, Math.max(1, DEFAULT_WEIGHTS.w4 + 1.0));
        nextState = 'learning';
        break;
      case 3: // Good
        nextStability = DEFAULT_WEIGHTS.w2;
        nextDifficulty = DEFAULT_WEIGHTS.w4;
        nextState = 'review';
        break;
      case 4: // Easy
        nextStability = DEFAULT_WEIGHTS.w3;
        nextDifficulty = Math.min(10, Math.max(1, DEFAULT_WEIGHTS.w4 - 1.5));
        nextState = 'review';
        break;
    }
  } else {
    // Card has been reviewed before
    const lastTime = card.lastReview || now;
    const elapsedDays = Math.max(0.01, (now - lastTime) / (1000 * 60 * 60 * 24));
    
    // Power-law retrievability
    const retrievability = Math.pow(1 + elapsedDays / (9 * Math.max(0.1, card.stability)), -1);

    // Update Difficulty (clamped between 1 and 10)
    let difficultyDelta = 0;
    if (rating === 1) difficultyDelta = 1.6;
    else if (rating === 2) difficultyDelta = 0.6;
    else if (rating === 3) difficultyDelta = -0.3;
    else if (rating === 4) difficultyDelta = -1.0;

    nextDifficulty = Math.min(10, Math.max(1, card.difficulty + difficultyDelta));

    // Update Stability
    if (rating === 1) {
      // Lapse (forgotten)
      nextState = 'learning';
      nextLapses += 1;
      nextStability = Math.max(0.1, 0.4 * Math.pow(card.stability, 0.3));
    } else {
      nextState = 'review';
      const difficultyPenalty = Math.exp(-0.08 * (nextDifficulty - 5));

      let ratingMultiplier = DEFAULT_WEIGHTS.factorGood;
      if (rating === 2) ratingMultiplier = DEFAULT_WEIGHTS.factorHard;
      if (rating === 4) ratingMultiplier = DEFAULT_WEIGHTS.factorEasy;

      // FSRS stability growth formula based on retention curve
      const growth = 1 + ratingMultiplier * difficultyPenalty * (1 - retrievability);
      nextStability = Math.max(1, card.stability * growth);
    }
  }

  // Calculate next interval based on stability and target retention
  let intervalDays: number;
  if (rating === 1) {
    // 10 minutes step for lapses / again
    intervalDays = 10 / (24 * 60);
  } else {
    // Interval derived from stability
    intervalDays = Math.max(1, Math.round(nextStability));
  }

  const nextDue = now + intervalDays * 24 * 60 * 60 * 1000;

  return {
    state: nextState,
    stability: Number(nextStability.toFixed(2)),
    difficulty: Number(nextDifficulty.toFixed(2)),
    reps: card.reps + 1,
    lapses: nextLapses,
    lastReview: now,
    due: nextDue,
  };
}

/**
 * Previews the next intervals for all 4 ratings (Again, Hard, Good, Easy)
 */
export function getFSRSOptions(card: Flashcard, now = Date.now()): FSRSRatingOption[] {
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
    const nextState = calculateNextFSRSState(card, r, now);
    const intervalDays = (nextState.due - now) / (1000 * 60 * 60 * 24);
    return {
      rating: r,
      label: labels[r],
      intervalText: formatInterval(intervalDays),
      shortcut: shortcuts[r],
      colorClass: colorClasses[r],
    };
  });
}
