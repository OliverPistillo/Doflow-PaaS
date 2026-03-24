import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangelogEntry, ReleaseType } from './entities/changelog-entry.entity';
import { PlatformNotificationsService } from './platform-notifications.service';
import { NotificationType } from './entities/platform-notification.entity';

@Injectable()
export class ChangelogService {
  constructor(
    @InjectRepository(ChangelogEntry)
    private repo: Repository<ChangelogEntry>,
    private readonly notifService: PlatformNotificationsService,
  ) {}

  async findAll(publishedOnly = false) {
    const where: any = {};
    if (publishedOnly) where.isPublished = true;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Changelog ${id} non trovato.`);
    return entry;
  }

  async create(dto: Partial<ChangelogEntry>) {
    const entry = this.repo.create(dto);
    return this.repo.save(entry);
  }

  async update(id: string, dto: Partial<ChangelogEntry>) {
    const entry = await this.findOne(id);
    Object.assign(entry, dto);
    return this.repo.save(entry);
  }

  async publish(id: string) {
    const entry = await this.findOne(id);
    entry.isPublished = true;
    entry.publishedAt = new Date();
    const saved = await this.repo.save(entry);

    // Notifica broadcast ai tenant
    await this.notifService.broadcast({
      title: `Aggiornamento ${entry.version}: ${entry.title}`,
      message: entry.content.slice(0, 200) + (entry.content.length > 200 ? '...' : ''),
      type: NotificationType.SUCCESS,
    });

    return saved;
  }

  async unpublish(id: string) {
    const entry = await this.findOne(id);
    entry.isPublished = false;
    return this.repo.save(entry);
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Voce eliminata.' };
  }
}
