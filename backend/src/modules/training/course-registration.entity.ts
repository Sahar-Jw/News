import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { News } from '../news/news.entity';

/** One participant registered for one course. The same e-mail can register for a course only once (unique with the course). */
@Entity('course_registrations')
@Index('uq_course_registration_email', ['courseId', 'email'], { unique: true })
export class CourseRegistration {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'course_id', type: 'bigint' })
  courseId: number;
  /** the course is a news row (main category COURSE) */
  @ManyToOne(() => News, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: News;

  @Column({ length: 150 })
  name: string;

  /** stored lower-case */
  @Column({ length: 190 })
  email: string;

  @Column({ length: 30 })
  phone: string;

  /** company name */
  @Column({ type: 'varchar', length: 150, nullable: true })
  organization: string | null;

  /** place of work (city / branch / department) */
  @Column({ type: 'varchar', length: 150, nullable: true })
  workplace: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 150, nullable: true })
  jobTitle: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  qualification: string | null;

  /** optional: experience or specialisation */
  @Column({ type: 'text', nullable: true })
  experience: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
