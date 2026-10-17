import { BeforeInsert, BeforeUpdate, Column } from 'typeorm';

/** Timestamps are set in the app (UTC) so they never depend on the DB server timezone. */
export abstract class TimestampedEntity {
  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @BeforeInsert()
  protected setCreated() {
    const now = new Date();
    this.createdAt = this.createdAt ?? now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  protected setUpdated() {
    this.updatedAt = new Date();
  }
}
