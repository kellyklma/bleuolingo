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

/**
 * Ensures all text on a flashcard is cleanly lowercased
 */
export function lowercaseCard(card: Flashcard): Flashcard {
  const fallbackCreated = card.createdAt || (card.due ? Math.min(card.due, Date.now() - 86400000 * 2) : Date.now() - 86400000 * 2);
  const fallbackModified = card.modifiedAt || card.lastReview || fallbackCreated;

  return {
    ...card,
    front: card.front ? card.front.toLowerCase() : '',
    back: card.back ? card.back.toLowerCase() : '',
    example: card.example ? card.example.toLowerCase() : card.example,
    exampleTranslation: card.exampleTranslation
      ? card.exampleTranslation.toLowerCase()
      : card.exampleTranslation,
    targetWord: card.targetWord ? card.targetWord.toLowerCase() : card.targetWord,
    createdAt: card.createdAt || fallbackCreated,
    modifiedAt: card.modifiedAt || fallbackModified,
  };
}

/**
 * Migrates and lowercases all existing cards across all user profiles in storage
 */
export function lowercaseAllExistingCardsForAllProfiles(profiles: UserProfile[]): void {
  if (typeof window === 'undefined') return;

  // Migrate legacy key if present
  try {
    const legacy = localStorage.getItem(LEGACY_CARDS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        localStorage.setItem(LEGACY_CARDS_KEY, JSON.stringify(parsed.map(lowercaseCard)));
      }
    }
  } catch {
    // Ignore error
  }

  // Lowercase cards for each registered profile
  for (const profile of profiles) {
    try {
      const key = getCardStorageKey(profile.id);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const lowercased = parsed.map(lowercaseCard);
          localStorage.setItem(key, JSON.stringify(lowercased));
        }
      }
    } catch {
      // Ignore error
    }
  }

  // Also sweep any other existing user cards in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && storageKey.startsWith('bleuolingo_cards_user_')) {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const lowercased = parsed.map(lowercaseCard);
            localStorage.setItem(storageKey, JSON.stringify(lowercased));
          }
        }
      }
    }
  } catch {
    // Ignore error
  }
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
      name: 'Learner 1',
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

  // Automatically lowercase all existing cards for all profiles
  lowercaseAllExistingCardsForAllProfiles(profiles);

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
  if (typeof window === 'undefined') return STARTER_DECK.map(lowercaseCard);
  try {
    const raw = localStorage.getItem(getCardStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(lowercaseCard);
      }
    }
  } catch {
    // Ignore parse error
  }
  return STARTER_DECK.map(lowercaseCard);
}

/**
 * Saves cards for a specific user
 */
export function saveUserCards(userId: string, cards: Flashcard[]): void {
  if (typeof window === 'undefined') return;
  try {
    const lowercasedCards = cards.map(lowercaseCard);
    localStorage.setItem(getCardStorageKey(userId), JSON.stringify(lowercasedCards));
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
    name: name.trim() || `Learner ${existingProfiles.length + 1}`,
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
