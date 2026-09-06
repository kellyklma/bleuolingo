/**
 * Dual-Engine Audio Pronunciation System
 * 1. Primary (Local / Hosted Server): Server-side High-Fidelity Neural TTS (/api/tts)
 * 2. Primary (GitHub Pages / Static Client): Direct Web Speech API synthesis fallback
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

export function resolveLanguage(text: string, cardLang: string = 'fr'): string {
  if (cardLang && cardLang !== 'auto') {
    return cardLang.split('-')[0].toLowerCase();
  }

  const clean = text.trim();
  const frenchRegex = /[éèêëàâäôöûüùçîïœæ]/i;
  if (frenchRegex.test(clean)) {
    return 'fr';
  }

  const englishRegex = /\b(the|a|an|hello|good|morning|afternoon|evening|please|thank|you|very|much|nice|to|meet|see|soon|water|bread|apple|how|are|what|is|where|who|yes|no|cat|dog|book|car|house|room|friend|time|day|night|work|eat|drink)\b/i;
  if (englishRegex.test(clean) && !frenchRegex.test(clean)) {
    return 'en';
  }

  return 'fr';
}

/**
 * Stop any ongoing audio or speech immediately and reset references.
 */
export function stopPronunciation(): void {
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
  currentUtterance = null;
}

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

  // Clean stop previous sounds
  stopPronunciation();

  // Guard against duplicate callback executions
  let ended = false;
  const safeEnd = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };

  // If on GitHub Pages or any static host without /api backend, jump straight to browser speech
  const isStaticHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('github.io') || window.location.hostname.endsWith('surge.sh'));

  if (isStaticHost) {
    fallbackToBrowserSynthesis(cleanText, lang, onStart, safeEnd);
    return;
  }

  // Otherwise, attempt the server endpoint
  let fallbackHandled = false;
  const triggerFallback = () => {
    if (!fallbackHandled) {
      fallbackHandled = true;
      if (activeAudio) {
        activeAudio.src = '';
        activeAudio = null;
      }
      fallbackToBrowserSynthesis(cleanText, lang, onStart, safeEnd);
    }
  };

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
      safeEnd();
    };

    audio.onerror = () => {
      triggerFallback();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (!hasStarted) {
            onStart?.();
          }
        })
        .catch(() => {
          triggerFallback();
        });
    }
  } catch {
    triggerFallback();
  }
}

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

    // Prefer high-quality/natural voices over basic system voices
    const available = cachedVoices.filter(
      (v) => v.lang.toLowerCase() === fullLang.toLowerCase() || v.lang.toLowerCase().startsWith(lang)
    );

    const naturalVoice =
      available.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ||
      available.find((v) => !v.localService) ||
      available[0] ||
      cachedVoices.find((v) => v.default);

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    let endFired = false;
    const handleEnd = () => {
      if (!endFired) {
        endFired = true;
        currentUtterance = null;
        onEnd?.();
      }
    };

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;

    // Failsafe timer: SpeechSynthesis on Safari/Chrome mobile can drop `onend` if audio locks
    const estimatedDurationMs = Math.max(1200, (text.length / 10) * 1000);
    setTimeout(() => {
      if (currentUtterance === utterance) {
        handleEnd();
      }
    }, estimatedDurationMs + 1000);

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis fallback error:', err);
    currentUtterance = null;
    onEnd?.();
  }
}