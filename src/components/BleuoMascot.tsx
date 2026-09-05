import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Sparkles } from 'lucide-react';
import { playPronunciation } from '../lib/audio';

export interface BleuPhrase {
  french: string;
  english: string;
}

export const BLEU_FRENCH_PHRASES: BleuPhrase[] = [
  { french: 'Bonjour ! Tu es formidable !', english: 'Hello! You are wonderful!' },
  { french: 'Très bien ! Continue comme ça !', english: 'Very good! Keep going like this!' },
  { french: "C'est parti mon ami !", english: "Let's go my friend!" },
  { french: 'Tu peux le faire !', english: 'You can do it!' },
  { french: 'Fantastique ! Bravo !', english: 'Fantastic! Well done!' },
  { french: "Un peu chaque jour, c'est la clé !", english: 'A little every day is the key!' },
  { french: 'Magnifique ! Tu progresses vite !', english: "Magnificent! You're making fast progress!" },
  { french: 'Courage, tu es sur la bonne voie !', english: "Courage, you're on the right track!" },
  { french: 'Super travail !', english: 'Super work!' },
  { french: 'On lâche rien !', english: 'Never give up!' },
  { french: "J'adore apprendre avec toi !", english: 'I love learning with you!' },
  { french: 'Génial ! Tu as du talent !', english: 'Awesome! You have talent!' },
  { french: 'Prêt pour la suite ?', english: 'Ready for the next part?' },
  { french: 'Bravo champion !', english: 'Bravo champion!' },
  { french: 'Tu apprends tellement vite !', english: 'You learn so fast!' },
];

interface BleuoMascotProps {
  mood?: 'happy' | 'thinking' | 'cheering' | 'wink';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  interactive?: boolean;
}

