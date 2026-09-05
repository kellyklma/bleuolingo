import { Flashcard } from '../types';

/**
 * Normalizes a word by:
 * 1. Trimming whitespace
 * 2. Lowercasing
 * 3. Normalizing Unicode (NFD) and stripping all diacritical marks/accents
 * 4. Normalizing quotes and hyphens for reliable comparison
 */
export function normalizeWord(str?: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type DuplicateDecision = 'keep' | 'overwrite';

export interface DuplicateConflict {
  id: string; // unique identifier for the conflict pair
  existingCard: Flashcard;
  incomingCard: Flashcard;
  decision: DuplicateDecision;
}

export interface DedupAnalysisResult {
  newCards: Flashcard[];
  conflicts: DuplicateConflict[];
}

/**
 * Compares incoming parsed cards against existing deck cards to find duplicates,
 * ignoring capitalization, accents, and diacritics.
 */
export function analyzeCardsForDuplicates(
  incomingCards: Flashcard[],
  existingCards: Flashcard[]
): DedupAnalysisResult {
  // Index existing cards by normalized front word
  const existingMap = new Map<string, Flashcard>();
  for (const card of existingCards) {
    const norm = normalizeWord(card.front);
    if (norm && !existingMap.has(norm)) {
      existingMap.set(norm, card);
    }
  }

  const newCards: Flashcard[] = [];
  const conflicts: DuplicateConflict[] = [];
  const seenIncomingNorms = new Set<string>();

  for (let i = 0; i < incomingCards.length; i++) {
    const incoming = incomingCards[i];
    const norm = normalizeWord(incoming.front);
    if (!norm) continue;

    if (existingMap.has(norm)) {
      const existing = existingMap.get(norm)!;
      conflicts.push({
        id: `conflict-${i}-${Date.now()}`,
        existingCard: existing,
        incomingCard: incoming,
        decision: 'keep', // Default to keep existing card unless user chooses overwrite
      });
    } else if (seenIncomingNorms.has(norm)) {
      // Duplicate within the incoming CSV itself; skip redundant incoming copies
      continue;
    } else {
      seenIncomingNorms.add(norm);
      newCards.push({
        ...incoming,
        id: incoming.id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });
    }
  }

  return { newCards, conflicts };
}

/**
 * Builds the merged updated cards and new cards based on the duplicate resolution decisions.
 */
export function resolveDuplicates(
  conflicts: DuplicateConflict[],
  newCards: Flashcard[]
): {
  cardsToUpdate: Flashcard[];
  cardsToAdd: Flashcard[];
  overwrittenCount: number;
  keptCount: number;
} {
  const cardsToUpdate: Flashcard[] = [];
  let overwrittenCount = 0;
  let keptCount = 0;

  for (const conflict of conflicts) {
    if (conflict.decision === 'overwrite') {
      overwrittenCount++;
      // Overwrite the existing card's text & tags, but preserve FSRS learning progress
      cardsToUpdate.push({
        ...conflict.existingCard,
        front: conflict.incomingCard.front,
        back: conflict.incomingCard.back,
        tags: conflict.incomingCard.tags ?? conflict.existingCard.tags,
        example: conflict.incomingCard.example ?? conflict.existingCard.example,
        exampleTranslation:
          conflict.incomingCard.exampleTranslation ?? conflict.existingCard.exampleTranslation,
        lang: conflict.incomingCard.lang ?? conflict.existingCard.lang,
      });
    } else {
      keptCount++;
    }
  }

  return {
    cardsToUpdate,
    cardsToAdd: newCards,
    overwrittenCount,
    keptCount,
  };
}
