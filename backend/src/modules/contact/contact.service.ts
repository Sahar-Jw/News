import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { ContactMessage } from './contact-message.entity';
import { AuditService } from '../audit/audit.service';
import { CreateContactDto, MessageListQueryDto } from './contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage) private readonly repo: Repository<ContactMessage>,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateContactDto) {
    const m = await this.repo.save(this.repo.create({ ...dto, isRead: false }));
    // public form: no actor; the message itself (name, e-mail, text) stays in contact_messages, not in the log
    await this.audit.log({ category: 'messages', action: 'create', description: 'رسالة تواصل جديدة من الموقع', entityType: 'contact_messages', entityId: m.id });
    return { id: m.id, message: 'تم إرسال رسالتك بنجاح' };
  }

  private build(q: MessageListQueryDto) {
    const qb = this.repo.createQueryBuilder('m');
    if (q.isRead !== undefined) qb.andWhere('m.isRead = :r', { r: q.isRead });
    if (q.from) qb.andWhere('m.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('m.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('m.name LIKE :like', { like }).orWhere('m.email LIKE :like', { like }).orWhere('m.subject LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { name: 'm.name', email: 'm.email', subject: 'm.subject', createdAt: 'CAST(m.createdAt AS CHAR)' });
    qb.orderBy('m.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('m.id', 'DESC');
    return qb;
  }

  async list(q: MessageListQueryDto) {
    const p = adminPage(q);
    // the list omits the full text; the body comes from GET :id (which marks the message read)
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map(({ message, ...rest }) => rest), total, p);
  }

  listAll(q: MessageListQueryDto) {
    return this.build(q).take(10000).getMany();
  }

  /** Fetch first, then mark as read only after a successful fetch (SRS FR-MSG-002). */
  async open(id: number, actor: AuthUser) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('الرسالة غير موجودة');
    if (!m.isRead) {
      m.isRead = true;
      m.readAt = new Date();
      await this.repo.save(m);
      await this.audit.log({ category: 'messages', action: 'read', description: 'قراءة رسالة تواصل', actorId: actor.id, entityType: 'contact_messages', entityId: id });
    }
    return m;
  }
}
