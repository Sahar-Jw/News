import { BeforeInsert, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contact_messages')
@Index('idx_contact_read_created', ['isRead', 'createdAt'])
export class ContactMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 190 })
  email: string;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  protected setCreated() {
    this.createdAt = this.createdAt ?? new Date();
  }
}
