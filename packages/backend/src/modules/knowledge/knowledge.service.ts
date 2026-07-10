import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { KnowledgeSourceType } from '@ozimai/shared';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { KnowledgeDocEntity } from '../../database/entities/knowledge-doc.entity';
import { parseKnowledgeImport } from './import-parser';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenant.repo(KnowledgeDocEntity).find({ where: { orgId: this.tenant.orgId }, order: { createdAt: 'DESC' } });
  }

  /** What the AI Orchestrator actually uses to build its system prompt. */
  listPublished() {
    return this.tenant.manager
      .getRepository(KnowledgeDocEntity)
      .createQueryBuilder('k')
      .where('k.orgId = :orgId', { orgId: this.tenant.orgId })
      .andWhere('k.publishedAt IS NOT NULL')
      .orderBy('k.publishedAt', 'DESC')
      .getMany();
  }

  /** Parses an uploaded price list / FAQ text into unpublished draft entries for preview. */
  async importDraft(raw: string, sourceType: KnowledgeSourceType) {
    const parsed = parseKnowledgeImport(raw);
    const repo = this.tenant.repo(KnowledgeDocEntity);
    const drafts = parsed.map((entry) =>
      repo.create({ orgId: this.tenant.orgId, question: entry.question, answer: entry.answer, sourceType, version: 1, publishedAt: null }),
    );
    return repo.save(drafts);
  }

  async publish(ids: string[]) {
    const repo = this.tenant.repo(KnowledgeDocEntity);
    const docs = await repo.find({ where: { id: In(ids), orgId: this.tenant.orgId } });
    const now = new Date();
    for (const doc of docs) doc.publishedAt = now;
    const saved = await repo.save(docs);
    await this.audit.record({ actor: this.tenant.userId, action: 'knowledge.publish', entity: 'knowledge_doc', after: { ids } });
    return saved;
  }

  async createManual(question: string, answer: string) {
    const repo = this.tenant.repo(KnowledgeDocEntity);
    const doc = await repo.save(
      repo.create({ orgId: this.tenant.orgId, question, answer, sourceType: KnowledgeSourceType.Manual, version: 1, publishedAt: new Date() }),
    );
    await this.audit.record({ actor: this.tenant.userId, action: 'knowledge.create', entity: 'knowledge_doc', entityId: doc.id, after: doc });
    return doc;
  }

  async update(id: string, question: string, answer: string) {
    const repo = this.tenant.repo(KnowledgeDocEntity);
    const doc = await repo.findOneBy({ id, orgId: this.tenant.orgId });
    if (!doc) throw new NotFoundException('Knowledge entry not found');
    const before = { question: doc.question, answer: doc.answer };
    doc.question = question;
    doc.answer = answer;
    doc.version += 1;
    const saved = await repo.save(doc);
    await this.audit.record({ actor: this.tenant.userId, action: 'knowledge.update', entity: 'knowledge_doc', entityId: id, before, after: { question, answer } });
    return saved;
  }

  async remove(id: string) {
    const repo = this.tenant.repo(KnowledgeDocEntity);
    const doc = await repo.findOneBy({ id, orgId: this.tenant.orgId });
    if (!doc) throw new NotFoundException('Knowledge entry not found');
    await repo.remove(doc);
    await this.audit.record({ actor: this.tenant.userId, action: 'knowledge.delete', entity: 'knowledge_doc', entityId: id, before: doc });
  }
}
