import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (value: string) => `'${value.replace(/'/g, "''")}'`;

const pageLinks = (navigation: { labelAr: string; labelEn: string; href: string }[], footer: { labelAr: string; labelEn: string; href: string }[]) =>
  JSON.stringify({ navigation, footer });

const expoLinks = pageLinks([
  { labelAr: 'الرئيسية', labelEn: 'Home', href: '/expo' },
  { labelAr: 'عن المعرض', labelEn: 'About', href: '/expo#about' },
  { labelAr: 'العارضون', labelEn: 'Exhibitors', href: '/expo/exhibitors' },
  { labelAr: 'البرنامج', labelEn: 'Programme', href: '/expo/programme' },
  { labelAr: 'الرعاة', labelEn: 'Sponsors', href: '/expo#sponsors' },
  { labelAr: 'الأخبار', labelEn: 'News', href: '/expo/news' },
  { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQs', href: '/expo/faq' },
  { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/expo/contact' },
], [
  { labelAr: 'عن المعرض', labelEn: 'About the expo', href: '/expo#about' },
  { labelAr: 'العارضون', labelEn: 'Exhibitors', href: '/expo/exhibitors' },
  { labelAr: 'البرنامج', labelEn: 'Programme', href: '/expo/programme' },
  { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQs', href: '/expo/faq' },
  { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/expo/contact' },
]);

const womenLinks = pageLinks([
  { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
  { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
  { labelAr: 'الاجتماعات والزيارات', labelEn: 'Meetings & visits', href: '/committees/women#meetings' },
  { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
  { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
], [
  { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
  { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
  { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
  { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
]);

const ADMIN_PERMISSIONS = [
  'nav.read', 'nav.update', 'footer.read', 'footer.update',
  'occasions.read',
  'expo.read', 'expo.create', 'expo.update', 'expo.delete',
  'expo.applications.read', 'expo.applications.update', 'expo.applications.export', 'expo.applications.delete',
  'faqs.read', 'faqs.create', 'faqs.update', 'faqs.delete',
  'committees.read', 'committees.create', 'committees.update', 'committees.delete',
];

export class RestoreSiteSettingsEditors1764400000000 implements MigrationInterface {
  name = 'RestoreSiteSettingsEditors1764400000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "permissions" ("code", "module", "name_ar", "name_en")
      VALUES ('occasions.read', 'occasions', 'عرض جدول المناسبات', 'View occasions table')
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "restore_site_settings_editor_grants" (
        "role_id" bigint NOT NULL,
        "permission_id" bigint NOT NULL,
        PRIMARY KEY ("role_id", "permission_id")
      )
    `);
    await r.query(`
      INSERT INTO "restore_site_settings_editor_grants" ("role_id", "permission_id")
      SELECT ro."id", p."id"
      FROM "roles" ro
      JOIN "permissions" p ON p."code" IN (${ADMIN_PERMISSIONS.map(q).join(', ')})
      WHERE ro."code" = 'administrator'
        AND NOT EXISTS (
          SELECT 1 FROM "role_permissions" rp
          WHERE rp."role_id" = ro."id" AND rp."permission_id" = p."id"
        )
    `);
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('expo', 'header_color', '#3b155f', 'color', now()),
        ('expo', 'footer_color', '#2d1049', 'color', now()),
        ('expo', 'background_color', '#faf8fc', 'color', now()),
        ('expo', 'text_color', '#1f2937', 'color', now()),
        ('expo', 'floor_plan_ar', NULL, 'text', now()),
        ('expo', 'floor_plan_en', NULL, 'text', now()),
        ('expo', 'footer_text_ar', NULL, 'text', now()),
        ('expo', 'footer_text_en', NULL, 'text', now()),
        ('expo', 'page_links', ${q(expoLinks)}, 'json', now()),
        ('women', 'footer_text_ar', NULL, 'text', now()),
        ('women', 'footer_text_en', NULL, 'text', now()),
        ('women', 'page_links', ${q(womenLinks)}, 'json', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);

    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT "role_id", "permission_id", now()
      FROM "restore_site_settings_editor_grants"
      ON CONFLICT DO NOTHING
    `);

    await r.query(`
      WITH target_group AS (
        SELECT ng."id"
        FROM "nav_groups" ng
        JOIN "nav_items" ni ON ni."group_id" = ng."id"
        WHERE ni."url" IN ('/occasions/upcoming', '/occasions/previous')
        ORDER BY ng."id"
        LIMIT 1
      ),
      additions ("sort_order", "title_ar", "title_en", "url") AS (
        VALUES
          (1, 'المناسبات الحالية', 'Current occasions', '/occasions/current'),
          (2, 'المعارض', 'Exhibitions', '/occasions/exhibitions')
      )
      INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order")
      SELECT tg."id", a."title_ar", a."title_en", a."url",
             COALESCE((SELECT MAX(ni."sort_order") FROM "nav_items" ni WHERE ni."group_id" = tg."id"), 0) + a."sort_order"
      FROM target_group tg
      CROSS JOIN additions a
      WHERE NOT EXISTS (
        SELECT 1 FROM "nav_items" ni WHERE ni."url" = a."url"
      )
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      DELETE FROM "role_permissions"
      WHERE ("role_id", "permission_id") IN (
        SELECT "role_id", "permission_id" FROM "restore_site_settings_editor_grants"
      )
    `);
    await r.query(`DROP TABLE "restore_site_settings_editor_grants"`);
  }
}
