import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('service')
@Index(['orgId'])
export class ServiceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column()
  name: string;

  @Column('int')
  price: number;

  @Column('int', { default: 30 })
  durationMin: number;

  @Column('int', { default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;
}
