import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Flashcard, ReviewRating, SessionStats, UserProfile } from './types';
import { STARTER_DECK } from './data/starterDeck';
import { calculateNextFSRSState } from './lib/fsrs';
import { AppSidebar, NavigationTab } from './components/AppSidebar';
import { SessionProgress } from './components/SessionProgress';
import { FlashcardView } from './components/FlashcardView';
import { SessionComplete } from './components/SessionComplete';
import { DeckManagerView } from './components/DeckManagerView';
import { SettingsView } from './components/SettingsView';
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
import { Sparkles, ArrowLeftRight, Menu, X } from 'lucide-react';
import {
  fetchUserCardsFirestore,
  saveUserCardsFirestore,
  fetchUserActivityFirestore,
  recordReviewActivityFirestore,
} from './lib/firestoreStorage';

const AUTOPLAY_DISPLAY_KEY = 'bleuolingo_autoplay_display_v1';
const AUTOPLAY_FLIP_KEY = 'bleuolingo_autoplay_flip_v1';
const SIDES_SWAPPED_KEY = 'bleuolingo_sides_swapped_v1';
const SIDEBAR_COLLAPSED_KEY = 'bleuolingo_sidebar_collapsed_v1';
const FRONT_LANG_KEY = 'bleuolingo_front_lang_v1';
const BACK_LANG_KEY = 'bleuolingo_back_lang_v1';

export default function App() {
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
  };

  const handleSelectBackLanguage = (lang: string) => {
    setBackLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(BACK_LANG_KEY, lang);
    }
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

  const [practiceAhead, setPracticeAhead] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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

  // Switch learner profile (guest mode)
  const handleSelectUser = (userId: string) => {
    if (userId === activeUserId) return;
    saveUserCards(activeUserId, cards);
    saveActiveUserId(userId);
    setUserState((prev) => ({ ...prev, activeUserId: userId }));
    const loadedCards = loadUserCards(userId);
    setCards(loadedCards);
    setActivityLog(loadActivityLog(userId));
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
      return next;
    });
  };

  const toggleAutoPlayOnFlip = () => {
    setAutoPlayOnFlip((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTOPLAY_FLIP_KEY, String(next));
      }
      return next;
    });
  };

  const handleToggleSwitchSides = () => {
    setIsSidesSwapped((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDES_SWAPPED_KEY, String(next));
      }
      return next;
    });
    setIsFlipped(false);
  };

  // Card queues calculation
  const now = Date.now();

  const newCards = useMemo(() => cards.filter((c) => c.state === 'new'), [cards]);
  const learningCards = useMemo(
    () =>
      cards
        .filter((c) => c.state === 'learning' && (practiceAhead || c.due <= now))
        .sort((a, b) => a.due - b.due),
    [cards, now, practiceAhead]
  );
  const reviewCards = useMemo(
    () =>
      cards
        .filter((c) => c.state === 'review' && (practiceAhead || c.due <= now))
        .sort((a, b) => a.due - b.due),
    [cards, now, practiceAhead]
  );
  const dueCount = useMemo(() => cards.filter((c) => c.due <= now).length, [cards, now]);

  const currentCard = useMemo(() => {
    if (learningCards.length > 0) return learningCards[0];
    if (reviewCards.length > 0) return reviewCards[0];
    if (newCards.length > 0) return newCards[0];
    if (practiceAhead && cards.length > 0) {
      return [...cards].sort((a, b) => a.stability - b.stability)[0];
    }
    return null;
  }, [learningCards, reviewCards, newCards, practiceAhead, cards]);

  // Handle rating a card with FSRS
  const handleRateCard = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;
      const activeCard = currentCard;

      if (rating === 4) setMascotMood('cheering');
      else if (rating === 3) setMascotMood('wink');
      else if (rating === 1) setMascotMood('thinking');
      else setMascotMood('happy');

      const updatedProps = calculateNextFSRSState(activeCard, rating, Date.now());
      const updatedCard: Flashcard = { ...activeCard, ...updatedProps };

      setCards((prevCards) => {
        let nextCards: Flashcard[];
        if (rating === 1) {
          nextCards = [...prevCards.filter((c) => c.id !== activeCard.id), updatedCard];
        } else {
          nextCards = prevCards.map((c) => (c.id === activeCard.id ? updatedCard : c));
        }
        return nextCards;
      });

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
    [currentCard, currentUser, activeUserId]
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
    setIsFlipped(false);
  };

  // 6. Reset Deck
  const handleResetToDefault = () => {
    const defaultDeck = STARTER_DECK.map(lowercaseCard);
    setCards(defaultDeck);
    persistCards(defaultDeck);
    setPracticeAhead(false);
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

  const handleResetAllDue = () => {
    const timestamp = Date.now();
    setCards((prev) => {
      const nextDeck = prev.map((c) => ({ ...c, due: timestamp }));
      persistCards(nextDeck);
      return nextDeck;
    });
    setPracticeAhead(false);
    setIsFlipped(false);
  };

  const handleResetSession = () => {
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
                {currentUser?.displayName || profiles.find((p) => p.id === activeUserId)?.name || 'Learner'}
              </span>
              <span>•</span>
              <span>{dueCount} cards due</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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

                {!currentCard && (
                  <button
                    type="button"
                    onClick={() => {
                      handleResetAllDue();
                      setPracticeAhead(true);
                    }}
                    className="h-9 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Practice Ahead</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-start mt-1 sm:mt-2">
              {currentCard ? (
                <FlashcardView
                  key={currentCard.id}
                  card={currentCard}
                  isFlipped={isFlipped}
                  onFlip={() => setIsFlipped(true)}
                  onRate={handleRateCard}
                  autoPlayOnDisplay={autoPlayOnDisplay}
                  autoPlayOnFlip={autoPlayOnFlip}
                  isSidesSwapped={isSidesSwapped}
                  frontLanguage={frontLanguage}
                  backLanguage={backLanguage}
                  onDeleteCard={handleDeleteCard}
                  onUpdateCard={handleUpdateCard}
                />
              ) : (
                <SessionComplete
                  stats={sessionStats}
                  onPracticeAll={() => {
                    handleResetAllDue();
                    setPracticeAhead(true);
                  }}
                  onOpenUpload={() => setActiveTab('deck')}
                  onRestartSession={handleResetSession}
                />
              )}
            </div>
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
            onResetAllDue={handleResetAllDue}
            onResetToDefault={handleResetToDefault}
          />
        )}
      </main>
    </div>
  );
}