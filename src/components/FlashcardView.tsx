import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Flashcard, ReviewRating } from '../types';
import { getFSRSOptions } from '../lib/fsrs';
import { playPronunciation } from '../lib/audio';

interface FlashcardViewProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (rating: ReviewRating) => void;
  autoPlayOnDisplay?: boolean;
  autoPlayOnFlip?: boolean;
  isSidesSwapped: boolean;
  frontLanguage?: string;
  backLanguage?: string;
  onDeleteCard?: (id: string) => void;
  onUpdateCard?: (updatedCard: Flashcard) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  card,
  isFlipped,
  onFlip,
  onRate,
  autoPlayOnDisplay = true,
  autoPlayOnFlip = true,
  isSidesSwapped,
  frontLanguage = 'fr',
  backLanguage = 'en',
}) => {
  const [isPlayingPromptAudio, setIsPlayingPromptAudio] = useState(false);
  const [isPlayingAnswerAudio, setIsPlayingAnswerAudio] = useState(false);
  const isInitialMountRef = useRef(true);
  const promptAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const answerAudioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fsrsOptions = getFSRSOptions(card);

  const promptText = isSidesSwapped ? card.back : card.front;
  const answerText = isSidesSwapped ? card.front : card.back;
  const promptLang = isSidesSwapped ? backLanguage : frontLanguage;
  const answerLang = isSidesSwapped ? frontLanguage : backLanguage;

  useEffect(() => {
    if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);
    if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);
    setIsPlayingPromptAudio(false);
    setIsPlayingAnswerAudio(false);

    return () => {
      if (promptAudioTimeoutRef.current) clearTimeout(promptAudioTimeoutRef.current);
      if (answerAudioTimeoutRef.current) clearTimeout(answerAudioTimeoutRef.current);
    };
  }, [card.id, isFlipped]);

  const handlePlayPromptAudio = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
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

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (autoPlayOnDisplay) {
      handlePlayPromptAudio();
    }
  }, [card.id, autoPlayOnDisplay, handlePlayPromptAudio]);

  useEffect(() => {
    if (autoPlayOnFlip && isFlipped) {
      handlePlayAnswerAudio();
    }
  }, [isFlipped, autoPlayOnFlip, handlePlayAnswerAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isFlipped) {
          onFlip();
        }
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlePlayPromptAudio();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (isFlipped) {
          handlePlayAnswerAudio();
        }
      } else if (isFlipped) {
        if (e.key === '1') {
          e.preventDefault();
          onRate(1);
        } else if (e.key === '2') {
          e.preventDefault();
          onRate(2);
        } else if (e.key === '3') {
          e.preventDefault();
          onRate(3);
        } else if (e.key === '4') {
          e.preventDefault();
          onRate(4);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, onFlip, onRate, handlePlayPromptAudio, handlePlayAnswerAudio]);

  return (
    <div id="flashcard-interactive-wrapper" className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {/* Flashcard Container */}
      <motion.div
        id="flashcard-main-container"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        onClick={() => !isFlipped && onFlip()}
        className={`w-full min-h-[290px] sm:min-h-[320px] bg-white rounded-[28px] p-6 sm:p-8 flex flex-col justify-between border-2 border-slate-200/90 border-b-4 transition-all cursor-pointer relative shadow-[0_12px_36px_rgba(0,0,0,0.05)] ${
          isFlipped ? 'border-blue-400/90' : 'hover:border-blue-300'
        }`}
      >
        {/* Option 2: Top-Left Anchor Audio Controls */}
        <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex items-center gap-1.5 z-10">
          {/* Prompt Audio Button */}
          <button
            id="pronounce-prompt-btn"
            type="button"
            onClick={handlePlayPromptAudio}
            title="Listen to front (A)"
            className={`h-8 px-2.5 rounded-xl border border-b-2 flex items-center gap-1 transition-all cursor-pointer select-none active:translate-y-0.5 active:border-b ${
              isPlayingPromptAudio
                ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 border-slate-200/80'
            }`}
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPlayingPromptAudio ? 'animate-pulse' : ''}`} />
            <span className="text-[11px] font-bold">Front</span>
          </button>

          {/* Answer Audio Button (appears on flip) */}
          {isFlipped && (
            <button
              id="pronounce-answer-btn"
              type="button"
              onClick={handlePlayAnswerAudio}
              title="Listen to back (S)"
              className={`h-8 px-2.5 rounded-xl border border-b-2 flex items-center gap-1 transition-all cursor-pointer select-none active:translate-y-0.5 active:border-b ${
                isPlayingAnswerAudio
                  ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 border-slate-200/80'
              }`}
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingAnswerAudio ? 'animate-pulse' : ''}`} />
              <span className="text-[11px] font-bold">Back</span>
            </button>
          )}
        </div>

        {/* Center: Clean, perfectly centered Prompt & Answer */}
        <div className="my-auto py-8 text-center flex flex-col items-center justify-center">
          <h2
            id="flashcard-prompt-text"
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
              id="flashcard-answer-container"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full pt-5 mt-5 border-t-2 border-slate-100 flex justify-center"
            >
              <h3
                id="flashcard-answer-text"
                className={`${
                  answerText.length > 50
                    ? 'text-lg sm:text-xl'
                    : answerText.length > 25
                    ? 'text-xl sm:text-2xl'
                    : 'text-2xl sm:text-3xl'
                } font-black text-blue-600 leading-snug select-text max-w-lg`}
              >
                {answerText}
              </h3>
            </motion.div>
          )}
        </div>

        {/* Card Footer Hint */}
        <div className="text-center">
          <span className="text-[11px] font-bold text-slate-400 tracking-wide select-none">
            {!isFlipped ? 'Tap card or press Space to reveal' : 'Rate how easily you remembered'}
          </span>
        </div>
      </motion.div>

      {/* Action Controls Below Card */}
      <div id="flashcard-controls-bar" className="w-full">
        {!isFlipped ? (
          <button
            id="show-answer-btn"
            onClick={onFlip}
            className="w-full py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 text-white font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer select-none"
          >
            <span>Show Answer</span>
            <kbd className="ml-1 px-2.5 py-0.5 rounded-lg bg-blue-700/60 text-xs font-mono text-white/90 border border-blue-400/40">
              Space
            </kbd>
          </button>
        ) : (
          <div id="fsrs-buttons-grid" className="grid grid-cols-4 gap-2 sm:gap-3">
            {fsrsOptions.map((opt) => {
              const buttonTheme =
                opt.rating === 1
                  ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-700'
                  : opt.rating === 2
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-700'
                  : opt.rating === 3
                  ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-700'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-700';

              return (
                <button
                  key={opt.rating}
                  id={`fsrs-rate-${opt.label.toLowerCase()}-btn`}
                  onClick={() => onRate(opt.rating)}
                  className={`py-3.5 px-1.5 rounded-2xl font-black text-center flex flex-col items-center justify-center border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer shadow-sm relative ${buttonTheme}`}
                >
                  <span className="text-sm sm:text-base font-black tracking-tight">{opt.label}</span>
                  <span className="text-[11px] font-bold opacity-90 mt-0.5">
                    {opt.intervalText}
                  </span>
                  <kbd className="mt-1 px-1.5 py-0.2 rounded bg-black/15 text-[10px] font-mono opacity-80">
                    {opt.rating}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};