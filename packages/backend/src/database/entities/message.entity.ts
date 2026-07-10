import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AiMeta, MessageSenderType } from '@ozimai/shared';

@Entity('message')
@Index(['orgId'])
@Index(['orgId', 'conversationId'])
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('uuid')
  conversationId: string;

  @Column({ type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType;

  @Column('text')
  text: string;

  @Column({ type: 'jsonb', nullable: true })
  aiMeta: AiMeta | null;

  @CreateDateColumn()
  createdAt: Date;
}
