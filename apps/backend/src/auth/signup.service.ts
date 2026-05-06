// apps/backend/src/auth/signup.service.ts
// Self-service tenant signup — pubblico, no auth richiesta.
// Crea: tenant + schema + admin user (in transazione) + auto-login JWT.

import {
  Injectable,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { normalizeSlugToSchema } from '../common/schema.utils';
import { AuthService } from '../auth.service';
import { Role } from '../roles';
import { SignupTenantDto } from './dto/signup-tenant.dto';

const RESERVED_SLUGS = new Set([
  'public', 'admin', 'superadmin', 'api', 'auth', 'login', 'register', 'signup',
  'app', 'www', 'mail', 'ftp', 'doflow', 'tenant', 'tenants', 'system',
  'support', 'help', 'docs', 'blog', 'static', 'assets', 'cdn', 'staging',
  'prod', 'production', 'dev', 'development', 'test', 'demo', 'pg_catalog',
  'information_schema', 'businaro', 'federicanerone',
]);

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
    @InjectRepository(PlatformModule) private moduleRepo: Repository<PlatformModule>,
    private dataSource: DataSource,
    private bootstrap: TenantBootstrapService,
    private authService: AuthService,
  ) {}

  /** Verifica se uno slug è disponibile. Non solleva eccezioni. */
  async checkSlugAvailability(slug: string): Promise<{ available: boolean; reason?: string }> {
    const s = (slug || '').trim().toLowerCase();
    if (!s) return { available: false, reason: 'Slug vuoto' };
    if (s.length < 3) return { available: false, reason: 'Minimo 3 caratteri' };
    if (s.length > 30) return { available: false, reason: 'Massimo 30 caratteri' };
    if (!/^[a-z0-9-]+$/.test(s)) return { available: false, reason: 'Solo lettere minuscole, numeri e trattini' };
    if (RESERVED_SLUGS.has(s)) return { available: false, reason: 'Slug riservato' };

    const existing = await this.tenantRepo.findOne({ where: { slug: s } });
    if (existing) return { available: false, reason: 'Slug già in uso' };

    return { available: true };
  }

  async signup(dto: SignupTenantDto) {
    // 1. Validation pre-flight
    const slugCheck = await this.checkSlugAvailability(dto.slug);
    if (!slugCheck.available) {
      throw new BadRequestException(`Slug non valido: ${slugCheck.reason}`);
    }

    // Check email already in directory
    const emailExists = await this.dataSource.query(
      `SELECT id FROM public.users WHERE lower(email) = lower($1) LIMIT 1`,
      [dto.email],
    );
    if (emailExists.length > 0) {
      throw new ConflictException('Esiste già un account con questa email');
    }

    const schemaName = normalizeSlugToSchema(dto.slug);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const planTier = dto.planTier || 'STARTER';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Create tenant record
      const tenant = this.tenantRepo.create({
        name: dto.companyName,
        slug: dto.slug,
        schemaName,
        adminEmail: dto.email,
        contactEmail: dto.email,
        planTier,
        isActive: true,
        maxUsers: planTier === 'ENTERPRISE' ? 999 : planTier === 'PRO' ? 25 : 5,
        storageLimitGb: planTier === 'ENTERPRISE' ? 100 : planTier === 'PRO' ? 25 : 5,
      });
      const savedTenant = await queryRunner.manager.save(tenant);

      // 3. Provision tenant schema (uses public.users LIKE pattern)
      await this.bootstrap.ensureTenantTables(queryRunner.manager.connection, schemaName);

      // 4. Create owner user inside tenant schema
      const ownerInsert = await queryRunner.query(
        `INSERT INTO "${schemaName}"."users"
           (email, role, password_hash, is_active, created_at, updated_at)
         VALUES ($1, 'owner', $2, true, now(), now())
         RETURNING id, email, role, created_at`,
        [dto.email, passwordHash],
      );

      // 5. Insert into directory (public.users) for cross-schema lookup
      await queryRunner.query(
        `INSERT INTO public.users
           (email, role, password_hash, tenant_id, is_active, created_at, updated_at)
         VALUES ($1, 'owner', $2, $3, true, now(), now())
         ON CONFLICT (email) DO UPDATE
           SET tenant_id = EXCLUDED.tenant_id, password_hash = EXCLUDED.password_hash`,
        [dto.email, passwordHash, savedTenant.id],
      );

      // 6. Auto-subscribe to all STARTER-tier modules (free trial)
      const starterModules = await queryRunner.manager.find(PlatformModule, {
        where: { minTier: 'STARTER' as any },
      });
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      for (const mod of starterModules) {
        await queryRunner.manager.save(TenantSubscription, {
          tenantId: savedTenant.id,
          moduleKey: mod.key,
          status: 'TRIAL',
          trialEndsAt,
        });
      }

      await queryRunner.commitTransaction();

      // 7. Add to Redis cache
      await this.bootstrap.addTenantToCache(dto.slug);

      // 8. Issue JWT (auto-login). Use AuthService's public sign method.
      const ownerUser = ownerInsert[0];
      const token = this.authService.signTokenPublic(
        ownerUser.id,
        dto.email,
        schemaName,
        dto.slug,
        'owner' as Role,
        { authStage: 'FULL', mfaRequired: false },
      );

      this.logger.log(`✅ Tenant signup: ${dto.companyName} (${dto.slug}) — owner: ${dto.email}`);

      return {
        tenant: {
          id: savedTenant.id,
          name: savedTenant.name,
          slug: savedTenant.slug,
          planTier: savedTenant.planTier,
          schemaName,
        },
        user: {
          id: ownerUser.id,
          email: ownerUser.email,
          role: 'owner',
          tenantId: schemaName,
          tenantSlug: dto.slug,
        },
        token,
        nextStep: 'onboarding', // frontend redirect to /onboarding wizard
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Errore signup tenant:', err);
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Errore durante la creazione del tenant. Riprova più tardi.',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
