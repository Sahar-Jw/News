import { MigrationInterface, QueryRunner } from 'typeorm';

type OldPage = { labelAr: string; labelEn: string; href: string; isActive?: boolean };
type NewPage = { type: 'page'; slug: string; labelAr: string; labelEn: string; isActive: boolean; newTab: false; bodyAr?: string; bodyEn?: string };
type Entry = NewPage | { type: 'dropdown'; titleAr: string; titleEn: string; isActive: boolean; items: NewPage[] };

function transform(list: unknown): Entry[] | null {
  if (!Array.isArray(list) || !list.some((item) => item && typeof item === 'object' && 'href' in item)) return null;
  const pages = list.flatMap((raw): NewPage[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as OldPage;
    if (typeof item.href !== 'string' || typeof item.labelAr !== 'string' || typeof item.labelEn !== 'string') return [];
    const path = item.href.split('#')[1] || item.href.split('/').pop() || '';
    const slug = path === 'about' ? 'about'
      : path === 'news' ? 'news'
        : path === 'media' ? 'media'
        : path === 'contact' ? 'contact'
          : path === 'archive' ? 'archive'
            : /^[a-z0-9-]{1,60}$/.test(path) ? path : 'page';
    return [{
      type: 'page', slug, labelAr: item.labelAr, labelEn: item.labelEn,
      isActive: item.isActive !== false, newTab: false,
      ...(['home', 'about', 'organization', 'initiatives', 'activities', 'success', 'news', 'archive', 'media', 'contact'].includes(slug)
        ? {} : { bodyAr: '', bodyEn: '' }),
    }];
  });
  const standalone = pages.filter((page) => ['news', 'contact', 'archive'].includes(page.slug));
  const grouped = pages.filter((page) => !['news', 'contact', 'archive'].includes(page.slug));
  return [
    ...(grouped.length ? [{ type: 'dropdown', titleAr: 'عن اللجنة', titleEn: 'About the committee', isActive: true, items: grouped } as const] : []),
    ...standalone,
  ];
}

export class WomenPageMenus1764900000000 implements MigrationInterface {
  name = 'WomenPageMenus1764900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: number; value: string | null }[] = await queryRunner.query(`
      SELECT "id", "value" FROM "site_settings"
      WHERE "category" = 'women' AND "key" = 'page_links'
    `);
    for (const row of rows) {
      if (!row.value) continue;
      const saved = JSON.parse(row.value) as { navigation?: unknown; footer?: unknown };
      const navigation = transform(saved.navigation);
      const footer = transform(saved.footer);
      if (!navigation && !footer) continue;
      await queryRunner.query(`
        UPDATE "site_settings" SET "value" = $1, "updated_at" = now() WHERE "id" = $2
      `, [JSON.stringify({
        navigation: navigation ?? saved.navigation,
        footer: footer ?? saved.footer,
      }), row.id]);
    }
  }

  async down(): Promise<void> {}
}
