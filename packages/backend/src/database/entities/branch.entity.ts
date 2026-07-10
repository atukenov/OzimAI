import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('branch')
@Index(['orgId'])
export class BranchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column()
  name: string;

  @Column({ default: '' })
  address: string;

  @CreateDateColumn()
  createdAt: Date;
}
