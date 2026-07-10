import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Channel, ConversationStatus } from '@ozimai/shared';

@Entity('conversation')
@Index(['orgId'])
@Index(['orgId', 'status'])
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  patientId: string;

  @Column({ type: 'enum', enum: Channel, default: Channel.WhatsApp })
  channel: Channel;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.Ai })
  status: ConversationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
