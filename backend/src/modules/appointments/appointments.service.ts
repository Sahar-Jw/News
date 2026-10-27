import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { isYmd, todayYmd } from '../../common/utils/dates';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { Customer } from '../customers/customer.entity';
import { SiteSetting } from '../settings/site-setting.entity';
import { Appointment } from './appointment.entity';
import { AppointmentStatus, statusesFromSettings } from './appointment-statuses';
import { AppointmentsQueryDto, CreateAppointmentDto, UpdateAppointmentDto } from './appointments.dto';

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hhmm = (t: string) => String(t).slice(0, 5);

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly repo: Repository<Appointment>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
  ) {}

  /** The statuses set in Settings (category "appointments": status_<code>_ar / _en / _color). */
  async statuses(): Promise<AppointmentStatus[]> {
    const rows = await this.settings.find({ where: { category: 'appointments' }, order: { id: 'ASC' } });
    return statusesFromSettings(rows);
  }

  private async assertStatus(code: string) {
    if (!(await this.statuses()).some((s) => s.code === code)) throw new BadRequestException('حالة الموعد غير موجودة في الإعدادات');
  }

  present(a: Appointment) {
    return {
      id: a.id,
      customerId: a.customerId,
      customerName: a.customer?.name ?? '',
      customerPhone: a.customer?.phone ?? '',
      appointmentDate: a.appointmentDate,
      appointmentTime: hhmm(a.appointmentTime),
      status: a.status,
      procedures: a.procedures,
      createdAt: a.createdAt,
    };
  }

  // ---------------------------------------------------------------- list
  private build(q: AppointmentsQueryDto) {
    const qb = this.repo.createQueryBuilder('a').innerJoinAndSelect('a.customer', 'c');
    if (q.status) qb.andWhere('a.status = :st', { st: q.status });
    if (q.customerId) qb.andWhere('a.customerId = :cid', { cid: q.customerId });
    if (q.from) qb.andWhere('a.appointmentDate >= :from', { from: q.from.slice(0, 10) });
    if (q.to) qb.andWhere('a.appointmentDate <= :to', { to: q.to.slice(0, 10) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('c.name ILIKE :like', { like }).orWhere('c.phone ILIKE :like', { like }).orWhere('a.procedures ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, {
      id: 'CAST(a.id AS TEXT)', customerName: 'c.name', customerPhone: 'c.phone', appointmentDate: 'CAST(a.appointmentDate AS TEXT)',
      appointmentTime: 'CAST(a.appointmentTime AS TEXT)', procedures: 'a.procedures',
    });
    const dir = q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('a.appointmentDate', dir).addOrderBy('a.appointmentTime', dir).addOrderBy('a.id', dir);
    return qb;
  }

  async list(q: AppointmentsQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async listAll(q: AppointmentsQueryDto) {
    return (await this.build(q).take(10000).getMany()).map((r) => this.present(r));
  }

  // ---------------------------------------------------------------- create / update / delete
  private assertWhen(date: string) {
    if (!isYmd(date)) throw new BadRequestException('التاريخ غير صالح');
  }

  async create(dto: CreateAppointmentDto, actor: AuthUser) {
    this.assertWhen(dto.appointmentDate);
    await this.assertStatus(dto.status);
    if (!(await this.customers.exist({ where: { id: dto.customerId } }))) throw new BadRequestException('العميل غير موجود');
    const saved = await this.repo.save(
      this.repo.create({
        customerId: dto.customerId, appointmentDate: dto.appointmentDate, appointmentTime: `${dto.appointmentTime}:00`,
        status: dto.status, procedures: dto.procedures?.trim() || null, createdById: actor.id,
      }),
    );
    await this.audit.log({ category: 'appointments', action: 'create', description: 'إضافة موعد', actorId: actor.id, entityType: 'appointments', entityId: saved.id });
    return this.present(await this.load(saved.id));
  }

  private async load(id: number) {
    const a = await this.repo.findOne({ where: { id }, relations: { customer: true } });
    if (!a) throw new NotFoundException('الموعد غير موجود');
    return a;
  }

  async update(id: number, dto: UpdateAppointmentDto, actor: AuthUser) {
    const a = await this.load(id);
    if (dto.appointmentDate !== undefined) { this.assertWhen(dto.appointmentDate); a.appointmentDate = dto.appointmentDate; }
    if (dto.appointmentTime !== undefined) a.appointmentTime = `${dto.appointmentTime}:00`;
    // an old status that was removed from Settings may stay on the record; only a CHANGE is checked
    if (dto.status !== undefined && dto.status !== a.status) { await this.assertStatus(dto.status); a.status = dto.status; }
    if (dto.customerId !== undefined && dto.customerId !== a.customerId) {
      if (!(await this.customers.exist({ where: { id: dto.customerId } }))) throw new BadRequestException('العميل غير موجود');
      a.customerId = dto.customerId;
      (a as any).customer = undefined; // reload below, or TypeORM keeps the old relation
    }
    if (dto.procedures !== undefined) a.procedures = dto.procedures?.trim() || null;
    await this.repo.save(a);
    await this.audit.log({ category: 'appointments', action: 'update', description: 'تعديل موعد', actorId: actor.id, entityType: 'appointments', entityId: id });
    return this.present(await this.load(id));
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: unique.map((id) => ({ id })), select: { id: true } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المواعيد غير موجودة');
    await this.repo.delete(unique);
    await this.audit.log({ category: 'appointments', action: 'delete', description: `حذف ${rows.length} موعد`, actorId: actor.id, entityType: 'appointments', details: { ids: unique } });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- dashboard
  async dashboard(todayIn?: string) {
    if (todayIn !== undefined && !isYmd(todayIn)) throw new BadRequestException('التاريخ غير صالح');
    const today = todayIn ?? todayYmd();
    const statuses = await this.statuses();

    const grouped: { status: string; n: string }[] = await this.repo.createQueryBuilder('a').select('a.status', 'status').addSelect('COUNT(*)', 'n').groupBy('a.status').getRawMany();
    const counts = new Map(grouped.map((g) => [g.status, Number(g.n)]));
    const byStatus = statuses.map((s) => ({ ...s, count: counts.get(s.code) ?? 0 }));
    for (const [code, n] of counts) if (!statuses.some((s) => s.code === code)) byStatus.push({ code, ar: code, en: code, count: n }); // removed from Settings but still used
    const total = [...counts.values()].reduce((x, y) => x + y, 0);

    const slim = (a: Appointment) => ({ id: a.id, customerName: a.customer?.name ?? '', customerPhone: a.customer?.phone ?? '', appointmentDate: a.appointmentDate, appointmentTime: hhmm(a.appointmentTime), status: a.status });
    const base = () => this.repo.createQueryBuilder('a').innerJoinAndSelect('a.customer', 'c').orderBy('a.appointmentDate', 'ASC').addOrderBy('a.appointmentTime', 'ASC').addOrderBy('a.id', 'ASC');
    const todayList = (await base().where('a.appointmentDate = :today', { today }).take(200).getMany()).map(slim);
    const next7 = (await base().where('a.appointmentDate > :today AND a.appointmentDate <= :end', { today, end: addDays(today, 7) }).take(300).getMany()).map(slim);

    // chart: one bar per day, 7 days back to 14 days ahead
    const from = addDays(today, -7);
    const to = addDays(today, 14);
    const perDayRows: { d: string; n: string }[] = await this.repo.createQueryBuilder('a').select('a.appointmentDate', 'd').addSelect('COUNT(*)', 'n').where('a.appointmentDate >= :from AND a.appointmentDate <= :to', { from, to }).groupBy('a.appointmentDate').getRawMany();
    const per = new Map(perDayRows.map((r) => [String(r.d).slice(0, 10), Number(r.n)]));
    const perDay: { date: string; count: number }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) perDay.push({ date: d, count: per.get(d) ?? 0 });

    return { today, total, byStatus, todayList, next7, perDay };
  }
}
