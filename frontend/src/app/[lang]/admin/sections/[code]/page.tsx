import { SECTIONS } from '@/lib/utils';
import SectionClient from './client';

export const dynamicParams = false;
export function generateStaticParams() {
  return SECTIONS.map((code) => ({ code }));
}

export default async function SectionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SectionClient code={code} />;
}
