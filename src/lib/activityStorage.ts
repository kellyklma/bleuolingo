export type ActivityLog = Record<string, number>;

export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SANITIZED_KEY = 'bleuolingo_activity_sanitized_v2';

function sanitizeMockData(log: ActivityLog): ActivityLog {
  const today = new Date();
  const todayKey = formatDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  const cleaned: ActivityLog = {};
  for (const [k, v] of Object.entries(log)) {
    // Keep today and yesterday, and remove older synthetic mock-seeded days
    if (k === todayKey || k === yesterdayKey) {
      cleaned[k] = v;
    }
  }
  // Ensure if user used yesterday and today, they have their records preserved
  if (log[yesterdayKey] !== undefined) {
    cleaned[yesterdayKey] = log[yesterdayKey];
  }
  if (log[todayKey] !== undefined) {
    cleaned[todayKey] = log[todayKey];
  }
  return cleaned;
}

export function getActivityStorageKey(userId: string): string {
  return `bleuolingo_activity_v1_${userId}`;
}

export function getActivityLog(userId: string): ActivityLog {
  if (typeof window === 'undefined') return {};
  try {
    const key = getActivityStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const isSanitized = localStorage.getItem(`${SANITIZED_KEY}_${userId}`);
        if (!isSanitized) {
          const cleaned = sanitizeMockData(parsed as ActivityLog);
          localStorage.setItem(`${SANITIZED_KEY}_${userId}`, 'true');
          saveActivityLog(userId, cleaned);
          return cleaned;
        }
        return parsed as ActivityLog;
      }
    }
  } catch {
    // Ignore error
  }

  // No mock seeding - start with an empty log for authentic tracking
  return {};
}

export const loadActivityLog = getActivityLog;

export function saveActivityLog(userId: string, log: ActivityLog): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getActivityStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(log));
  } catch {
    // Ignore error
  }
}

export function recordReviewActivity(userId: string, count: number = 1): ActivityLog {
  const current = getActivityLog(userId);
  const todayKey = formatDateKey(new Date());
  const updated: ActivityLog = {
    ...current,
    [todayKey]: (current[todayKey] || 0) + count,
  };
  saveActivityLog(userId, updated);
  return updated;
}

export function calculateStreak(log: ActivityLog): {
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
} {
  const today = new Date();
  const todayKey = formatDateKey(today);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  // Compute total reviews
  const totalReviews = Object.values(log).reduce((acc, val) => acc + (val || 0), 0);

  // Compute current streak
  let currentStreak = 0;
  let checkDate = new Date(today);

  // If active today, start counting from today. Otherwise, if active yesterday, start from yesterday.
  if ((log[todayKey] || 0) > 0) {
    checkDate = today;
  } else if ((log[yesterdayKey] || 0) > 0) {
    checkDate = yesterday;
  } else {
    // Streak broken
    return { currentStreak: 0, longestStreak: 0, totalReviews };
  }

  while (true) {
    const key = formatDateKey(checkDate);
    if ((log[key] || 0) > 0) {
      currentStreak++;
      checkDate = new Date(checkDate);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak calculation
  const sortedDates = Object.keys(log)
    .filter((k) => (log[k] || 0) > 0)
    .sort();

  let longestStreak = currentStreak;
  let running = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d);

    if (!prevDate) {
      running = 1;
    } else {
      const diffMs = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        running++;
      } else if (diffDays > 1) {
        running = 1;
      }
    }
    if (running > longestStreak) {
      longestStreak = running;
    }
    prevDate = currentDate;
  }

  return { currentStreak, longestStreak, totalReviews };
}
