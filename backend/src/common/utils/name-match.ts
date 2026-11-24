/**
 * Forgiving name matching for Arabic (and English) names, used to find
 *  - the news that mention a board member / committee member / committee (shown on their detail pages), and
 *  - the committees a person belongs to (names typed a little differently in two places).
 * Nobody has to type a name exactly as it is saved: spelling variants (hamza, ya, ta marbuta, diacritics), titles (Dr. / Eng.), the
 * article "ال", "عبد الله" written as one or two words and a missing middle name are all ignored.
 *
 * A person is "in" a text when, after that clean-up, ANY of these holds (n = number of name parts):
 *   1. the first and the last name appear in this order, close together (at most 2 other words between them);
 *   2. the first and the third name appear in this order, close together (people who write "محمد ... خالد");
 *   3. at least 3 of his / her name parts appear within a short stretch of the text.
 * A single-part name never matches (too many people share it), unless it is long (5+ letters).
 * A committee is "in" a text when all its distinctive words appear close together ("لجنة" / "قطاع" alone are not distinctive).
 */

const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
/** letters that are written in several ways: the same letter on the left and on the right, in JS and in SQL (see sqlNormalized) */
export const FOLD_FROM = 'أإآٱىةؤئ';
export const FOLD_TO = 'اااايهوي';
const FOLD: Record<string, string> = Object.fromEntries([...FOLD_FROM].map((c, i) => [c, FOLD_TO[i]]));

export function normalizeText(v: unknown): string {
  return String(v ?? '').normalize('NFC').replace(DIACRITICS, '').replace(/[أإآٱىةؤئ]/g, (c) => FOLD[c]).toLowerCase();
}

const TITLES = new Set([
  'د', 'دكتور', 'دكتوره', 'الدكتور', 'الدكتوره', 'م', 'مهندس', 'مهندسه', 'المهندس', 'المهندسه', 'استاذ', 'استاذه', 'الاستاذ', 'الاستاذه', 'السيد', 'السيده', 'الشيخ', 'الحاج', 'الحاجه',
  'سعاده', 'معالي', 'عطوفه', 'المحامي', 'المحاميه', 'رئيس', 'نائب', 'dr', 'eng', 'mr', 'mrs', 'ms', 'miss', 'prof', 'sir', 'sheikh', 'hajj',
]);
/** "son of" words between names */
const CONNECTORS = new Set(['بن', 'ابن', 'بنت', 'ابنه', 'bin', 'ibn', 'bint']);
/** words that start a compound name together with the next word: عبد الله = عبدالله */
const COMPOUND = new Set(['عبد', 'ابو', 'ام', 'abd', 'abu']);

/** clean word list of a name or a text: lower-case, folded letters, no titles / connectors, compound names joined, no "ال" prefix */
export function canonTokens(v: unknown): string[] {
  const raw = normalizeText(v).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    let w = raw[i];
    if (TITLES.has(w) || CONNECTORS.has(w)) continue;
    if (COMPOUND.has(w) && i + 1 < raw.length) w += raw[++i].replace(/^ال(?=.{3,})/, '');
    else {
      if (w.length > 5 && w.startsWith('وال')) w = w.slice(1); // "والمواصلات" (and the transport) -> "المواصلات"
      if (w.length > 4 && w.startsWith('ال')) w = w.slice(2);
    }
    if (w.length >= 2 && w !== 'ال') out.push(w);
  }
  return out;
}

