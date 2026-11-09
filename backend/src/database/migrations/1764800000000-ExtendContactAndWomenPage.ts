import { MigrationInterface, QueryRunner } from 'typeorm';

const esc = (value: string) => `'${value.replace(/'/g, "''")}'`;

const SETTINGS: [string, string, string, string | null][] = [
  ['contact', 'title_ar', 'text', 'تواصل معنا'],
  ['contact', 'title_en', 'text', 'Contact us'],
  ['contact', 'subtitle_ar', 'text', 'يسعدنا استقبال استفساراتكم ومقترحاتكم'],
  ['contact', 'subtitle_en', 'text', 'We welcome your questions and suggestions'],
  ['contact', 'show_form', 'boolean', 'true'],
  ['women', 'vision_ar', 'text', null], ['women', 'vision_en', 'text', null],
  ['women', 'mission_ar', 'text', null], ['women', 'mission_en', 'text', null],
  ['women', 'goals_ar', 'text', null], ['women', 'goals_en', 'text', null],
  ['women', 'structure_ar', 'text', null], ['women', 'structure_en', 'text', null],
  ['women', 'news_category_ar', 'text', 'سيدات الأعمال'], ['women', 'news_category_en', 'text', 'Businesswomen'],
  ['women', 'contact_phone', 'text', null], ['women', 'contact_email', 'text', null], ['women', 'contact_website', 'url', null],
  ['women', 'social_facebook_url', 'url', null], ['women', 'social_x_url', 'url', null],
  ['women', 'social_instagram_url', 'url', null], ['women', 'social_linkedin_url', 'url', null],
  ['women', 'social_youtube_url', 'url', null], ['women', 'social_whatsapp_url', 'url', null],
  ['women', 'social_telegram_url', 'url', null],
];

const OLD_WOMEN_LINKS = JSON.stringify({
  navigation: [
    { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
    { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
    { labelAr: 'الاجتماعات والزيارات', labelEn: 'Meetings & visits', href: '/committees/women#meetings' },
    { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
    { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
  ],
  footer: [
    { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
    { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
    { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
    { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
  ],
});

const WOMEN_LINKS = JSON.stringify({
  navigation: [
    { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
    { labelAr: 'الهيكلية التنظيمية', labelEn: 'Organization', href: '/committees/women#organization' },
    { labelAr: 'المبادرات والمشاريع', labelEn: 'Initiatives & projects', href: '/committees/women#initiatives' },
    { labelAr: 'الأنشطة والفعاليات', labelEn: 'Activities & events', href: '/committees/women#activities' },
    { labelAr: 'قصص النجاح', labelEn: 'Success stories', href: '/committees/women#success' },
    { labelAr: 'الأخبار', labelEn: 'News', href: '/committees/women#news' },
    { labelAr: 'الأرشيف', labelEn: 'Archive', href: '/committees/women#archive' },
    { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/committees/women#contact' },
    { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
  ],
  footer: [
    { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
    { labelAr: 'الهيكلية التنظيمية', labelEn: 'Organization', href: '/committees/women#organization' },
    { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
    { labelAr: 'قصص النجاح', labelEn: 'Success stories', href: '/committees/women#success' },
    { labelAr: 'الأرشيف', labelEn: 'Archive', href: '/committees/women#archive' },
    { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/committees/women#contact' },
    { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
  ],
});

export class ExtendContactAndWomenPage1764800000000 implements MigrationInterface {
  name = 'ExtendContactAndWomenPage1764800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = SETTINGS.map(([category, key, type, value]) =>
      `(${esc(category)}, ${esc(key)}, ${value === null ? 'NULL' : esc(value)}, ${esc(type)}, now())`,
    );
    await queryRunner.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${rows.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE "site_settings"
      SET "value" = $1, "updated_at" = now()
      WHERE "category" = 'women' AND "key" = 'page_links' AND "value" = $2
    `, [WOMEN_LINKS, OLD_WOMEN_LINKS]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "site_settings"
      WHERE ("category", "key") IN (${SETTINGS.map(([category, key]) => `(${esc(category)}, ${esc(key)})`).join(', ')})
    `);
  }
}
