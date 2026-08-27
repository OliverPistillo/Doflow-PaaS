import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { TenantCommercialAccessService, CommercialActor } from './tenant-commercial-access.service';
import { boundedText, rejectActorOverride, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { withTenantIdempotency } from './tenant-universal-idempotency';
import { ensureTenantBackendContractTables } from './tenant-backend-contracts-schema';
import { safeSchema } from '../common/schema.utils';

@Injectable()
export class TenantBackendContractsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: TenantCommercialAccessService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private async actor(...capabilities: string[]) {
    const actor = await this.access.current();
    if (capabilities.length) this.access.require(actor, ...capabilities);
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    return actor;
  }
  private version(value: unknown) {
    const version = Number(value);
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('optimisticVersion obbligatoria');
    return version;
  }
  private integer(value: unknown, label: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) throw new BadRequestException(`${label} non valido`);
    return number;
  }
  private textArray(value: unknown, label: string, maxItems = 30, maxLength = 80) {
    if (!Array.isArray(value) || value.length > maxItems) throw new BadRequestException(`${label} non valido`);
    const values = [...new Set(value.map((item) => boundedText(item, label, maxLength, true)))];
    return values;
  }
  private object(value: unknown, label: string, maxBytes = 100_000) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`${label} non valido`);
    if (Buffer.byteLength(JSON.stringify(value)) > maxBytes) throw new BadRequestException(`${label} troppo grande`);
    return value as Record<string, unknown>;
  }
  private async company(actor: CommercialActor, value: string) {
    const id = tenantUuid(value, 'companyId');
    const rows = await this.dataSource.query(`SELECT id FROM "${actor.schema}".companies WHERE id=$1 AND deleted_at IS NULL`, [id]);
    if (!rows[0]) throw new NotFoundException('Cliente non trovato');
    return id;
  }

  private readonly calendarCategories = ['activity','appointment','project','contract','quote','payment','renewal','support'];
  private async calendarStatus(actor: CommercialActor) {
    const rows = await this.dataSource.query(`SELECT enabled_categories,ics_token_hash,ics_token_suffix,token_created_at,last_successful_sync_at,optimistic_version FROM "${actor.schema}".calendar_integration_preferences WHERE user_id=$1`, [actor.id]);
    const preference = rows[0];
    const categories = preference?.enabled_categories?.length ? preference.enabled_categories : this.calendarCategories;
    const counts = await this.dataSource.query(`SELECT COUNT(*)::integer AS count FROM "${actor.schema}".calendar_integration_events WHERE user_id=$1 AND archived_at IS NULL AND category=ANY($2::text[])`, [actor.id, categories]);
    return {
      hasIcsFeed: Boolean(preference?.ics_token_hash),
      icsTokenSuffix: preference?.ics_token_suffix || undefined,
      tokenCreatedAt: preference?.token_created_at || undefined,
      categories,
      eventCount: Number(counts[0]?.count || 0),
      lastSuccessfulSyncAt: preference?.last_successful_sync_at || undefined,
      optimisticVersion: Number(preference?.optimistic_version || 0),
      google: { configured: false, connected: false, reconnectRequired: false, state: 'Non disponibile' },
    };
  }
  async calendarIntegrations() {
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    return this.calendarStatus(actor);
  }
  async updateCalendarIntegrations(body: Record<string, unknown>) {
    rejectActorOverride(body);
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    const allowed = new Set(this.calendarCategories);
    const categories = this.textArray(body.enabledCategories ?? body.enabled_categories, 'enabledCategories', this.calendarCategories.length, 30);
    if (categories.some((item) => !allowed.has(item))) throw new BadRequestException('Categoria calendario non valida');
    await this.dataSource.query(`INSERT INTO "${actor.schema}".calendar_integration_preferences (user_id,enabled_categories) VALUES ($1,$2::text[]) ON CONFLICT (user_id) DO UPDATE SET enabled_categories=EXCLUDED.enabled_categories,optimistic_version="${actor.schema}".calendar_integration_preferences.optimistic_version+1,updated_at=now()`, [actor.id, categories]);
    return this.calendarStatus(actor);
  }
  async rotateIcsToken() {
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    const suffix = token.slice(-8);
    await this.dataSource.query(`INSERT INTO "${actor.schema}".calendar_integration_preferences (user_id,ics_token_hash,ics_token_suffix,token_created_at) VALUES ($1,$2,$3,now()) ON CONFLICT (user_id) DO UPDATE SET ics_token_hash=EXCLUDED.ics_token_hash,ics_token_suffix=EXCLUDED.ics_token_suffix,token_created_at=now(),optimistic_version="${actor.schema}".calendar_integration_preferences.optimistic_version+1,updated_at=now()`, [actor.id, hash, suffix]);
    return { ...await this.calendarStatus(actor), icsToken: token };
  }
  async revokeIcsToken() {
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    await this.dataSource.query(`INSERT INTO "${actor.schema}".calendar_integration_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET ics_token_hash=NULL,ics_token_suffix=NULL,token_created_at=NULL,optimistic_version="${actor.schema}".calendar_integration_preferences.optimistic_version+1,updated_at=now()`, [actor.id]);
    return this.calendarStatus(actor);
  }
  async syncCalendarProjection(body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    const categories = this.textArray(body.categories, 'categories', this.calendarCategories.length, 30);
    if (categories.some((item) => !this.calendarCategories.includes(item))) throw new BadRequestException('Categoria calendario non valida');
    if (!Array.isArray(body.events) || body.events.length > 2_000) throw new BadRequestException('events non validi');
    const events = body.events.map((value, index) => {
      const event = this.object(value, `events[${index}]`, 20_000);
      const category = boundedText(event.category, `events[${index}].category`, 30, true);
      if (!this.calendarCategories.includes(category)) throw new BadRequestException(`events[${index}].category non valida`);
      const startsAt = new Date(String(event.startsAt || ''));
      const endsAt = event.endsAt ? new Date(String(event.endsAt)) : null;
      if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) throw new BadRequestException(`events[${index}] data non valida`);
      if (endsAt && endsAt < startsAt) throw new BadRequestException(`events[${index}].endsAt non valida`);
      return {
        key: boundedText(event.id, `events[${index}].id`, 200, true),
        title: boundedText(event.title, `events[${index}].title`, 300, true),
        startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() || null, category,
        status: boundedText(event.status, `events[${index}].status`, 80) || null,
        description: boundedText(event.description, `events[${index}].description`, 4_000) || null,
      };
    });
    await this.dataSource.transaction((manager) => withTenantIdempotency(manager, actor.schema, `calendar-projection:${actor.id}`, key, { categories, events }, actor.id, async () => {
      await manager.query(`UPDATE "${actor.schema}".calendar_integration_events SET archived_at=now(),updated_at=now() WHERE user_id=$1 AND archived_at IS NULL`, [actor.id]);
      for (const event of events) {
        await manager.query(`INSERT INTO "${actor.schema}".calendar_integration_events (user_id,event_key,title,starts_at,ends_at,category,status,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id,event_key) DO UPDATE SET title=$3,starts_at=$4,ends_at=$5,category=$6,status=$7,description=$8,archived_at=NULL,updated_at=now()`, [actor.id,event.key,event.title,event.startsAt,event.endsAt,event.category,event.status,event.description]);
      }
      await manager.query(`INSERT INTO "${actor.schema}".calendar_integration_preferences (user_id,enabled_categories,last_successful_sync_at) VALUES ($1,$2::text[],now()) ON CONFLICT (user_id) DO UPDATE SET enabled_categories=$2::text[],last_successful_sync_at=now(),optimistic_version="${actor.schema}".calendar_integration_preferences.optimistic_version+1,updated_at=now()`, [actor.id,categories]);
      return { synced: true, eventCount: events.length };
    }));
    return this.calendarStatus(actor);
  }
  async disconnectGoogleCalendar() {
    const actor = await this.actor('canViewActivities', 'canViewProjects');
    return this.calendarStatus(actor);
  }
  async calendarFeed(tokenValue: string) {
    const token = String(tokenValue || '').trim();
    if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) throw new NotFoundException('Feed calendario non trovato');
    const hash = createHash('sha256').update(token).digest('hex');
    const registry: Array<{ schema_name: string }> = await this.dataSource.query(`SELECT DISTINCT schema_name FROM public.tenants WHERE schema_name IS NOT NULL ORDER BY schema_name`);
    for (const row of registry) {
      const schema = safeSchema(row.schema_name, 'calendarFeed');
      if (schema === 'public') continue;
      let preferences: any[];
      try {
        preferences = await this.dataSource.query(`SELECT user_id,enabled_categories FROM "${schema}".calendar_integration_preferences WHERE ics_token_hash=$1`, [hash]);
      } catch (error) {
        if ((error as { code?: string }).code === '42P01') continue;
        throw error;
      }
      if (!preferences[0]) continue;
      const events = await this.dataSource.query(`SELECT event_key,title,starts_at,ends_at,category,status,description FROM "${schema}".calendar_integration_events WHERE user_id=$1 AND archived_at IS NULL AND category=ANY($2::text[]) ORDER BY starts_at,event_key`, [preferences[0].user_id,preferences[0].enabled_categories]);
      const escape = (value: unknown) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
      const stamp = (value: unknown) => new Date(String(value)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const generatedAt = stamp(new Date());
      const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Doflow//Calendar Integration//IT','CALSCALE:GREGORIAN','X-WR-CALNAME:Doflow'];
      for (const event of events) {
        lines.push('BEGIN:VEVENT',`UID:${createHash('sha256').update(`${schema}:${preferences[0].user_id}:${event.event_key}`).digest('hex')}@doflow.it`,`DTSTAMP:${generatedAt}`,`DTSTART:${stamp(event.starts_at)}`);
        if (event.ends_at) lines.push(`DTEND:${stamp(event.ends_at)}`);
        lines.push(`SUMMARY:${escape(event.title)}`,`CATEGORIES:${escape(event.category)}`);
        if (event.description) lines.push(`DESCRIPTION:${escape(event.description)}`);
        if (event.status) lines.push(`X-DOFLOW-STATUS:${escape(event.status)}`);
        lines.push('END:VEVENT');
      }
      return `${lines.concat('END:VCALENDAR').join('\r\n')}\r\n`;
    }
    throw new NotFoundException('Feed calendario non trovato');
  }

  async commerceSettings() {
    const actor = await this.actor('canViewOrders', 'canViewCommercialValues');
    const rows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".commerce_settings WHERE singleton=true`);
    return rows[0] || null;
  }
  async updateCommerceSettings(body: Record<string, unknown>) {
    rejectActorOverride(body);
    const actor = await this.actor('canManageCommerceRules');
    const allowed=new Set(['optimisticVersion','optimistic_version','autoNumberOrders','requireDeposit','defaultDepositPercent','defaultPaymentTermsDays','defaultCurrency','supplierName','supplierVatNumber','supplierTaxCode','supplierAddress','orderPrefix','contractPrefix','enabledSalesChannels','requireSignedContract','defaultVatRate','supplierBrandName','supplierLegalHolder','supplierEmail','supplierPhone','supplierPostalCode','supplierCity','supplierProvince','supplierCountry','supplierCertifiedEmail','supplierSdiCode','supplierWebsite','supplierLogoUrl','quoteValidityDays','paymentTerms','bankDetails','defaultNotes','enabledPaymentMethods','renewalReminderDays']);
    const unknown=Object.keys(body).find((key)=>!allowed.has(key));if(unknown)throw new BadRequestException(`${unknown} non supportato`);
    const version = this.version(body.optimisticVersion ?? body.optimistic_version);
    const currentRows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".commerce_settings WHERE singleton=true`);
    const current = currentRows[0] || { optimistic_version: 1 };
    if (currentRows[0] && Number(current.optimistic_version) !== version) throw new ConflictException('Impostazioni modificate da un altro utente');
    const bool = (key: string, fallback: boolean) => body[key] === undefined ? fallback : body[key] === true;
    const value = {
      auto: bool('autoNumberOrders', current.auto_number_orders ?? true), requireDeposit: bool('requireDeposit', current.require_deposit ?? false),
      deposit: body.defaultDepositPercent === undefined ? Number(current.default_deposit_percent || 0) : Number(body.defaultDepositPercent),
      terms: body.defaultPaymentTermsDays === undefined ? Number(current.default_payment_terms_days || 30) : this.integer(body.defaultPaymentTermsDays, 'defaultPaymentTermsDays', 0, 3650),
      currency: boundedText(body.defaultCurrency ?? current.default_currency ?? 'EUR', 'defaultCurrency', 3, true).toUpperCase(),
      supplierName: boundedText(body.supplierName ?? current.supplier_name, 'supplierName', 200), vat: boundedText(body.supplierVatNumber ?? current.supplier_vat_number, 'supplierVatNumber', 32),
      taxCode: boundedText(body.supplierTaxCode ?? current.supplier_tax_code, 'supplierTaxCode', 32), address: boundedText(body.supplierAddress ?? current.supplier_address, 'supplierAddress', 500),
      orderPrefix: boundedText(body.orderPrefix ?? current.order_prefix ?? 'ORD', 'orderPrefix', 12, true), contractPrefix: boundedText(body.contractPrefix ?? current.contract_prefix ?? 'CTR', 'contractPrefix', 12, true),
      channels: body.enabledSalesChannels === undefined ? (current.enabled_sales_channels || []) : this.textArray(body.enabledSalesChannels, 'enabledSalesChannels', 20, 40),
      signed: bool('requireSignedContract', current.require_signed_contract ?? true), vatRate: body.defaultVatRate === undefined ? Number(current.default_vat_rate || 22) : Number(body.defaultVatRate),
      brand: boundedText(body.supplierBrandName ?? current.supplier_brand_name,'supplierBrandName',200), holder: boundedText(body.supplierLegalHolder ?? current.supplier_legal_holder,'supplierLegalHolder',200),
      email: boundedText(body.supplierEmail ?? current.supplier_email,'supplierEmail',254), phone: boundedText(body.supplierPhone ?? current.supplier_phone,'supplierPhone',50), postal: boundedText(body.supplierPostalCode ?? current.supplier_postal_code,'supplierPostalCode',20), city: boundedText(body.supplierCity ?? current.supplier_city,'supplierCity',100), province: boundedText(body.supplierProvince ?? current.supplier_province,'supplierProvince',100), country: boundedText(body.supplierCountry ?? current.supplier_country,'supplierCountry',100), certifiedEmail: boundedText(body.supplierCertifiedEmail ?? current.supplier_certified_email,'supplierCertifiedEmail',254), sdi: boundedText(body.supplierSdiCode ?? current.supplier_sdi_code,'supplierSdiCode',20), website: boundedText(body.supplierWebsite ?? current.supplier_website,'supplierWebsite',500), logo: boundedText(body.supplierLogoUrl ?? current.supplier_logo_url,'supplierLogoUrl',1000),
      quoteDays: body.quoteValidityDays === undefined ? Number(current.quote_validity_days || 30) : this.integer(body.quoteValidityDays,'quoteValidityDays',1,3650), paymentTerms: boundedText(body.paymentTerms ?? current.payment_terms,'paymentTerms',2000), bank: boundedText(body.bankDetails ?? current.bank_details,'bankDetails',4000), notes: boundedText(body.defaultNotes ?? current.default_notes,'defaultNotes',4000), methods: body.enabledPaymentMethods === undefined ? (current.enabled_payment_methods||[]) : this.textArray(body.enabledPaymentMethods,'enabledPaymentMethods',20,60), reminderDays: body.renewalReminderDays === undefined ? Number(current.renewal_reminder_days||30) : this.integer(body.renewalReminderDays,'renewalReminderDays',0,3650),
    };
    if (!Number.isFinite(value.deposit) || value.deposit < 0 || value.deposit > 100) throw new BadRequestException('defaultDepositPercent non valido');
    if (!Number.isFinite(value.vatRate) || value.vatRate < 0 || value.vatRate > 100) throw new BadRequestException('defaultVatRate non valido');
    if (!/^[A-Z]{3}$/.test(value.currency)) throw new BadRequestException('defaultCurrency non valida');
    const changedFields=Object.keys(body).filter((key)=>!['optimisticVersion','optimistic_version'].includes(key)).sort();
    const rows = await this.dataSource.query(`WITH changed AS (INSERT INTO "${actor.schema}".commerce_settings
      (singleton,auto_number_orders,require_deposit,default_deposit_percent,default_payment_terms_days,default_currency,
       supplier_name,supplier_vat_number,supplier_tax_code,supplier_address,order_prefix,contract_prefix,enabled_sales_channels,
       require_signed_contract,default_vat_rate,supplier_brand_name,supplier_legal_holder,supplier_email,supplier_phone,
       supplier_postal_code,supplier_city,supplier_province,supplier_country,supplier_certified_email,supplier_sdi_code,
       supplier_website,supplier_logo_url,quote_validity_days,payment_terms,bank_details,default_notes,enabled_payment_methods,
       renewal_reminder_days,optimistic_version,updated_by)
      VALUES (true,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,1,$33)
      ON CONFLICT (singleton) DO UPDATE SET
       auto_number_orders=EXCLUDED.auto_number_orders,require_deposit=EXCLUDED.require_deposit,
       default_deposit_percent=EXCLUDED.default_deposit_percent,default_payment_terms_days=EXCLUDED.default_payment_terms_days,
       default_currency=EXCLUDED.default_currency,supplier_name=EXCLUDED.supplier_name,
       supplier_vat_number=EXCLUDED.supplier_vat_number,supplier_tax_code=EXCLUDED.supplier_tax_code,
       supplier_address=EXCLUDED.supplier_address,order_prefix=EXCLUDED.order_prefix,contract_prefix=EXCLUDED.contract_prefix,
       enabled_sales_channels=EXCLUDED.enabled_sales_channels,require_signed_contract=EXCLUDED.require_signed_contract,
       default_vat_rate=EXCLUDED.default_vat_rate,supplier_brand_name=EXCLUDED.supplier_brand_name,
       supplier_legal_holder=EXCLUDED.supplier_legal_holder,supplier_email=EXCLUDED.supplier_email,
       supplier_phone=EXCLUDED.supplier_phone,supplier_postal_code=EXCLUDED.supplier_postal_code,
       supplier_city=EXCLUDED.supplier_city,supplier_province=EXCLUDED.supplier_province,
       supplier_country=EXCLUDED.supplier_country,supplier_certified_email=EXCLUDED.supplier_certified_email,
       supplier_sdi_code=EXCLUDED.supplier_sdi_code,supplier_website=EXCLUDED.supplier_website,
       supplier_logo_url=EXCLUDED.supplier_logo_url,quote_validity_days=EXCLUDED.quote_validity_days,
       payment_terms=EXCLUDED.payment_terms,bank_details=EXCLUDED.bank_details,default_notes=EXCLUDED.default_notes,
       enabled_payment_methods=EXCLUDED.enabled_payment_methods,renewal_reminder_days=EXCLUDED.renewal_reminder_days,
       optimistic_version="${actor.schema}".commerce_settings.optimistic_version+1,updated_by=EXCLUDED.updated_by,updated_at=now()
      WHERE "${actor.schema}".commerce_settings.optimistic_version=$34 RETURNING *),
      logged AS (INSERT INTO "${actor.schema}".commerce_settings_audit (actor_user_id,from_version,to_version,changed_fields)
        SELECT $33,$34,optimistic_version,$35::text[] FROM changed)
      SELECT * FROM changed`,
      [value.auto,value.requireDeposit,value.deposit,value.terms,value.currency,value.supplierName||null,value.vat||null,value.taxCode||null,value.address||null,value.orderPrefix,value.contractPrefix,value.channels,value.signed,value.vatRate,value.brand||null,value.holder||null,value.email||null,value.phone||null,value.postal||null,value.city||null,value.province||null,value.country||null,value.certifiedEmail||null,value.sdi||null,value.website||null,value.logo||null,value.quoteDays,value.paymentTerms||null,value.bank||null,value.notes||null,value.methods,value.reminderDays,actor.id,version,changedFields]);
    if (!rows[0]) throw new ConflictException('Impostazioni modificate da un altro utente');
    return rows[0];
  }

  async customerCare(companyValue: string) { const actor = await this.actor('canViewCustomers'); const id = await this.company(actor, companyValue); const rows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".customer_care_settings WHERE company_id=$1`, [id]); return rows[0] || null; }
  async customerContractState() {
    const actor=await this.actor('canViewCustomers');
    const canViewFinance=this.access.has(actor,'canViewCommercialValues');
    const [care,documents,finance]=await Promise.all([
      this.dataSource.query(`SELECT s.* FROM "${actor.schema}".customer_care_settings s JOIN "${actor.schema}".companies c ON c.id=s.company_id AND c.deleted_at IS NULL ORDER BY s.company_id`),
      this.dataSource.query(`SELECT d.* FROM "${actor.schema}".customer_document_metadata d JOIN "${actor.schema}".companies c ON c.id=d.company_id AND c.deleted_at IS NULL WHERE d.archived_at IS NULL ORDER BY d.company_id,d.sort_order,d.created_at`),
      canViewFinance?this.dataSource.query(`SELECT f.* FROM "${actor.schema}".customer_finance_snapshots f JOIN "${actor.schema}".companies c ON c.id=f.company_id AND c.deleted_at IS NULL ORDER BY f.company_id`):Promise.resolve([]),
    ]);
    return {care,documents,finance,financeRedacted:!canViewFinance};
  }
  async updateCustomerCare(companyValue: string, body: Record<string, unknown>) {
    rejectActorOverride(body); const actor = await this.actor('canEditCustomers'); const id = await this.company(actor, companyValue);
    const mode = boundedText(body.mode, 'mode', 60, true); if(!['Nessuna','Assistenza','Rinnovo'].includes(mode))throw new BadRequestException('mode non valida'); const cadence = body.cadenceDays == null ? null : this.integer(body.cadenceDays, 'cadenceDays', 1, 3650);
    const owner = body.ownerUserId ? tenantUuid(body.ownerUserId, 'ownerUserId') : null; const due = body.nextDueAt ? new Date(String(body.nextDueAt)) : null;
    if (due && Number.isNaN(due.getTime())) throw new BadRequestException('nextDueAt non valida');
    if (owner) { const users = await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".users WHERE id=$1 AND COALESCE(is_active,true)=true`, [owner]); if (!users[0]) throw new BadRequestException('Owner non appartenente al tenant'); }
    const version = Number(body.optimisticVersion ?? 0); const rows = await this.dataSource.query(`INSERT INTO "${actor.schema}".customer_care_settings (company_id,mode,cadence_days,owner_user_id,next_due_at,notifications_enabled,notes,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (company_id) DO UPDATE SET mode=$2,cadence_days=$3,owner_user_id=$4,next_due_at=$5,notifications_enabled=$6,notes=$7,updated_by=$8,optimistic_version="${actor.schema}".customer_care_settings.optimistic_version+1,updated_at=now() WHERE $9=0 OR "${actor.schema}".customer_care_settings.optimistic_version=$9 RETURNING *`, [id,mode,cadence,owner,due?.toISOString()||null,body.notificationsEnabled !== false,boundedText(body.notes,'notes',4000)||null,actor.id,version]);
    if (!rows[0]) throw new ConflictException('Customer care modificata da un altro utente'); return rows[0];
  }

  async customerFinance(companyValue: string) { const actor = await this.actor('canViewCommercialValues'); const id = await this.company(actor, companyValue); const rows = await this.dataSource.query(`SELECT * FROM "${actor.schema}".customer_finance_snapshots WHERE company_id=$1`, [id]); return rows[0] || null; }
  async updateCustomerFinance(companyValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body); const actor = await this.actor('canEditCustomers', 'canManageCommerceRules'); const id = await this.company(actor, companyValue); const expected = this.version(body.optimisticVersion ?? body.optimistic_version);
    const fields = ['totalCents','depositCents','paidCents','invoicedCents'] as const; const amounts = fields.map((field) => this.integer(body[field], field, 0, 9_000_000_000_000));
    if(amounts.slice(1).some((amount)=>amount>amounts[0]))throw new BadRequestException('Deposito, pagato e fatturato non possono superare il totale');
    const currency = boundedText(body.currency ?? 'EUR','currency',3,true).toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('currency non valida');
    return this.dataSource.transaction((manager) => withTenantIdempotency(manager,actor.schema,`customer-finance:${id}`,key,{expected,amounts,currency},actor.id,async()=>{
      const existing = await manager.query(`SELECT optimistic_version FROM "${actor.schema}".customer_finance_snapshots WHERE company_id=$1 FOR UPDATE`,[id]);
      if (existing[0] && Number(existing[0].optimistic_version)!==expected) throw new ConflictException('Dati finanziari modificati da un altro utente');
      const rows = await manager.query(`INSERT INTO "${actor.schema}".customer_finance_snapshots (company_id,total_cents,deposit_cents,paid_cents,invoiced_cents,revenue_cents,cost_cents,refunded_cents,currency,note,updated_by) VALUES ($1,$2,$3,$4,$5,0,0,0,$6,$7,$8) ON CONFLICT (company_id) DO UPDATE SET total_cents=$2,deposit_cents=$3,paid_cents=$4,invoiced_cents=$5,currency=$6,note=$7,updated_by=$8,optimistic_version="${actor.schema}".customer_finance_snapshots.optimistic_version+1,updated_at=now() RETURNING *`,[id,...amounts,currency,boundedText(body.note,'note',2000)||null,actor.id]);
      await manager.query(`INSERT INTO "${actor.schema}".customer_finance_audit (company_id,actor_user_id,from_version,to_version,changed_fields) VALUES ($1,$2,$3,$4,$5::text[])`,[id,actor.id,existing[0]?.optimistic_version||0,rows[0].optimistic_version,fields]); return rows[0];
    }));
  }

  async customerDocuments(companyValue: string) { const actor = await this.actor('canViewCustomers'); const id = await this.company(actor,companyValue); return { items: await this.dataSource.query(`SELECT * FROM "${actor.schema}".customer_document_metadata WHERE company_id=$1 AND archived_at IS NULL ORDER BY sort_order,created_at`,[id]) }; }
  async addCustomerDocument(companyValue: string, body: Record<string, unknown>, key?: string) { rejectActorOverride(body); const actor=await this.actor('canEditCustomers'); const companyId=await this.company(actor,companyValue); const input=this.documentInput(body); await this.validateDocumentRelation(actor,companyId,input); const requestedId=body.id?tenantUuid(body.id,'documentId'):null; return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`customer-document:${companyId}`,key,{...input,requestedId},actor.id,async()=>{ const rows=await manager.query(`INSERT INTO "${actor.schema}".customer_document_metadata (id,company_id,title,category,description,relation_type,relation_id,tags,visibility,sort_order,created_by,updated_by) VALUES (COALESCE($1,uuid_generate_v4()),$2,$3,$4,$5,$6,$7,$8::text[],$9,$10,$11,$11) RETURNING *`,[requestedId,companyId,input.title,input.category,input.description,input.relationType,input.relationId,input.tags,input.visibility,input.sortOrder,actor.id]); return rows[0]; })); }
  private documentInput(body: Record<string, unknown>, current: any = {}) {
    const visibility=String(body.visibility??current.visibility??'internal');if(!['internal','shared'].includes(visibility))throw new BadRequestException('visibility non valida');
    const category=boundedText(body.category??current.category,'category',80)||null;const categories=new Set(['Da ricevere','Ricevuto','Da firmare','Firmato','In revisione','Rifiutato','Scaduto','Archiviato']);if(category&&!categories.has(category))throw new BadRequestException('category non valida');
    const relationType=body.relationType===undefined?(current.relation_type||null):(body.relationType?boundedText(body.relationType,'relationType',50,true):null);
    const relationId=body.relationId===undefined?(current.relation_id||null):(body.relationId?tenantUuid(body.relationId,'relationId'):null);
    return {title:boundedText(body.title??current.title,'title',200,true),category,description:boundedText(body.description??current.description,'description',4000)||null,relationType,relationId,tags:body.tags===undefined?(current.tags||[]):this.textArray(body.tags,'tags',30,60),visibility,sortOrder:body.sortOrder===undefined?Number(current.sort_order||0):this.integer(body.sortOrder,'sortOrder',0,100000)};
  }
  private async validateDocumentRelation(actor:CommercialActor,companyId:string,input:{relationType:string|null;relationId:string|null}){if(!input.relationType&&!input.relationId)return;if(input.relationType!=='project'||!input.relationId)throw new BadRequestException('Relazione documento non valida');const rows=await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".projects WHERE id=$1 AND company_id=$2 AND deleted_at IS NULL`,[input.relationId,companyId]);if(!rows[0])throw new BadRequestException('Progetto non accessibile per il cliente');}
  async updateCustomerDocument(companyValue:string,documentValue:string,body:Record<string,unknown>){ rejectActorOverride(body); const actor=await this.actor('canEditCustomers'); const companyId=await this.company(actor,companyValue); const documentId=tenantUuid(documentValue,'documentId'); const existing=await this.dataSource.query(`SELECT * FROM "${actor.schema}".customer_document_metadata WHERE id=$1 AND company_id=$2 AND archived_at IS NULL`,[documentId,companyId]); if(!existing[0]) throw new NotFoundException('Documento non trovato'); const expected=this.version(body.optimisticVersion??body.optimistic_version); const input=this.documentInput(body,existing[0]); await this.validateDocumentRelation(actor,companyId,input); const rows=await this.dataSource.query(`UPDATE "${actor.schema}".customer_document_metadata SET title=$3,category=$4,description=$5,relation_type=$6,relation_id=$7,tags=$8::text[],visibility=$9,sort_order=$10,updated_by=$11,updated_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND company_id=$2 AND optimistic_version=$12 RETURNING *`,[documentId,companyId,input.title,input.category,input.description,input.relationType,input.relationId,input.tags,input.visibility,input.sortOrder,actor.id,expected]); if(!rows[0]) throw new ConflictException('Documento modificato da un altro utente'); return rows[0]; }
  async archiveCustomerDocument(companyValue:string,documentValue:string){ const actor=await this.actor('canEditCustomers'); const companyId=await this.company(actor,companyValue); const documentId=tenantUuid(documentValue,'documentId'); const rows=await this.dataSource.query(`UPDATE "${actor.schema}".customer_document_metadata SET archived_at=COALESCE(archived_at,now()),updated_by=$3,updated_at=now() WHERE id=$1 AND company_id=$2 AND archived_at IS NULL RETURNING id`,[documentId,companyId,actor.id]); if(!rows[0]) throw new NotFoundException('Documento non trovato'); return {id:documentId,archived:true}; }

  async inboxState(){ const actor=await this.actor('canReadNotifications'); const [conversations,drafts,receipts,filters]=await Promise.all([this.dataSource.query(`SELECT * FROM "${actor.schema}".customer_inbox_conversations ORDER BY updated_at DESC LIMIT 500`),this.dataSource.query(`SELECT company_id,body,optimistic_version FROM "${actor.schema}".customer_inbox_drafts WHERE user_id=$1`,[actor.id]),this.dataSource.query(`SELECT company_id,read_at FROM "${actor.schema}".customer_inbox_receipts WHERE user_id=$1`,[actor.id]),this.dataSource.query(`SELECT filters FROM "${actor.schema}".customer_inbox_user_state WHERE user_id=$1`,[actor.id])]); return {conversations,drafts,receipts,filters:filters[0]?.filters||{}}; }
  async updateInboxConversation(companyValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.actor('canEditCustomers', 'canAssignLeads');
    const companyId = await this.company(actor, companyValue);
    const expected = Number(body.optimisticVersion ?? 0);
    if (!Number.isInteger(expected) || expected < 0) throw new BadRequestException('optimisticVersion non valida');
    const priority = boundedText(body.priority ?? 'Normale', 'priority', 30, true);
    const status = boundedText(body.status ?? 'In lavorazione', 'status', 30, true);
    const due = body.dueAt ? new Date(String(body.dueAt)) : null;
    if (due && Number.isNaN(due.getTime())) throw new BadRequestException('dueAt non valida');
    const tags = body.tags ? this.textArray(body.tags, 'tags') : [];
    const linked = body.linkedRecords === undefined ? [] : body.linkedRecords;
    const candidates = body.candidateMatches === undefined ? [] : body.candidateMatches;
    if (!Array.isArray(linked) || !Array.isArray(candidates)) throw new BadRequestException('Collegamenti Inbox non validi');
    return this.dataSource.transaction((manager) => withTenantIdempotency(manager, actor.schema, `inbox:${companyId}`, key, { status,priority,due,tags,linked,candidates,expected }, actor.id, async () => {
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".customer_inbox_conversations (company_id,status,priority,assigned_to_id,supervisor_id,due_at,category,tags,linked_records,candidate_matches,updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9::jsonb,$10::jsonb,$11)
         ON CONFLICT (company_id) DO UPDATE SET status=$2,priority=$3,assigned_to_id=$4,supervisor_id=$5,due_at=$6,category=$7,tags=$8::text[],linked_records=$9::jsonb,candidate_matches=$10::jsonb,updated_by=$11,optimistic_version="${actor.schema}".customer_inbox_conversations.optimistic_version+1,updated_at=now()
         WHERE "${actor.schema}".customer_inbox_conversations.optimistic_version=$12 RETURNING *`,
        [companyId,status,priority,body.assignedToId?tenantUuid(body.assignedToId,'assignedToId'):null,body.supervisorId?tenantUuid(body.supervisorId,'supervisorId'):null,due?.toISOString()||null,boundedText(body.category,'category',80)||null,tags,JSON.stringify(linked),JSON.stringify(candidates),actor.id,expected],
      );
      if (!rows[0]) throw new ConflictException('Conversazione modificata da un altro utente');
      return rows[0];
    }));
  }
  async scheduleInboxMessage(companyValue:string,body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canReadNotifications');const companyId=await this.company(actor,companyValue);if(body.internal!==true)throw new BadRequestException('Solo note interne pianificate sono supportate senza provider esterno');const text=boundedText(body.text??body.body,'body',20000,true);const scheduled=new Date(String(body.scheduledAt||''));if(Number.isNaN(scheduled.getTime())||scheduled.getTime()<=Date.now())throw new BadRequestException('scheduledAt deve essere futura');const requestedId=body.id?tenantUuid(body.id,'messageId'):null;const channel=boundedText(body.channel??'Nota','channel',30,true);return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`inbox-message:${companyId}`,key,{requestedId,text,scheduled:scheduled.toISOString(),channel},actor.id,async()=>{const rows=await manager.query(`INSERT INTO "${actor.schema}".commercial_communications (id,company_id,channel,direction,title,body,status,occurred_at,scheduled_at,idempotency_key,created_by,updated_by) VALUES (COALESCE($1,uuid_generate_v4()),$2,$3,'internal','Nota Inbox pianificata',$4,'scheduled',$5,$5,$6,$7,$7) RETURNING *`,[requestedId,companyId,channel,text,scheduled.toISOString(),key||null,actor.id]);return rows[0];}));}
  async saveInboxDraft(companyValue:string,body:Record<string,unknown>){rejectActorOverride(body);const actor=await this.actor('canReadNotifications');const companyId=await this.company(actor,companyValue);const text=boundedText(body.text??body.body,'draft',20000);const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".customer_inbox_drafts (company_id,user_id,body) VALUES ($1,$2,$3) ON CONFLICT (company_id,user_id) DO UPDATE SET body=$3,optimistic_version="${actor.schema}".customer_inbox_drafts.optimistic_version+1,updated_at=now() RETURNING *`,[companyId,actor.id,text]);return rows[0];}
  async markInboxRead(companyValue:string){const actor=await this.actor('canReadNotifications');const companyId=await this.company(actor,companyValue);const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".customer_inbox_receipts (company_id,user_id) VALUES ($1,$2) ON CONFLICT (company_id,user_id) DO UPDATE SET read_at=now() RETURNING *`,[companyId,actor.id]);return rows[0];}
  async saveInboxFilters(body:Record<string,unknown>){rejectActorOverride(body);const actor=await this.actor('canReadNotifications');const filters=this.object(body.filters??body,'filters',20000);const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".customer_inbox_user_state (user_id,filters) VALUES ($1,$2::jsonb) ON CONFLICT (user_id) DO UPDATE SET filters=$2::jsonb,updated_at=now() RETURNING *`,[actor.id,JSON.stringify(filters)]);return rows[0];}

  async guidedCalls(){const actor=await this.actor('canAssignLeads');return {items:await this.dataSource.query(`SELECT g.*,COALESCE(jsonb_agg(m ORDER BY m.created_at) FILTER (WHERE m.id IS NOT NULL),'[]'::jsonb) AS messages FROM "${actor.schema}".guided_calls g LEFT JOIN "${actor.schema}".guided_call_messages m ON m.call_id=g.id WHERE g.created_by=$1 OR $2::boolean OR EXISTS (SELECT 1 FROM "${actor.schema}".opportunities o WHERE o.id=g.lead_id AND o.assigned_to=$1 AND o.deleted_at IS NULL) GROUP BY g.id ORDER BY g.updated_at DESC LIMIT 200`,[actor.id,actor.capabilities.has('*')||actor.capabilities.has('canViewAllLeads')])};}
  private async guidedWorkflow(actor:CommercialActor,value:unknown,current:Record<string,unknown>={}){
    const input=this.object(value,'workflow',60_000);
    const allowed=new Set(['currentPhase','mode','linkedAppointmentId','previousCallId','initialServiceIds','selectedServiceIds','primaryServiceId','serviceDetectionSource','serviceSelectionUpdatedAt','serviceSelectionUpdatedBy','serviceSelectionReason','participants','recommendedService','suggestedProbability','suggestedStage','technicalParticipantId','materialChecklist']);
    const unknown=Object.keys(input).find((key)=>!allowed.has(key));if(unknown)throw new BadRequestException(`workflow.${unknown} non supportato`);
    const next={...current,...input};
    if(input.currentPhase!==undefined)next.currentPhase=this.integer(input.currentPhase,'currentPhase',0,20);
    if(input.mode!==undefined){const mode=boundedText(input.mode,'mode',40,true);if(!['first_contact','scheduled_appointment','follow_up'].includes(mode))throw new BadRequestException('mode non valida');next.mode=mode;}
    for(const key of ['linkedAppointmentId','previousCallId','technicalParticipantId'] as const){if(input[key]!==undefined)next[key]=input[key]?tenantUuid(input[key],key):null;}
    for(const key of ['initialServiceIds','selectedServiceIds','materialChecklist'] as const){if(input[key]!==undefined)next[key]=this.textArray(input[key],key,50,100);}
    for(const key of ['primaryServiceId','serviceDetectionSource','serviceSelectionReason','recommendedService','suggestedStage'] as const){if(input[key]!==undefined)next[key]=boundedText(input[key],key,1000)||null;}
    if(input.serviceSelectionUpdatedAt!==undefined){const date=new Date(String(input.serviceSelectionUpdatedAt));if(Number.isNaN(date.getTime()))throw new BadRequestException('serviceSelectionUpdatedAt non valida');next.serviceSelectionUpdatedAt=date.toISOString();}
    if(input.serviceSelectionUpdatedBy!==undefined)next.serviceSelectionUpdatedBy=actor.id;
    for(const key of ['suggestedProbability'] as const){if(input[key]!==undefined)next[key]=this.integer(input[key],key,0,100);}
    if(input.participants!==undefined){
      if(!Array.isArray(input.participants)||input.participants.length>50)throw new BadRequestException('participants non validi');
      const roles=new Set(['commerciale principale','consulente web','consulente tecnico','osservatore','passaggio di consegne']);
      const participants=input.participants.map((value,index)=>{const item=this.object(value,`participants[${index}]`,2_000);const userId=tenantUuid(item.userId,`participants[${index}].userId`);const role=boundedText(item.role,`participants[${index}].role`,80,true);if(!roles.has(role))throw new BadRequestException(`participants[${index}].role non valido`);return {userId,role};});
      const userIds=[...new Set(participants.map((item)=>item.userId))];
      if(userIds.length){const rows=await this.dataSource.query(`SELECT id FROM "${actor.schema}".users WHERE id=ANY($1::uuid[]) AND COALESCE(is_active,true)=true`,[userIds]);if(rows.length!==userIds.length)throw new BadRequestException('Partecipante non appartenente al tenant');}
      next.participants=participants;
    }
    return next;
  }
  async startGuidedCall(body:Record<string,unknown>,key?:string){
    rejectActorOverride(body);const actor=await this.actor('canAssignLeads');const requestedId=body.id?tenantUuid(body.id,'callId'):null;const leadId=body.leadId?tenantUuid(body.leadId,'leadId'):null;if(!leadId)throw new BadRequestException('leadId obbligatorio');
    const leads=await this.dataSource.query(`SELECT id,company_id,title,assigned_to FROM "${actor.schema}".opportunities WHERE id=$1 AND deleted_at IS NULL AND ($2::boolean OR assigned_to=$3)`,[leadId,actor.capabilities.has('*')||actor.capabilities.has('canViewAllLeads'),actor.id]);if(!leads[0])throw new NotFoundException('Lead non trovato');
    const companyId=body.companyId?await this.company(actor,String(body.companyId)):(leads[0].company_id||null);const title=boundedText(body.title??leads[0].title,'title',200,true);const answers=body.scriptAnswers?this.object(body.scriptAnswers,'scriptAnswers'):{};
    const workflow={currentPhase:0,operatorId:actor.id,primarySellerId:leads[0].assigned_to||actor.id,participants:[]};
    return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`guided-call:${leadId}`,key,{requestedId,title,leadId,answers},actor.id,async()=>{const rows=await manager.query(`INSERT INTO "${actor.schema}".guided_calls (id,company_id,lead_id,title,script_answers,workflow,created_by,updated_by,started_at) VALUES (COALESCE($1,uuid_generate_v4()),$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7,now()) ON CONFLICT (lead_id) WHERE status IN ('draft','active') DO UPDATE SET updated_at="${actor.schema}".guided_calls.updated_at RETURNING *,(xmax=0) AS inserted`,[requestedId,companyId,leadId,title,JSON.stringify(answers),JSON.stringify(workflow),actor.id]);if(rows[0].inserted)await this.guidedAudit(manager,actor,rows[0].id,'created',null,1);return rows[0];}));
  }
  private async guidedAccess(actor:CommercialActor,idValue:string,manager:DataSource|EntityManager=this.dataSource){const id=tenantUuid(idValue,'callId');const rows=await manager.query(`SELECT g.* FROM "${actor.schema}".guided_calls g WHERE g.id=$1 AND (g.created_by=$2 OR $3::boolean OR EXISTS (SELECT 1 FROM "${actor.schema}".opportunities o WHERE o.id=g.lead_id AND o.assigned_to=$2 AND o.deleted_at IS NULL))`,[id,actor.id,actor.capabilities.has('*')||actor.capabilities.has('canViewAllLeads')]);if(!rows[0])throw new NotFoundException('Chiamata guidata non trovata');return rows[0];}
  private guidedAudit(manager:EntityManager,actor:CommercialActor,id:string,action:string,from:number|null,to:number|null){return manager.query(`INSERT INTO "${actor.schema}".guided_call_audit (call_id,actor_user_id,action,from_version,to_version) VALUES ($1,$2,$3,$4,$5)`,[id,actor.id,action,from,to]);}
  async updateGuidedCall(idValue:string,body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canAssignLeads');const id=tenantUuid(idValue,'callId');const expected=this.version(body.optimisticVersion??body.optimistic_version);return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`guided-call:update:${id}`,key,body,actor.id,async()=>{const current=await this.guidedAccess(actor,id,manager);const answers=body.scriptAnswers===undefined?current.script_answers:this.object(body.scriptAnswers,'scriptAnswers');const workflow=body.workflow===undefined?current.workflow:await this.guidedWorkflow(actor,body.workflow,current.workflow||{});const rows=await manager.query(`UPDATE "${actor.schema}".guided_calls SET title=$2,script_answers=$3::jsonb,workflow=$4::jsonb,notes=$5,updated_by=$6,optimistic_version=optimistic_version+1,updated_at=now() WHERE id=$1 AND optimistic_version=$7 AND status IN ('draft','active') RETURNING *`,[current.id,boundedText(body.title??current.title,'title',200,true),JSON.stringify(answers),JSON.stringify(workflow),boundedText(body.notes??current.notes,'notes',10000)||null,actor.id,expected]);if(!rows[0])throw new ConflictException('Chiamata modificata da un altro utente');await this.guidedAudit(manager,actor,current.id,'updated',expected,rows[0].optimistic_version);return rows[0];}));}
  async addGuidedCallMessage(idValue:string,body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canAssignLeads');const call=await this.guidedAccess(actor,idValue);const requestedId=body.id?tenantUuid(body.id,'messageId'):null;const channel=boundedText(body.channel,'channel',30,true);if(!['WhatsApp','Email'].includes(channel))throw new BadRequestException('channel non valido');const text=boundedText(body.body??body.text,'body',10000,true);const metadata={template:boundedText(body.template,'template',100)||null,subject:boundedText(body.subject,'subject',300)||null,recipient:boundedText(body.recipient,'recipient',500)||null};return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`guided-message:${call.id}`,key,{requestedId,channel,text,metadata},actor.id,async()=>{const rows=await manager.query(`INSERT INTO "${actor.schema}".guided_call_messages (id,call_id,channel,body,metadata,created_by) VALUES (COALESCE($1,uuid_generate_v4()),$2,$3,$4,$5::jsonb,$6) RETURNING *`,[requestedId,call.id,channel,text,JSON.stringify(metadata),actor.id]);return rows[0];}));}
  async updateGuidedCallMessage(idValue:string,messageValue:string,body:Record<string,unknown>){rejectActorOverride(body);const actor=await this.actor('canAssignLeads');const call=await this.guidedAccess(actor,idValue);const messageId=tenantUuid(messageValue,'messageId');const status=String(body.status||'');const allowed=['prepared','external_opened','manually_confirmed','not_sent','sent','replied','no_reply','follow_up'];if(!allowed.includes(status))throw new BadRequestException('status non valido');const rows=await this.dataSource.query(`UPDATE "${actor.schema}".guided_call_messages SET status=$3,updated_at=now() WHERE id=$1 AND call_id=$2 RETURNING *`,[messageId,call.id,status]);if(!rows[0])throw new NotFoundException('Messaggio non trovato');return rows[0];}
  async completeGuidedCall(idValue:string,body:Record<string,unknown>,key?:string){
    rejectActorOverride(body);const actor=await this.actor('canAssignLeads');const id=tenantUuid(idValue,'callId');const expected=this.version(body.optimisticVersion??body.optimistic_version);const outcome=boundedText(body.outcome,'outcome',2000,true);const summary=boundedText(body.summary??body.notes,'summary',10000,true);const probability=this.integer(body.confirmedProbability,'confirmedProbability',0,100);const stage=boundedText(body.confirmedStage,'confirmedStage',40,true);const allowedStages=new Set(['new','qualified','proposal','negotiation','won','unqualified','not-interested','follow-up','lost']);if(!allowedStages.has(stage))throw new BadRequestException('confirmedStage non valido');const nextAction=boundedText(body.nextAction,'nextAction',300,true);const due=new Date(String(body.nextActionAt||''));if(Number.isNaN(due.getTime()))throw new BadRequestException('nextActionAt non valida');const assignee=tenantUuid(body.nextAssigneeId,'nextAssigneeId');const technicalParticipant=body.technicalParticipantId?tenantUuid(body.technicalParticipantId,'technicalParticipantId'):null;const requiredUsers=[...new Set([assignee,technicalParticipant].filter((value):value is string=>Boolean(value)))];const users=await this.dataSource.query(`SELECT id FROM "${actor.schema}".users WHERE id=ANY($1::uuid[]) AND COALESCE(is_active,true)=true`,[requiredUsers]);if(users.length!==requiredUsers.length)throw new BadRequestException('Utente non appartenente al tenant');const completion={outcome,summary,recommendedService:boundedText(body.recommendedService,'recommendedService',300)||null,confirmedProbability:probability,confirmedStage:stage,nextAction,nextActionAt:due.toISOString(),nextAssigneeId:assignee,technicalParticipantId:technicalParticipant,createAppointment:body.createAppointment===true,materialChecklist:body.materialChecklist===undefined?[]:this.textArray(body.materialChecklist,'materialChecklist',50,200),selectedServiceIds:body.selectedServiceIds===undefined?[]:this.textArray(body.selectedServiceIds,'selectedServiceIds',50,100),primaryServiceId:boundedText(body.primaryServiceId,'primaryServiceId',100)||null,serviceSelectionReason:boundedText(body.serviceSelectionReason,'serviceSelectionReason',2000)||null};
    return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`guided-call:complete:${id}`,key,{expected,completion},actor.id,async()=>{const call=await this.guidedAccess(actor,id,manager);const activity=await manager.query(`INSERT INTO "${actor.schema}".commercial_activities (company_id,opportunity_id,type,title,description,due_at,assigned_to,created_by,updated_by,status,channel,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,'todo','internal',$9::jsonb) RETURNING id`,[call.company_id,call.lead_id,completion.createAppointment?'appointment':'follow_up',nextAction,summary,due.toISOString(),assignee,actor.id,JSON.stringify({guided_call_id:id,appointment_status:completion.createAppointment?'scheduled':undefined})]);const canonical:Record<string,string>={new:'new',qualified:'qualified',proposal:'appointment',negotiation:'quote',won:'closed_won',unqualified:'lost','not-interested':'lost','follow-up':'paused',lost:'lost'};await manager.query(`UPDATE "${actor.schema}".opportunities SET stage=$2,ui_stage=$3,probability=$4,assigned_to=$5,next_action=$6,next_action_at=$7,version=version+1,updated_by=$8,updated_at=now() WHERE id=$1 AND deleted_at IS NULL`,[call.lead_id,canonical[stage],stage,probability,assignee,nextAction,due.toISOString(),actor.id]);const completed={...completion,followUpActivityId:activity[0].id,appointmentId:completion.createAppointment?activity[0].id:null};const rows=await manager.query(`UPDATE "${actor.schema}".guided_calls SET status='completed',outcome=$2,notes=$3,completion=$4::jsonb,completed_at=now(),updated_by=$5,optimistic_version=optimistic_version+1,updated_at=now() WHERE id=$1 AND optimistic_version=$6 AND status IN ('draft','active') RETURNING *`,[call.id,outcome,summary,JSON.stringify(completed),actor.id,expected]);if(!rows[0])throw new ConflictException('Chiamata non completabile o versione obsoleta');await this.guidedAudit(manager,actor,call.id,'completed',expected,rows[0].optimistic_version);return rows[0];}));
  }

  async teamDuties(){const actor=await this.actor('canViewTeam','canViewProjects');return {items:await this.dataSource.query(`SELECT d.id,d.duty_key,d.title,d.current_version,d.archived_at,d.created_at,d.updated_at,v.version,v.content,v.reason,v.author_user_id,v.created_at AS version_created_at,r.read_at FROM "${actor.schema}".team_duties d JOIN "${actor.schema}".team_duty_versions v ON v.duty_id=d.id LEFT JOIN "${actor.schema}".team_duty_reads r ON r.duty_id=d.id AND r.version=v.version AND r.user_id=$1 WHERE d.archived_at IS NULL ORDER BY d.title,v.version DESC`,[actor.id])};}
  async createTeamDuty(body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canManageRoles');const requestedId=body.id?tenantUuid(body.id,'dutyId'):null;const dutyKey=tenantUuid(body.key??body.dutyKey,'key');const subjects=await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".users WHERE id=$1`,[dutyKey]);if(!subjects[0])throw new BadRequestException('Utente mansione non appartenente al tenant');const title=boundedText(body.title,'title',200,true);const content=this.object(body.content,'content');if(content.status!==undefined&&content.status!=='Bozza')throw new BadRequestException('Una nuova mansione deve essere in bozza');const reason=boundedText(body.reason,'reason',1000,true);return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`team-duty:create:${dutyKey}`,key,{requestedId,title,content,reason},actor.id,async()=>{const rows=await manager.query(`INSERT INTO "${actor.schema}".team_duties (id,duty_key,title,updated_by) VALUES (COALESCE($1,uuid_generate_v4()),$2,$3,$4) RETURNING *`,[requestedId,dutyKey,title,actor.id]);await manager.query(`INSERT INTO "${actor.schema}".team_duty_versions (duty_id,version,content,reason,author_user_id) VALUES ($1,1,$2::jsonb,$3,$4)`,[rows[0].id,JSON.stringify(content),reason,actor.id]);return {...rows[0],content};}));}
  async updateTeamDuty(idValue:string,body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canManageRoles');const id=tenantUuid(idValue,'dutyId');const expected=this.version(body.optimisticVersion??body.optimistic_version);const content=this.object(body.content,'content');if(content.status==='Attiva')throw new BadRequestException('Usare il flusso di approvazione dedicato');const reason=boundedText(body.reason,'reason',1000,true);const title=boundedText(body.title,'title',200,true);return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`team-duty:update:${id}`,key,{expected,title,content,reason},actor.id,async()=>{const rows=await manager.query(`UPDATE "${actor.schema}".team_duties SET title=$2,current_version=current_version+1,updated_by=$3,updated_at=now() WHERE id=$1 AND current_version=$4 AND archived_at IS NULL RETURNING *`,[id,title,actor.id,expected]);if(!rows[0])throw new ConflictException('Team Duty modificata da un altro utente');await manager.query(`INSERT INTO "${actor.schema}".team_duty_versions (duty_id,version,content,reason,author_user_id) VALUES ($1,$2,$3::jsonb,$4,$5)`,[id,rows[0].current_version,JSON.stringify(content),reason,actor.id]);return {...rows[0],content};}));}
  async approveTeamDuty(idValue:string,body:Record<string,unknown>,key?:string){rejectActorOverride(body);const actor=await this.actor('canManageRoles');const id=tenantUuid(idValue,'dutyId');const expected=this.version(body.optimisticVersion??body.optimistic_version);return this.dataSource.transaction((manager)=>withTenantIdempotency(manager,actor.schema,`team-duty:approve:${id}`,key,{expected},actor.id,async()=>{const rows=await manager.query(`SELECT d.*,v.content,v.author_user_id FROM "${actor.schema}".team_duties d JOIN "${actor.schema}".team_duty_versions v ON v.duty_id=d.id AND v.version=d.current_version WHERE d.id=$1 AND d.archived_at IS NULL FOR UPDATE OF d`,[id]);const current=rows[0];if(!current)throw new NotFoundException('Team Duty non trovata');if(Number(current.current_version)!==expected)throw new ConflictException('Team Duty modificata da un altro utente');if(String(current.author_user_id)===actor.id)throw new BadRequestException('L’autore non può approvare la propria mansione');const previous=this.object(current.content,'content');if(previous.status!=='Bozza')throw new BadRequestException('Solo una bozza può essere approvata');const content={...previous,status:'Attiva',approverId:actor.id,approvedAt:new Date().toISOString()};const updated=await manager.query(`UPDATE "${actor.schema}".team_duties SET current_version=current_version+1,updated_by=$2,updated_at=now() WHERE id=$1 AND current_version=$3 RETURNING *`,[id,actor.id,expected]);if(!updated[0])throw new ConflictException('Team Duty modificata da un altro utente');await manager.query(`INSERT INTO "${actor.schema}".team_duty_versions (duty_id,version,content,reason,author_user_id) VALUES ($1,$2,$3::jsonb,'Approvazione',$4)`,[id,updated[0].current_version,JSON.stringify(content),actor.id]);return {...updated[0],content};}));}
  async teamDutyHistory(idValue:string){const actor=await this.actor('canViewTeam','canViewProjects');const id=tenantUuid(idValue,'dutyId');const rows=await this.dataSource.query(`SELECT version,content,reason,author_user_id,created_at FROM "${actor.schema}".team_duty_versions WHERE duty_id=$1 ORDER BY version DESC`,[id]);if(!rows.length)throw new NotFoundException('Team Duty non trovata');return {items:rows};}
  async markTeamDutyRead(idValue:string,body:Record<string,unknown>){rejectActorOverride(body);const actor=await this.actor('canViewTeam','canViewProjects');const id=tenantUuid(idValue,'dutyId');const version=this.version(body.version);const exists=await this.dataSource.query(`SELECT 1 FROM "${actor.schema}".team_duty_versions v JOIN "${actor.schema}".team_duties d ON d.id=v.duty_id WHERE v.duty_id=$1 AND v.version=$2 AND d.duty_key=$3`,[id,version,actor.id]);if(!exists[0])throw new NotFoundException('Versione non trovata');const rows=await this.dataSource.query(`INSERT INTO "${actor.schema}".team_duty_reads (duty_id,user_id,version) VALUES ($1,$2,$3) ON CONFLICT (duty_id,user_id,version) DO UPDATE SET read_at=now() RETURNING *`,[id,actor.id,version]);return rows[0];}
}
