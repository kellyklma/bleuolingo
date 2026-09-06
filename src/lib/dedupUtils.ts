import { Flashcard } from '../types';

export interface DuplicateConflict {
  id: string;
  existingCard: Flashcard;
  incomingCard: Flashcard;
  decision: 'keep' | 'overwrite';
}

export interface DedupAnalysisResult {
  newCards: Flashcard[];
  conflicts: DuplicateConflict[];
}

export interface ResolveDuplicatesResult {
  cardsToAdd: Flashcard[];
  cardsToUpdate: Flashcard[];
  overwrittenCount: number;
  keptCount: number;
}

export type DuplicateDecision = 'keep' | 'overwrite';

/**
 * Normalizes text for accent- and case-insensitive matching.
 */
export function normalizeWord(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Analyzes incoming CSV rows against existing cards, flagging matches on front or back.
 */
export function analyzeCardsForDuplicates(
  incomingCards: Flashcard[],
  existingCards: Flashcard[]
): DedupAnalysisResult {
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
  const seenIncomingFronts = new Set<string>();
  const seenIncomingBacks = new Set<string>();

  for (let i = 0; i < incomingCards.length; i++) {
    const incoming = incomingCards[i];
    const normFront = normalizeWord(incoming.front);
    const normBack = normalizeWord(incoming.back);

    if (!normFront && !normBack) continue;

    const existing =
      (normFront ? existingByFront.get(normFront) : undefined) ||
      (normBack ? existingByBack.get(normBack) : undefined);

    if (existing) {
      const frontDiff = normalizeWord(existing.front) !== normalizeWord(incoming.front);
      const backDiff = normalizeWord(existing.back) !== normalizeWord(incoming.back);

      const existingTags = (existing.tags || []).map((t) => t.trim().toLowerCase()).sort().join(',');
      const incomingTags = (incoming.tags || []).map((t) => t.trim().toLowerCase()).sort().join(',');
      const tagDiff = incoming.tags !== undefined && existingTags !== incomingTags;

      const exampleDiff = (existing.example || '').trim() !== (incoming.example || '').trim();
      const exampleTransDiff =
        (existing.exampleTranslation || '').trim() !== (incoming.exampleTranslation || '').trim();

      const hasDiscrepancy = frontDiff || backDiff || tagDiff || exampleDiff || exampleTransDiff;

      if (hasDiscrepancy) {
        conflicts.push({
          id: `conflict-${i}-${Date.now()}`,
          existingCard: existing,
          incomingCard: incoming,
          decision: 'keep',
        });
      }
    } else if (
      (normFront && seenIncomingFronts.has(normFront)) ||
      (normBack && seenIncomingBacks.has(normBack))
    ) {
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
 * Resolves duplicate conflicts, preserving FSRS learning progress and protecting tags 
 * from accidental blank overwrites.
 */
export function resolveDuplicates(
  conflicts: DuplicateConflict[],
  newCards: Flashcard[]
): ResolveDuplicatesResult {
  const cardsToUpdate: Flashcard[] = [];
  let overwrittenCount = 0;
  let keptCount = 0;

  for (const conflict of conflicts) {
    if (conflict.decision === 'overwrite') {
      overwrittenCount++;

      const incomingTags = conflict.incomingCard.tags;
      const existingTags = conflict.existingCard.tags || [];

      // Safe tag resolution:
      // - If incomingTags is undefined (blank cell), keep existing tags.
      // - If user explicitly wrote 'none' or 'clear', wipe tags to [].
      // - Otherwise, apply the new tags.
      let resolvedTags = existingTags;
      if (incomingTags !== undefined) {
        if (
          incomingTags.length === 1 &&
          ['none', 'clear', '-', '[none]'].includes(incomingTags[0].toLowerCase())
        ) {
          resolvedTags = [];
        } else {
          resolvedTags = incomingTags;
        }
      }

      cardsToUpdate.push({
        ...conflict.existingCard, // Preserves ID, FSRS states, intervals, repetition counts, and due dates
        front: conflict.incomingCard.front.trim(),
        back: conflict.incomingCard.back.trim(),
        tags: resolvedTags,
        example: conflict.incomingCard.example?.trim() || conflict.existingCard.example,
        exampleTranslation:
          conflict.incomingCard.exampleTranslation?.trim() ||
          conflict.existingCard.exampleTranslation,
        lang: conflict.incomingCard.lang || conflict.existingCard.lang,
        modifiedAt: Date.now(),
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