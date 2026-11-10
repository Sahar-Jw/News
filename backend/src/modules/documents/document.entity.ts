/** official = the "Decisions and circulars" page; the rest only appear in the Library (P17), which lists every kind. */
export const OFFICIAL_DOCUMENT_KINDS = ['circular', 'decision', 'law', 'guide'] as const;
export const DOCUMENT_KINDS = [...OFFICIAL_DOCUMENT_KINDS, 'study', 'report', 'bulletin', 'form', 'historical', 'press', 'mediakit', 'library'] as const;
/** Sub-classification inside a kind: decisions (government / commercial-economic / members) and the laws page (law / instruction / regulation). */
export const DOCUMENT_SUBTYPES = ['government', 'economic', 'members', 'law', 'instruction', 'regulation'] as const;
export const SUBTYPES_OF_KIND: Record<string, readonly string[]> = { decision: ['government', 'economic', 'members'], law: ['law', 'instruction', 'regulation'] };
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
