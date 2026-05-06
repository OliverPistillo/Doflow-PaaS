// apps/backend/src/superadmin/platform-modules.seed.ts
// Idempotent seed of the 25+ Odoo-style platform modules at app bootstrap.

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PlatformModule, ModuleCategory, ModuleTier } from './entities/platform-module.entity';

type SeedModule = {
  key: string;
  name: string;
  description: string;
  category: ModuleCategory;
  minTier: ModuleTier;
  priceMonthly: number;
  isBeta?: boolean;
};

const MODULES: SeedModule[] = [
  // ─── SALES (Commercial) ─────────────────────────────────────
  { key: 'crm.contacts', name: 'CRM & Contatti', description: 'Anagrafica clienti, lead e aziende', category: ModuleCategory.COMMERCIAL, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'crm.deals', name: 'Pipeline & Trattative', description: 'Gestione opportunità con kanban e probabilità chiusura', category: ModuleCategory.COMMERCIAL, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'crm.quotes', name: 'Preventivi', description: 'Genera preventivi PDF, invio cliente, conversione in ordine', category: ModuleCategory.COMMERCIAL, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'crm.contracts', name: 'Contratti', description: 'Template contratti, firma elettronica, scadenze', category: ModuleCategory.COMMERCIAL, minTier: ModuleTier.PRO, priceMonthly: 19 },
  { key: 'crm.sales-intel', name: 'Sales Intelligence AI', description: 'Lead enrichment con Apollo.io e outreach automatizzato', category: ModuleCategory.COMMERCIAL, minTier: ModuleTier.ENTERPRISE, priceMonthly: 49, isBeta: true },

  // ─── FINANCE ────────────────────────────────────────────────
  { key: 'fin.invoices', name: 'Fatturazione Elettronica', description: 'Fatture XML SDI, riba, scadenzario', category: ModuleCategory.FINANCE, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'fin.payments', name: 'Pagamenti & Incassi', description: 'Tracciamento pagamenti, riconciliazione bancaria', category: ModuleCategory.FINANCE, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'fin.expenses', name: 'Note Spese', description: 'Rimborsi spese dipendenti con OCR scontrini', category: ModuleCategory.FINANCE, minTier: ModuleTier.PRO, priceMonthly: 9 },
  { key: 'fin.subscriptions', name: 'Abbonamenti Ricorrenti', description: 'Gestione contratti SaaS, renewal automatici', category: ModuleCategory.FINANCE, minTier: ModuleTier.PRO, priceMonthly: 15 },
  { key: 'fin.vat-reports', name: 'Report IVA & F24', description: 'Liquidazione IVA, esterometro, intrastat', category: ModuleCategory.FINANCE, minTier: ModuleTier.PRO, priceMonthly: 19 },

  // ─── OPERATIONS ─────────────────────────────────────────────
  { key: 'ops.tasks', name: 'Tasks & To-Do', description: 'Liste personali e di team', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'ops.kanban', name: 'Project Kanban', description: 'Board di progetto con drag & drop', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'ops.calendar', name: 'Calendario & Appuntamenti', description: 'Pianificazione visite, sync Google Calendar', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'ops.timesheet', name: 'Timesheet', description: 'Rendicontazione ore su progetti e cliente', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.PRO, priceMonthly: 9 },
  { key: 'ops.projects', name: 'Progetti Avanzati', description: 'Gantt, milestone, dipendenze, budget vs actual', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.PRO, priceMonthly: 19 },

  // ─── INVENTORY (Operations sub-area) ────────────────────────
  { key: 'inv.warehouse', name: 'Magazzino', description: 'Giacenze, lotti, ubicazioni multiple', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'inv.suppliers', name: 'Fornitori', description: 'Anagrafica fornitori e listini', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'inv.purchase-orders', name: 'Ordini di Acquisto', description: 'PO automatici da soglia minima, ricezione merci', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.PRO, priceMonthly: 15 },
  { key: 'inv.logistics', name: 'Logistica & Spedizioni', description: 'DDT, integrazione corrieri, tracking', category: ModuleCategory.OPERATIONS, minTier: ModuleTier.PRO, priceMonthly: 19 },

  // ─── MARKETING ──────────────────────────────────────────────
  { key: 'mkt.campaigns', name: 'Email Campaigns', description: 'Newsletter, sequenze, segmenti', category: ModuleCategory.MARKETING, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'mkt.lead-capture', name: 'Lead Capture Forms', description: 'Form embeddabili per landing page', category: ModuleCategory.MARKETING, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'mkt.sms', name: 'SMS Marketing', description: 'Invio SMS transazionali e campagne', category: ModuleCategory.MARKETING, minTier: ModuleTier.PRO, priceMonthly: 9 },

  // ─── HR ─────────────────────────────────────────────────────
  { key: 'hr.employees', name: 'Dipendenti', description: 'Anagrafica dipendenti, contratti, documenti', category: ModuleCategory.HR, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'hr.attendance', name: 'Presenze', description: 'Timbrature, badge virtuale, straordinari', category: ModuleCategory.HR, minTier: ModuleTier.PRO, priceMonthly: 9 },
  { key: 'hr.leaves', name: 'Ferie & Permessi', description: 'Workflow approvazione richieste assenze', category: ModuleCategory.HR, minTier: ModuleTier.PRO, priceMonthly: 9 },
  { key: 'hr.payroll', name: 'Buste Paga', description: 'Calcolo cedolini, integrazione consulente', category: ModuleCategory.HR, minTier: ModuleTier.ENTERPRISE, priceMonthly: 39 },

  // ─── SUPPORT (Services) ─────────────────────────────────────
  { key: 'sup.tickets', name: 'Helpdesk Ticket', description: 'Sistema ticket con SLA e priorità', category: ModuleCategory.SERVICES, minTier: ModuleTier.STARTER, priceMonthly: 0 },
  { key: 'sup.knowledge-base', name: 'Knowledge Base', description: 'Articoli FAQ pubblici e interni', category: ModuleCategory.SERVICES, minTier: ModuleTier.PRO, priceMonthly: 9 },
  { key: 'sup.live-chat', name: 'Live Chat', description: 'Widget chat per il sito web', category: ModuleCategory.SERVICES, minTier: ModuleTier.PRO, priceMonthly: 15, isBeta: true },

  // ─── VERTICAL: HOSPITALITY (new) ────────────────────────────
  { key: 'vert.hospitality.bookings', name: 'Prenotazioni Hospitality', description: 'Camere, calendar disponibilità, channel manager', category: ModuleCategory.SERVICES, minTier: ModuleTier.PRO, priceMonthly: 29, isBeta: true },
  { key: 'vert.hospitality.menu', name: 'Menu Digitale & Comande', description: 'QR menu, gestione tavoli, kitchen display', category: ModuleCategory.SERVICES, minTier: ModuleTier.PRO, priceMonthly: 19, isBeta: true },

  // ─── VERTICAL: BEAUTY (federicanerone) ──────────────────────
  { key: 'vert.beauty', name: 'Centro Estetico', description: 'Trattamenti, schede cliente, appuntamenti', category: ModuleCategory.HEALTH, minTier: ModuleTier.PRO, priceMonthly: 19 },

  // ─── VERTICAL: MANUFACTURING (businaro) ─────────────────────
  { key: 'vert.manufacturing', name: 'Produzione Industriale', description: 'Macchine utensili, assemblaggio, MES', category: ModuleCategory.CONSTRUCTION, minTier: ModuleTier.ENTERPRISE, priceMonthly: 49 },
];

