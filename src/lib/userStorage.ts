import { Flashcard, UserProfile } from '../types';
import { STARTER_DECK } from '../data/starterDeck';

const PROFILES_STORAGE_KEY = 'bleuolingo_profiles_v1';
const ACTIVE_USER_KEY = 'bleuolingo_active_user_v1';
const LEGACY_CARDS_KEY = 'bleuolingo_deck_v1';

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
];

export function getCardStorageKey(userId: string): string {
  return `bleuolingo_cards_user_${userId}`;
}

export function getSettingsStorageKey(userId: string): string {
  return `bleuolingo_settings_user_${userId}`;
}

export function ensureCardTimestamps(card: Flashcard): Flashcard {
  const now = Date.now();
  return {
    ...card,
    createdAt: card.createdAt || now,
    modifiedAt: card.modifiedAt || now,
  };
}

/**
 * Initializes and retrieves all user profiles.
 * Seamlessly migrates legacy localStorage data to the default profile.
 */
export function getInitialProfiles(): { profiles: UserProfile[]; activeUserId: string } {
  if (typeof window === 'undefined') {
    const defaultUser: UserProfile = {
      id: 'user_default',
      name: 'Default Learner',
      avatarColor: AVATAR_COLORS[0],
      createdAt: Date.now(),
    };
    return { profiles: [defaultUser], activeUserId: defaultUser.id };
  }

  let profiles: UserProfile[] = [];
  try {
    const savedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (savedProfiles) {
      const parsed = JSON.parse(savedProfiles);
      if (Array.isArray(parsed) && parsed.length > 0) {
        profiles = parsed.map((p: UserProfile) => ({
          ...p,
          createdAt: p.createdAt || Date.now(),
        }));
      }
    }
  } catch {
    // Ignore parse error
  }

  // Create default profile if none exist
  if (profiles.length === 0) {
    const defaultUser: UserProfile = {
      id: 'user_default',
      name: 'Guest',
      avatarColor: AVATAR_COLORS[0],
      createdAt: Date.now(),
    };
    profiles = [defaultUser];
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));

    // Migrate legacy cards to this user's storage
    try {
      const legacyCards = localStorage.getItem(LEGACY_CARDS_KEY);
      if (legacyCards) {
        localStorage.setItem(getCardStorageKey(defaultUser.id), legacyCards);
      }
    } catch {
      // Ignore migration error
    }
  }

  // Determine active user ID
  let activeId = localStorage.getItem(ACTIVE_USER_KEY) || profiles[0].id;
  if (!profiles.some((p) => p.id === activeId)) {
    activeId = profiles[0].id;
    localStorage.setItem(ACTIVE_USER_KEY, activeId);
  }

  return { profiles, activeUserId: activeId };
}

/**
 * Saves all user profiles
 */
export function saveProfiles(profiles: UserProfile[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

/**
 * Saves active user ID
 */
export function saveActiveUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_USER_KEY, userId);
}

/**
 * Loads cards for a specific user.
 * If user has no saved cards, initializes with STARTER_DECK.
 */
export function loadUserCards(userId: string): Flashcard[] {
  if (typeof window === 'undefined') return STARTER_DECK;
  try {
    const raw = localStorage.getItem(getCardStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error
  }
  return STARTER_DECK;
}

/**
 * Saves cards for a specific user
 */
export function saveUserCards(userId: string, cards: Flashcard[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCardStorageKey(userId), JSON.stringify(cards));
  } catch {
    // Ignore storage quota error
  }
}

/**
 * Creates a brand new user profile with their own independent starter deck
 */
export function createUserProfile(name: string, existingProfiles: UserProfile[]): UserProfile {
  const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const colorIndex = existingProfiles.length % AVATAR_COLORS.length;
  const newProfile: UserProfile = {
    id: newId,
    name: name.trim() || `Guest`,
    avatarColor: AVATAR_COLORS[colorIndex],
    createdAt: Date.now(),
  };

  // Initialize brand new independent cards for this user (lowercased)
  saveUserCards(newId, STARTER_DECK.map(lowercaseCard));

  const updatedProfiles = [...existingProfiles, newProfile];
  saveProfiles(updatedProfiles);
  saveActiveUserId(newId);

  return newProfile;
}

/**
 * Deletes a user profile and cleans up their data
 */
export function deleteUserProfile(
  userId: string,
  existingProfiles: UserProfile[]
): { updatedProfiles: UserProfile[]; nextActiveId: string } {
  if (existingProfiles.length <= 1) {
    // Cannot delete the only profile
    return { updatedProfiles: existingProfiles, nextActiveId: userId };
  }

  // Remove data
  if (typeof window !== 'undefined') {
    localStorage.removeItem(getCardStorageKey(userId));
    localStorage.removeItem(getSettingsStorageKey(userId));
  }

  const updatedProfiles = existingProfiles.filter((p) => p.id !== userId);
  const nextActiveId = updatedProfiles[0].id;

  saveProfiles(updatedProfiles);
  saveActiveUserId(nextActiveId);

  return { updatedProfiles, nextActiveId };
}

/**
 * Renames an existing user profile
 */
export function renameUserProfile(
  userId: string,
  newName: string,
  existingProfiles: UserProfile[]
): UserProfile[] {
  const trimmed = newName.trim();
  if (!trimmed) return existingProfiles;

  const updatedProfiles = existingProfiles.map((p) =>
    p.id === userId ? { ...p, name: trimmed } : p
  );

  saveProfiles(updatedProfiles);
  return updatedProfiles;
}