/** positions of each word of a text, to look up quickly */
export function indexTokens(text: string[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  text.forEach((w, i) => { const a = m.get(w); if (a) a.push(i); else m.set(w, [i]); });
  return m;
}

/** do word `a` and, after it, word `b` appear with at most `gap` other words between them? */
function near(ix: Map<string, number[]>, a: string, b: string, gap: number): boolean {
  const pa = ix.get(a), pb = ix.get(b);
  if (!pa || !pb) return false;
  return pa.some((x) => pb.some((y) => y > x && y - x - 1 <= gap));
}

/** does a person (clean name words) appear in a text (clean text words)? see the rules at the top of the file */
export function personInText(name: string[], ix: Map<string, number[]>): boolean {
  const n = name.length;
  if (n === 0) return false;
  if (n === 1) return name[0].length >= 5 && ix.has(name[0]);
  if (near(ix, name[0], name[n - 1], 2)) return true; // first + last
  if (n >= 4 && near(ix, name[0], name[2], 2)) return true; // first + third
  // 3 or more different parts of the name within a short stretch
  const at = new Map<number, string>();
  for (const w of new Set(name)) for (const p of ix.get(w) ?? []) at.set(p, w);
  const pos = [...at.keys()].sort((x, y) => x - y);
  const window = n + 2;
  for (let s = 0; s < pos.length; s++) {
    const distinct = new Set<string>();
    for (let e = s; e < pos.length && pos[e] - pos[s] < window; e++) distinct.add(at.get(pos[e])!);
    if (distinct.size >= 3) return true;
  }
  return false;
}

/** Are two written names the same person? (a committee member typed slightly differently from the board member) */
export function sameName(a: unknown, b: unknown): boolean {
  const A = canonTokens(a), B = canonTokens(b);
  if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return A.join('').length >= 4;
  if (A.length < 2 || B.length < 2) return false;
  const first = A[0] === B[0], last = A[A.length - 1] === B[B.length - 1];
  if (first && last) return true; // same first and last name, whatever is between
  if (first && A.slice(1).filter((w) => B.slice(1).includes(w)).length >= 2) return true; // same first name and 2 more parts
  const mid = (X: string[]) => X.slice(1, -1);
  if (last && A.length >= 3 && B.length >= 3 && mid(A).filter((w) => mid(B).includes(w)).length >= 2) return true; // same family and 2 middle parts
  return false;
}

// ---------------------------------------------------------------- committees
const GENERIC = new Set(['لجنه', 'لجان', 'قطاع', 'قطاعات', 'committee', 'committees', 'sector', 'sectors', 'the', 'of', 'and', 'for', 'in', 'chamber', 'غرفه', 'دمشق']);

/** the distinctive words of a committee name ("لجنة الصناعة" -> صناعه) */
export function committeeWords(name: unknown): string[] {
  return [...new Set(canonTokens(name).filter((w) => !GENERIC.has(w)))];
}

/** is a committee named in a text? All its distinctive words close together; a single distinctive word needs "لجنة" / "قطاع" next to it. */
export function committeeInText(words: string[], ix: Map<string, number[]>): boolean {
  if (!words.length) return false;
  if (words.length === 1) {
    const w = words[0];
    if (w.length < 4) return false;
    return (ix.get(w) ?? []).some((p) => [...GENERIC].some((g) => ix.get(g)?.some((q) => Math.abs(q - p) <= 2)));
  }
  const at = new Map<number, string>();
  for (const w of words) for (const p of ix.get(w) ?? []) at.set(p, w);
  const pos = [...at.keys()].sort((a, b) => a - b);
  for (let s = 0; s < pos.length; s++) {
    const distinct = new Set<string>();
    for (let e = s; e < pos.length && pos[e] - pos[s] < words.length + 3; e++) distinct.add(at.get(pos[e])!);
    if (distinct.size === words.length) return true;
  }
  return false;
}

// ---------------------------------------------------------------- one thing to look for
export type Matcher = { kind: 'person'; words: string[] } | { kind: 'committee'; words: string[] };
export const personMatcher = (name: unknown): Matcher | null => { const w = canonTokens(name); return w.length >= 2 || (w.length === 1 && w[0].length >= 5) ? { kind: 'person', words: w } : null; };
export const committeeMatcher = (name: unknown): Matcher | null => { const w = committeeWords(name); return w.length ? { kind: 'committee', words: w } : null; };

export function textMatches(matchers: Matcher[], text: string): boolean {
  const tokens = canonTokens(text);
  const ix = indexTokens(tokens);
  return matchers.some((m) => (m.kind === 'person' ? personInText(m.words, ix) : committeeInText(m.words, ix)));
}

/** "<p>Hello&nbsp;world</p>" -> "Hello world" */
export const htmlToPlain = (h: unknown) => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ');

/**
 * A cheap database filter that keeps every text a matcher could accept (and some it will refuse: the exact check is textMatches):
 * a regular expression "any two of the words" per person, "any of the words" per committee. `col` is already normalised (sqlNormalized).
 */
export function candidateRegex(matchers: Matcher[]): string | null {
  const alts: string[] = [];
  for (const m of matchers) {
    const w = [...new Set(m.words)].filter((x) => /^[\p{L}\p{N}]+$/u.test(x));
    if (!w.length) continue;
    if (w.length === 1) { alts.push(w[0]); continue; }
    if (m.kind === 'committee') { alts.push(`${w[0]}.*${w[1]}`, `${w[1]}.*${w[0]}`); continue; }
    for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) if (i !== j) alts.push(`${w[i]}.*${w[j]}`);
  }
  return alts.length ? alts.join('|') : null;
}

/** SQL that normalises a text column the way normalizeText does (no diacritics, folded letters, lower case) */
export const sqlNormalized = (expr: string) =>
  `translate(lower(regexp_replace(${expr}, '[\\u064B-\\u065F\\u0670\\u0640]', '', 'g')), '${FOLD_FROM}', '${FOLD_TO}')`;
