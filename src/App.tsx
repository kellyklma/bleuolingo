import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Flashcard, ReviewRating, SessionStats, UserProfile } from './types';
import { STARTER_DECK } from './data/starterDeck';
import { calculateNextFSRSState } from './lib/fsrs';
import { AppSidebar, NavigationTab } from './components/AppSidebar';
import { SessionProgress } from './components/SessionProgress';
import { FlashcardView } from './components/FlashcardView';
import { SessionComplete } from './components/SessionComplete';
import { FreeStudyView } from './components/FreeStudyView';
import { DeckManagerView } from './components/DeckManagerView';
import { SettingsView } from './components/SettingsView';
import { StatsView } from './components/StatsView';
import { BleuoMascot } from './components/BleuoMascot';
import {
  getInitialProfiles,
  saveActiveUserId,
  loadUserCards,
  saveUserCards,
  createUserProfile,
  deleteUserProfile,
  renameUserProfile,
  lowercaseCard,
} from './lib/userStorage';
import { loadActivityLog, recordReviewActivity, ActivityLog, formatDateKey } from './lib/activityStorage';
import { User } from 'firebase/auth';
import { subscribeToAuth, loginWithGoogle, logout } from './lib/auth';
import { ArrowLeftRight, BookOpen, Menu, X } from 'lucide-react';
import {
  fetchUserCardsFirestore,
  saveUserCardsFirestore,
  fetchUserActivityFirestore,
  recordReviewActivityFirestore,
  fetchUserSettingsFirestore,
  saveUserSettingsFirestore,
  UserSettingsFirestore,
} from './lib/firestoreStorage';
import {
  getDailyNewCardLimit,
  saveDailyNewCardLimit,
  getRandomizeNewCards,
  saveRandomizeNewCards,
  getNewCardsIntroducedToday,
  recordNewCardIntroducedToday,
  getTodayNewCardsOverride,
  addTodayNewCardsOverride,
  clearTodayNewCards,
  getAvailableNewCards,
} from './lib/studySettingsStorage';

