/** official = the "Decisions and circulars" page; the rest only appear in the Library (P17), which lists every kind. */
export const OFFICIAL_DOCUMENT_KINDS = ['circular', 'decision', 'law', 'guide'] as const;
export const DOCUMENT_KINDS = [...OFFICIAL_DOCUMENT_KINDS, 'study', 'report', 'bulletin', 'form', 'historical', 'press', 'mediakit', 'library'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
