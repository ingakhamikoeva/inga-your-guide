/**
 * Helpers for using the user's name in Inga's messages.
 *
 * Rules:
 * - Use only the nominative form (no automatic declension).
 * - If the name is missing/empty, fall back to a neutral phrase without the name.
 * - Use sparingly: at most once per semantic block.
 */

export function cleanName(name?: string | null): string {
  if (!name) return '';
  return name.trim().slice(0, 40);
}

export function hasName(name?: string | null): boolean {
  return cleanName(name).length > 0;
}

/**
 * Returns "{name}, {rest}" if name is provided, otherwise just "{rest}"
 * with the first letter capitalized.
 */
export function withName(name: string | undefined | null, rest: string): string {
  const n = cleanName(name);
  if (!n) {
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return `${n}, ${rest}`;
}

/**
 * Greeting variant: "Приятно познакомиться, {name} 💛"
 */
export function niceToMeet(name: string | undefined | null): string {
  const n = cleanName(name);
  if (!n) return 'Приятно познакомиться 💛';
  return `Приятно познакомиться, ${n} 💛`;
}
