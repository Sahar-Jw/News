import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 100, unique: true })
  code: string;

  @Column({ name: 'name_ar', length: 150 })
  nameAr: string;

  @Column({ name: 'name_en', length: 150 })
  nameEn: string;

  @Column({ length: 50 })
  module: string;
}
