import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { rejectTenantOverride, tenantActor } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';

const STATUS = new Set(['not_started', 'in_progress', 'completed', 'dismissed']);

@Injectable()
export class TenantPreferencesService {
  constructor(private readonly dataSource: DataSource, @Inject(REQUEST) private readonly request: any) {}
  private actor() { return tenantActor(this.request, 'TenantPreferencesService'); }
  private defaults() {
    return { onboardingStatus: 'not_started', tourStep: 0, activeTourId: 'full-flow', tutorialVersion: 1,
      completedTours: [], dismissedModules: [], suggestionsEnabled: true, animationsEnabled: true,
      reducedMotion: false, illustratedEmptyStates: true, contextualMascotEnabled: true, seenNewsVersion: 0,
      emojiPreferences: { recent: [], favorites: ['👍', '❤️', '✅'], skinTone: '' } };
  }
  private async row() {
    const actor = this.actor();
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    const rows = await this.dataSource.query(
      `INSERT INTO "${actor.schema}".tenant_user_preferences (user_id,preferences)
       VALUES ($1,$2::jsonb) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *`,
      [actor.id, JSON.stringify(this.defaults())],
    );
    return { actor, row: rows[0] };
  }
  async get() { const { row } = await this.row(); return { preferences: { ...this.defaults(), ...(row.preferences || {}) }, updatedAt: row.updated_at }; }
  async update(body: Record<string, unknown>) {
    rejectTenantOverride(body);
    const { actor, row } = await this.row();
    if ((body.userId !== undefined && body.userId !== actor.id) || (body.user_id !== undefined && body.user_id !== actor.id)) throw new ConflictException('La sessione e cambiata');
    const current = { ...this.defaults(), ...(row.preferences || {}) } as Record<string, unknown>;
    const next = { ...current };
    if (body.onboardingStatus !== undefined) {
      if (!STATUS.has(String(body.onboardingStatus))) throw new BadRequestException('onboardingStatus non valido');
      next.onboardingStatus = body.onboardingStatus;
    }
    for (const key of ['tourStep', 'tutorialVersion', 'seenNewsVersion']) if (body[key] !== undefined) {
      const value = Number(body[key]); if (!Number.isInteger(value) || value < 0 || value > 100) throw new BadRequestException(`${key} non valido`); next[key] = value;
    }
    if (body.activeTourId !== undefined) {
      const value = String(body.activeTourId); if (!/^[a-z0-9-]{1,64}$/.test(value)) throw new BadRequestException('activeTourId non valido'); next.activeTourId = value;
    }
    for (const key of ['completedTours', 'dismissedModules']) if (body[key] !== undefined) {
      if (!Array.isArray(body[key])) throw new BadRequestException(`${key} non valido`);
      next[key] = Array.from(new Set((body[key] as unknown[]).map(String).filter((v) => /^[a-zA-Z0-9._:-]{1,100}$/.test(v)))).slice(0, 100);
    }
    for (const key of ['suggestionsEnabled', 'animationsEnabled', 'reducedMotion', 'illustratedEmptyStates', 'contextualMascotEnabled']) if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw new BadRequestException(`${key} non valido`); next[key] = body[key];
    }
    if (body.emojiPreferences !== undefined) {
      if (!body.emojiPreferences || typeof body.emojiPreferences !== 'object' || Array.isArray(body.emojiPreferences)) {
        throw new BadRequestException('emojiPreferences non valide');
      }
      const input = body.emojiPreferences as Record<string, unknown>;
      const list = (value: unknown, field: string) => {
        if (!Array.isArray(value)) throw new BadRequestException(`${field} non valido`);
        return Array.from(new Set(value.map((entry) => String(entry)).filter((entry) => {
          if (!entry || entry.length > 32 || /[\u0000-\u001f\u007f]/u.test(entry)) return false;
          return /^:[a-z0-9-]{1,28}:$/i.test(entry) || /\p{Extended_Pictographic}/u.test(entry);
        }))).slice(0, 24);
      };
      const skinTone = String(input.skinTone ?? '');
      if (!['', '🏻', '🏼', '🏽', '🏾', '🏿'].includes(skinTone)) throw new BadRequestException('skinTone non valida');
      next.emojiPreferences = {
        recent: list(input.recent ?? [], 'emojiPreferences.recent'),
        favorites: list(input.favorites ?? [], 'emojiPreferences.favorites'),
        skinTone,
      };
    }
    const rows = await this.dataSource.query(
      `UPDATE "${actor.schema}".tenant_user_preferences SET preferences=$2::jsonb,updated_at=now() WHERE user_id=$1 RETURNING *`,
      [actor.id, JSON.stringify(next)],
    );
    return { before: current, after: next, updatedAt: rows[0].updated_at };
  }
}
