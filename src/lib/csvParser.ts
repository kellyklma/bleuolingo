import { Flashcard } from '../types';
import { parseTags } from './tagUtils';

/**
 * Parses CSV/TSV text into rows of columns, taking quotes into account.
 */
export function parseCSVText(rawText: string): string[][] {
  const lines: string[][] = [];
  const trimmed = rawText.trim();
  if (!trimmed) return lines;

  // Determine delimiter: tab or comma or semicolon
  const firstLine = trimmed.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Converts parsed spreadsheet rows into Flashcard objects.
 * Expects Front and Back columns (from CSV/TSV or Excel paste), plus optional Tags column.
 */
export function convertRowsToFlashcards(
  rows: string[][],
  defaultLang = 'fr-FR'
): { cards: Flashcard[]; errors: string[] } {
  if (!rows || rows.length === 0) {
    return { cards: [], errors: ['No rows found in spreadsheet.'] };
  }

  const errors: string[] = [];
  const cards: Flashcard[] = [];

  // Check if first row is a header
  const headerRow = rows[0].map((h) => h.toLowerCase());
  const hasHeader = headerRow.some((h) =>
    ['front', 'word', 'term', 'question', 'prompt', 'target', 'back', 'definition', 'meaning', 'translation', 'answer', 'tags', 'tag'].includes(h)
  );

  let frontIdx = 0;
  let backIdx = 1;
  let exampleIdx = -1;
  let tagsIdx = -1;

  if (hasHeader) {
    frontIdx = headerRow.findIndex((h) =>
      ['front', 'word', 'term', 'prompt', 'question', 'target', 'vocab'].some((k) => h.includes(k))
    );
    if (frontIdx === -1) frontIdx = 0;

    backIdx = headerRow.findIndex((h) =>
      ['back', 'definition', 'meaning', 'translation', 'answer', 'english'].some((k) => h.includes(k))
    );
    if (backIdx === -1) backIdx = frontIdx === 0 ? 1 : 0;

    exampleIdx = headerRow.findIndex((h) =>
      ['example', 'sentence', 'context', 'notes'].some((k) => h.includes(k))
    );

    tagsIdx = headerRow.findIndex((h) =>
      ['tags', 'tag', 'category', 'categories', 'label', 'labels'].some((k) => h.includes(k))
    );
  } else {
    // If no header and has 3 or more columns, column 2 might be tags or example
    if (rows[0].length >= 3) {
      tagsIdx = 2;
    }
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;

  dataRows.forEach((row, index) => {
    const front = row[frontIdx]?.trim();
    const back = row[backIdx]?.trim();

    if (!front || !back) {
      if (row.filter(Boolean).length > 0) {
        errors.push(`Row ${index + (hasHeader ? 2 : 1)} skipped: Missing front or back column.`);
      }
      return;
    }

    const example = exampleIdx !== -1 ? row[exampleIdx]?.trim() : undefined;
    const rawTags = tagsIdx !== -1 ? row[tagsIdx]?.trim() : undefined;
    const parsedTags = rawTags ? parseTags(rawTags) : undefined;

    const now = Date.now();
    cards.push({
      id: `custom-${now}-${Math.random().toString(36).slice(2, 7)}`,
      front: front.toLowerCase(),
      back: back.toLowerCase(),
      tags: parsedTags && parsedTags.length > 0 ? parsedTags : undefined,
      example: example ? example.toLowerCase() : undefined,
      lang: defaultLang,
      createdAt: now,
      modifiedAt: now,
      state: 'new',
      stability: 0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      due: now,
    });
  });

  return { cards, errors };
}

/**
 * Generates and triggers download of a 3-column Front, Back, Tags sample CSV template
 */
export function downloadSampleCSV(): void {
  const link = document.createElement('a');
  link.href = `${import.meta.env.BASE_URL}bleuolingo_sample_cards.csv`;
  link.setAttribute('download', 'bleuolingo_sample_cards.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Extracts a list of clean vocabulary words from CSV or pasted text
 */
export function extractWordsFromCSV(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const rows = parseCSVText(trimmed);
  if (rows.length === 0) return [];

  const firstRow = rows[0].map((c) => c.toLowerCase());
  const headerWords = ['word', 'words', 'term', 'terms', 'vocab', 'vocabulary', 'target', 'front', 'item', 'french', 'spanish', 'german', 'japanese'];
  const hasHeader = firstRow.some((c) => headerWords.includes(c));

  let wordColIdx = 0;
  if (hasHeader) {
    wordColIdx = firstRow.findIndex((c) => headerWords.some((hw) => c.includes(hw)));
    if (wordColIdx === -1) wordColIdx = 0;
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const wordSet = new Set<string>();

  dataRows.forEach((row) => {
    // Check target column first
    const cell = row[wordColIdx]?.trim();
    if (cell) {
      // In case user entered comma-separated words in one cell or row
      if (row.length === 1 && cell.includes(',')) {
        cell.split(',').forEach((w) => {
          const clean = w.trim().replace(/^["']|["']$/g, '');
          if (clean && clean.length > 0 && !headerWords.includes(clean.toLowerCase())) {
            wordSet.add(clean);
          }
        });
      } else {
        const clean = cell.replace(/^["']|["']$/g, '');
        if (clean && clean.length > 0 && !headerWords.includes(clean.toLowerCase())) {
          wordSet.add(clean);
        }
      }
    }
  });

  return Array.from(wordSet);
}

/**
 * Exports current flashcard deck to a clean UTF-8 CSV file
 */
export function exportDeckToCSV(cards: Flashcard[], filename: string = 'bleuolingo_deck.csv'): void {
  const headers = ['Front', 'Back', 'Tags'];
  const rows = cards.map((c) => {
    const front = `"${(c.front || '').replace(/"/g, '""')}"`;
    const back = `"${(c.back || '').replace(/"/g, '""')}"`;
    const tags = `"${(c.tags ? c.tags.join(';') : '').replace(/"/g, '""')}"`;
    return `${front},${back},${tags}`;
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
