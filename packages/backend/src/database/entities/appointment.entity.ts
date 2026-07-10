import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AppointmentStatus, CreatedBy } from '@ozimai/shared';

@Entity('appointment')
@Index(['orgId'])
@Index(['orgId', 'practitionerId', 'slotStart'])
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  patientId: string;

  @Column('uuid')
  practitionerId: string;

  @Column('uuid', { nullable: true })
  serviceId: string | null;

  @Column({ type: 'timestamptz' })
  slotStart: Date;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.Held })
  status: AppointmentStatus;

  @Column({ type: 'enum', enum: CreatedBy, default: CreatedBy.Ai })
  createdBy: CreatedBy;

  @Column({ type: 'text', nullable: true })
  holdToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reminded_24h_at' })
  reminded24hAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'reminded_2h_at' })
  reminded2hAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
