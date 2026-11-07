import { MigrationInterface, QueryRunner } from 'typeorm';

type Pair = [key: string, sql: string];

/** `x.col` as a JSON date string (YYYY-MM-DD) */
const day = (c: string) => `to_char(${c}, 'YYYY-MM-DD')`;
/** a timestamptz as the ISO string JSON.stringify(new Date()) produces */
const iso = (c: string) => `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const img = (c: string) => `CASE WHEN ${c} IS NULL OR ${c} = '' THEN '[]'::jsonb ELSE jsonb_build_array(${c}) END`;
/** news id of the row that was copied from `table`.id = `col` (the migration marks every copied row with extra.legacy) */
const legacyId = (alias: string, table: string, col: string) => `(SELECT ${alias}.id FROM news ${alias} WHERE ${alias}.extra->'legacy'->>'t' = '${table}' AND (${alias}.extra->'legacy'->>'id')::bigint = ${col})`;

const OLD_TABLES = [
  'committee_activities', 'committee_members', 'committees', 'courses', 'trainers', 'expo_items', 'g2t_packages', 'g2t_spaces', 'services', 'documents', 'board_members', 'faqs', 'site_pages', 'incubator_projects',
];

/**
 * FAQ, static pages, documents, board, committees (+ members and activities), services, trainers, courses, expo items, Get2Trade packages / spaces / page
 * texts, membership page texts and incubator projects stop having tables of their own: every row becomes a `news` row whose main category is the type
 * (FAQ, PAGE, DOC_CIRCULAR, BOARD_MEMBER, COMMITTEE, SERVICE, COURSE ...) and whose type-specific fields live in the new JSON column `news.extra`.
 * References are re-pointed to the new news ids (course registrations, Get2Trade bookings, committee photo albums, linked news). The old tables are then dropped.
 *
 * Take a database backup first: this migration deletes the old tables and cannot be reversed by `migration:revert`.
 */
export class ContentTypesAsNews1763700000000 implements MigrationInterface {
  name = 'ContentTypesAsNews1763700000000';

  private async exists(r: QueryRunner, table: string) {
    return (await r.query(`SELECT to_regclass('public.${table}') AS t`))[0].t !== null;
  }

  /** INSERT INTO news ... SELECT from an old table (rows keep their order, created_at / updated_at and a legacy marker used to re-point references) */
  private async copy(r: QueryRunner, o: { table: string; alias: string; code: string; title: string; body?: string; images?: string; pdf?: string; x: Pair[]; join?: string }) {
    if (!(await this.exists(r, o.table))) return;
    const a = o.alias;
    const pairs: Pair[] = [['legacy', `jsonb_build_object('t', '${o.table}', 'id', ${a}.id)`], ...o.x];
    const obj = pairs.map(([k, v]) => `'${k}', ${v}`).join(', ');
    // jsonb_build_object takes at most 100 arguments; the widest type has about 30 keys
    await r.query(`
      INSERT INTO news (created_at, updated_at, title, main_category, body, images, pdf, topics, publish_at, extra)
      SELECT ${a}.created_at, ${a}.updated_at, ${o.title}, ${o.code}, ${o.body ?? 'NULL'}, ${o.images ?? `'[]'::jsonb`}, ${o.pdf ?? 'NULL'}, '[]'::jsonb, now(), jsonb_strip_nulls(jsonb_build_object(${obj}))
      FROM ${o.table} ${a} ${o.join ?? ''}
      ORDER BY ${a}.id
    `);
  }

  private async dropFks(r: QueryRunner, table: string, refTable: string) {
    if (!(await this.exists(r, table)) || !(await this.exists(r, refTable))) return;
    const rows = await r.query(`SELECT conname FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND confrelid = 'public.${refTable}'::regclass AND contype = 'f'`);
    for (const { conname } of rows) await r.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`);
  }

  private async addFk(r: QueryRunner, table: string, name: string, column: string, onDelete: 'CASCADE' | 'SET NULL') {
    const has = (await r.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [name])).length > 0;
    if (!has) await r.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "news" ("id") ON DELETE ${onDelete}`);
  }

  /** column `col` of `table` held an old id of `oldTable`: make it the news id of the copied row (two steps, so a unique index never sees a half-moved state) */
  private async repoint(r: QueryRunner, table: string, col: string, oldTable: string, extraWhere = '') {
    const map = (alias: string) => legacyId(alias, oldTable, `t.${col}`);
    await r.query(`UPDATE "${table}" t SET "${col}" = -${map('n')} WHERE t."${col}" IS NOT NULL AND ${map('m')} IS NOT NULL ${extraWhere}`);
    await r.query(`UPDATE "${table}" t SET "${col}" = -t."${col}" WHERE t."${col}" < 0 ${extraWhere}`);
  }

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "extra" jsonb`);
    await r.query(`ALTER TABLE "news" ALTER COLUMN "title" TYPE varchar(500)`);
    await r.query(`ALTER TABLE "news" ALTER COLUMN "pdf" TYPE varchar(500)`);

    // ---------------------------------------------------------------- copy (parents before children)
    await this.copy(r, { table: 'faqs', alias: 'f', code: `'FAQ'`, title: 'f.question_ar', body: 'f.answer_ar', x: [['scope', 'f.scope'], ['questionEn', 'f.question_en'], ['answerEn', 'f.answer_en'], ['sortOrder', 'f.sort_order'], ['isActive', 'f.is_active']] });
    await this.copy(r, { table: 'site_pages', alias: 'p', code: `'PAGE'`, title: 'p.title_ar', body: 'p.body_ar', x: [['slug', 'p.slug'], ['titleEn', 'p.title_en'], ['bodyEn', 'p.body_en'], ['sortOrder', 'p.sort_order'], ['isActive', 'p.is_active'], ['showInFooter', 'p.show_in_footer']] });
    await this.copy(r, { table: 'documents', alias: 'd', code: `'DOC_' || upper(d.kind)`, title: 'd.title_ar', body: 'd.summary_ar', pdf: 'd.file', x: [['docNumber', 'd.doc_number'], ['titleEn', 'd.title_en'], ['summaryEn', 'd.summary_en'], ['issuerAr', 'd.issuer_ar'], ['issuerEn', 'd.issuer_en'], ['docDate', day('d.doc_date')], ['isActive', 'd.is_active']] });
    await this.copy(r, { table: 'board_members', alias: 'b', code: `'BOARD_MEMBER'`, title: 'b.name_ar', body: 'b.bio_ar', images: img('b.photo'), x: [['position', 'b."position"'], ['nameEn', 'b.name_en'], ['jobTitleAr', 'b.job_title_ar'], ['jobTitleEn', 'b.job_title_en'], ['bioEn', 'b.bio_en'], ['dutiesAr', 'b.duties_ar'], ['dutiesEn', 'b.duties_en'], ['termLabel', 'b.term_label'], ['sortOrder', 'b.sort_order'], ['isActive', 'b.is_active']] });
    await this.copy(r, { table: 'committees', alias: 'c', code: `CASE WHEN c.kind = 'women' THEN 'WOMEN_COMMITTEE' ELSE 'COMMITTEE' END`, title: 'c.name_ar', body: 'c.summary_ar', images: img('c.logo'), x: [['nameEn', 'c.name_en'], ['summaryEn', 'c.summary_en'], ['dutiesAr', 'c.duties_ar'], ['dutiesEn', 'c.duties_en'], ['chairNameAr', 'c.chair_name_ar'], ['chairNameEn', 'c.chair_name_en'], ['activityTagsAr', 'c.activity_tags_ar'], ['activityTagsEn', 'c.activity_tags_en'], ['sortOrder', 'c.sort_order'], ['isActive', 'c.is_active']] });
    await this.copy(r, { table: 'committee_members', alias: 'm', code: `'COMMITTEE_MEMBER'`, title: 'm.name_ar', images: img('m.photo'), x: [['parentId', legacyId('pc', 'committees', 'm.committee_id')], ['role', 'm.role'], ['nameEn', 'm.name_en'], ['titleAr', 'm.title_ar'], ['titleEn', 'm.title_en'], ['sortOrder', 'm.sort_order']] });
    await this.copy(r, { table: 'committee_activities', alias: 'a', code: `'COMMITTEE_' || upper(a.kind)`, title: 'a.title_ar', body: 'a.body_ar', x: [['parentId', legacyId('pc', 'committees', 'a.committee_id')], ['titleEn', 'a.title_en'], ['bodyEn', 'a.body_en'], ['eventDate', day('a.event_date')]] });
    await this.copy(r, { table: 'services', alias: 's', code: `'SERVICE'`, title: 's.name_ar', body: 's.description_ar', images: img('s.image'), x: [['kind', 's.kind'], ['nameEn', 's.name_en'], ['descriptionEn', 's.description_en'], ['audienceAr', 's.audience_ar'], ['audienceEn', 's.audience_en'], ['documentsAr', 's.documents_ar'], ['documentsEn', 's.documents_en'], ['stepsAr', 's.steps_ar'], ['stepsEn', 's.steps_en'], ['locationAr', 's.location_ar'], ['locationEn', 's.location_en'], ['departmentAr', 's.department_ar'], ['departmentEn', 's.department_en'], ['durationAr', 's.duration_ar'], ['durationEn', 's.duration_en'], ['feeAr', 's.fee_ar'], ['feeEn', 's.fee_en'], ['formUrl', 's.form_url'], ['sortOrder', 's.sort_order'], ['isActive', 's.is_active']] });
    await this.copy(r, { table: 'trainers', alias: 't', code: `'TRAINER'`, title: 't.name_ar', body: 't.bio_ar', x: [['nameEn', 't.name_en'], ['bioEn', 't.bio_en'], ['isActive', 't.is_active']] });
    await this.copy(r, { table: 'courses', alias: 'c', code: `'COURSE'`, title: 'c.name_ar', images: img('c.image'), x: [['kind', 'c.kind'], ['nameEn', 'c.name_en'], ['fieldAr', 'c.field_ar'], ['fieldEn', 'c.field_en'], ['topicsAr', 'c.topics_ar'], ['topicsEn', 'c.topics_en'], ['audienceAr', 'c.audience_ar'], ['audienceEn', 'c.audience_en'], ['trainerId', legacyId('tr', 'trainers', 'c.trainer_id')], ['startDate', day('c.start_date')], ['endDate', day('c.end_date')], ['hours', 'c.hours'], ['locationAr', 'c.location_ar'], ['locationEn', 'c.location_en'], ['feeAr', 'c.fee_ar'], ['feeEn', 'c.fee_en'], ['capacity', 'c.capacity'], ['registrationClosed', 'c.registration_closed'], ['isActive', 'c.is_active']] });
    await this.copy(r, { table: 'expo_items', alias: 'e', code: `'EXPO_' || upper(e.kind)`, title: 'e.name_ar', body: 'e.description_ar', images: img('e.logo'), x: [['nameEn', 'e.name_en'], ['descriptionEn', 'e.description_en'], ['sectorAr', 'e.sector_ar'], ['sectorEn', 'e.sector_en'], ['category', 'e.category'], ['personAr', 'e.person_ar'], ['personEn', 'e.person_en'], ['placeAr', 'e.place_ar'], ['placeEn', 'e.place_en'], ['startsAt', iso('e.starts_at')], ['endsAt', iso('e.ends_at')], ['website', 'e.website'], ['sortOrder', 'e.sort_order'], ['isActive', 'e.is_active']] });
    await this.copy(r, { table: 'g2t_packages', alias: 'g', code: `'G2T_PACKAGE'`, title: 'g.name_ar', x: [['nameEn', 'g.name_en'], ['featuresAr', 'g.features_ar'], ['featuresEn', 'g.features_en'], ['priceAr', 'g.price_ar'], ['priceEn', 'g.price_en'], ['sortOrder', 'g.sort_order'], ['isActive', 'g.is_active']] });
    await this.copy(r, { table: 'g2t_spaces', alias: 'g', code: `'G2T_SPACE'`, title: 'g.name_ar', body: 'g.description_ar', images: img('g.image'), x: [['kind', 'g.kind'], ['nameEn', 'g.name_en'], ['descriptionEn', 'g.description_en'], ['priceAr', 'g.price_ar'], ['priceEn', 'g.price_en'], ['capacity', 'g.capacity'], ['areaSqm', 'g.area_sqm'], ['isAvailable', 'g.is_available'], ['sortOrder', 'g.sort_order'], ['isActive', 'g.is_active']] });
    await this.copy(r, { table: 'incubator_projects', alias: 'i', code: `'INCUBATOR_PROJECT'`, title: 'i.name_ar', body: 'i.story_ar', images: img('i.image'), x: [['status', 'i.status'], ['nameEn', 'i.name_en'], ['sectorAr', 'i.sector_ar'], ['sectorEn', 'i.sector_en'], ['founderAr', 'i.founder_ar'], ['founderEn', 'i.founder_en'], ['summaryAr', 'i.summary_ar'], ['summaryEn', 'i.summary_en'], ['storyEn', 'i.story_en'], ['website', 'i.website'], ['joinedYear', 'i.joined_year'], ['sortOrder', 'i.sort_order'], ['isActive', 'i.is_active']] });

    // page texts that sat in the settings rows (the notify e-mail and the open flag stay there)
    if ((await this.exists(r, 'g2t_settings')) && (await r.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'g2t_settings' AND column_name = 'about_ar'`)).length) {
      await this.copy(r, { table: 'g2t_settings', alias: 'g', code: `'G2T_INFO'`, title: `'Get2Trade'`, body: 'g.about_ar', x: [['aboutEn', 'g.about_en'], ['servicesAr', 'g.services_ar'], ['servicesEn', 'g.services_en'], ['newsTopicAr', 'g.news_topic_ar'], ['newsTopicEn', 'g.news_topic_en']] });
      for (const c of ['about_ar', 'about_en', 'services_ar', 'services_en', 'news_topic_ar', 'news_topic_en']) await r.query(`ALTER TABLE "g2t_settings" DROP COLUMN "${c}"`);
    }
    if ((await this.exists(r, 'membership_settings')) && (await r.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'membership_settings' AND column_name = 'conditions_ar'`)).length) {
      await this.copy(r, { table: 'membership_settings', alias: 'm', code: `'MEMBERSHIP_INFO'`, title: `'الانتساب'`, body: 'm.conditions_ar', x: [['conditionsEn', 'm.conditions_en'], ['documentsAr', 'm.documents_ar'], ['documentsEn', 'm.documents_en'], ['feesAr', 'm.fees_ar'], ['feesEn', 'm.fees_en'], ['stepsAr', 'm.steps_ar'], ['stepsEn', 'm.steps_en']] });
      for (const c of ['conditions_ar', 'conditions_en', 'documents_ar', 'documents_en', 'fees_ar', 'fees_en', 'steps_ar', 'steps_en']) await r.query(`ALTER TABLE "membership_settings" DROP COLUMN "${c}"`);
    }

    // ---------------------------------------------------------------- re-point the references to the new news ids
    await this.dropFks(r, 'course_registrations', 'courses');
    await this.dropFks(r, 'g2t_bookings', 'g2t_spaces');
    await this.dropFks(r, 'g2t_bookings', 'g2t_packages');
    await this.dropFks(r, 'galleries', 'committees');
    if (await this.exists(r, 'courses')) await this.repoint(r, 'course_registrations', 'course_id', 'courses');
    if (await this.exists(r, 'g2t_spaces')) await this.repoint(r, 'g2t_bookings', 'space_id', 'g2t_spaces');
    if (await this.exists(r, 'g2t_packages')) await this.repoint(r, 'g2t_bookings', 'package_id', 'g2t_packages');
    if (await this.exists(r, 'committees')) await this.repoint(r, 'galleries', 'committee_id', 'committees');
    if (await this.exists(r, 'committees')) await this.repoint(r, 'content_links', 'entity_id', 'committees', `AND t.entity_type = 'committee'`);
    if (await this.exists(r, 'board_members')) await this.repoint(r, 'content_links', 'entity_id', 'board_members', `AND t.entity_type = 'board_member'`);
    await this.addFk(r, 'course_registrations', 'fk_course_regs_course', 'course_id', 'CASCADE');
    await this.addFk(r, 'g2t_bookings', 'fk_g2t_bookings_space', 'space_id', 'SET NULL');
    await this.addFk(r, 'g2t_bookings', 'fk_g2t_bookings_package', 'package_id', 'SET NULL');
    await this.addFk(r, 'galleries', 'fk_galleries_committee', 'committee_id', 'SET NULL');

    // ---------------------------------------------------------------- done: drop the markers and the old tables
    await r.query(`UPDATE "news" SET "extra" = "extra" - 'legacy' WHERE "extra" ? 'legacy'`);
    for (const t of OLD_TABLES) await r.query(`DROP TABLE IF EXISTS "${t}"`);
  }

  public async down(): Promise<void> {
    throw new Error('ContentTypesAsNews cannot be reverted: restore the database backup taken before running it.');
  }
}
