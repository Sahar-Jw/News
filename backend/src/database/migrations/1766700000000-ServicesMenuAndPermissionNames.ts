import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The permission list showed two groups called "Services": the chamber services (services.*) and the old home-page services section
 * (news.<action>.services). The home-page one is renamed so the two can be told apart. Idempotent.
 */
const SECTION: Record<string, [string, string]> = {
  read: ['عرض خدمات الصفحة الرئيسية', 'View home-page services'],
  create: ['إضافة إلى خدمات الصفحة الرئيسية', 'Create in home-page services'],
  update: ['تعديل خدمات الصفحة الرئيسية', 'Update home-page services'],
  delete: ['حذف من خدمات الصفحة الرئيسية', 'Delete from home-page services'],
};
const OLD: Record<string, [string, string]> = {
  read: ['عرض الخدمات', 'View Services'],
  create: ['إضافة إلى الخدمات', 'Create in Services'],
  update: ['تعديل الخدمات', 'Update Services'],
  delete: ['حذف من الخدمات', 'Delete from Services'],
};

export class ServicesMenuAndPermissionNames1766700000000 implements MigrationInterface {
  name = 'ServicesMenuAndPermissionNames1766700000000';

  public async up(r: QueryRunner): Promise<void> {
    for (const a of Object.keys(SECTION)) {
      await r.query(`UPDATE "permissions" SET "name_ar" = $1, "name_en" = $2 WHERE "code" = $3`, [SECTION[a][0], SECTION[a][1], `news.${a}.services`]);
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    for (const a of Object.keys(OLD)) {
      await r.query(`UPDATE "permissions" SET "name_ar" = $1, "name_en" = $2 WHERE "code" = $3`, [OLD[a][0], OLD[a][1], `news.${a}.services`]);
    }
  }
}
