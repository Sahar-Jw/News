import { BeforeInsert, BeforeUpdate, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SettingValueType = 'text' | 'number' | 'boolean' | 'url' | 'color' | 'file' | 'json';

/** Key-value settings: one row per setting, never a column per setting (SRS 14). */
@Entity('site_settings')
@Index('uq_settings_category_key', ['category', 'key'], { unique: true })
export class SiteSetting {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 50 })
  category: string;

  @Column({ name: 'key', length: 100 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ name: 'value_type', type: 'enum', enum: ['text', 'number', 'boolean', 'url', 'color', 'file', 'json'], default: 'text' })
  valueType: SettingValueType;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  protected touch() {
    this.updatedAt = new Date();
  }
}
