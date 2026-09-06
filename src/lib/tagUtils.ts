/**
 * Utility functions for handling tags separated by ';'
 */

export function parseTags(input?: string | string[]): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    // If it's already an array, flatten any strings that contain ';'
    return Array.from(
      new Set(
        input
          .flatMap((item) => item.split(';'))
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      )
    );
  }

  const str = input.trim();
  if (!str) return [];

  // Split by ';' as primary delimiter, or fallback to comma if no ';' is present
  const delimiter = str.includes(';') ? ';' : str.includes(',') ? ',' : null;
  const parts = delimiter ? str.split(delimiter) : [str];

  return Array.from(
    new Set(
      parts
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    )
  );
}

export function formatTags(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags.filter(Boolean).join(';');
}
