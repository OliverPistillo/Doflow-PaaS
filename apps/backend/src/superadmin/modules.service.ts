import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformModule } from './entities/platform-module.entity';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(PlatformModule)
    private moduleRepo: Repository<PlatformModule>,
    @InjectRepository(TenantSubscription)
    private subRepo: Repository<TenantSubscription>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  // ─── Moduli catalogo ────────────────────────────────────────

  async findAllModules() {
    return this.moduleRepo.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async createModule(dto: Partial<PlatformModule>) {
    const existing = await this.moduleRepo.findOne({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Modulo '${dto.key}' già esistente.`);
    const mod = this.moduleRepo.create(dto);
    return this.moduleRepo.save(mod);
  }

  async updateModule(id: string, dto: Partial<PlatformModule>) {
    const mod = await this.moduleRepo.findOne({ where: { id } });
    if (!mod) throw new NotFoundException(`Modulo ${id} non trovato.`);
    Object.assign(mod, dto);
    return this.moduleRepo.save(mod);
  }

  async deleteModule(id: string) {
    const mod = await this.moduleRepo.findOne({ where: { id } });
    if (!mod) throw new NotFoundException(`Modulo ${id} non trovato.`);
    await this.subRepo.delete({ moduleKey: mod.key });
    await this.moduleRepo.delete(id);
    return { message: 'Modulo eliminato' };
  }

  // ─── Assegnazione moduli ai tenant ──────────────────────────

  async getModulesByTenant(tenantId: string) {
    return this.subRepo.find({
      where: { tenantId },
      relations: ['module'],
      order: { assignedAt: 'DESC' },
    });
  }

  async getTenantMatrix() {
    const tenants = await this.tenantRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    const modules = await this.moduleRepo.find({ order: { category: 'ASC', name: 'ASC' } });
    const subs = await this.subRepo.find();

    const subMap = new Map<string, Set<string>>();
    for (const s of subs) {
      if (!subMap.has(s.tenantId)) subMap.set(s.tenantId, new Set());
      subMap.get(s.tenantId)!.add(s.moduleKey);
    }

    return {
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        planTier: t.planTier,
        enabledModules: [...(subMap.get(t.id) || [])],
      })),
      modules: modules.map(m => ({
        id: m.id,
        key: m.key,
        name: m.name,
        category: m.category,
        minTier: m.minTier,
        priceMonthly: m.priceMonthly,
        isBeta: m.isBeta,
      })),
    };
  }

  async toggleModule(tenantId: string, moduleKey: string, enable: boolean) {
    if (enable) {
      const exists = await this.subRepo.findOne({ where: { tenantId, moduleKey } });
      if (exists) return exists;
      const sub = this.subRepo.create({ tenantId, moduleKey, status: 'ACTIVE' });
      return this.subRepo.save(sub);
    } else {
      await this.subRepo.delete({ tenantId, moduleKey });
      return { message: `Modulo '${moduleKey}' disattivato per tenant ${tenantId}` };
    }
  }
}
