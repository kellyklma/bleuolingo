import { useState, useEffect, useMemo, useCallback } from 'react';
import { Flashcard, ReviewRating, SessionStats, UserProfile } from './types';
import { STARTER_DECK } from './data/starterDeck';
import { calculateNextFSRSState } from './lib/fsrs';
import { AppSidebar, NavigationTab } from './components/AppSidebar';
import { SessionProgress } from './components/SessionProgress';
import { FlashcardView } from './components/FlashcardView';
import { SessionComplete } from './components/SessionComplete';
import { DeckManagerView } from './components/DeckManagerView';
import { SettingsView } from './components/SettingsView';
import { playPronunciation } from './lib/audio';
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
import { loadActivityLog, recordReviewActivity, ActivityLog } from './lib/activityStorage';
import { Sparkles, ArrowLeftRight, Volume2, VolumeX, Menu, X } from 'lucide-react';

const AUTOPLAY_DISPLAY_KEY = 'bleuolingo_autoplay_display_v1';
const AUTOPLAY_FLIP_KEY = 'bleuolingo_autoplay_flip_v1';
const SIDES_SWAPPED_KEY = 'bleuolingo_sides_swapped_v1';
const SIDEBAR_COLLAPSED_KEY = 'bleuolingo_sidebar_collapsed_v1';
const FRONT_LANG_KEY = 'bleuolingo_front_lang_v1';
const BACK_LANG_KEY = 'bleuolingo_back_lang_v1';