export const BleuoMascot: React.FC<BleuoMascotProps> = ({
  mood = 'happy',
  size = 'md',
  className = '',
  interactive = true,
}) => {
  const [currentPhrase, setCurrentPhrase] = useState<BleuPhrase | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [temporaryMood, setTemporaryMood] = useState<'happy' | 'thinking' | 'cheering' | 'wink' | null>(null);
  const timerRef = useRef<number | null>(null);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const handleMascotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactive) return;

    // Pick a phrase different from current
    let nextIdx = Math.floor(Math.random() * BLEU_FRENCH_PHRASES.length);
    if (currentPhrase && BLEU_FRENCH_PHRASES[nextIdx].french === currentPhrase.french) {
      nextIdx = (nextIdx + 1) % BLEU_FRENCH_PHRASES.length;
    }
    const phrase = BLEU_FRENCH_PHRASES[nextIdx];
    setCurrentPhrase(phrase);
    setIsSpeaking(true);

    const cheeringMoods: ('cheering' | 'wink')[] = ['cheering', 'wink'];
    const chosenMood = cheeringMoods[Math.floor(Math.random() * cheeringMoods.length)];
    setTemporaryMood(chosenMood);

    playPronunciation(
      phrase.french,
      'fr',
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCurrentPhrase(null);
      setTemporaryMood(null);
      setIsSpeaking(false);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const activeMood = temporaryMood || mood;

  return (
    <div className="relative inline-flex items-center justify-center">
      <motion.div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={handleMascotClick}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleMascotClick(e as unknown as React.MouseEvent);
          }
        }}
        title={interactive ? 'Click Bleu to speak in French! 🐶💬' : 'Bleu'}
        className={`relative inline-flex items-center justify-center select-none ${sizeClasses[size]} ${
          interactive ? 'cursor-pointer' : ''
        } ${className}`}
        whileHover={interactive ? { scale: 1.1, rotate: 3 } : undefined}
        whileTap={interactive ? { scale: 0.95 } : undefined}
        animate={isSpeaking ? { y: [0, -4, 0, -3, 0] } : { y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      >
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
        <defs>
          {/* Duolingo-style clean gradients */}
          <linearGradient id="duo_blue_body" x1="50" y1="10" x2="50" y2="92" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>

          <linearGradient id="duo_ear_l" x1="16" y1="20" x2="28" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1D4ED8" />
            <stop offset="0.75" stopColor="#1E40AF" />
            <stop offset="0.76" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>

          <linearGradient id="duo_ear_r" x1="84" y1="20" x2="72" y2="70" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1D4ED8" />
            <stop offset="0.75" stopColor="#1E40AF" />
            <stop offset="0.76" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="50" cy="94" rx="30" ry="4" fill="#CBD5E1" opacity="0.6" />

        {/* --- Beagle Hound Ears (Flapping on sides like Duo owl wings/ears) --- */}
        {/* Left Ear */}
        <path
          d="M 28 22 C 14 26 8 44 10 65 C 11 74 18 78 24 74 C 30 70 32 50 30 32 Z"
          fill="url(#duo_ear_l)"
        />
        {/* Right Ear */}
        <path
          d="M 72 22 C 86 26 92 44 90 65 C 89 74 82 78 76 74 C 70 70 68 50 70 32 Z"
          fill="url(#duo_ear_r)"
        />

        {/* --- Main Duolingo Chubby Pear Body --- */}
        <path
          d="M 24 45 C 24 22 36 10 50 10 C 64 10 76 22 76 45 C 76 68 76 90 50 90 C 24 90 24 68 24 45 Z"
          fill="url(#duo_blue_body)"
        />

        {/* White Beagle Chest Patch */}
        <path
          d="M 38 68 C 38 60 43 56 50 56 C 57 56 62 60 62 68 C 62 82 58 89 50 89 C 42 89 38 82 38 68 Z"
          fill="#FFFFFF"
        />

        {/* White Beagle Face Blaze & Muzzle */}
        <path
          d="M 45 18 C 45 13 55 13 55 18 C 55 32 58 40 64 48 C 66 54 62 64 50 64 C 38 64 34 54 36 48 C 42 40 45 32 45 18 Z"
          fill="#FFFFFF"
        />

        {/* Tan Beagle Eyebrow/Pip Spots (Classic Beagle Characteristic) */}
        {activeMood !== 'cheering' && (
          <>
            <circle cx="37" cy="25" r="3.5" fill="#F59E0B" />
            <circle cx="63" cy="25" r="3.5" fill="#F59E0B" />
          </>
        )}

        {/* --- Giant Expressive Duolingo Eyes --- */}
        {activeMood === 'wink' ? (
          <>
            {/* Left Eye: Open Giant Duo Eye */}
            <circle cx="36" cy="38" r="9.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="37" cy="38" r="5.5" fill="#0F172A" />
            <circle cx="35" cy="36" r="2.2" fill="#FFFFFF" />
            <circle cx="39" cy="40" r="1.1" fill="#FFFFFF" />

            {/* Right Eye: Cheerful Winking Arc */}
            <path
              d="M 58 39 Q 64 32 70 39"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Playful cheek blush */}
            <ellipse cx="66" cy="45" rx="3.5" ry="2" fill="#F43F5E" opacity="0.4" />
          </>
        ) : activeMood === 'cheering' ? (
          <>
            {/* Cheerful Joyful Crescent Eyes */}
            <path
              d="M 30 39 Q 36 30 42 39"
              stroke="#0F172A"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 58 39 Q 64 30 70 39"
              stroke="#0F172A"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Cute rosy cheeks */}
            <ellipse cx="29" cy="44" rx="3.5" ry="2" fill="#F43F5E" opacity="0.4" />
            <ellipse cx="71" cy="44" rx="3.5" ry="2" fill="#F43F5E" opacity="0.4" />
          </>
        ) : activeMood === 'thinking' ? (
          <>
            {/* Left Eye looking up-left */}
            <circle cx="36" cy="38" r="9.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="34" cy="35" r="5.5" fill="#0F172A" />
            <circle cx="33" cy="33.5" r="2.2" fill="#FFFFFF" />

            {/* Right Eye looking up-left */}
            <circle cx="64" cy="38" r="9.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="62" cy="35" r="5.5" fill="#0F172A" />
            <circle cx="61" cy="33.5" r="2.2" fill="#FFFFFF" />

            {/* Inquisitive Raised Right Eyebrow */}
            <path
              d="M 58 24 Q 65 20 71 25"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          /* Default 'happy' Big Round Duolingo Eyes */
          <>
            {/* Left Eye */}
            <circle cx="36" cy="38" r="9.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="37" cy="38" r="5.5" fill="#0F172A" />
            <circle cx="35" cy="36" r="2.2" fill="#FFFFFF" />
            <circle cx="39" cy="40" r="1.1" fill="#FFFFFF" />

            {/* Right Eye */}
            <circle cx="64" cy="38" r="9.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="63" cy="38" r="5.5" fill="#0F172A" />
            <circle cx="61" cy="36" r="2.2" fill="#FFFFFF" />
            <circle cx="65" cy="40" r="1.1" fill="#FFFFFF" />
          </>
        )}

        {/* --- Cute Rounded Beagle Nose --- */}
        <path
          d="M 46 48 C 46 46 54 46 54 48 C 54 52 51 54 50 54 C 49 54 46 52 46 48 Z"
          fill="#0F172A"
        />
        {/* Soft highlight on nose */}
        <ellipse cx="48.5" cy="48" rx="1.5" ry="0.8" fill="#FFFFFF" opacity="0.6" />

        {/* --- Puppy Mouth --- */}
        {activeMood === 'cheering' ? (
          /* Open happy laughing mouth with tongue */
          <g>
            <path
              d="M 45 54 Q 50 63 55 54 Z"
              fill="#991B1B"
            />
            <path
              d="M 47 57 Q 50 63 53 57 Z"
              fill="#F43F5E"
            />
          </g>
        ) : (
          /* Sweet w-smile */
          <path
            d="M 44 54 Q 47 57 50 54 Q 53 57 56 54"
            stroke="#0F172A"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* --- Cute Front Paws --- */}
        {activeMood === 'cheering' ? (
          /* Cheering paws raised up */
          <>
            <circle cx="25" cy="48" r="5.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="75" cy="48" r="5.5" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
          </>
        ) : (
          /* Paws resting at bottom */
          <>
            <ellipse cx="41" cy="87" rx="5.5" ry="4" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="0.8" />
            <ellipse cx="59" cy="87" rx="5.5" ry="4" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="0.8" />
          </>
        )}

        {/* Collar & Golden Tag */}
        <path
          d="M 36 78 Q 50 82 64 78"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="50" cy="81" r="2.8" fill="#FBBF24" stroke="#D97706" strokeWidth="0.8" />
      </svg>
      </motion.div>

      {/* Floating Animated Speech Bubble when Bleu is clicked */}
      <AnimatePresence>
        {currentPhrase && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            onClick={(e) => {
              e.stopPropagation();
              playPronunciation(currentPhrase.french, 'fr');
            }}
            title="Click to hear Bleu repeat this in French"
            className="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-auto cursor-pointer"
          >
            <div className="bg-slate-900 text-white rounded-2xl p-2.5 sm:p-3 shadow-xl border border-slate-700/80 flex flex-col gap-1 min-w-[190px] max-w-[260px] text-center relative group">
              <div className="flex items-center justify-center gap-1.5 text-blue-400 font-extrabold text-[11px] tracking-wide">
                <Volume2 className="w-3 h-3 animate-pulse text-blue-400 shrink-0" />
                <span>Bleu dit :</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-white leading-tight">
                « {currentPhrase.french} »
              </div>
              <div className="text-[10px] text-slate-300 font-medium italic">
                {currentPhrase.english}
              </div>

              {/* Triangle speech pointer pointing down to Bleu */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-700/80 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
