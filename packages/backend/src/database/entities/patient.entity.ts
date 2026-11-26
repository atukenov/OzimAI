import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Channel, LeadStatus } from '@ozimai/shared';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Entity('patient')
@Index(['orgId'])
@Index(['orgId', 'phone'], { unique: true })
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column()
  phone: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'enum', enum: LeadStatus, default: LeadStatus.Lead })
  leadStatus: LeadStatus;

  @Column({ type: 'enum', enum: Channel, default: Channel.WhatsApp })
  sourceChannel: Channel;

  @Column({ type: 'text', nullable: true })
  lastNote: string | null;

  /** Browser Web Push subscription (web chat patients who allowed notifications). */
  @Column({ type: 'jsonb', nullable: true })
  pushSubscription: WebPushSubscription | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
