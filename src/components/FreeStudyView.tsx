import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Shuffle,
  ArrowLeftRight,
  X,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Flashcard } from '../types';
import { playPronunciation } from '../lib/audio';

interface FreeStudyViewProps {
  cards: Flashcard[];
  isSidesSwapped: boolean;
  onToggleSwitchSides: () => void;
  onExitFreeStudy: () => void;
  frontLanguage?: string;
  backLanguage?: string;
  autoPlayOnDisplay?: boolean;
  autoPlayOnFlip?: boolean;
}

export const FreeStudyView: React.FC<FreeStudyViewProps> = ({
  cards,
  isSidesSwapped,
  onToggleSwitchSides,
  onExitFreeStudy,
  frontLanguage = 'fr',
  backLanguage = 'en',
  autoPlayOnDisplay = true,
  autoPlayOnFlip = true,
}) => {
  // Free study queue (can be shuffled)
  const [studyList, setStudyList] = useState<Flashcard[]>(() => [...cards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlayingPromptAudio, setIsPlayingPromptAudio] = useState(false);
  const [isPlayingAnswerAudio, setIsPlayingAnswerAudio] = useState(false);

  const promptAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const answerAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  // Sync if cards change
  useEffect(() => {
    setStudyList([...cards]);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards]);

  const currentCard: Flashcard | undefined = studyList[currentIndex];

  const promptText = currentCard ? (isSidesSwapped ? currentCard.back : currentCard.front) : '';
  const answerText = currentCard ? (isSidesSwapped ? currentCard.front : currentCard.back) : '';
  const promptLang = isSidesSwapped ? backLanguage : frontLanguage;
  const answerLang = isSidesSwapped ? frontLanguage : backLanguage;

  // Cleanup timeouts on card or flip change
  useEffect(() => {
    if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);
    if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);
    setIsPlayingPromptAudio(false);
    setIsPlayingAnswerAudio(false);

    return () => {
      if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);
      if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);
    };
  }, [currentCard?.id, isFlipped]);

  const handlePlayPromptAudio = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!promptText) return;
      if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);

      playPronunciation(
        promptText,
        promptLang,
        () => {
          setIsPlayingPromptAudio(true);
          promptAudioTimeoutRef.current = setTimeout(() => {
            setIsPlayingPromptAudio(false);
          }, 4500);
        },
        () => {
          if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);
          setIsPlayingPromptAudio(false);
        }
      );
    },
    [promptText, promptLang]
  );

  const handlePlayAnswerAudio = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!answerText) return;
      if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);

      playPronunciation(
        answerText,
        answerLang,
        () => {
          setIsPlayingAnswerAudio(true);
          answerAudioTimeoutRef.current = setTimeout(() => {
            setIsPlayingAnswerAudio(false);
          }, 4500);
        },
        () => {
          if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);
          setIsPlayingAnswerAudio(false);
        }
      );
    },
    [answerText, answerLang]
  );

  // Auto-play front audio when displaying a new card
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (autoPlayOnDisplay && !isFlipped && promptText) {
      const timer = setTimeout(() => {
        handlePlayPromptAudio();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentCard?.id, autoPlayOnDisplay, isFlipped, handlePlayPromptAudio, promptText]);

  // Auto-play back audio when flipped
  useEffect(() => {
    if (autoPlayOnFlip && isFlipped && answerText) {
      const timer = setTimeout(() => {
        handlePlayAnswerAudio();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isFlipped, autoPlayOnFlip, handlePlayAnswerAudio, answerText]);

  const handleNext = () => {
    if (currentIndex < studyList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...studyList].sort(() => Math.random() - 0.5);
    setStudyList(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExitFreeStudy();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onToggleSwitchSides();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!currentCard || studyList.length === 0) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-xl font-black text-slate-800">Deck is Empty</h3>
        <p className="text-xs text-slate-500 mt-1">Add cards in the Deck view to begin free studying.</p>
        <button
          type="button"
          onClick={onExitFreeStudy}
          className="mt-5 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
        >
          Exit Free-Study
        </button>
      </div>
    );
  }

  const isLastCard = currentIndex === studyList.length - 1;

  return (
    <div id="free-study-container" className="w-full max-w-2xl mx-auto flex flex-col items-center">
      {/* Top Banner & Controls */}
      <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        {/* Left: Mode Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-slate-900">Free-Study Mode</span>
              <span className="px-2 py-0.2 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-black uppercase">
                Read-Only
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              FSRS scheduling bypassed • Zero rating pressure
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Reverse Sides */}
          <button
            type="button"
            onClick={onToggleSwitchSides}
            title={isSidesSwapped ? 'Reverse sides active' : 'Default sides'}
            className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
              isSidesSwapped
                ? 'bg-purple-600 border-purple-700 text-white shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reverse</span>
          </button>

          {/* Shuffle */}
          <button
            type="button"
            onClick={handleShuffle}
            title="Shuffle card sequence"
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shuffle</span>
          </button>

          {/* Exit Free-Study */}
          <button
            type="button"
            onClick={onExitFreeStudy}
            className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200/80 text-slate-600 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Progress Counter & Bar */}
      <div className="w-full mb-3">
        <div className="flex items-center justify-between text-xs font-black text-slate-500 mb-1.5 px-1">
          <span>Card {currentIndex + 1} of {studyList.length}</span>
          <span className="text-[11px] font-semibold text-slate-400">
            {Math.round(((currentIndex + 1) / studyList.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-200"
            style={{ width: `${((currentIndex + 1) / studyList.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard Box */}
      <motion.div
        id="free-study-card"
        onClick={() => setIsFlipped((prev) => !prev)}
        className="w-full min-h-[300px] sm:min-h-[340px] bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200/90 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative flex flex-col justify-between select-none"
        whileTap={{ scale: 0.995 }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-50 text-purple-700 border border-purple-100">
              Free Study
            </span>
            {currentCard.tags && currentCard.tags.length > 0 && (
              <span className="text-xs font-semibold text-slate-400">
                #{currentCard.tags[0]}
              </span>
            )}
          </div>

          {/* Audio Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePlayPromptAudio}
              title={`Pronounce prompt (${promptLang})`}
              className={`h-8 px-2.5 rounded-xl border border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                isPlayingPromptAudio
                  ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-purple-50 hover:border-purple-200 text-slate-600 hover:text-purple-700 border-slate-200/80'
              }`}
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingPromptAudio ? 'animate-pulse' : ''}`} />
              <span className="text-[11px] font-bold">Front</span>
            </button>

            {isFlipped && (
              <button
                type="button"
                onClick={handlePlayAnswerAudio}
                title={`Pronounce answer (${answerLang})`}
                className={`h-8 px-2.5 rounded-xl border border-b-2 flex items-center gap-1 transition-all cursor-pointer ${
                  isPlayingAnswerAudio
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-slate-50 hover:bg-purple-50 hover:border-purple-200 text-slate-600 hover:text-purple-700 border-slate-200/80'
                }`}
              >
                <Volume2 className={`w-3.5 h-3.5 ${isPlayingAnswerAudio ? 'animate-pulse' : ''}`} />
                <span className="text-[11px] font-bold">Back</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Prompt & Answer */}
        <div className="my-auto py-6 text-center flex flex-col items-center justify-center">
          <h2
            className={`${
              promptText.length > 50
                ? 'text-xl sm:text-2xl'
                : promptText.length > 25
                ? 'text-2xl sm:text-3xl'
                : 'text-3xl sm:text-5xl'
            } font-black text-slate-900 tracking-tight leading-tight select-text max-w-lg`}
          >
            {promptText}
          </h2>

          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full pt-5 mt-5 border-t-2 border-slate-100 flex flex-col items-center justify-center"
            >
              <h3
                className={`${
                  answerText.length > 50
                    ? 'text-lg sm:text-xl'
                    : answerText.length > 25
                    ? 'text-xl sm:text-2xl'
                    : 'text-2xl sm:text-3xl'
                } font-black text-purple-600 leading-snug select-text max-w-lg`}
              >
                {answerText}
              </h3>
              {currentCard.example && (
                <p className="text-xs text-slate-500 italic mt-3 max-w-md">
                  &ldquo;{currentCard.example}&rdquo;
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="text-center">
          <span className="text-[11px] font-bold text-slate-400 tracking-wide">
            {!isFlipped ? 'Click card or Space to reveal' : 'Arrow Left / Right to navigate'}
          </span>
        </div>
      </motion.div>

      {/* Navigation Controls Bar */}
      <div className="w-full mt-4 flex items-center justify-between gap-3">
        {/* Previous Button */}
        <button
          type="button"
          id="free-study-prev-btn"
          disabled={currentIndex === 0}
          onClick={handlePrev}
          className={`flex-1 sm:flex-none sm:w-36 py-3.5 px-4 rounded-2xl border-2 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            currentIndex === 0
              ? 'opacity-40 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
          <kbd className="hidden sm:inline ml-1 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-500">
            ←
          </kbd>
        </button>

        {/* Flip / Reveal Toggle */}
        <button
          type="button"
          id="free-study-flip-btn"
          onClick={() => setIsFlipped((prev) => !prev)}
          className="flex-1 py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <span>{isFlipped ? 'Hide Answer' : 'Show Answer'}</span>
          <kbd className="hidden sm:inline px-2 py-0.5 rounded-md bg-purple-800/60 text-[10px] font-mono">
            Space
          </kbd>
        </button>

        {/* Next Button */}
        {isLastCard ? (
          <button
            type="button"
            id="free-study-restart-btn"
            onClick={handleRestart}
            className="flex-1 sm:flex-none sm:w-36 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Restart</span>
          </button>
        ) : (
          <button
            type="button"
            id="free-study-next-btn"
            onClick={handleNext}
            className="flex-1 sm:flex-none sm:w-36 py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <span>Next</span>
            <kbd className="hidden sm:inline ml-1 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-500">
              →
            </kbd>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
