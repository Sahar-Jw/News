'use client';
import { DocumentsBrowser } from '@/components/site/documents-browser';

/** P4: decisions, circulars, laws and guides. Studies, reports and the rest live in the Library (/library). */
export default function DocumentsPage() {
  return <DocumentsBrowser base="/documents" kinds={['circular', 'decision', 'law', 'guide']} scope="official" title="doc.title" />;
}
