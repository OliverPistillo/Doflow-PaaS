import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate, TemplateCategory } from './entities/email-template.entity';
import { MailService } from '../mail/mail.service';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private tplRepo: Repository<EmailTemplate>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private readonly mailService: MailService,
  ) {}

  async findAll(category?: TemplateCategory) {
    const where: any = {};
    if (category) where.category = category;
    return this.tplRepo.find({ where, order: { category: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const tpl = await this.tplRepo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException(`Template ${id} non trovato.`);
    return tpl;
  }

  async findBySlug(slug: string) {
    const tpl = await this.tplRepo.findOne({ where: { slug } });
    if (!tpl) throw new NotFoundException(`Template '${slug}' non trovato.`);
    return tpl;
  }

  async create(dto: Partial<EmailTemplate>) {
    if (dto.slug) {
      const existing = await this.tplRepo.findOne({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException(`Slug '${dto.slug}' già in uso.`);
    }
    const tpl = this.tplRepo.create(dto);
    return this.tplRepo.save(tpl);
  }

  async update(id: string, dto: Partial<EmailTemplate>) {
    const tpl = await this.findOne(id);
    Object.assign(tpl, dto);
    return this.tplRepo.save(tpl);
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.tplRepo.delete(id);
    return { message: 'Template eliminato.' };
  }

  /** Preview: interpola variabili con dati di test */
  preview(template: EmailTemplate, testData: Record<string, string>) {
    let html = template.htmlBody;
    let subject = template.subject;
    for (const [key, value] of Object.entries(testData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    }
    return { subject, html };
  }

  /** Invia email usando un template */
  async sendWithTemplate(slug: string, to: string, variables: Record<string, string>) {
    const tpl = await this.findBySlug(slug);
    const { subject, html } = this.preview(tpl, variables);

    await this.mailService.sendMail({ to, subject, html });

    // Aggiorna contatori
    tpl.sendCount++;
    tpl.lastSentAt = new Date();
    await this.tplRepo.save(tpl);

    return { success: true, to, subject };
  }

  /** Invio massivo a tutti i tenant (campagna) */
  async sendCampaign(slug: string, extraVars?: Record<string, string>) {
    const tpl = await this.findBySlug(slug);
    const tenants = await this.tenantRepo.find({ where: { isActive: true } });

    let sent = 0;
    let failed = 0;

    for (const tenant of tenants) {
      if (!tenant.adminEmail) continue;
      try {
        const vars = {
          tenantName: tenant.name || tenant.slug,
          tenantSlug: tenant.slug,
          planTier: tenant.planTier || 'STARTER',
          ...extraVars,
        };
        const { subject, html } = this.preview(tpl, vars);
        await this.mailService.sendMail({ to: tenant.adminEmail, subject, html });
        sent++;
      } catch {
        failed++;
      }
    }

    tpl.sendCount += sent;
    tpl.lastSentAt = new Date();
    await this.tplRepo.save(tpl);

    return { sent, failed, total: tenants.length };
  }

  async getStats() {
    const all = await this.tplRepo.find();
    const totalSent = all.reduce((acc, t) => acc + t.sendCount, 0);
    const byCategory: Record<string, number> = {};
    for (const t of all) byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    return { total: all.length, totalSent, byCategory };
  }
}
