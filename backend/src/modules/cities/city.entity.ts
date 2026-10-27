import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ name: 'name_ar', length: 100 })
  nameAr: string;

  @Column({ name: 'name_en', length: 100 })
  nameEn: string;

  @Column({ name: 'numeric_value', type: 'int', nullable: true })
  numericValue: number | null;

  @Column({ name: 'string_value', type: 'varchar', length: 100, nullable: true })
  stringValue: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  type: string | null;
}
