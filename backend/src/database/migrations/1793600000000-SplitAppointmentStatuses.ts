import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_APPOINTMENT_STATUSES, normalizeStatuses, statusSettingRows } from '../../modules/appointments/appointment-statuses';

/**
 * Date statuses used to be ONE json setting (appointments.statuses) that had to be edited by hand.
 * They become ordinary settings, three per status, edited like every other setting:
 *   status_<code>_ar, status_<code>_en (text) and status_<code>_color (color).
 * The current JSON is converted, so custom names, colours and extra statuses are kept. Nothing else changes:
 * appointments keep their status codes.
 */
export class SplitAppointmentStatuses1793600000000 implements MigrationInterface {
  name = 'SplitAppointmentStatuses1793600000000';

  public async up(q: QueryRunner): Promise<void> {
    const rows: { value: string | null }[] = await q.query("SELECT `value` FROM `site_settings` WHERE `category` = 'appointments' AND `key` = 'statuses'");
    let list = DEFAULT_APPOINTMENT_STATUSES;
    try {
      if (rows[0]?.value) list = normalizeStatuses(JSON.parse(rows[0].value));
    } catch {
      /* unreadable JSON: start from the defaults */
    }
    // inserted one by one so the row order (= the order of the statuses in the Dates form) is kept
    for (const [key, type, value] of statusSettingRows(list)) {
      await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('appointments', ?, ?, ?, UTC_TIMESTAMP())", [key, value, type]);
    }
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'appointments' AND `key` = 'statuses'");
  }

  public async down(q: QueryRunner): Promise<void> {
    const rows: { key: string; value: string | null }[] = await q.query("SELECT `key`, `value` FROM `site_settings` WHERE `category` = 'appointments' AND `key` LIKE 'status\\_%' ORDER BY `id`");
    const byCode = new Map<string, Record<string, string>>();
    for (const r of rows) {
      const m = /^status_(.+)_(ar|en|color)$/.exec(r.key);
      if (!m) continue;
      byCode.set(m[1], { ...(byCode.get(m[1]) ?? { code: m[1] }), [m[2]]: r.value ?? '' });
    }
    const json = JSON.stringify(normalizeStatuses([...byCode.values()]));
    await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('appointments', 'statuses', ?, 'json', UTC_TIMESTAMP())", [json]);
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'appointments' AND `key` LIKE 'status\\_%'");
  }
}
