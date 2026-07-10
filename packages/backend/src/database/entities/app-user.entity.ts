import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '@ozimai/shared';

/**
 * Also exempt from RLS (see organization.entity.ts): magic-link login has to
 * resolve a user by email before any org context exists. Contains no patient
 * data, so this does not weaken the tenant-isolation guarantee that matters.
 */
@Entity('app_user')
@Index(['orgId'])
@Index(['email'], { unique: true })
export class AppUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Owner })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}
