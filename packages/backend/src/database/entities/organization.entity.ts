import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BillingStatus } from '@ozimai/shared';

/**
 * The one table intentionally NOT covered by RLS: tenant resolution (login,
 * WhatsApp webhook phone-number lookup, billing webhooks) has to find an
 * organization before any `app.current_org_id` context exists.
 */
@Entity('organization')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'start' })
  plan: 'start' | 'growth' | 'business';

  @Column({ default: 'ru' })
  locale: 'ru' | 'kk';

  @Column({ type: 'enum', enum: BillingStatus, default: BillingStatus.Trial })
  billingStatus: BillingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ nullable: true, unique: true })
  whatsappPhoneNumberId?: string;

  @Column({ nullable: true })
  aiName?: string;

  @Column({ nullable: true })
  aiTone?: string;

  @CreateDateColumn()
  createdAt: Date;
}
