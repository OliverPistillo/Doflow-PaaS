import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike } from 'typeorm';
import {
  PlatformNotification, NotificationType, NotificationChannel,
} from './entities/platform-notification.entity';
import { NotificationsService as RealtimeService } from '../realtime/notifications.service';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class PlatformNotificationsService {
  constructor(
    @InjectRepository(PlatformNotification)
    private notifRepo: Repository<PlatformNotification>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Lettura ────────────────────────────────────────────────

  async findAll(filters?: { type?: NotificationType; isRead?: boolean; search?: string }) {
    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.isRead !== undefined) where.isRead = filters.isRead;

    if (filters?.search) {
      return this.notifRepo.find({
        where: [
          { ...where, title: ILike(`%${filters.search}%`) },
          { ...where, message: ILike(`%${filters.search}%`) },
        ],
        order: { createdAt: 'DESC' },
        take: 100,
      });
    }

    return this.notifRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }

  async getStats() {
    const all = await this.notifRepo.find();
    const unread = all.filter(n => !n.isRead).length;
    const byType: Record<string, number> = {};
    for (const n of all) {
      byType[n.type] = (byType[n.type] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = all.filter(n => new Date(n.createdAt) >= today).length;

    return {
      total: all.length,
      unread,
      todayCount,
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    };
  }

  // ─── Creazione & Broadcast ──────────────────────────────────

  async create(dto: {
    title: string;
    message: string;
    type?: NotificationType;
    channel?: NotificationChannel;
    targetTenantId?: string;
    targetUserEmail?: string;
    sender?: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const notif = this.notifRepo.create({
      title: dto.title,
      message: dto.message,
      type: dto.type || NotificationType.INFO,
      channel: dto.channel || NotificationChannel.PLATFORM,
      targetTenantId: dto.targetTenantId || undefined,
      targetUserEmail: dto.targetUserEmail || undefined,
      sender: dto.sender || 'SYSTEM',
      actionUrl: dto.actionUrl || undefined,
      metadata: dto.metadata || undefined,
    });

    const saved = await this.notifRepo.save(notif);

    // Push real-time via WebSocket
    const shouldPushRealtime =
      dto.channel === NotificationChannel.REALTIME ||
      dto.channel === NotificationChannel.ALL ||
      dto.channel === NotificationChannel.PLATFORM;

    if (shouldPushRealtime) {
      const wsPayload = {
        type: 'platform_notification',
        payload: {
          id: saved.id,
          title: saved.title,
          message: saved.message,
          notificationType: saved.type,
          actionUrl: saved.actionUrl,
          createdAt: saved.createdAt,
        },
      };

      if (dto.targetTenantId) {
        await this.realtime.broadcastToTenant(dto.targetTenantId, wsPayload);
      } else {
        // Broadcast globale: invia a tutti i tenant attivi
        const tenants = await this.tenantRepo.find({ where: { isActive: true } });
        for (const t of tenants) {
          await this.realtime.broadcastToTenant(t.id, wsPayload);
        }
        // Anche al canale superadmin
        await this.realtime.broadcastToTenant('global', wsPayload);
      }
    }

    return saved;
  }

  /** Broadcast rapido a tutti i tenant */
  async broadcast(dto: { title: string; message: string; type?: NotificationType }) {
    return this.create({
      ...dto,
      channel: NotificationChannel.ALL,
      sender: 'SUPERADMIN',
    });
  }

  // ─── Aggiornamento stato ────────────────────────────────────

  async markAsRead(id: string) {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException(`Notifica ${id} non trovata.`);
    notif.isRead = true;
    notif.readAt = new Date();
    return this.notifRepo.save(notif);
  }

  async markAllAsRead() {
    await this.notifRepo.update({ isRead: false }, { isRead: true, readAt: new Date() });
    return { message: 'Tutte le notifiche segnate come lette.' };
  }

  async delete(id: string) {
    await this.notifRepo.delete(id);
    return { message: 'Notifica eliminata.' };
  }

  async deleteAll() {
    await this.notifRepo.clear();
    return { message: 'Tutte le notifiche eliminate.' };
  }
}