export default function App() {
  // Navigation tab: 'practice' | 'deck'
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

  // Audio auto-play preferences (separate for prompt display and answer flip)
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

  // Global switch sides state (Prompt: Back, Answer: Front vs Prompt: Front, Answer: Back)
  const [isSidesSwapped, setIsSidesSwapped] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDES_SWAPPED_KEY) === 'true';
    }
    return false;
  });

  // Active card flipping state
  const [isFlipped, setIsFlipped] = useState(false);

  // Mascot dynamic mood state ('happy' | 'thinking' | 'cheering' | 'wink')
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

  // Practice ahead toggle (allows reviewing cards even before due time)
  const [practiceAhead, setPracticeAhead] = useState(false);

  // Save cards for the active user whenever cards change
  useEffect(() => {
    saveUserCards(activeUserId, cards);
  }, [cards, activeUserId]);

  // Switch to another learner profile
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

  // Create a brand-new learner profile with its own independent deck & progress
  const handleCreateUser = (name: string) => {
    saveUserCards(activeUserId, cards);
    const newProfile = createUserProfile(name, profiles);
    const updatedProfiles = [...profiles, newProfile];
    setUserState({
      profiles: updatedProfiles,
      activeUserId: newProfile.id,
    });
    setCards(STARTER_DECK);
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

  // Delete a learner profile
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

  // Rename a learner profile
  const handleRenameUser = (userId: string, newName: string) => {
    const updatedProfiles = renameUserProfile(userId, newName, profiles);
    setUserState((prev) => ({
      ...prev,
      profiles: updatedProfiles,
    }));
  };

  // Save audio auto-play settings
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

  // Toggle switch sides
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

  // Compute card queues based on FSRS due times
  const now = Date.now();

  const newCards = useMemo(() => cards.filter((c) => c.state === 'new'), [cards]);
  const learningCards = useMemo(
    () => cards.filter((c) => c.state === 'learning' && (practiceAhead || c.due <= now)),
    [cards, now, practiceAhead]
  );
  const reviewCards = useMemo(
    () => cards.filter((c) => c.state === 'review' && (practiceAhead || c.due <= now)),
    [cards, now, practiceAhead]
  );

  // Active queue due count
  const dueCount = useMemo(() => {
    return cards.filter((c) => c.due <= now).length;
  }, [cards, now]);

  // Determine current active card:
  // Priority: Learning cards due -> Review cards due -> New cards
  const currentCard = useMemo(() => {
    if (learningCards.length > 0) return learningCards[0];
    if (reviewCards.length > 0) return reviewCards[0];
    if (newCards.length > 0) return newCards[0];
    if (practiceAhead && cards.length > 0) {
      // Pick card with lowest stability
      return [...cards].sort((a, b) => a.stability - b.stability)[0];
    }
    return null;
  }, [learningCards, reviewCards, newCards, practiceAhead, cards]);

  // Handle rating a card with FSRS
  const handleRateCard = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;

      // Update mascot expression based on performance
      if (rating === 4) {
        setMascotMood('cheering');
      } else if (rating === 3) {
        setMascotMood('wink');
      } else if (rating === 1) {
        setMascotMood('thinking');
      } else {
        setMascotMood('happy');
      }

      const updatedProps = calculateNextFSRSState(currentCard, rating, Date.now());

      setCards((prevCards) =>
        prevCards.map((c) => (c.id === currentCard.id ? { ...c, ...updatedProps } : c))
      );

      // Update current session stats
      setSessionStats((prev) => ({
        ...prev,
        totalReviewed: prev.totalReviewed + 1,
        againCount: rating === 1 ? prev.againCount + 1 : prev.againCount,
        hardCount: rating === 2 ? prev.hardCount + 1 : prev.hardCount,
        goodCount: rating === 3 ? prev.goodCount + 1 : prev.goodCount,
        easyCount: rating === 4 ? prev.easyCount + 1 : prev.easyCount,
      }));

      // Record review activity for the progress heatmap
      setActivityLog(() => recordReviewActivity(activeUserId, 1));

      // Flip back for next card
      setIsFlipped(false);
    },
    [currentCard, activeUserId]
  );

  // Card Operations
  const handleAddCards = (newCardsToAdd: Flashcard[]) => {
    if (newCardsToAdd.length === 0) return;
    setCards((prev) => [...prev, ...newCardsToAdd.map(lowercaseCard)]);
    setIsFlipped(false);
  };

  const handleApplyImport = (cardsToAdd: Flashcard[], cardsToUpdate: Flashcard[]) => {
    setCards((prev) => {
      const updateMap = new Map(cardsToUpdate.map((c) => [c.id, lowercaseCard(c)]));
      const updated = prev.map((c) => updateMap.get(c.id) || c);
      return [...updated, ...cardsToAdd.map(lowercaseCard)];
    });
    setIsFlipped(false);
  };

  const handleAddSingleCard = (newCard: Flashcard) => {
    setCards((prev) => [lowercaseCard(newCard), ...prev]);
  };

  const handleUpdateCard = (updatedCard: Flashcard) => {
    setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? lowercaseCard(updatedCard) : c)));
  };

  const handleDeleteCard = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setIsFlipped(false);
  };

  const handleResetToDefault = () => {
    setCards(STARTER_DECK.map(lowercaseCard));
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
    setCards((prev) => prev.map((c) => ({ ...c, due: timestamp })));
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

  return (
    <div
      id="app-root-layout"
      className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900"
    >
      {/* Mobile Top Header (Hidden on md+) */}
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
                {profiles.find((p) => p.id === activeUserId)?.name || 'Learner'}
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

      {/* Left Hand Navigation Column (Sidebar) */}
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block`}>
        <AppSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          dueCount={dueCount}
          totalCards={cards.length}
          reviewedCount={sessionStats.totalReviewed}
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
            {/* Minimal Ergonomic Practice Header with Clean Reverse Toggle */}
            <div className="w-full flex items-center justify-between gap-3 mb-3">
              {/* Duolingo Chunky Progress Bar */}
              <div className="flex-1">
                <SessionProgress
                  reviewedThisSession={sessionStats.totalReviewed}
                  newCount={newCards.length}
                  learningCount={learningCards.length}
                  reviewCount={reviewCards.length}
                  totalDeckSize={cards.length}
                />
              </div>

              {/* Clean Study Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Clean Reverse Sides Toggle */}
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

                {/* Quick Practice Ahead Trigger if caught up */}
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

            {/* Flashcard Component (Directly in upper focal zone, zero gap!) */}
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

        {/* Dedicated Settings View */}
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
