'use client';
import { DocumentsBrowser } from '@/components/site/documents-browser';

/** P17: the library and digital archive: every kind of document in one searchable list (type, date range, issuer). */
export default function LibraryPage() {
  return <DocumentsBrowser base="/library" kinds={['study', 'report', 'bulletin', 'guide', 'law', 'decision', 'circular', 'form', 'historical', 'library']} title="nav.library" />;
}
