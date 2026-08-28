import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { MailService } from '../mail/mail.service';
import { ensureTenantCustomerInboxMailTables } from './tenant-customer-inbox-mail-schema';

export type CustomerInboxAdapterStatus = {
  email: {
    outboundConfigured: boolean;
    inboundConfigured: boolean;
    lastSuccessfulSync: string | null;
    errorCode: string | null;
  };
  whatsapp: { mode: 'web_handoff' };
};

export type CustomerInboxIncomingMessage = {
  uid: number;
  uidValidity: string;
  messageId: string | null;
  from: string;
  to: string[];
  subject: string;
  occurredAt: Date;
  text: string;
  inReplyTo: string | null;
  references: string[];
  attachmentCount: number;
};

type ImapConfig = {
  schema: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  mailboxKey: string;
};

@Injectable()
export class TenantCustomerInboxMailService {
  private readonly logger = new Logger(TenantCustomerInboxMailService.name);
  private syncing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
  ) {}

  private outboundSchemas() {
    return new Set(String(process.env.CUSTOMER_INBOX_MAIL_TENANTS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => safeSchema(value, 'CUSTOMER_INBOX_MAIL_TENANTS')));
  }

  private imapConfig(): ImapConfig | null {
    const rawSchema = String(process.env.CUSTOMER_INBOX_IMAP_TENANT_SCHEMA || '').trim();
    const host = String(process.env.CUSTOMER_INBOX_IMAP_HOST || '').trim();
    const user = String(process.env.CUSTOMER_INBOX_IMAP_USER || '').trim();
    const password = String(process.env.CUSTOMER_INBOX_IMAP_PASSWORD || '').trim();
    const port = Number(process.env.CUSTOMER_INBOX_IMAP_PORT);
    if (!rawSchema || !host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    const schema = safeSchema(rawSchema, 'CUSTOMER_INBOX_IMAP_TENANT_SCHEMA');
    if (schema === 'public') return null;
    const mailbox = String(process.env.CUSTOMER_INBOX_IMAP_MAILBOX || 'INBOX').trim() || 'INBOX';
    const mailboxKey = createHash('sha256').update(`${schema}\0${host}\0${user}\0${mailbox}`).digest('hex');
    return {
      schema,
      host,
      port,
      secure: String(process.env.CUSTOMER_INBOX_IMAP_SECURE || '').toLowerCase() === 'true',
      user,
      password,
      mailbox,
      mailboxKey,
    };
  }

  private outboundConfigured(schema: string) {
    return this.mail.isConfigured() && this.outboundSchemas().has(schema);
  }

  async status(schemaValue: string): Promise<CustomerInboxAdapterStatus> {
    const schema = safeSchema(schemaValue, 'TenantCustomerInboxMailService.status');
    const imap = this.imapConfig();
    let state: Record<string, unknown> | undefined;
    if (imap?.schema === schema) {
      await ensureTenantCustomerInboxMailTables(this.dataSource, schema);
      const rows = await this.dataSource.query(
        `SELECT last_successful_sync_at,last_error_code FROM "${schema}".customer_inbox_mailbox_state WHERE mailbox_key=$1`,
        [imap.mailboxKey],
      );
      state = rows[0];
    }
    return {
      email: {
        outboundConfigured: this.outboundConfigured(schema),
        inboundConfigured: imap?.schema === schema,
        lastSuccessfulSync: state?.last_successful_sync_at ? new Date(String(state.last_successful_sync_at)).toISOString() : null,
        errorCode: state?.last_error_code ? String(state.last_error_code) : null,
      },
      whatsapp: { mode: 'web_handoff' },
    };
  }

  async sendEmail(input: {
    schema: string;
    actorId: string;
    companyId: string;
    text: string;
    subject?: string;
    idempotencyKey: string;
  }) {
    const schema = safeSchema(input.schema, 'TenantCustomerInboxMailService.sendEmail');
    if (!this.outboundConfigured(schema)) throw new BadRequestException('Email non configurata per questo tenant.');
    await ensureTenantCustomerInboxMailTables(this.dataSource, schema);
    const recipients = await this.dataSource.query(
      `SELECT c.name,
              COALESCE(NULLIF(primary_contact.email,''), NULLIF(c.email,'')) AS recipient_email,
              primary_contact.id AS contact_id
       FROM "${schema}".companies c
       LEFT JOIN LATERAL (
         SELECT id,email FROM "${schema}".contacts
         WHERE company_id=c.id AND deleted_at IS NULL AND NULLIF(email,'') IS NOT NULL
         ORDER BY is_primary DESC, created_at ASC LIMIT 1
       ) primary_contact ON true
       WHERE c.id=$1 AND c.deleted_at IS NULL`,
      [input.companyId],
    );
    if (!recipients[0]) throw new BadRequestException('Cliente non trovato.');
    const recipient = String(recipients[0].recipient_email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new BadRequestException('Il cliente non ha un indirizzo email valido.');
    const subject = String(input.subject || `Aggiornamento ${recipients[0].name || ''}`).trim().slice(0, 240);
    const text = String(input.text || '').trim();
    if (!text || text.length > 20_000) throw new BadRequestException('Messaggio email non valido.');

    const inserted = await this.dataSource.query(
      `INSERT INTO "${schema}".commercial_communications
       (company_id,contact_id,channel,direction,title,body,status,occurred_at,idempotency_key,metadata,created_by,updated_by)
       VALUES ($1,$2,'Email','outgoing',$3,$4,'sending',now(),$5,$6::jsonb,$7,$7)
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [input.companyId, recipients[0].contact_id || null, subject, text, input.idempotencyKey, JSON.stringify({ source: 'customer_inbox', transport: 'smtp' }), input.actorId],
    );
    if (!inserted[0]) {
      const existing = await this.dataSource.query(
        `SELECT * FROM "${schema}".commercial_communications WHERE idempotency_key=$1 AND deleted_at IS NULL LIMIT 1`,
        [input.idempotencyKey],
      );
      if (existing[0]?.status === 'sent') return { item: existing[0], existing: true };
      throw new ConflictException(existing[0]?.status === 'failed' ? 'Il precedente invio non è riuscito. Riprova dalla bozza.' : 'Invio email già in corso.');
    }

    try {
      await this.mail.sendMailRequired({ to: recipient, subject, text, purpose: 'Customer Inbox' });
      const rows = await this.dataSource.query(
        `UPDATE "${schema}".commercial_communications
         SET status='sent',sent_at=now(),updated_at=now(),version=version+1
         WHERE id=$1 RETURNING *`,
        [inserted[0].id],
      );
      return { item: rows[0], existing: false };
    } catch {
      await this.dataSource.query(
        `UPDATE "${schema}".commercial_communications
         SET status='failed',metadata=COALESCE(metadata,'{}'::jsonb)||'{"errorCode":"SMTP_SEND_FAILED"}'::jsonb,updated_at=now(),version=version+1
         WHERE id=$1`,
        [inserted[0].id],
      );
      throw new BadRequestException('Invio email non riuscito. La bozza è stata conservata.');
    }
  }

  async importMessage(schemaValue: string, message: CustomerInboxIncomingMessage) {
    const schema = safeSchema(schemaValue, 'TenantCustomerInboxMailService.importMessage');
    await ensureTenantCustomerInboxMailTables(this.dataSource, schema);
    const sender = message.from.trim().toLowerCase();
    const from = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender) ? sender : 'unknown-sender@invalid.local';
    const matches = await this.dataSource.query(
      `SELECT c.id AS company_id, ct.id AS contact_id, c.name
       FROM "${schema}".companies c
       LEFT JOIN "${schema}".contacts ct ON ct.company_id=c.id AND ct.deleted_at IS NULL
       WHERE c.deleted_at IS NULL AND (lower(c.email)=lower($1) OR lower(ct.email)=lower($1))
       ORDER BY c.id, ct.is_primary DESC, ct.created_at ASC`,
      [from],
    );
    const byCompany = new Map<string, Record<string, unknown>>();
    for (const row of matches) if (!byCompany.has(String(row.company_id))) byCompany.set(String(row.company_id), row);
    const candidates = [...byCompany.values()];
    const metadata = {
      source: 'customer_inbox',
      transport: 'imap',
      from,
      to: message.to,
      messageId: message.messageId,
      inReplyTo: message.inReplyTo,
      references: message.references,
      uidValidity: message.uidValidity,
      attachmentCount: message.attachmentCount,
    };
    if (candidates.length === 1) {
      const match = candidates[0];
      const rows = await this.dataSource.query(
        `INSERT INTO "${schema}".commercial_communications
         (company_id,contact_id,channel,direction,title,body,status,occurred_at,external_message_id,mailbox_uid_validity,mailbox_uid,metadata,created_at,updated_at)
         VALUES ($1,$2,'Email','incoming',$3,$4,'recorded',$5,$6,$7,$8,$9::jsonb,now(),now())
         ON CONFLICT DO NOTHING RETURNING *`,
        [match.company_id, match.contact_id || null, message.subject || 'Email ricevuta', message.text, message.occurredAt.toISOString(), message.messageId, message.uidValidity, message.uid, JSON.stringify(metadata)],
      );
      return { matched: true, duplicate: !rows[0], companyId: String(match.company_id), item: rows[0] };
    }
    const status = candidates.length ? 'ambiguous' : 'unmatched';
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".customer_inbox_unmatched_messages
       (mailbox_key,uid_validity,mailbox_uid,message_id,from_email,recipients,subject,occurred_at,body,match_status,candidate_matches,provider_metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       ON CONFLICT DO NOTHING RETURNING *`,
      [this.imapConfig()?.mailboxKey || 'manual-import', message.uidValidity, message.uid, message.messageId, from, message.to, message.subject || null, message.occurredAt.toISOString(), message.text, status, JSON.stringify(candidates.map((candidate) => ({ type: 'customer', id: candidate.company_id, title: candidate.name }))), JSON.stringify(metadata)],
    );
    return { matched: false, duplicate: !rows[0], status, item: rows[0] };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncConfiguredMailbox() {
    const config = this.imapConfig();
    if (!config || this.syncing) return { configured: false, imported: 0 };
    this.syncing = true;
    await ensureTenantCustomerInboxMailTables(this.dataSource, config.schema);
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      logger: false,
    });
    try {
      const stateRows = await this.dataSource.query(
        `SELECT uid_validity,last_uid FROM "${config.schema}".customer_inbox_mailbox_state WHERE mailbox_key=$1`,
        [config.mailboxKey],
      );
      await client.connect();
      const lock = await client.getMailboxLock(config.mailbox);
      let uidValidity = '';
      let messages: Array<{ uid: number; source?: Buffer; internalDate?: Date }> = [];
      try {
        uidValidity = String(client.mailbox && client.mailbox.uidValidity || '');
        const previousUid = stateRows[0] && String(stateRows[0].uid_validity || '') === uidValidity ? Number(stateRows[0].last_uid || 0) : 0;
        const result = await client.search({ uid: `${previousUid + 1}:*` }, { uid: true });
        const batch = (Array.isArray(result) ? result : []).filter((uid) => uid > previousUid).slice(0, 100);
        if (batch.length) messages = await client.fetchAll(batch, { uid: true, source: true, internalDate: true }, { uid: true }) as typeof messages;
      } finally {
        lock.release();
      }
      let imported = 0;
      for (const raw of messages) {
        if (!raw.source) continue;
        const parsed = await simpleParser(raw.source, { maxHtmlLengthToParse: 1_000_000, skipImageLinks: true });
        const from = parsed.from?.value[0]?.address || '';
        const to = parsed.to && 'value' in parsed.to ? parsed.to.value.map((entry) => entry.address || '').filter(Boolean) : [];
        const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
        await this.importMessage(config.schema, {
          uid: raw.uid,
          uidValidity,
          messageId: parsed.messageId || null,
          from,
          to,
          subject: parsed.subject || 'Email ricevuta',
          occurredAt: parsed.date || raw.internalDate || new Date(),
          text: String(parsed.text || '').trim().slice(0, 100_000),
          inReplyTo: parsed.inReplyTo || null,
          references,
          attachmentCount: parsed.attachments.length,
        });
        imported += 1;
        await this.dataSource.query(
          `INSERT INTO "${config.schema}".customer_inbox_mailbox_state (mailbox_key,uid_validity,last_uid,updated_at)
           VALUES ($1,$2,$3,now()) ON CONFLICT (mailbox_key) DO UPDATE
           SET uid_validity=EXCLUDED.uid_validity,
               last_uid=CASE
                 WHEN "${config.schema}".customer_inbox_mailbox_state.uid_validity IS DISTINCT FROM EXCLUDED.uid_validity THEN EXCLUDED.last_uid
                 ELSE GREATEST("${config.schema}".customer_inbox_mailbox_state.last_uid,EXCLUDED.last_uid)
               END,
               updated_at=now()`,
          [config.mailboxKey, uidValidity, raw.uid],
        );
      }
      await this.dataSource.query(
        `INSERT INTO "${config.schema}".customer_inbox_mailbox_state (mailbox_key,uid_validity,last_successful_sync_at,last_error_code,updated_at)
         VALUES ($1,$2,now(),NULL,now()) ON CONFLICT (mailbox_key) DO UPDATE
         SET last_uid=CASE
               WHEN "${config.schema}".customer_inbox_mailbox_state.uid_validity IS DISTINCT FROM EXCLUDED.uid_validity THEN 0
               ELSE "${config.schema}".customer_inbox_mailbox_state.last_uid
             END,
             uid_validity=EXCLUDED.uid_validity,last_successful_sync_at=now(),last_error_code=NULL,updated_at=now()`,
        [config.mailboxKey, uidValidity],
      );
      await client.logout();
      return { configured: true, imported };
    } catch (error) {
      const code = String((error as { code?: unknown; name?: unknown }).code || (error as { name?: unknown }).name || 'IMAP_SYNC_FAILED').replace(/[^A-Z0-9_-]/gi, '_').slice(0, 80);
      await this.dataSource.query(
        `INSERT INTO "${config.schema}".customer_inbox_mailbox_state (mailbox_key,last_error_code,updated_at)
         VALUES ($1,$2,now()) ON CONFLICT (mailbox_key) DO UPDATE SET last_error_code=$2,updated_at=now()`,
        [config.mailboxKey, code],
      ).catch(() => undefined);
      this.logger.error(`Customer Inbox IMAP sync failed code=${code}`);
      try { await client.logout(); } catch { /* connection may not be open */ }
      return { configured: true, imported: 0, errorCode: code };
    } finally {
      this.syncing = false;
    }
  }
}
