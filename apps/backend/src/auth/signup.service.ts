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
import * as jwt from 'jsonwebtoken';

import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { TenantBootstrapService } from '../tenancy/tenant-bootstrap.service';
import { normalizeSlugToSchema } from '../common/schema.utils';
import { AuthService } from '../auth.service';
import { Role } from '../roles';
import { SignupTenantDto } from './dto/signup-tenant.dto';

type GoogleSignupPayload = jwt.JwtPayload & {
  purpose?: 'google_signup';
  googleId?: string;
  email?: string;
  fullName?: string;
  picture?: string;
};

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

  private verifyGoogleSignupToken(token?: string): GoogleSignupPayload | null {
    if (!token) return null;

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    try {
      const decoded = jwt.verify(token, secret) as GoogleSignupPayload;
      if (decoded.purpose !== 'google_signup' || !decoded.googleId || !decoded.email) {
        throw new Error('Invalid Google signup token payload');
      }
      return {
        ...decoded,
        email: decoded.email.toLowerCase(),
      };
    } catch {
      throw new BadRequestException('Sessione Google non valida o scaduta. Ripeti accesso con Google.');
    }
  }

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
    const googleSignup = this.verifyGoogleSignupToken(dto.googleSignupToken);
    const email = (googleSignup?.email || dto.email || '').trim().toLowerCase();
    const fullName = (googleSignup?.fullName || dto.fullName || '').trim() || null;

    if (!email) {
      throw new BadRequestException('Email obbligatoria');
    }

    if (!googleSignup && !dto.password) {
      throw new BadRequestException('Password obbligatoria per la registrazione email/password');
    }

    // 1. Validation pre-flight
    const slugCheck = await this.checkSlugAvailability(dto.slug);
    if (!slugCheck.available) {
      throw new BadRequestException(`Slug non valido: ${slugCheck.reason}`);
    }

    // Check email already in directory
    const emailExists = await this.dataSource.query(
      `SELECT id FROM public.users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    if (emailExists.length > 0) {
      throw new ConflictException('Esiste già un account con questa email');
    }

    const schemaName = normalizeSlugToSchema(dto.slug);
    const passwordHash = googleSignup ? null : await bcrypt.hash(dto.password as string, 12);
    const authProvider = googleSignup ? 'google' : 'password';
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
        adminEmail: email,
        contactEmail: email,
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
           (email, role, password_hash, full_name, auth_provider, google_id, avatar_url, email_verified_at, is_active, created_at, updated_at)
         VALUES ($1, 'owner', $2, $3, $4, $5, $6, CASE WHEN $5 IS NULL THEN NULL ELSE now() END, true, now(), now())
         RETURNING id, email, role, created_at`,
        [email, passwordHash, fullName, authProvider, googleSignup?.googleId || null, googleSignup?.picture || null],
      );

      // 5. Insert into directory (public.users) for cross-schema lookup
      await queryRunner.query(
        `INSERT INTO public.users
           (id, email, role, password_hash, tenant_id, full_name, auth_provider, google_id, avatar_url, email_verified_at, is_active, created_at, updated_at)
         VALUES ($1, $2, 'owner', $3, $4, $5, $6, $7, $8, CASE WHEN $7 IS NULL THEN NULL ELSE now() END, true, now(), now())
         ON CONFLICT (email) DO UPDATE
           SET tenant_id = EXCLUDED.tenant_id,
               password_hash = EXCLUDED.password_hash,
               full_name = EXCLUDED.full_name,
               auth_provider = EXCLUDED.auth_provider,
               google_id = EXCLUDED.google_id,
               avatar_url = EXCLUDED.avatar_url,
               email_verified_at = COALESCE(public.users.email_verified_at, EXCLUDED.email_verified_at),
               updated_at = now()`,
        [ownerInsert[0].id, email, passwordHash, savedTenant.id, fullName, authProvider, googleSignup?.googleId || null, googleSignup?.picture || null],
      );

      // 6. Auto-subscribe to all STARTER-tier modules (free trial)
      const starterModules = await queryRunner.manager.find(PlatformModule, {
        where: { minTier: 'STARTER' as any },
      });
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const subscriptions = starterModules.map((mod) => {
        const sub = new TenantSubscription();
        sub.tenantId = savedTenant.id;
        sub.moduleKey = mod.key;
        sub.status = 'TRIAL';
        sub.trialEndsAt = trialEndsAt;
        return sub;
      });

      if (subscriptions.length > 0) {
        await queryRunner.manager.save(subscriptions);
      }

      await queryRunner.commitTransaction();

      // 7. Add to Redis cache
      await this.bootstrap.addTenantToCache(dto.slug);

      // 8. Issue JWT (auto-login). Use AuthService's public sign method.
      const ownerUser = ownerInsert[0];
      const token = this.authService.signTokenPublic(
        ownerUser.id,
        email,
        schemaName,
        dto.slug,
        'owner' as Role,
        { authStage: 'FULL', mfaRequired: false },
      );

      this.logger.log(`✅ Tenant signup: ${dto.companyName} (${dto.slug}) — owner: ${email} via ${authProvider}`);

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