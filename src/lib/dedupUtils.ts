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
 * - Identical cards (matching all of front, back, tags, and examples) are silently skipped.
 * - Only flags a conflict if the front and/or back matches but a discrepancy is found in the
 *   other fields, prompting user review.
 */
export function analyzeCardsForDuplicates(
  incomingCards: Flashcard[],
  existingCards: Flashcard[]
): DedupAnalysisResult {
  // 1. Index existing cards by normalized front AND normalized back
  const existingByFront = new Map<string, Flashcard>();
  const existingByBack = new Map<string, Flashcard>();

  for (const card of existingCards) {
    const normFront = normalizeWord(card.front);
    const normBack = normalizeWord(card.back);

    if (normFront && !existingByFront.has(normFront)) {
      existingByFront.set(normFront, card);
    }
    if (normBack && !existingByBack.has(normBack)) {
      existingByBack.set(normBack, card);
    }
  }

  const newCards: Flashcard[] = [];
  const conflicts: DuplicateConflict[] = [];

  // Track incoming entries to avoid adding duplicates within the same import batch
  const seenIncomingFronts = new Set<string>();
  const seenIncomingBacks = new Set<string>();

  for (let i = 0; i < incomingCards.length; i++) {
    const incoming = incomingCards[i];
    const normFront = normalizeWord(incoming.front);
    const normBack = normalizeWord(incoming.back);

    if (!normFront && !normBack) continue;

    // 2. Check for an existing card matching either front or back
    const existing =
      (normFront ? existingByFront.get(normFront) : undefined) ||
      (normBack ? existingByBack.get(normBack) : undefined);

    if (existing) {
      // Check for discrepancies across any relevant fields
      const frontDiff =
        normalizeWord(existing.front) !== normalizeWord(incoming.front);
      const backDiff =
        normalizeWord(existing.back) !== normalizeWord(incoming.back);

      const existingTags = (existing.tags || [])
        .map((t) => t.trim().toLowerCase())
        .sort()
        .join(',');
      const incomingTags = (incoming.tags || [])
        .map((t) => t.trim().toLowerCase())
        .sort()
        .join(',');
      const tagDiff = existingTags !== incomingTags;

      const exampleDiff =
        (existing.example || '').trim() !== (incoming.example || '').trim();
      const exampleTransDiff =
        (existing.exampleTranslation || '').trim() !==
        (incoming.exampleTranslation || '').trim();

      const hasDiscrepancy =
        frontDiff || backDiff || tagDiff || exampleDiff || exampleTransDiff;

      // Only prompt for conflict resolution if there is an actual difference
      if (hasDiscrepancy) {
        conflicts.push({
          id: `conflict-${i}-${Date.now()}`,
          existingCard: existing,
          incomingCard: incoming,
          decision: 'keep',
        });
      }
      // If 100% identical match, silently drop/skip duplicate
    } else if (
      (normFront && seenIncomingFronts.has(normFront)) ||
      (normBack && seenIncomingBacks.has(normBack))
    ) {
      // Drop duplicate that appeared earlier in the same CSV
      continue;
    } else {
      if (normFront) seenIncomingFronts.add(normFront);
      if (normBack) seenIncomingBacks.add(normBack);

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