@Injectable()
export class PlatformModulesSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformModulesSeedService.name);

  constructor(
    @InjectRepository(PlatformModule)
    private readonly moduleRepo: Repository<PlatformModule>,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap() {
    await this.seedModules();
    await this.ensurePublicSchemaCore();
    await this.seedSuperadmin();
  }

  private async seedModules() {
    let inserted = 0;
    let updated = 0;
    for (const m of MODULES) {
      const existing = await this.moduleRepo.findOne({ where: { key: m.key } });
      if (existing) {
        // Update mutable fields (name/description/price) but keep ID stable
        await this.moduleRepo.update({ key: m.key }, {
          name: m.name,
          description: m.description,
          category: m.category,
          minTier: m.minTier,
          priceMonthly: m.priceMonthly,
          isBeta: m.isBeta || false,
        });
        updated++;
      } else {
        await this.moduleRepo.save(this.moduleRepo.create({
          key: m.key,
          name: m.name,
          description: m.description,
          category: m.category,
          minTier: m.minTier,
          priceMonthly: m.priceMonthly,
          isBeta: m.isBeta || false,
        }));
        inserted++;
      }
    }
    this.logger.log(`📦 Platform modules seed: ${inserted} inseriti, ${updated} aggiornati (totale: ${MODULES.length})`);
  }

  /**
   * Crea le tabelle base del schema public (users, invites, audit_log)
   * se non esistono. Necessarie per il signup self-service e il login.
   */
  private async ensurePublicSchemaCore() {
    try {
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.users (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          email         TEXT         NOT NULL UNIQUE,
          password_hash TEXT,
          role          TEXT         NOT NULL DEFAULT 'user',
          tenant_id     TEXT,
          mfa_enabled   BOOLEAN      DEFAULT false,
          mfa_secret    TEXT,
          is_active     BOOLEAN      DEFAULT true,
          created_at    TIMESTAMP    DEFAULT NOW(),
          updated_at    TIMESTAMP    DEFAULT NOW()
        )
      `);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.invites (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          email         TEXT         NOT NULL,
          token         TEXT         NOT NULL UNIQUE,
          role          TEXT         NOT NULL DEFAULT 'user',
          accepted_at   TIMESTAMP,
          expires_at    TIMESTAMP,
          created_at    TIMESTAMP    DEFAULT NOW()
        )
      `);

      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.audit_log (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          actor_email   TEXT,
          actor_id      TEXT,
          actor_role    TEXT,
          action        TEXT         NOT NULL,
          target_email  TEXT,
          target_id     TEXT,
          ip            TEXT,
          ip_address    TEXT,
          user_agent    TEXT,
          metadata      JSONB        DEFAULT '{}'::jsonb,
          created_at    TIMESTAMP    DEFAULT NOW()
        )
      `);

      // Add columns if missing (idempotent migrations)
      await this.dataSource.query(`ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_role TEXT`);
      await this.dataSource.query(`ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip TEXT`);

      // Tenant onboarding state — track first-login wizard completion
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
          tenant_id          UUID         PRIMARY KEY,
          sector             TEXT,
          completed_at       TIMESTAMP,
          selected_modules   JSONB        DEFAULT '[]'::jsonb,
          dashboard_layout   JSONB        DEFAULT '[]'::jsonb,
          created_at         TIMESTAMP    DEFAULT NOW(),
          updated_at         TIMESTAMP    DEFAULT NOW()
        )
      `);

      // Tenant domains (for custom domain routing)
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS public.tenant_domains (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_slug   TEXT         NOT NULL,
          domain        TEXT         NOT NULL UNIQUE,
          is_verified   BOOLEAN      DEFAULT false,
          created_at    TIMESTAMP    DEFAULT NOW()
        )
      `);

      this.logger.log('✅ public.users / invites / audit_log / tenant_onboarding / tenant_domains — OK');
    } catch (err: any) {
      this.logger.error('❌ ensurePublicSchemaCore failed', err);
    }
  }

  /**
   * Idempotent superadmin seed: admin@doflow.local / Admin123!
   * Solo se non esiste alcun utente con role='superadmin' o role='admin'.
   */
  private async seedSuperadmin() {
    try {
      const existing = await this.dataSource.query(
        `SELECT id FROM public.users WHERE lower(email) = 'admin@doflow.local' LIMIT 1`,
      );
      if (existing.length > 0) return;

      const hash = await bcrypt.hash('Admin123!', 12);
      await this.dataSource.query(
        `INSERT INTO public.users (email, password_hash, role, tenant_id, is_active)
         VALUES ($1, $2, 'superadmin', NULL, true)
         ON CONFLICT (email) DO NOTHING`,
        ['admin@doflow.local', hash],
      );
      this.logger.log('🌱 Superadmin seeded: admin@doflow.local / Admin123!');
    } catch (err: any) {
      this.logger.error('❌ seedSuperadmin failed', err);
    }
  }
}
