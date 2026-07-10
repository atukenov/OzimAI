import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  orgId: string;

  /** e.g. "ai", or a user id */
  @Column()
  actor: string;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true })
  before: any;

  @Column({ type: 'jsonb', nullable: true })
  after: any;

  @CreateDateColumn()
  createdAt: Date;
}
