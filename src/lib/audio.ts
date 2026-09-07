/**
 * Dual-Engine Audio Pronunciation System
 * 1. Native High-Fidelity Web Speech API (Instant, offline, zero-latency on iOS iPad, Safari, Chrome)
 * 2. High-Fidelity Server-side TTS endpoint (/api/tts)
 */

let sharedAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let audioUnlocked = false;
let serverTtsAvailable: boolean | null = null;

// 1-sample silent WAV to bless iOS media pipeline on user gesture
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    try {
      sharedAudio = new Audio();
      sharedAudio.preload = 'auto';
    } catch {
      sharedAudio = null;
    }
  }
  return sharedAudio;
}

/**
 * Pre-unlock both HTMLAudioElement and SpeechSynthesis on first user interaction.
 * Required by iOS Safari / iPadOS autoplay policies.
 */
export function unlockAudioContext(): void {
  if (audioUnlocked || typeof window === 'undefined') return;
  audioUnlocked = true;

  try {
    const audio = getSharedAudio();
    if (audio) {
      audio.src = SILENT_AUDIO_URI;
      audio.play().catch(() => {});
    }
  } catch {
    // ignore
  }

  try {
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      cachedVoices = window.speechSynthesis.getVoices();
      const dummy = new SpeechSynthesisUtterance('');
      dummy.volume = 0;
      window.speechSynthesis.speak(dummy);
    }
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudioContext, { passive: true, capture: true });
  window.addEventListener('touchstart', unlockAudioContext, { passive: true, capture: true });
  window.addEventListener('keydown', unlockAudioContext, { passive: true, capture: true });
  window.addEventListener('pointerdown', unlockAudioContext, { passive: true, capture: true });

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

  const englishRegex =
    /\b(the|a|an|hello|good|morning|afternoon|evening|please|thank|you|very|much|nice|to|meet|see|soon|water|bread|apple|how|are|what|is|where|who|yes|no|cat|dog|book|car|house|room|friend|time|day|night|work|eat|drink)\b/i;
  if (englishRegex.test(clean) && !frenchRegex.test(clean)) {
    return 'en';
  }

  return 'fr';
}

/**
 * Stop any ongoing audio or speech immediately.
 */
export function stopPronunciation(): void {
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
  }
  currentUtterance = null;
}

/**
 * Speaks text using the native Web Speech API.
 * Includes explicit fixes for iOS Safari / WebKit:
 * 1. Does not immediately call speak() if cancel() was just invoked.
 * 2. Keeps a global reference to prevent premature garbage collection.
 * 3. Handles resume() if paused.
 */
export function speakWithBrowserSynthesis(
  text: string,
  lang: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return false;
  }

  try {
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

    // Prefer high-quality/natural/neural voices (especially Apple Siri & Neural on iOS/macOS)
    const available = cachedVoices.filter(
      (v) => v.lang.toLowerCase() === fullLang.toLowerCase() || v.lang.toLowerCase().startsWith(lang)
    );

    const bestVoice =
      available.find((v) => /siri|neural|natural|premium|enhanced/i.test(v.name)) ||
      available.find((v) => !v.localService) ||
      available[0] ||
      cachedVoices.find((v) => v.default);

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    let endFired = false;
    const handleEnd = () => {
      if (!endFired) {
        endFired = true;
        if (currentUtterance === utterance) {
          currentUtterance = null;
        }
        onEnd?.();
      }
    };

    utterance.onstart = () => {
      onStart?.();
    };
    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;

    // Failsafe timer in case browser drops onend event
    const estimatedDurationMs = Math.max(1200, (text.length / 8) * 1000);
    setTimeout(() => {
      if (currentUtterance === utterance) {
        handleEnd();
      }
    }, estimatedDurationMs + 1500);

    const doSpeak = () => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis speak error:', err);
        handleEnd();
      }
    };

    // CRITICAL: On iOS Safari / iPadOS, calling cancel() immediately before speak()
    // synchronously cancels the newly enqueued utterance!
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      setTimeout(doSpeak, 35);
    } else {
      doSpeak();
    }

    return true;
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
    currentUtterance = null;
    onEnd?.();
    return false;
  }
}

/**
 * Main pronunciation function with multi-tier resilience:
 * - On iOS / iPadOS: Web Speech API is native, lightning-fast, and bypasses audio element media restrictions.
 * - On other platforms: Uses Web Speech if voices available or falls back smoothly between server & client TTS.
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

  unlockAudioContext();

  const lang = resolveLanguage(cleanText, targetLang);

  // Stop previous sounds
  stopPronunciation();

  let ended = false;
  const safeEnd = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };

  // Detect iOS / iPadOS WebKit (which has excellent built-in native Siri/Thomas/Samantha voices)
  const isIOS =
    typeof window !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const isStaticHost =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('github.io') ||
      window.location.hostname.endsWith('surge.sh') ||
      window.location.hostname.endsWith('web.app') ||
      window.location.hostname.endsWith('firebaseapp.com') ||
      window.location.pathname.startsWith('/bleuolingo'));

  // If on iOS/iPadOS, GitHub Pages, or if server TTS was determined unavailable, use native Web Speech
  if (
    (isIOS || isStaticHost || serverTtsAvailable === false) &&
    typeof window !== 'undefined' &&
    'speechSynthesis' in window
  ) {
    speakWithBrowserSynthesis(cleanText, lang, onStart, safeEnd);
    return;
  }

  // Otherwise, try server TTS (/api/tts) first, with graceful fallback to browser speech
  let fallbackHandled = false;
  const triggerFallback = () => {
    serverTtsAvailable = false;
    if (!fallbackHandled) {
      fallbackHandled = true;
      speakWithBrowserSynthesis(cleanText, lang, onStart, safeEnd);
    }
  };

  try {
    const audio = getSharedAudio();
    if (!audio) {
      triggerFallback();
      return;
    }

    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(lang)}`;
    audio.src = ttsUrl;

    let hasStarted = false;
    audio.onplay = () => {
      serverTtsAvailable = true;
      hasStarted = true;
      onStart?.();
    };

    audio.onended = () => {
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
