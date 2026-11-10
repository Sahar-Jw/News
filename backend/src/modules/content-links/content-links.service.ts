import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContentLink, LinkEntityType } from './content-link.entity';

/** Generic news <-> entity links (document 7.2). Pages of any entity read their news through this service. */
@Injectable()
export class ContentLinksService {
  constructor(@InjectRepository(ContentLink) private readonly repo: Repository<ContentLink>) {}

  async newsIdsOf(type: LinkEntityType, entityId: number): Promise<number[]> {
    const rows = await this.repo.find({ where: { entityType: type, entityId }, select: ['newsId'] });
    return rows.map((r) => Number(r.newsId));
  }

  /** The linked news ids of one entity together with their kind label. */
  async linksOf(type: LinkEntityType, entityId: number): Promise<{ newsId: number; kind: string | null }[]> {
    const rows = await this.repo.find({ where: { entityType: type, entityId }, select: ['newsId', 'kind'] });
    return rows.map((r) => ({ newsId: Number(r.newsId), kind: r.kind ?? null }));
  }

  /** Attach news (idempotent: an already linked id only gets its kind updated when one is given). */
  async link(type: LinkEntityType, entityId: number, newsIds: number[], kind?: string | null) {
    const unique = [...new Set(newsIds)];
    if (!unique.length) return;
    const qb = this.repo.createQueryBuilder().insert().values(unique.map((newsId) => ({ newsId, entityType: type, entityId, kind: kind ?? null })));
    if (kind) await qb.orUpdate(['kind'], ['news_id', 'entity_type', 'entity_id']).execute();
    else await qb.orIgnore().execute();
  }

  async unlink(type: LinkEntityType, entityId: number, newsIds: number[]) {
    if (newsIds.length) await this.repo.delete({ entityType: type, entityId, newsId: In(newsIds) });
  }

  /** Called when the entity itself is deleted. */
  async removeAllOf(type: LinkEntityType, entityIds: number[]) {
    if (entityIds.length) await this.repo.delete({ entityType: type, entityId: In(entityIds) });
  }
}
