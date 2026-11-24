'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { NewsFormDialog } from '@/components/admin/news-form';
import { ExpoAdmin } from '@/components/admin/expo-admin';
import { ManageBtn, ManageLink, PageManageBar } from './page-manage-bar';

const TAB = (tab: string) => `/admin/settings?page=expo&tab=${tab}`;
const TEXT_TABS = ['about', 'sectors', 'info', 'contact'];

/**
 * Control buttons at the top of the public EXPO pages, for the people who hold the permission (visitors see nothing).
 * The buttons follow the page that is open (exhibitors page: add / manage exhibitors ...); the home page lists the quick adds.
 */
export function ExpoManageBar() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const pathname = usePathname() ?? '';
  const [adding, setAdding] = useState(false);
  const [addKind, setAddKind] = useState<'exhibitor' | 'sponsor' | 'session' | null>(null);
  const ar = lang === 'ar';
  const slug = pathname.replace(/\/+$/, '').split('/expo')[1]?.replace(/^\//, '') || 'home';
  const mayRead = can('expo.read'), mayCreate = can('expo.create'), mayApps = can('expo.applications.read');
  const maySettings = can('settings.read'), mayNews = can('news.create'), mayFaq = can('faqs.read');
  const home = slug === 'home';

  const kinds: [string, string, 'exhibitor' | 'sponsor' | 'session'][] = [['exhibitors', 'عارض', 'exhibitor'], ['sponsors', 'راعٍ / شريك', 'sponsor'], ['programme', 'جلسة', 'session']];
  const tabKey = (k: string) => (k === 'programme' ? 'sessions' : k);
  const show = mayRead || mayCreate || mayApps || maySettings || mayNews || mayFaq;
  const label = (k: string) => ({ exhibitors: ar ? 'العارضين' : 'exhibitors', sponsors: ar ? 'الرعاة' : 'sponsors', programme: ar ? 'البرنامج' : 'programme' }[k] ?? k);

  return (
    <PageManageBar show={show} settingsUrl={mayRead ? TAB('exhibitors') : maySettings ? TAB('identity') : undefined}>
      {kinds.filter(([k]) => mayCreate && (home || slug === k)).map(([k, name, en]) => (
        <ManageBtn key={`add-${k}`} onClick={() => setAddKind(en)}>＋ {ar ? `إضافة ${name}` : `Add ${en}`}</ManageBtn>
      ))}
      {kinds.filter(([k]) => mayRead && (home || slug === k)).map(([k]) => (
        <ManageLink key={`list-${k}`} to={TAB(tabKey(k))}>▤ {ar ? `إدارة ${label(k)}` : `Manage ${label(k)}`}</ManageLink>
      ))}
      {mayApps && (home || slug === 'register' || slug === 'exhibitors') && <ManageLink to={TAB('applications')}>📥 {ar ? 'طلبات المشاركة' : 'Participation requests'}</ManageLink>}
      {mayNews && (home || slug === 'news') && <ManageBtn onClick={() => setAdding(true)}>＋ {ar ? 'إضافة خبر' : 'Add news'}</ManageBtn>}
      {mayFaq && slug === 'faq' && <ManageLink tone="solid" to={TAB('faqs')}>❓ {ar ? 'إدارة الأسئلة' : 'Manage FAQs'}</ManageLink>}
      {maySettings && TEXT_TABS.includes(slug) && <ManageLink tone="solid" to={TAB(slug)}>✎ {ar ? 'تعديل نص الصفحة' : 'Edit page text'}</ManageLink>}
      {maySettings && home && <ManageLink to={TAB('identity')}>🎨 {ar ? 'الهوية والمظهر' : 'Identity & theme'}</ManageLink>}
      {maySettings && home && <ManageLink to={TAB('links')}>☰ {ar ? 'القائمة والتذييل' : 'Navigation & footer'}</ManageLink>}
      {adding && <NewsFormDialog category="expo" onClose={() => setAdding(false)} />}
      {/* the add form opens right here; the page's lists reload when it is saved */}
      {addKind && <ExpoAdmin kind={addKind} quick={{ onClose: () => setAddKind(null) }} />}
    </PageManageBar>
  );
}
