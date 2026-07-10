import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { KnowledgeSourceType } from '@ozimai/shared';

/**
 * `embedding vector(1536)` exists in the DB (see migration) for future RAG
 * similarity search but is intentionally NOT mapped here yet — this pass
 * injects the full published Q&A set into the system prompt directly (see
 * OrchestratorService), which is correct at MVP knowledge-base sizes.
 */
@Entity('knowledge_doc')
@Index(['orgId'])
@Index(['orgId', 'publishedAt'])
export class KnowledgeDocEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orgId: string;

  @Column('text')
  question: string;

  @Column('text')
  answer: string;

  @Column({ type: 'enum', enum: KnowledgeSourceType, default: KnowledgeSourceType.Manual })
  sourceType: KnowledgeSourceType;

  @Column('int', { default: 1 })
  version: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
