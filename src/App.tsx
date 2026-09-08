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
import { ArrowLeftRight, BookOpen, Menu, X, Loader2 } from 'lucide-react';
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

const STORAGE_KEYS = {
  AUTOPLAY_DISPLAY: 'bleuolingo_autoplay_display_v1',
  AUTOPLAY_FLIP: 'bleuolingo_autoplay_flip_v1',
  SIDES_SWAPPED: 'bleuolingo_sides_swapped_v1',
  SIDEBAR_COLLAPSED: 'bleuolingo_sidebar_collapsed_v1',
  FRONT_LANG: 'bleuolingo_front_lang_v1',
  BACK_LANG: 'bleuolingo_back_lang_v1',
  TARGET_RETENTION: 'bleuolingo_target_retention_v1',
} as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const createInitialSessionStats = (): SessionStats => ({
  totalReviewed: 0,
  againCount: 0,
  hardCount: 0,
  goodCount: 0,
  easyCount: 0,
  sessionStartTime: Date.now(),
});

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Per-user profiles state
  const [userState, setUserState] = useState<{ profiles: UserProfile[]; activeUserId: string }>(
    () => getInitialProfiles()
  );
  const { profiles, activeUserId } = userState;
  const effectiveUserId = currentUser ? currentUser.uid : activeUserId;

  // Deck & Activity
  const [cards, setCards] = useState<Flashcard[]>(() => loadUserCards(userState.activeUserId));
  const [activityLog, setActivityLog] = useState<ActivityLog>(() =>
    loadActivityLog(userState.activeUserId)
  );

  // Active Review State
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mascotMood, setMascotMood] = useState<'happy' | 'thinking' | 'cheering' | 'wink'>('happy');
  const [sessionSalt, setSessionSalt] = useState<string>(() => Math.random().toString(36).substring(2, 9));
  const [reviewAheadCardIds, setReviewAheadCardIds] = useState<string[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>(createInitialSessionStats);

  // Navigation & Modes
  const [activeTab, setActiveTab] = useState<NavigationTab>('practice');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFreeStudyMode, setIsFreeStudyMode] = useState(false);

  // User Settings
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true' : false;
  });
  const [frontLanguage, setFrontLanguage] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.FRONT_LANG)) || 'fr';
  });
  const [backLanguage, setBackLanguage] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.BACK_LANG)) || 'en';
  });
  const [autoPlayOnDisplay, setAutoPlayOnDisplay] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEYS.AUTOPLAY_DISPLAY);
    return saved !== null ? saved === 'true' : true;
  });
  const [autoPlayOnFlip, setAutoPlayOnFlip] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(STORAGE_KEYS.AUTOPLAY_FLIP);
    return saved !== null ? saved === 'true' : true;
  });
  const [isSidesSwapped, setIsSidesSwapped] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SIDES_SWAPPED) === 'true' : false;
  });
  const [targetRetention, setTargetRetention] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.TARGET_RETENTION);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.7 && val <= 0.98) return val;
      }
    }
    return 0.9;
  });
  const [dailyNewLimit, setDailyNewLimit] = useState<number>(() => getDailyNewCardLimit(activeUserId));
  const [randomizeNewCards, setRandomizeNewCards] = useState<boolean>(() => getRandomizeNewCards(activeUserId));
  const [newCardsIntroducedToday, setNewCardsIntroducedToday] = useState<number>(() => getNewCardsIntroducedToday(activeUserId));
  const [overrideNewCardsToday, setOverrideNewCardsToday] = useState<number>(() => getTodayNewCardsOverride(activeUserId));

  // Firestore Save Guard
  const isCloudLoadedRef = useRef<boolean>(false);

  const persistSetting = useCallback(
    <K extends keyof UserSettingsFirestore>(key: K, value: UserSettingsFirestore[K]) => {
      if (currentUser) {
        saveUserSettingsFirestore(currentUser.uid, { [key]: value });
      }
    },
    [currentUser]
  );

  // Single-source Auto-save for Cards
  useEffect(() => {
    if (currentUser) {
      if (isCloudLoadedRef.current) {
        saveUserCardsFirestore(currentUser.uid, cards);
      }
    } else {
      saveUserCards(activeUserId, cards);
    }
  }, [cards, activeUserId, currentUser]);

  const resetActiveStudyState = useCallback(() => {
    setIsFlipped(false);
    setActiveCardId(null);
    setSessionStats(createInitialSessionStats());
  }, []);

  // Settings Sync on Effective User Switch
  useEffect(() => {
    setDailyNewLimit(getDailyNewCardLimit(effectiveUserId));
    setRandomizeNewCards(getRandomizeNewCards(effectiveUserId));
    setNewCardsIntroducedToday(getNewCardsIntroducedToday(effectiveUserId));
    setOverrideNewCardsToday(getTodayNewCardsOverride(effectiveUserId));
  }, [effectiveUserId]);

  // Auth Subscription with Load Guard
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user);

      if (user) {
        isCloudLoadedRef.current = false;
        try {
          const cloudActivity = await fetchUserActivityFirestore(user.uid);
          if (isMounted) setActivityLog(cloudActivity);

          const cloudCards = await fetchUserCardsFirestore(user.uid);
          if (!isMounted) return;

          if (cloudCards && cloudCards.length > 0) {
            setCards(cloudCards);
          } else {
            const initialDeck = cards.length > 0 ? cards : STARTER_DECK.map(lowercaseCard);
            await saveUserCardsFirestore(user.uid, initialDeck);
            setCards(initialDeck);
          }

          const cloudSettings = await fetchUserSettingsFirestore(user.uid);
          if (isMounted && cloudSettings && Object.keys(cloudSettings).length > 0) {
            if (cloudSettings.frontLanguage) setFrontLanguage(cloudSettings.frontLanguage);
            if (cloudSettings.backLanguage) setBackLanguage(cloudSettings.backLanguage);
            if (typeof cloudSettings.autoPlayOnDisplay === 'boolean') setAutoPlayOnDisplay(cloudSettings.autoPlayOnDisplay);
            if (typeof cloudSettings.autoPlayOnFlip === 'boolean') setAutoPlayOnFlip(cloudSettings.autoPlayOnFlip);
            if (typeof cloudSettings.isSidesSwapped === 'boolean') setIsSidesSwapped(cloudSettings.isSidesSwapped);
            if (typeof cloudSettings.targetRetention === 'number') setTargetRetention(cloudSettings.targetRetention);
            if (typeof cloudSettings.dailyNewLimit === 'number') setDailyNewLimit(cloudSettings.dailyNewLimit);
            if (typeof cloudSettings.randomizeNewCards === 'boolean') setRandomizeNewCards(cloudSettings.randomizeNewCards);
            if (typeof cloudSettings.isSidebarCollapsed === 'boolean') setIsSidebarCollapsed(cloudSettings.isSidebarCollapsed);
          }
        } catch (err) {
          console.error('Failed to sync user data from Firestore on login:', err);
        } finally {
          if (isMounted) {
            isCloudLoadedRef.current = true;
            setIsAuthLoading(false);
          }
        }
      } else {
        isCloudLoadedRef.current = false;
        if (isMounted) {
          setCards(loadUserCards(activeUserId));
          setActivityLog(loadActivityLog(activeUserId));
          resetActiveStudyState();
          setIsAuthLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeUserId, resetActiveStudyState]);

  // Queue Calculations
  const reviewAheadSet = useMemo(() => new Set(reviewAheadCardIds), [reviewAheadCardIds]);

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

  const queueReferenceTime = sessionStats.sessionStartTime || Date.now();

  const learningCards = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            (c.state === 'learning' || c.state === 'relearning') &&
            (c.due <= queueReferenceTime || reviewAheadSet.has(c.id))
        )
        .sort((a, b) => a.due - b.due),
    [cards, queueReferenceTime, reviewAheadSet]
  );

  const reviewCards = useMemo(
    () =>
      cards
        .filter(
          (c) =>
            c.state === 'review' &&
            (c.due <= queueReferenceTime || reviewAheadSet.has(c.id))
        )
        .sort((a, b) => a.due - b.due),
    [cards, queueReferenceTime, reviewAheadSet]
  );

  // Total items scheduled to be studied today
  const totalToStudy = learningCards.length + reviewCards.length + newCards.length;

  const cardsDueAheadCount = useMemo(
    () =>
      cards.filter(
        (c) =>
          (c.state === 'review' || c.state === 'learning' || c.state === 'relearning') &&
          c.due > queueReferenceTime &&
          c.due <= queueReferenceTime + ONE_DAY_MS &&
          !reviewAheadSet.has(c.id)
      ).length,
    [cards, queueReferenceTime, reviewAheadSet]
  );

  const nextCandidateCard = useMemo(() => {
    if (learningCards.length > 0) return learningCards[0];
    if (reviewCards.length > 0) return reviewCards[0];
    if (newCards.length > 0) return newCards[0];
    return null;
  }, [learningCards, reviewCards, newCards]);

  const currentCard = useMemo(() => {
    if (activeCardId) {
      const active = cards.find((c) => c.id === activeCardId);
      if (active) return active;
    }
    return nextCandidateCard;
  }, [activeCardId, cards, nextCandidateCard]);

  useEffect(() => {
    if (!activeCardId && nextCandidateCard) {
      setActiveCardId(nextCandidateCard.id);
    } else if (activeCardId && !cards.some((c) => c.id === activeCardId)) {
      setActiveCardId(nextCandidateCard ? nextCandidateCard.id : null);
    }
  }, [activeCardId, nextCandidateCard, cards]);

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

      if (activeCard.state === 'new') {
        const nextCount = recordNewCardIntroducedToday(effectiveUserId, 1);
        setNewCardsIntroducedToday(nextCount);
      }

      setCards((prevCards) => {
        if (rating === 1) {
          return [...prevCards.filter((c) => c.id !== activeCard.id), updatedCard];
        }
        return prevCards.map((c) => (c.id === activeCard.id ? updatedCard : c));
      });

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

      const today = formatDateKey(new Date());
      if (currentUser) {
        setActivityLog((prevLog) => {
          const nextLog: ActivityLog = {
            ...prevLog,
            [today]: (prevLog[today] || 0) + 1,
          };
          recordReviewActivityFirestore(currentUser.uid, nextLog, 1);
          return nextLog;
        });
      } else {
        const nextLog = recordReviewActivity(activeUserId, 1);
        setActivityLog(nextLog);
      }

      setIsFlipped(false);
      setActiveCardId(null);
    },
    [currentCard, currentUser, effectiveUserId, activeUserId, targetRetention, reviewAheadSet]
  );

  const handleTriggerReviewAhead = useCallback(() => {
    const candidateIds = cards
      .filter(
        (c) =>
          (c.state === 'review' || c.state === 'learning' || c.state === 'relearning') &&
          c.due > queueReferenceTime &&
          c.due <= queueReferenceTime + ONE_DAY_MS &&
          !reviewAheadSet.has(c.id)
      )
      .map((c) => c.id);

    if (candidateIds.length > 0) {
      setReviewAheadCardIds((prev) => Array.from(new Set([...prev, ...candidateIds])));
      setIsFlipped(false);
      setActiveCardId(null);
    }
  }, [cards, queueReferenceTime, reviewAheadSet]);

  const handleAddTodayOverride = (additionalCount: number) => {
    const nextCount = addTodayNewCardsOverride(effectiveUserId, additionalCount);
    setOverrideNewCardsToday(nextCount);
    resetActiveStudyState();
  };

  const handleAddSingleCard = (newCard: Flashcard) => {
    setCards((prev) => [lowercaseCard(newCard), ...prev]);
  };

  const handleAddCards = (newCardsToAdd: Flashcard[]) => {
    if (newCardsToAdd.length === 0) return;
    const formatted = newCardsToAdd.map(lowercaseCard);
    setCards((prev) => [...prev, ...formatted]);
    setIsFlipped(false);
    setActiveCardId(null);
  };

  const handleApplyImport = (cardsToAdd: Flashcard[], cardsToUpdate: Flashcard[]) => {
    setCards((prev) => {
      const updateMap = new Map(cardsToUpdate.map((c) => [c.id, lowercaseCard(c)]));
      const updatedExisting = prev.map((c) => updateMap.get(c.id) || c);
      return [...updatedExisting, ...cardsToAdd.map(lowercaseCard)];
    });
    setIsFlipped(false);
    setActiveCardId(null);
  };

  const handleUpdateCard = (updatedCard: Flashcard) => {
    const formatted = lowercaseCard(updatedCard);
    setCards((prev) => prev.map((c) => (c.id === formatted.id ? formatted : c)));
  };

  const handleDeleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setReviewAheadCardIds((prev) => prev.filter((cid) => cid !== id));
    if (activeCardId === id) {
      setActiveCardId(null);
      setIsFlipped(false);
    }
  };

  const handleResetToDefault = () => {
    const defaultDeck = STARTER_DECK.map(lowercaseCard);
    setCards(defaultDeck);
    clearTodayNewCards(effectiveUserId);
    setNewCardsIntroducedToday(0);
    setOverrideNewCardsToday(0);
    setSessionSalt(Math.random().toString(36).substring(2, 9));
    setReviewAheadCardIds([]);
    resetActiveStudyState();
  };

  const handleResetSession = () => {
    setSessionSalt(Math.random().toString(36).substring(2, 9));
    setReviewAheadCardIds([]);
    resetActiveStudyState();
  };

  const handleSelectUser = (userId: string) => {
    if (userId === activeUserId) return;
    saveActiveUserId(userId);
    setUserState((prev) => ({ ...prev, activeUserId: userId }));
    setCards(loadUserCards(userId));
    setActivityLog(loadActivityLog(userId));
    resetActiveStudyState();
  };

  const handleCreateUser = (name: string) => {
    const newProfile = createUserProfile(name, profiles);
    setUserState({
      profiles: [...profiles, newProfile],
      activeUserId: newProfile.id,
    });
    setCards(STARTER_DECK.map(lowercaseCard));
    setActivityLog(loadActivityLog(newProfile.id));
    resetActiveStudyState();
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    const { updatedProfiles, nextActiveId } = deleteUserProfile(userIdToDelete, profiles);
    setUserState({ profiles: updatedProfiles, activeUserId: nextActiveId });
    if (userIdToDelete === activeUserId) {
      setCards(loadUserCards(nextActiveId));
      setActivityLog(loadActivityLog(nextActiveId));
      resetActiveStudyState();
    }
  };

  const handleRenameUser = (userId: string, newName: string) => {
    setUserState((prev) => ({
      ...prev,
      profiles: renameUserProfile(userId, newName, prev.profiles),
    }));
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      persistSetting('isSidebarCollapsed', next);
      return next;
    });
  };

  const handleSelectFrontLanguage = (lang: string) => {
    setFrontLanguage(lang);
    localStorage.setItem(STORAGE_KEYS.FRONT_LANG, lang);
    persistSetting('frontLanguage', lang);
  };

  const handleSelectBackLanguage = (lang: string) => {
    setBackLanguage(lang);
    localStorage.setItem(STORAGE_KEYS.BACK_LANG, lang);
    persistSetting('backLanguage', lang);
  };

  const toggleAutoPlayOnDisplay = () => {
    setAutoPlayOnDisplay((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.AUTOPLAY_DISPLAY, String(next));
      persistSetting('autoPlayOnDisplay', next);
      return next;
    });
  };

  const toggleAutoPlayOnFlip = () => {
    setAutoPlayOnFlip((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.AUTOPLAY_FLIP, String(next));
      persistSetting('autoPlayOnFlip', next);
      return next;
    });
  };

  const handleToggleSwitchSides = () => {
    setIsSidesSwapped((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.SIDES_SWAPPED, String(next));
      persistSetting('isSidesSwapped', next);
      return next;
    });
    setIsFlipped(false);
  };

  const handleUpdateTargetRetention = (retention: number) => {
    setTargetRetention(retention);
    localStorage.setItem(STORAGE_KEYS.TARGET_RETENTION, String(retention));
    persistSetting('targetRetention', retention);
  };

  const handleUpdateDailyNewLimit = (limit: number) => {
    setDailyNewLimit(limit);
    saveDailyNewCardLimit(effectiveUserId, limit);
    persistSetting('dailyNewLimit', limit);
    setIsFlipped(false);
    setActiveCardId(null);
  };

  const handleToggleRandomizeNewCards = (randomize: boolean) => {
    setRandomizeNewCards(randomize);
    saveRandomizeNewCards(effectiveUserId, randomize);
    persistSetting('randomizeNewCards', randomize);
  };

  const todayKey = formatDateKey(new Date());
  const todayReviewedCount = activityLog[todayKey] || 0;

  return (
    <div
      id="app-root-layout"
      className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900"
    >
      {/* Clean Mobile Top Header: Mascot & Logo + Controls only */}
      <header className="md:hidden flex items-center justify-between p-3.5 bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center p-0.5">
            <BleuoMascot mood={mascotMood} size="sm" />
          </div>
          <span className="font-black text-slate-900 text-base tracking-tight">Bleuolingo</span>
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
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${isFreeStudyMode
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
            aria-label="Open menu"
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
          dueCount={isAuthLoading ? 0 : totalToStudy}
          newCount={isAuthLoading ? 0 : newCards.length}
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

      {/* Main Workspace Area */}
      <main
        id="main-app-content"
        className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-[radial-gradient(ellipse_70%_70%_at_50%_0%,rgba(224,242,254,0.35),rgba(255,255,255,0))]"
      >
        {isAuthLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Loading your deck...
            </span>
          </div>
        ) : (
          <>
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
                          className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isSidesSwapped
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

            {activeTab === 'stats' && (
              <StatsView
                activityLog={activityLog}
                cards={cards}
                sessionStats={sessionStats}
                todayReviewedCount={todayReviewedCount}
                dueCount={reviewCards.length}
              />
            )}

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
          </>
        )}
      </main>
    </div>
  );
}