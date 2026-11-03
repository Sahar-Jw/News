import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from './course.entity';

/** One participant registered for one course. The same e-mail can register for a course only once (unique with the course). */
@Entity('course_registrations')
@Index('uq_course_registration_email', ['courseId', 'email'], { unique: true })
export class CourseRegistration {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'course_id', type: 'bigint' })
  courseId: number;
  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Course;

  @Column({ length: 150 })
  name: string;

  /** stored lower-case */
  @Column({ length: 190 })
  email: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  organization: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
