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
 * Compares incoming parsed cards against existing deck cards to identify conflicts.
 *
 * - Matches fronts agnostically (ignoring case, whitespace, and diacritics/accents).
 * - Identical cards (matching front, back, tags, and examples) are silently skipped.
 * - Only flags a conflict if the front matches but a discrepancy is found in the
 *   translation (back), tags, or example fields, prompting user review.
 */
export function analyzeCardsForDuplicates(
  incomingCards: Flashcard[],
  existingCards: Flashcard[]
): DedupAnalysisResult {
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

      // Check for discrepancies in back, tags, or example fields
      const backDiff = (existing.back || '').trim() !== (incoming.back || '').trim();
      
      const existingTags = (existing.tags || []).map((t) => t.trim()).sort().join(',');
      const incomingTags = (incoming.tags || []).map((t) => t.trim()).sort().join(',');
      const tagDiff = existingTags !== incomingTags;

      const exampleDiff =
        (existing.example || '').trim() !== (incoming.example || '').trim();
      const exampleTransDiff =
        (existing.exampleTranslation || '').trim() !==
        (incoming.exampleTranslation || '').trim();

      const hasDiscrepancy = backDiff || tagDiff || exampleDiff || exampleTransDiff;

      // Only prompt for review if there is an actual difference
      if (hasDiscrepancy) {
        conflicts.push({
          id: `conflict-${i}-${Date.now()}`,
          existingCard: existing,
          incomingCard: incoming,
          decision: 'keep',
        });
      }
      // If 100% identical, do nothing (silently kept as-is)
    } else if (seenIncomingNorms.has(norm)) {
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
