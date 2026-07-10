import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { WorkingHours } from '@ozimai/shared';

@Entity('practitioner')
@Index(['orgId'])
export class PractitionerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  branchId: string;

  @Column()
  name: string;

  /** { [dayOfWeek 0-6]: ["09:00","20:00"] | null } */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  workingHours: WorkingHours;

  @CreateDateColumn()
  createdAt: Date;
}
