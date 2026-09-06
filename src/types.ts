export type CardState = 'new' | 'learning' | 'review';

export type ReviewRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface Flashcard {
  id: string;
  front: string; // Target language word or phrase
  back: string; // Meaning / translation
  tags?: string[]; // Tags or hierarchical categories separated by ';'
  example?: string; // Example sentence in target language
  exampleTranslation?: string; // Example sentence translated
  targetWord?: string; // Original vocabulary word used to generate sentence
  lang?: string; // BCP-47 tag for TTS (e.g. 'fr-FR', 'es-ES', 'ja-JP', 'de-DE')
  createdAt?: number; // Creation timestamp (ms)
  modifiedAt?: number; // Last modified/updated timestamp (ms)

  // FSRS Core State Variables
  state: CardState;
  stability: number; // S (days)
  difficulty: number; // D (1 to 10)
  reps: number;
  lapses: number;
  lastReview?: number; // timestamp (ms)
  due: number; // timestamp (ms)
}

export interface SessionStats {
  totalReviewed: number;
  againCount: number;
  hardCount: number;
  goodCount: number;
  easyCount: number;
  sessionStartTime: number;
}

export interface FSRSRatingOption {
  rating: ReviewRating;
  label: string;
  intervalText: string;
  shortcut: string;
  colorClass: string;
}

export interface GeneratedSentenceCard {
  targetWord: string;
  targetSentence: string; // Accurate sentence in target language (Back of card)
  englishTranslation: string; // English translation (Front of card)
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: number;
}