const AUTOPLAY_DISPLAY_KEY = 'bleuolingo_autoplay_display_v1';
const AUTOPLAY_FLIP_KEY = 'bleuolingo_autoplay_flip_v1';
const SIDES_SWAPPED_KEY = 'bleuolingo_sides_swapped_v1';
const SIDEBAR_COLLAPSED_KEY = 'bleuolingo_sidebar_collapsed_v1';
const FRONT_LANG_KEY = 'bleuolingo_front_lang_v1';
const BACK_LANG_KEY = 'bleuolingo_back_lang_v1';
const TARGET_RETENTION_KEY = 'bleuolingo_target_retention_v1';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const persistSetting = useCallback(
    <K extends keyof UserSettingsFirestore>(key: K, value: UserSettingsFirestore[K]) => {
      if (currentUser) {
        saveUserSettingsFirestore(currentUser.uid, { [key]: value });
      }
    },
    [currentUser]
  );

  // Navigation tab: 'practice' | 'deck' | 'settings'
  const [activeTab, setActiveTab] = useState<NavigationTab>('practice');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    }
    return false;
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      persistSetting('isSidebarCollapsed', next);
      return next;
    });
  };

  // Global Audio Languages (Defaults: front -> fr, back -> en)
  const [frontLanguage, setFrontLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(FRONT_LANG_KEY) || 'fr';
    }
    return 'fr';
  });

  const [backLanguage, setBackLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(BACK_LANG_KEY) || 'en';
    }
    return 'en';
  });

  const handleSelectFrontLanguage = (lang: string) => {
    setFrontLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FRONT_LANG_KEY, lang);
    }
    persistSetting('frontLanguage', lang);
  };

  const handleSelectBackLanguage = (lang: string) => {
    setBackLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BACK_LANG_KEY, lang);
    }
    persistSetting('backLanguage', lang);
  };

  // Per-user profiles state (isolated cards, CSV imports, and FSRS progress per user)
  const [userState, setUserState] = useState<{ profiles: UserProfile[]; activeUserId: string }>(
    () => getInitialProfiles()
  );
  const profiles = userState.profiles;
  const activeUserId = userState.activeUserId;

  // Initialize cards for the active user
  const [cards, setCards] = useState<Flashcard[]>(() => loadUserCards(userState.activeUserId));

  // Activity tracking for heatmap & streaks
  const [activityLog, setActivityLog] = useState<ActivityLog>(() =>
    loadActivityLog(userState.activeUserId)
  );

  // Audio auto-play preferences
  const [autoPlayOnDisplay, setAutoPlayOnDisplay] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTOPLAY_DISPLAY_KEY);
      if (saved !== null) return saved === 'true';
      const legacy = localStorage.getItem('bleuolingo_auto_audio_v1');
      if (legacy !== null) return legacy !== 'false';
    }
    return true;
  });

  const [autoPlayOnFlip, setAutoPlayOnFlip] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTOPLAY_FLIP_KEY);
      if (saved !== null) return saved === 'true';
      const legacy = localStorage.getItem('bleuolingo_auto_audio_v1');
      if (legacy !== null) return legacy !== 'false';
    }
    return true;
  });

  // Global switch sides state
  const [isSidesSwapped, setIsSidesSwapped] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDES_SWAPPED_KEY) === 'true';
    }
    return false;
  });

  // FSRS Target Retention preference (default 90% / 0.90)
  const [targetRetention, setTargetRetention] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(TARGET_RETENTION_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.7 && val <= 0.98) return val;
      }
    }
    return 0.9;
  });

  const handleUpdateTargetRetention = (retention: number) => {
    setTargetRetention(retention);
    if (typeof window !== 'undefined') {
      localStorage.setItem(TARGET_RETENTION_KEY, String(retention));
    }
    persistSetting('targetRetention', retention);
  };

  const effectiveUserId = currentUser ? currentUser.uid : activeUserId;

  // Daily new card limit (default 20 cards/day, 0 = No limit)
  const [dailyNewLimit, setDailyNewLimit] = useState<number>(() => {
    return getDailyNewCardLimit(activeUserId);
  });

  const handleUpdateDailyNewLimit = (limit: number) => {
    setDailyNewLimit(limit);
    saveDailyNewCardLimit(effectiveUserId, limit);
    persistSetting('dailyNewLimit', limit);
    setIsFlipped(false);
  };

  // Randomize new cards order preference (default false = deck order)
  const [randomizeNewCards, setRandomizeNewCards] = useState<boolean>(() => {
    return getRandomizeNewCards(activeUserId);
  });

  const handleToggleRandomizeNewCards = (randomize: boolean) => {
    setRandomizeNewCards(randomize);
    saveRandomizeNewCards(effectiveUserId, randomize);
    persistSetting('randomizeNewCards', randomize);
  };

  // Tracking how many new cards have been introduced today
  const [newCardsIntroducedToday, setNewCardsIntroducedToday] = useState<number>(() => {
    return getNewCardsIntroducedToday(activeUserId);
  });

  // Today's override allowance for extra new cards
  const [overrideNewCardsToday, setOverrideNewCardsToday] = useState<number>(() => {
    return getTodayNewCardsOverride(activeUserId);
  });

  const handleAddTodayOverride = (additionalCount: number) => {
    const nextCount = addTodayNewCardsOverride(effectiveUserId, additionalCount);
    setOverrideNewCardsToday(nextCount);
    // Reset session stats so the new batch of cards counts cleanly from 0
    setSessionStats({
      totalReviewed: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      sessionStartTime: Date.now(),
    });
  };

  // Keep settings synced whenever effective user changes
  useEffect(() => {
    setDailyNewLimit(getDailyNewCardLimit(effectiveUserId));
    setRandomizeNewCards(getRandomizeNewCards(effectiveUserId));
    setNewCardsIntroducedToday(getNewCardsIntroducedToday(effectiveUserId));
    setOverrideNewCardsToday(getTodayNewCardsOverride(effectiveUserId));
  }, [effectiveUserId]);

  // Session random salt for stable card shuffling across renders
  const [sessionSalt, setSessionSalt] = useState<string>(() => Math.random().toString(36).substring(2, 9));

  // Active card flipping state
  const [isFlipped, setIsFlipped] = useState(false);

  // Mascot dynamic mood state
  const [mascotMood, setMascotMood] = useState<'happy' | 'thinking' | 'cheering' | 'wink'>('happy');

  // Session stats for tracking progress in current session
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalReviewed: 0,
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
    sessionStartTime: Date.now(),
  });

  const [reviewAheadCardIds, setReviewAheadCardIds] = useState<string[]>([]);
  const [isFreeStudyMode, setIsFreeStudyMode] = useState(false);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Lock flag: prevents auto-save from clobbering Firestore before cloud data has been loaded
  const isCloudLoadedRef = useRef<boolean>(false);

  // Persist helper: writes cards to either Firestore or localStorage
  const persistCards = useCallback(
    (cardsToSave: Flashcard[]) => {
      if (currentUser) {
        saveUserCardsFirestore(currentUser.uid, cardsToSave);
      } else {
        saveUserCards(activeUserId, cardsToSave);
      }
    },
    [currentUser, activeUserId]
  );

  // Auto-save effect for FSRS review updates and background changes
  useEffect(() => {
    if (currentUser) {
      if (isCloudLoadedRef.current) {
        saveUserCardsFirestore(currentUser.uid, cards);
      }
    } else {
      saveUserCards(activeUserId, cards);
    }
  }, [cards, activeUserId, currentUser]);

  // Auth subscription: safely load remote cards without race-condition overwrites
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);

      if (user) {
        isCloudLoadedRef.current = false;

        try {
          // 1. Fetch remote activity log
          const cloudActivity = await fetchUserActivityFirestore(user.uid);
          if (isMounted) setActivityLog(cloudActivity);

          // 2. Fetch remote cards
          const cloudCards = await fetchUserCardsFirestore(user.uid);
          if (!isMounted) return;

          if (cloudCards && cloudCards.length > 0) {
            setCards(cloudCards);
          } else {
            // New cloud account with 0 cards: seed existing local deck or starter deck
            const initialDeck = cards.length > 0 ? cards : STARTER_DECK.map(lowercaseCard);
            await saveUserCardsFirestore(user.uid, initialDeck);
            setCards(initialDeck);
          }

          // 3. Fetch remote settings and hydrate
          const cloudSettings = await fetchUserSettingsFirestore(user.uid);
          if (isMounted) {
            if (cloudSettings && Object.keys(cloudSettings).length > 0) {
              if (typeof cloudSettings.frontLanguage === 'string') {
                setFrontLanguage(cloudSettings.frontLanguage);
                localStorage.setItem(FRONT_LANG_KEY, cloudSettings.frontLanguage);
              }
              if (typeof cloudSettings.backLanguage === 'string') {
                setBackLanguage(cloudSettings.backLanguage);
                localStorage.setItem(BACK_LANG_KEY, cloudSettings.backLanguage);
              }
              if (typeof cloudSettings.autoPlayOnDisplay === 'boolean') {
                setAutoPlayOnDisplay(cloudSettings.autoPlayOnDisplay);
                localStorage.setItem(AUTOPLAY_DISPLAY_KEY, String(cloudSettings.autoPlayOnDisplay));
              }
              if (typeof cloudSettings.autoPlayOnFlip === 'boolean') {
                setAutoPlayOnFlip(cloudSettings.autoPlayOnFlip);
                localStorage.setItem(AUTOPLAY_FLIP_KEY, String(cloudSettings.autoPlayOnFlip));
              }
              if (typeof cloudSettings.isSidesSwapped === 'boolean') {
                setIsSidesSwapped(cloudSettings.isSidesSwapped);
                localStorage.setItem(SIDES_SWAPPED_KEY, String(cloudSettings.isSidesSwapped));
              }
              if (typeof cloudSettings.targetRetention === 'number') {
                setTargetRetention(cloudSettings.targetRetention);
                localStorage.setItem(TARGET_RETENTION_KEY, String(cloudSettings.targetRetention));
              }
              if (typeof cloudSettings.dailyNewLimit === 'number') {
                setDailyNewLimit(cloudSettings.dailyNewLimit);
                saveDailyNewCardLimit(user.uid, cloudSettings.dailyNewLimit);
              }
              if (typeof cloudSettings.randomizeNewCards === 'boolean') {
                setRandomizeNewCards(cloudSettings.randomizeNewCards);
                saveRandomizeNewCards(user.uid, cloudSettings.randomizeNewCards);
              }
              if (typeof cloudSettings.isSidebarCollapsed === 'boolean') {
                setIsSidebarCollapsed(cloudSettings.isSidebarCollapsed);
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(cloudSettings.isSidebarCollapsed));
              }
            } else {
              // New cloud user: seed cloud with current user settings
              await saveUserSettingsFirestore(user.uid, {
                frontLanguage,
                backLanguage,
                autoPlayOnDisplay,
                autoPlayOnFlip,
                isSidesSwapped,
                targetRetention,
                dailyNewLimit,
                randomizeNewCards,
                isSidebarCollapsed,
              });
            }
          }
        } catch (err) {
          console.error('Failed to sync user data from Firestore on login:', err);
        } finally {
          if (isMounted) {
            isCloudLoadedRef.current = true;
          }
        }
      } else {
        // Sign-out: reset lock and load guest profile
        isCloudLoadedRef.current = false;
        if (isMounted) {
          setCards(loadUserCards(activeUserId));
          setActivityLog(loadActivityLog(activeUserId));
          setDailyNewLimit(getDailyNewCardLimit(activeUserId));
          setRandomizeNewCards(getRandomizeNewCards(activeUserId));
          setSessionStats({
            totalReviewed: 0,
            againCount: 0,
            hardCount: 0,
            goodCount: 0,
            easyCount: 0,
            sessionStartTime: Date.now(),
          });
          setIsFlipped(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeUserId]);

  const handleSelectUser = (userId: string) => {
    if (userId === activeUserId) return;
    saveUserCards(activeUserId, cards);
    saveActiveUserId(userId);
    setUserState((prev) => ({ ...prev, activeUserId: userId }));
    const loadedCards = loadUserCards(userId);
    setCards(loadedCards);
    setActivityLog(loadActivityLog(userId));
    setDailyNewLimit(getDailyNewCardLimit(userId));
    setRandomizeNewCards(getRandomizeNewCards(userId));
    setNewCardsIntroducedToday(getNewCardsIntroducedToday(userId));
    setOverrideNewCardsToday(getTodayNewCardsOverride(userId));
    setIsFlipped(false);
    setSessionStats({
      totalReviewed: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      sessionStartTime: Date.now(),
    });
  };

  const handleCreateUser = (name: string) => {
    saveUserCards(activeUserId, cards);
    const newProfile = createUserProfile(name, profiles);
    const updatedProfiles = [...profiles, newProfile];
    setUserState({
      profiles: updatedProfiles,
      activeUserId: newProfile.id,
    });
    setCards(STARTER_DECK.map(lowercaseCard));
    setActivityLog(loadActivityLog(newProfile.id));
    setDailyNewLimit(getDailyNewCardLimit(newProfile.id));
    setRandomizeNewCards(getRandomizeNewCards(newProfile.id));
    setNewCardsIntroducedToday(getNewCardsIntroducedToday(newProfile.id));
    setOverrideNewCardsToday(getTodayNewCardsOverride(newProfile.id));
    setIsFlipped(false);
    setSessionStats({
      totalReviewed: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      sessionStartTime: Date.now(),
    });
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    const { updatedProfiles, nextActiveId } = deleteUserProfile(userIdToDelete, profiles);
    setUserState({
      profiles: updatedProfiles,
      activeUserId: nextActiveId,
    });
    if (userIdToDelete === activeUserId) {
      setCards(loadUserCards(nextActiveId));
      setActivityLog(loadActivityLog(nextActiveId));
      setDailyNewLimit(getDailyNewCardLimit(nextActiveId));
      setRandomizeNewCards(getRandomizeNewCards(nextActiveId));
      setNewCardsIntroducedToday(getNewCardsIntroducedToday(nextActiveId));
      setOverrideNewCardsToday(getTodayNewCardsOverride(nextActiveId));
      setIsFlipped(false);
      setSessionStats({
        totalReviewed: 0,
        againCount: 0,
        hardCount: 0,
        goodCount: 0,
        easyCount: 0,
        sessionStartTime: Date.now(),
      });
    }
  };

  const handleRenameUser = (userId: string, newName: string) => {
    const updatedProfiles = renameUserProfile(userId, newName, profiles);
    setUserState((prev) => ({
      ...prev,
      profiles: updatedProfiles,
    }));
  };

  const toggleAutoPlayOnDisplay = () => {
    setAutoPlayOnDisplay((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTOPLAY_DISPLAY_KEY, String(next));
      }
      persistSetting('autoPlayOnDisplay', next);
      return next;
    });
  };

  const toggleAutoPlayOnFlip = () => {
    setAutoPlayOnFlip((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTOPLAY_FLIP_KEY, String(next));
      }
      persistSetting('autoPlayOnFlip', next);
      return next;
    });
  };

  const handleToggleSwitchSides = () => {
    setIsSidesSwapped((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDES_SWAPPED_KEY, String(next));
      }
      persistSetting('isSidesSwapped', next);
      return next;
    });
    setIsFlipped(false);
  };

  // Card queues calculation
  const now = Date.now();

  const newCardsResult = useMemo(
    () =>
      getAvailableNewCards(
        cards,
        dailyNewLimit,
        newCardsIntroducedToday,
        overrideNewCardsToday,
        randomizeNewCards,
        sessionSalt
      ),
    [cards, dailyNewLimit, newCardsIntroducedToday, overrideNewCardsToday, randomizeNewCards, sessionSalt]
  );

  const newCards = newCardsResult.queueNewCards;
  const unintroducedNewCardsCount = newCardsResult.unintroducedCount;
  const allNewCardsCount = newCardsResult.allNewCardsCount;

  const reviewAheadSet = useMemo(() => new Set(reviewAheadCardIds), [reviewAheadCardIds]);

  const learningCards = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            (c.state === 'learning' || c.state === 'relearning') &&
            (c.due <= now || reviewAheadSet.has(c.id))
        )
        .sort((a, b) => a.due - b.due),
    [cards, now, reviewAheadSet]
  );
  const reviewCards = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            c.state === 'review' &&
            (c.due <= now || reviewAheadSet.has(c.id))
        )
        .sort((a, b) => a.due - b.due),
    [cards, now, reviewAheadSet]
  );
  const dueCount = useMemo(
    () =>
      cards.filter(
        (c) => c.state !== 'new' && c.due <= now
      ).length,
    [cards, now]
  );

  const cardsDueAheadCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          (c.state === 'review' || c.state === 'learning' || c.state === 'relearning') &&
          c.due > now &&
          c.due <= now + ONE_DAY_MS &&
          !reviewAheadSet.has(c.id)
      ).length,
    [cards, now, ONE_DAY_MS, reviewAheadSet]
  );

  // One-time addition of cards scheduled within the next 24 hours to the daily queue (Anki-style)
  const handleTriggerReviewAhead = useCallback(() => {
    const candidateIds = cards
      .filter(
        (c) =>
          (c.state === 'review' || c.state === 'learning' || c.state === 'relearning') &&
          c.due > now &&
          c.due <= now + ONE_DAY_MS &&
          !reviewAheadSet.has(c.id)
      )
      .map((c) => c.id);

    if (candidateIds.length > 0) {
      setReviewAheadCardIds((prev) => Array.from(new Set([...prev, ...candidateIds])));
      setIsFlipped(false);
    }
  }, [cards, now, ONE_DAY_MS, reviewAheadSet]);

  const currentCard = useMemo(() => {
    if (learningCards.length > 0) return learningCards[0];
    if (reviewCards.length > 0) return reviewCards[0];
    if (newCards.length > 0) return newCards[0];
    return null;
  }, [learningCards, reviewCards, newCards]);

  // Handle rating a card with FSRS
  const handleRateCard = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;
      const activeCard = currentCard;

      if (rating === 4) setMascotMood('cheering');
      else if (rating === 3) setMascotMood('wink');
      else if (rating === 1) setMascotMood('thinking');
      else setMascotMood('happy');

      const updatedProps = calculateNextFSRSState(activeCard, rating, Date.now(), targetRetention);
      const updatedCard: Flashcard = { ...activeCard, ...updatedProps };

      // Record new card introduction if card was brand new
      if (activeCard.state === 'new') {
        const nextCount = recordNewCardIntroducedToday(effectiveUserId, 1);
        setNewCardsIntroducedToday(nextCount);
      }

      setCards((prevCards) => {
        let nextCards: Flashcard[];
        if (rating === 1) {
          nextCards = [...prevCards.filter((c) => c.id !== activeCard.id), updatedCard];
        } else {
          nextCards = prevCards.map((c) => (c.id === activeCard.id ? updatedCard : c));
        }
        return nextCards;
      });

      // If card was part of the one-time review-ahead batch, remove it so queue shrinks and completes
      if (reviewAheadSet.has(activeCard.id)) {
        setReviewAheadCardIds((prev) => prev.filter((id) => id !== activeCard.id));
      }

      setSessionStats((prev) => ({
        ...prev,
        totalReviewed: prev.totalReviewed + 1,
        againCount: rating === 1 ? prev.againCount + 1 : prev.againCount,
        hardCount: rating === 2 ? prev.hardCount + 1 : prev.hardCount,
        goodCount: rating === 3 ? prev.goodCount + 1 : prev.goodCount,
        easyCount: rating === 4 ? prev.easyCount + 1 : prev.easyCount,
      }));

      if (currentUser) {
        setActivityLog((prevLog) => {
          const today = formatDateKey(new Date());
          const nextLog: ActivityLog = {
            ...prevLog,
            [today]: (prevLog[today] || 0) + 1,
          };
          recordReviewActivityFirestore(currentUser.uid, prevLog, 1);
          return nextLog;
        });
      } else {
        const nextLog = recordReviewActivity(activeUserId, 1);
        setActivityLog(nextLog);
      }

      setIsFlipped(false);
    },
    [currentCard, currentUser, activeUserId, targetRetention]
  );

  // -------------------------------------------------------------
  // Card Mutations with Explicit Firestore Persistence Guarantees
  // -------------------------------------------------------------

  // 1. Single Card Addition
  const handleAddSingleCard = (newCard: Flashcard) => {
    const cardFormatted = lowercaseCard(newCard);
    setCards((prev) => {
      const nextDeck = [cardFormatted, ...prev];
      persistCards(nextDeck);
      return nextDeck;
    });
  };

  // 2. Batch Cards Addition (Direct CSV clean import)
  const handleAddCards = (newCardsToAdd: Flashcard[]) => {
    if (newCardsToAdd.length === 0) return;
    const formatted = newCardsToAdd.map(lowercaseCard);
    setCards((prev) => {
      const nextDeck = [...prev, ...formatted];
      persistCards(nextDeck);
      return nextDeck;
    });
    setIsFlipped(false);
  };

  // 3. Deduplication Import (New + Overwritten cards)
  const handleApplyImport = (cardsToAdd: Flashcard[], cardsToUpdate: Flashcard[]) => {
    setCards((prev) => {
      const updateMap = new Map(cardsToUpdate.map((c) => [c.id, lowercaseCard(c)]));
      const updatedExisting = prev.map((c) => updateMap.get(c.id) || c);
      const nextDeck = [...updatedExisting, ...cardsToAdd.map(lowercaseCard)];
      persistCards(nextDeck);
      return nextDeck;
    });
    setIsFlipped(false);
  };

  // 4. Update Existing Card
  const handleUpdateCard = (updatedCard: Flashcard) => {
    const cardFormatted = lowercaseCard(updatedCard);
    setCards((prev) => {
      const nextDeck = prev.map((c) => (c.id === cardFormatted.id ? cardFormatted : c));
      persistCards(nextDeck);
      return nextDeck;
    });
  };

  // 5. Delete Card (Fixed: Guarantees removal reflects in Firestore immediately)
  const handleDeleteCard = (id: string) => {
    setCards((prev) => {
      const nextDeck = prev.filter((c) => c.id !== id);
      persistCards(nextDeck);
      return nextDeck;
    });
    setReviewAheadCardIds((prev) => prev.filter((cid) => cid !== id));
    setIsFlipped(false);
  };

  // 6. Reset Deck
  const handleResetToDefault = () => {
    const defaultDeck = STARTER_DECK.map(lowercaseCard);
    setCards(defaultDeck);
    persistCards(defaultDeck);
    clearTodayNewCards(effectiveUserId);
    setNewCardsIntroducedToday(0);
    setOverrideNewCardsToday(0);
    setSessionSalt(Math.random().toString(36).substring(2, 9));
    setReviewAheadCardIds([]);
    setIsFlipped(false);
    setSessionStats({
      totalReviewed: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      sessionStartTime: Date.now(),
    });
  };

  const handleResetSession = () => {
    setSessionSalt(Math.random().toString(36).substring(2, 9));
    setReviewAheadCardIds([]);
    setSessionStats({
      totalReviewed: 0,
      againCount: 0,
      hardCount: 0,
      goodCount: 0,
      easyCount: 0,
      sessionStartTime: Date.now(),
    });
  };

  const todayKey = formatDateKey(new Date());
  const todayReviewedCount = activityLog[todayKey] || 0;

  return (
    <div
      id="app-root-layout"
      className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900"
    >
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center p-0.5">
            <BleuoMascot mood={mascotMood} size="sm" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-slate-900 text-base">Bleuolingo</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
              <span className="text-slate-700 font-bold">
                {currentUser?.displayName || profiles.find((p) => p.id === activeUserId)?.name || 'Guest'}
              </span>
              <span>•</span>
              <span>
                {dueCount > 0
                  ? `${dueCount} cards due`
                  : newCards.length > 0
                  ? `${newCards.length} new cards`
                  : '0 cards due'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="mobile-free-study-toggle-btn"
            onClick={() => {
              const next = !isFreeStudyMode;
              setIsFreeStudyMode(next);
              if (next && activeTab !== 'practice') setActiveTab('practice');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              isFreeStudyMode
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Free Study</span>
            <span>{isFreeStudyMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
        <AppSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          dueCount={dueCount}
          newCount={newCards.length}
          totalCards={cards.length}
          reviewedCount={todayReviewedCount}
          activityLog={activityLog}
          mascotMood={mascotMood}
          profiles={profiles}
          activeUserId={activeUserId}
          onSelectUser={handleSelectUser}
          onCreateUser={handleCreateUser}
          onDeleteUser={handleDeleteUser}
          onRenameUser={handleRenameUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          currentUser={currentUser}
          onLogin={loginWithGoogle}
          onLogout={logout}
          isFreeStudyMode={isFreeStudyMode}
          onToggleFreeStudy={setIsFreeStudyMode}
        />
      </div>

      {/* Main App Workspace Area */}
      <main
        id="main-app-content"
        className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-[radial-gradient(ellipse_70%_70%_at_50%_0%,rgba(224,242,254,0.35),rgba(255,255,255,0))]"
      >
        {/* Practice / Flashcard View */}
        {activeTab === 'practice' && (
          <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto px-4 py-4 sm:py-6">
            {isFreeStudyMode ? (
              <FreeStudyView
                cards={cards}
                isSidesSwapped={isSidesSwapped}
                onToggleSwitchSides={handleToggleSwitchSides}
                onExitFreeStudy={() => setIsFreeStudyMode(false)}
                frontLanguage={frontLanguage}
                backLanguage={backLanguage}
                autoPlayOnDisplay={autoPlayOnDisplay}
                autoPlayOnFlip={autoPlayOnFlip}
                onUpdateCard={handleUpdateCard}
              />
            ) : (
              <>
                <div className="w-full flex items-center justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <SessionProgress
                      reviewedThisSession={sessionStats.totalReviewed}
                      newCount={newCards.length}
                      learningCount={learningCards.length}
                      reviewCount={reviewCards.length}
                      totalDeckSize={cards.length}
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="study-reverse-sides-btn"
                      onClick={handleToggleSwitchSides}
                      title={isSidesSwapped ? 'Reverse Mode: Active' : 'Reverse Mode: Inactive'}
                      className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSidesSwapped
                          ? 'bg-blue-500 border-blue-600 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                      }`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Reverse</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-start mt-1 sm:mt-2">
                  {currentCard ? (
                    <FlashcardView
                      card={currentCard}
                      isFlipped={isFlipped}
                      onFlip={() => setIsFlipped(true)}
                      onRate={handleRateCard}
                      autoPlayOnDisplay={autoPlayOnDisplay}
                      autoPlayOnFlip={autoPlayOnFlip}
                      isSidesSwapped={isSidesSwapped}
                      frontLanguage={frontLanguage}
                      backLanguage={backLanguage}
                      targetRetention={targetRetention}
                      onDeleteCard={handleDeleteCard}
                      onUpdateCard={handleUpdateCard}
                    />
                  ) : (
                    <SessionComplete
                      stats={sessionStats}
                      onReviewAhead={handleTriggerReviewAhead}
                      cardsDueAheadCount={cardsDueAheadCount}
                      onAddTodayOverride={handleAddTodayOverride}
                      unintroducedNewCardsCount={unintroducedNewCardsCount}
                      newCardsIntroducedToday={newCardsIntroducedToday}
                      dailyNewLimit={dailyNewLimit}
                      onStartFreeStudy={() => setIsFreeStudyMode(true)}
                      onRestartSession={handleResetSession}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Unified Deck & Import View */}
        {activeTab === 'deck' && (
          <DeckManagerView
            cards={cards}
            frontLanguage={frontLanguage}
            backLanguage={backLanguage}
            onSelectFrontLanguage={handleSelectFrontLanguage}
            onSelectBackLanguage={handleSelectBackLanguage}
            onAddCard={handleAddSingleCard}
            onAddCards={handleAddCards}
            onApplyImport={handleApplyImport}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
          />
        )}

        {/* Dedicated Study Activity & Stats View */}
        {activeTab === 'stats' && (
          <StatsView
            activityLog={activityLog}
            cards={cards}
            sessionStats={sessionStats}
            todayReviewedCount={todayReviewedCount}
            dueCount={dueCount}
          />
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <SettingsView
            activeProfile={profiles.find((p) => p.id === activeUserId)}
            totalCards={cards.length}
            activityLog={activityLog}
            autoPlayOnDisplay={autoPlayOnDisplay}
            onToggleAutoPlayOnDisplay={toggleAutoPlayOnDisplay}
            autoPlayOnFlip={autoPlayOnFlip}
            onToggleAutoPlayOnFlip={toggleAutoPlayOnFlip}
            targetRetention={targetRetention}
            onUpdateTargetRetention={handleUpdateTargetRetention}
            dailyNewLimit={dailyNewLimit}
            onUpdateDailyNewLimit={handleUpdateDailyNewLimit}
            randomizeNewCards={randomizeNewCards}
            onToggleRandomizeNewCards={handleToggleRandomizeNewCards}
            onResetToDefault={handleResetToDefault}
            isCloudSynced={!!currentUser}
          />
        )}
      </main>
    </div>
  );
}