/**
 * Dual-Engine Audio Pronunciation System
 * 1. Primary: Server-side High-Fidelity Neural TTS stream (/api/tts)
 *    - Works inside sandboxed iframes, mobile WebKit, Chrome, Brave, Safari without permissions policy blocks.
 * 2. Secondary: Client-side Web Speech API synthesis fallback.
 */

let activeAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let audioUnlocked = false;

// Pre-unlock audio context on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (!audioUnlocked) {
      audioUnlocked = true;
      try {
        const dummy = new Audio();
        dummy.volume = 0;
        dummy.play().catch(() => {});
      } catch {
        // ignore
      }
      try {
        if ('speechSynthesis' in window) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          cachedVoices = window.speechSynthesis.getVoices();
        }
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('click', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });

  if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        cachedVoices = window.speechSynthesis.getVoices();
      } catch {
        // ignore
      }
    };
  }
}

export interface LanguageOption {
  code: string;
  label: string;
  testPhrase?: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'French (Français)', testPhrase: 'Bonjour ! Comment allez-vous aujourd’hui ?' },
  { code: 'en', label: 'English', testPhrase: 'Hello! How are you doing today?' },
  { code: 'es', label: 'Spanish (Español)', testPhrase: '¡Hola! ¿Cómo estás hoy?' },
  { code: 'de', label: 'German (Deutsch)', testPhrase: 'Guten Tag! Wie geht es Ihnen heute?' },
  { code: 'it', label: 'Italian (Italiano)', testPhrase: 'Ciao! Come va oggi?' },
  { code: 'pt', label: 'Portuguese (Português)', testPhrase: 'Olá! Como você está hoje?' },
  { code: 'ja', label: 'Japanese (日本語)', testPhrase: 'こんにちは！お元気ですか？' },
  { code: 'zh', label: 'Chinese (中文)', testPhrase: '你好！今天过得怎么样？' },
];

/**
 * Intelligent language detection helper.
 */
export function resolveLanguage(text: string, cardLang: string = 'fr'): string {
  if (cardLang && cardLang !== 'auto') {
    return cardLang.split('-')[0].toLowerCase();
  }

  const clean = text.trim();
  // French accent characters
  const frenchRegex = /[éèêëàâäôöûüùçîïœæ]/i;
  if (frenchRegex.test(clean)) {
    return 'fr';
  }

  // Common English words
  const englishRegex = /\b(the|a|an|hello|good|morning|afternoon|evening|please|thank|you|very|much|nice|to|meet|see|soon|water|bread|apple|how|are|what|is|where|who|yes|no|cat|dog|book|car|house|room|friend|time|day|night|work|eat|drink)\b/i;
  if (englishRegex.test(clean) && !frenchRegex.test(clean)) {
    return 'en';
  }

  return 'fr';
}

/**
 * Plays speech for the provided text.
 * Always prefers the crystal-clear `/api/tts` endpoint, falling back to Web Speech.
 */
export function playPronunciation(
  text: string,
  targetLang: string = 'fr',
  onStart?: () => void,
  onEnd?: () => void
): void {
  const cleanText = text.trim();
  if (!cleanText) {
    onEnd?.();
    return;
  }

  const lang = resolveLanguage(cleanText, targetLang);

  // Stop any ongoing audio
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  // 1. Try Server-Side High-Quality Neural TTS
  try {
    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;
    const audio = new Audio(ttsUrl);
    activeAudio = audio;

    let hasStarted = false;

    audio.onplay = () => {
      hasStarted = true;
      onStart?.();
    };

    audio.onended = () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
      onEnd?.();
    };

    audio.onerror = () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
      // If server TTS fails, fallback to browser synthesis
      fallbackToBrowserSynthesis(cleanText, lang, onStart, onEnd);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (!hasStarted) {
            onStart?.();
          }
        })
        .catch((err) => {
          console.warn('Audio play prevented or failed, falling back:', err);
          fallbackToBrowserSynthesis(cleanText, lang, onStart, onEnd);
        });
    }
  } catch {
    fallbackToBrowserSynthesis(cleanText, lang, onStart, onEnd);
  }
}

/**
 * Fallback synthesizer using Web Speech API
 */
function fallbackToBrowserSynthesis(
  text: string,
  lang: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    const langMap: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      es: 'es-ES',
      de: 'de-DE',
      it: 'it-IT',
      ja: 'ja-JP',
      pt: 'pt-PT',
      zh: 'zh-CN',
      ru: 'ru-RU',
      nl: 'nl-NL',
      ar: 'ar-SA',
      ko: 'ko-KR',
    };
    const fullLang = langMap[lang] || (lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`);
    utterance.lang = fullLang;
    utterance.rate = 0.92;
    utterance.volume = 1.0;

    if (cachedVoices.length === 0) {
      try {
        cachedVoices = window.speechSynthesis.getVoices();
      } catch {
        // ignore
      }
    }

    const matchingVoice =
      cachedVoices.find((v) => v.lang.toLowerCase() === fullLang.toLowerCase()) ||
      cachedVoices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
      cachedVoices.find((v) => v.default);

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      onEnd?.();
    };

    utterance.onerror = () => {
      currentUtterance = null;
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis fallback error:', err);
    currentUtterance = null;
    onEnd?.();
  }
}
