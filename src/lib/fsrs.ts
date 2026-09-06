import { Flashcard, ReviewRating, FSRSRatingOption } from '../types';

const DEFAULT_WEIGHTS = {
  w0: 0.4, // Initial stability for Again (~10m)
  w1: 0.9, // Initial stability for Hard (~1d)
  w2: 2.5, // Initial stability for Good (~2-3d)
  w3: 6.0, // Initial stability for Easy (~6d)
  w4: 5.0, // Base difficulty
  requestRetention: 0.9,
};

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
  let nextLapses = card.lapses || 0;
  let intervalDays: number;

  if (isFirstReview) {
    switch (rating) {
      case 1: // Again
        nextStability = DEFAULT_WEIGHTS.w0;
        nextDifficulty = 7.0;
        nextState = 'learning';
        nextLapses += 1;
        intervalDays = 10 / (24 * 60); // 10 minutes
        break;
      case 2: // Hard
        nextStability = DEFAULT_WEIGHTS.w1;
        nextDifficulty = 6.0;
        nextState = 'learning';
        intervalDays = 1; // 1 day
        break;
      case 3: // Good
        nextStability = DEFAULT_WEIGHTS.w2;
        nextDifficulty = DEFAULT_WEIGHTS.w4;
        nextState = 'review';
        intervalDays = 2.5;
        break;
      case 4: // Easy
        nextStability = DEFAULT_WEIGHTS.w3;
        nextDifficulty = 3.5;
        nextState = 'review';
        intervalDays = 6.0;
        break;
    }
  } else {
    const lastTime = card.lastReview || now;
    const elapsedDays = Math.max(0.01, (now - lastTime) / (1000 * 60 * 60 * 24));
    
    // Retrievability (power-law forgetting curve)
    const retrievability = Math.pow(1 + elapsedDays / (9 * Math.max(0.1, card.stability)), -1);

    // Difficulty delta with mean reversion toward 5.0
    let delta = 0;
    if (rating === 1) delta = 1.4;
    else if (rating === 2) delta = 0.5;
    else if (rating === 3) delta = -0.3;
    else if (rating === 4) delta = -1.0;

    const rawDifficulty = (card.difficulty || 5.0) + delta;
    nextDifficulty = Math.min(10, Math.max(1, 0.1 * 5.0 + 0.9 * rawDifficulty));

    if (rating === 1) {
      // Failed in review (Lapse)
      nextState = 'learning';
      nextLapses += 1;
      nextStability = Math.max(0.2, 0.4 * Math.pow(card.stability, 0.35));
      intervalDays = 10 / (24 * 60); // 10 minutes re-test
    } else {
      nextState = 'review';
      const difficultyFactor = Math.exp(-0.07 * (nextDifficulty - 5));
      
      let ratingFactor = 2.5; // Good
      if (rating === 2) ratingFactor = 1.2; // Hard
      if (rating === 4) ratingFactor = 3.8; // Easy

      // Stability growth on successful recall
      const growth = 1 + ratingFactor * difficultyFactor * (1 - retrievability);
      nextStability = Math.max(1.0, card.stability * growth);

      // Interval scaled to target retention
      intervalDays = Math.max(1, Math.round(nextStability));
    }
  }

  const nextDue = now + Math.round(intervalDays * 24 * 60 * 60 * 1000);

  return {
    state: nextState,
    stability: Number(nextStability.toFixed(2)),
    difficulty: Number(nextDifficulty.toFixed(2)),
    reps: (card.reps || 0) + 1,
    lapses: nextLapses,
    lastReview: now,
    due: nextDue,
  };
}

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