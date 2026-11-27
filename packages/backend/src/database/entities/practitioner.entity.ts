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

  /** Free text the AI matches against, e.g. "ортодонт", "терапевт". */
  @Column({ type: 'text', nullable: true })
  specialty: string | null;

  /** { [dayOfWeek 0-6]: ["09:00","20:00"] | null } */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  workingHours: WorkingHours;

  /** Daily break, e.g. ["13:00","14:00"]. */
  @Column({ type: 'jsonb', nullable: true })
  breakTime: [string, string] | null;

  /** Local dates 'YYYY-MM-DD' off work (vacation, sick days). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  daysOff: string[];

  @CreateDateColumn()
  createdAt: Date;
}
