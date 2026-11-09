import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-stop window: a structured opening-hours schedule (weekly hours, holidays, temporary changes) as one JSON setting,
 * the window's own contact details, a note under the fees table and the "electronic services (coming soon)" text.
 * Idempotent; existing values are never overwritten.
 */
export class AddOneStopDetails1765200000000 implements MigrationInterface {
  name = 'AddOneStopDetails1765200000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('one_stop', 'schedule', '{"week":[{"day":0,"open":true,"from":"08:00","to":"14:00"},{"day":1,"open":true,"from":"08:00","to":"14:00"},{"day":2,"open":true,"from":"08:00","to":"14:00"},{"day":3,"open":true,"from":"08:00","to":"14:00"},{"day":4,"open":true,"from":"08:00","to":"14:00"},{"day":5,"open":false,"from":"08:00","to":"14:00"},{"day":6,"open":false,"from":"08:00","to":"14:00"}],"holidays":[],"changes":[]}', 'json', now()),
        ('one_stop', 'contact_phone', NULL, 'text', now()),
        ('one_stop', 'contact_email', NULL, 'text', now()),
        ('one_stop', 'contact_address_ar', NULL, 'text', now()),
        ('one_stop', 'contact_address_en', NULL, 'text', now()),
        ('one_stop', 'contact_map_url', NULL, 'url', now()),
        ('one_stop', 'fees_note_ar', 'الرسوم المذكورة هي الرسوم المعتمدة وقد تتغير بقرار من الغرفة.', 'text', now()),
        ('one_stop', 'fees_note_en', 'The fees shown are the approved fees and may change by decision of the chamber.', 'text', now()),
        ('one_stop', 'eservices_ar', 'سيتم إطلاق التقديم الإلكتروني على خدمات الغرفة قريباً، وستتمكن من تقديم طلبك ومتابعته عبر الموقع.', 'text', now()),
        ('one_stop', 'eservices_en', 'Online applications for the chamber services are coming soon: you will be able to submit and follow your request through the website.', 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'one_stop' AND "key" IN ('schedule', 'contact_phone', 'contact_email', 'contact_address_ar', 'contact_address_en', 'contact_map_url', 'fees_note_ar', 'fees_note_en', 'eservices_ar', 'eservices_en')`);
  }
}
