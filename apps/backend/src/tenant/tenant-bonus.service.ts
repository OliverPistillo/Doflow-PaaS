import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { ensureDoflowAutomationPerformanceTables } from './tenant-automation-performance-schema';
import { isDoflowTenant } from './tenant-context';
import { boundedText, rejectActorOverride, rejectTenantOverride, tenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { withTenantIdempotency } from './tenant-universal-idempotency';
import { TenantUniversalCapabilitiesService, TenantUniversalCapability } from './tenant-universal-capabilities.service';

@Injectable()
export class TenantBonusService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}
  private actor() { return tenantActor(this.request, 'TenantBonusService'); }
  private async ensure(capability: TenantUniversalCapability = 'canViewOwnPoints', actor = this.actor()) {
    await this.capabilities.require(actor, capability);
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    if (isDoflowTenant(actor.schema)) {
      await ensureDoflowAutomationPerformanceTables(this.dataSource, actor.schema);
    }
    return actor;
  }

  private currentPeriodBounds(now = new Date()) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const startsAt = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(year, month + 1, 0));
    const endsAt = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
    return { label: `${year}-${String(month + 1).padStart(2, '0')}`, startsAt, endsAt };
  }

  private async currentPeriod(target: DataSource | EntityManager, schema: string) {
    const period = this.currentPeriodBounds();
    const rows = await target.query(
      `INSERT INTO "${schema}".bonus_periods (label,starts_at,ends_at,status)
       VALUES ($1,$2,$3,'open')
       ON CONFLICT (starts_at,ends_at) DO UPDATE SET label=EXCLUDED.label
       RETURNING *`,
      [period.label, period.startsAt, period.endsAt],
    );
    return rows[0];
  }

  private operationUuid(value: string) {
    const hash = createHash('sha256').update(value).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  private async activePointPolicy(target: DataSource | EntityManager, schema: string, lock = false) {
    const rows = await target.query(
      `SELECT p.*,v.formula
       FROM "${schema}".point_policies p
       JOIN "${schema}".point_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
       WHERE p.status='active' AND p.event_type='default'
         AND p.valid_from <= now() AND (p.valid_to IS NULL OR p.valid_to > now())
       ORDER BY p.valid_from DESC LIMIT 1${lock ? ' FOR UPDATE OF p' : ''}`,
    );
    if (!rows[0]) throw new NotFoundException('Policy punti non trovata');
    return rows[0];
  }

  private async minimumRequestPoints(target: DataSource | EntityManager, schema: string) {
    const rows = isDoflowTenant(schema)
      ? await target.query(
        `SELECT v.formula FROM "${schema}".point_policies p
         JOIN "${schema}".point_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
         WHERE p.status='active' AND p.event_type='default'
           AND p.valid_from <= now() AND (p.valid_to IS NULL OR p.valid_to > now())
         ORDER BY p.valid_from DESC LIMIT 1`,
      )
      : await target.query(
        `SELECT v.rules FROM "${schema}".bonus_policies p
         JOIN "${schema}".bonus_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
         WHERE p.status='active' ORDER BY p.created_at DESC LIMIT 1`,
      );
    const policyRules = isDoflowTenant(schema) ? rows[0]?.formula?.bonus : rows[0]?.rules;
    const minimum = Number(policyRules?.minimumRequestPoints ?? policyRules?.minimum_request_points ?? 0);
    return Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
  }

  private async lockUser(target: EntityManager, schema: string, userId: string) {
    const rows = await target.query(
      `SELECT id FROM "${schema}".users WHERE id=$1 AND COALESCE(is_active,true)=true FOR UPDATE`,
      [userId],
    );
    if (!rows[0]) throw new BadRequestException('Utente non appartenente al tenant');
  }
  private amount(value: unknown, positive = false) {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0 || Math.abs(number) > 1_000_000 || (positive && number <= 0)) throw new BadRequestException('points non validi');
    return number;
  }
  private async assertUser(schema: string, id: string) {
    const rows = await this.dataSource.query(`SELECT 1 FROM "${schema}".users WHERE id=$1 AND COALESCE(is_active,true)=true`, [id]);
    if (!rows[0]) throw new BadRequestException('Utente non appartenente al tenant');
  }

  private requestSelect(schema: string) {
    return `SELECT r.*,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',h.id,'status',h.status,'actorId',h.actor_user_id,'reason',h.reason,'createdAt',h.created_at
      ) ORDER BY h.created_at) FROM "${schema}".bonus_request_history h WHERE h.request_id=r.id),'[]'::jsonb) AS history,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'approverId',a.approver_user_id,'decision',a.decision,'reason',a.reason,'createdAt',a.created_at
      ) ORDER BY a.created_at) FROM "${schema}".bonus_approvals a WHERE a.request_id=r.id),'[]'::jsonb) AS approvals,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',ba.id,'reference',ba.metadata->>'reference','paidBy',ba.actor_user_id,'paidAt',ba.created_at
      ) ORDER BY ba.created_at) FROM "${schema}".bonus_audit ba
        WHERE ba.target_id=r.id AND ba.action='bonus_paid'),'[]'::jsonb) AS payouts
      FROM "${schema}".bonus_requests r`;
  }

  async state(query: Record<string, unknown>) {
    rejectTenantOverride(query);
    const actor = await this.ensure();
    const requested = query.userId || query.user_id ? tenantUuid(query.userId ?? query.user_id, 'userId') : actor.id;
    const canViewGlobal = await this.capabilities.has(actor, 'canViewGlobalPoints');
    if (requested !== actor.id && !canViewGlobal) throw new ForbiddenException('Wallet di un altro utente non autorizzato');
    await this.assertUser(actor.schema, requested);
    await this.currentPeriod(this.dataSource, actor.schema);

    if (isDoflowTenant(actor.schema)) {
      const [walletRows, ledger, requests, periods, policies, pendingRequests] = await Promise.all([
        this.dataSource.query(
          `SELECT $1::uuid AS user_id,
             COALESCE(SUM(amount) FILTER (WHERE state<>'provisional'),0) AS authoritative_balance,
             COALESCE(SUM(amount) FILTER (WHERE state='provisional'),0) AS provisional_points,
             COALESCE((SELECT SUM(points) FROM "${actor.schema}".bonus_requests
                       WHERE user_id=$1 AND status='pending'),0) AS reserved_points
           FROM "${actor.schema}".point_ledger WHERE user_id=$1`,
          [requested],
        ),
        this.dataSource.query(
          `SELECT l.*,l.state AS entry_type,l.source_record_type AS source_type,
             l.source_record_id AS source_id,l.operation_id AS operation_key,l.effective_at AS occurred_at
           FROM "${actor.schema}".point_ledger l WHERE l.user_id=$1
           ORDER BY l.effective_at DESC,l.created_at DESC LIMIT 500`,
          [requested],
        ),
        this.dataSource.query(`${this.requestSelect(actor.schema)} WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 200`, [requested]),
        this.dataSource.query(`SELECT * FROM "${actor.schema}".bonus_periods ORDER BY starts_at DESC LIMIT 100`),
        this.dataSource.query(
          `SELECT p.*,v.formula FROM "${actor.schema}".point_policies p
           JOIN "${actor.schema}".point_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
           WHERE p.status='active' AND p.event_type='default' ORDER BY p.valid_from DESC LIMIT 1`,
        ),
        canViewGlobal
          ? this.dataSource.query(`${this.requestSelect(actor.schema)} WHERE r.status IN ('pending','approved') ORDER BY r.created_at ASC LIMIT 500`)
          : Promise.resolve([]),
      ]);
      const totals = walletRows[0] || {};
      const authoritative = Number(totals.authoritative_balance || 0);
      const reserved = Number(totals.reserved_points || 0);
      const policy = policies[0]
        ? { ...policies[0], rules: policies[0].formula?.bonus || {} }
        : null;
      return {
        wallet: {
          user_id: requested,
          balance: authoritative - reserved,
          authoritative_balance: authoritative,
          provisional_points: Number(totals.provisional_points || 0),
          reserved_points: reserved,
        },
        ledger,
        requests,
        periods,
        policy,
        pendingRequests,
        canManage: await this.capabilities.has(actor, 'canManagePointPolicies'),
        currentUserId: actor.id,
      };
    }

    await this.dataSource.query(
      `INSERT INTO "${actor.schema}".bonus_wallets (user_id,balance) VALUES ($1,0) ON CONFLICT (user_id) DO NOTHING`, [requested],
    );
    const [wallet, ledger, requests, periods, policies, pendingRequests] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "${actor.schema}".bonus_wallets WHERE user_id=$1`, [requested]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".bonus_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500`, [requested]),
      this.dataSource.query(`${this.requestSelect(actor.schema)} WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 200`, [requested]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".bonus_periods ORDER BY starts_at DESC LIMIT 100`),
      this.dataSource.query(
        `SELECT p.*,v.rules FROM "${actor.schema}".bonus_policies p
         JOIN "${actor.schema}".bonus_policy_versions v ON v.policy_id=p.id AND v.version=p.current_version
         WHERE p.status='active' ORDER BY p.created_at DESC LIMIT 1`,
      ),
      canViewGlobal
        ? this.dataSource.query(`${this.requestSelect(actor.schema)} WHERE r.status IN ('pending','approved') ORDER BY r.created_at ASC LIMIT 500`)
        : Promise.resolve([]),
    ]);
    const ownReserved = requests
      .filter((request: any) => request.status === 'pending')
      .reduce((total: number, request: any) => total + Number(request.points || 0), 0);
    const authoritative = Number(wallet[0]?.balance || 0);
    return {
      wallet: wallet[0]
        ? { ...wallet[0], balance: authoritative - ownReserved, authoritative_balance: authoritative, reserved_points: ownReserved }
        : null,
      ledger, requests, periods, policy: policies[0] || null,
      pendingRequests, canManage: await this.capabilities.has(actor, 'canManagePointPolicies'),
      currentUserId: actor.id,
    };
  }

  async requestBonus(body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure();
    const points = this.amount(body.points, true);
    const reason = boundedText(body.reason, 'reason', 2_000, true);
    const requestedPeriodId = body.periodId || body.period_id
      ? tenantUuid(body.periodId ?? body.period_id, 'periodId')
      : null;
    return this.dataSource.transaction(async (manager) => {
      const current = await this.currentPeriod(manager, actor.schema);
      const periodId = requestedPeriodId || current.id;
      return withTenantIdempotency(
        manager, actor.schema, `bonus:request:${actor.id}`, key, { points, reason, periodId }, actor.id,
        async () => {
          const periods = await manager.query(
            `SELECT 1 FROM "${actor.schema}".bonus_periods WHERE id=$1 AND status='open'`,
            [periodId],
          );
          if (!periods[0]) throw new BadRequestException('Periodo Bonus non aperto');
          const minimum = await this.minimumRequestPoints(manager, actor.schema);
          if (points < minimum) {
            throw new BadRequestException(`La richiesta minima e di ${minimum} punti`);
          }

          let available = 0;
          if (isDoflowTenant(actor.schema)) {
            await this.lockUser(manager, actor.schema, actor.id);
            const balances = await manager.query(
              `SELECT COALESCE(SUM(amount) FILTER (WHERE state<>'provisional'),0) AS balance
               FROM "${actor.schema}".point_ledger WHERE user_id=$1`,
              [actor.id],
            );
            const pending = await manager.query(
              `SELECT COALESCE(SUM(points),0) AS points FROM "${actor.schema}".bonus_requests
               WHERE user_id=$1 AND status='pending'`,
              [actor.id],
            );
            available = Number(balances[0]?.balance || 0) - Number(pending[0]?.points || 0);
          } else {
            await manager.query(`INSERT INTO "${actor.schema}".bonus_wallets (user_id,balance) VALUES ($1,0) ON CONFLICT DO NOTHING`, [actor.id]);
            const wallet = await manager.query(`SELECT balance FROM "${actor.schema}".bonus_wallets WHERE user_id=$1 FOR UPDATE`, [actor.id]);
            const pending = await manager.query(
              `SELECT COALESCE(SUM(points),0) AS points FROM "${actor.schema}".bonus_requests
               WHERE user_id=$1 AND status='pending'`,
              [actor.id],
            );
            available = Number(wallet[0]?.balance || 0) - Number(pending[0]?.points || 0);
          }
          if (available < points) throw new ConflictException('Saldo Bonus insufficiente');

          const rows = await manager.query(
            `INSERT INTO "${actor.schema}".bonus_requests (user_id,period_id,points,reason)
             VALUES ($1,$2,$3,$4) RETURNING *`, [actor.id, periodId, points, reason],
          );
          await manager.query(
            `INSERT INTO "${actor.schema}".bonus_request_history (request_id,status,actor_user_id,reason)
             VALUES ($1,'pending',$2,$3)`, [rows[0].id, actor.id, reason],
          );
          await manager.query(
            `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
             VALUES ($1,'bonus_requested',$2,$3::jsonb)`, [actor.id, rows[0].id, JSON.stringify({ points, periodId })],
          );
          return rows[0];
        },
      );
    });
  }

  async decide(requestValue: string, decision: 'approved' | 'rejected', body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canManagePointPolicies');
    const requestId = tenantUuid(requestValue, 'requestId');
    const reason = boundedText(body.reason, 'reason', 2_000, true);
    return this.dataSource.transaction(async (manager) => withTenantIdempotency(
      manager, actor.schema, `bonus:decision:${requestId}`, key, { decision, reason }, actor.id,
      async () => {
        const requests = await manager.query(`SELECT * FROM "${actor.schema}".bonus_requests WHERE id=$1 FOR UPDATE`, [requestId]);
        const request = requests[0];
        if (!request) throw new NotFoundException('Richiesta Bonus non trovata');
        if (decision === 'approved' && String(request.user_id) === actor.id) {
          throw new ForbiddenException('Non puoi approvare una richiesta Bonus personale');
        }
        if (request.status !== 'pending') {
          if (request.status === decision) return request;
          throw new ConflictException('Richiesta Bonus gia decisa');
        }
        if (decision === 'approved') {
          if (isDoflowTenant(actor.schema)) {
            await this.lockUser(manager, actor.schema, String(request.user_id));
            const balances = await manager.query(
              `SELECT COALESCE(SUM(amount) FILTER (WHERE state<>'provisional'),0) AS balance
               FROM "${actor.schema}".point_ledger WHERE user_id=$1`,
              [request.user_id],
            );
            if (Number(balances[0]?.balance || 0) < Number(request.points)) {
              throw new ConflictException('Saldo Bonus insufficiente');
            }
            const policy = await this.activePointPolicy(manager, actor.schema);
            await manager.query(
              `INSERT INTO "${actor.schema}".point_ledger
               (user_id,policy_id,policy_version,event_type,source_record_type,source_record_id,
                operation_id,amount,state,effective_at,actor_user_id,reason,metadata)
               VALUES ($1,$2,$3,'bonus_redemption','bonus_request',$4,$5,$6,'approved',now(),$7,$8,$9::jsonb)
               ON CONFLICT (operation_id,event_type,user_id) DO NOTHING`,
              [request.user_id, policy.id, policy.current_version, requestId,
                this.operationUuid(`bonus-request:${requestId}:approved`), -Number(request.points), actor.id, reason,
                JSON.stringify({ bonus_request_id: requestId })],
            );
          } else {
            const wallet = await manager.query(
              `UPDATE "${actor.schema}".bonus_wallets SET balance=balance-$2,updated_at=now()
               WHERE user_id=$1 AND balance >= $2 RETURNING *`, [request.user_id, request.points],
            );
            if (!wallet[0]) throw new ConflictException('Saldo Bonus insufficiente');
            await manager.query(
              `INSERT INTO "${actor.schema}".bonus_ledger
               (user_id,period_id,amount,entry_type,source_type,source_id,reason,operation_key,actor_user_id)
               VALUES ($1,$2,$3,'redemption','bonus_request',$4,$5,$6,$7)`,
              [request.user_id, request.period_id, -Number(request.points), requestId, reason, `bonus-request:${requestId}:approved`, actor.id],
            );
          }
        }
        const updated = await manager.query(
          `UPDATE "${actor.schema}".bonus_requests SET status=$2,decided_by=$3,decided_at=now(),decision_reason=$4,updated_at=now()
           WHERE id=$1 RETURNING *`, [requestId, decision, actor.id, reason],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_approvals (request_id,approver_user_id,decision,reason)
           VALUES ($1,$2,$3,$4)`, [requestId, actor.id, decision, reason],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_request_history (request_id,status,actor_user_id,reason)
           VALUES ($1,$2,$3,$4)`, [requestId, decision, actor.id, reason],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
           VALUES ($1,$2,$3,$4::jsonb)`, [actor.id, `bonus_${decision}`, requestId, JSON.stringify({ reason })],
        );
        return updated[0];
      },
    ));
  }

  async payout(requestValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canManagePointPolicies');
    if (!key) throw new BadRequestException('Idempotency-Key obbligatoria');
    const requestId = tenantUuid(requestValue, 'requestId');
    const reference = boundedText(body.reference, 'reference', 300, true);
    return this.dataSource.transaction((manager) => withTenantIdempotency(
      manager,
      actor.schema,
      `bonus:payout:${requestId}`,
      key,
      { requestId, reference },
      actor.id,
      async () => {
        const rows = await manager.query(
          `SELECT * FROM "${actor.schema}".bonus_requests WHERE id=$1 FOR UPDATE`,
          [requestId],
        );
        const request = rows[0];
        if (!request) throw new NotFoundException('Richiesta Bonus non trovata');
        if (String(request.user_id) === actor.id) throw new ForbiddenException('Non puoi liquidare una richiesta Bonus personale');
        if (request.status === 'paid') return request;
        if (request.status !== 'approved') throw new ConflictException('Solo una richiesta approvata puo essere liquidata');
        const updated = await manager.query(
          `UPDATE "${actor.schema}".bonus_requests
           SET status='paid',updated_at=now() WHERE id=$1 AND status='approved' RETURNING *`,
          [requestId],
        );
        if (!updated[0]) throw new ConflictException('Richiesta Bonus modificata da un altro utente');
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_request_history (request_id,status,actor_user_id,reason)
           VALUES ($1,'paid',$2,$3)`,
          [requestId, actor.id, `Liquidazione gestionale: ${reference}`],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
           VALUES ($1,'bonus_paid',$2,$3::jsonb)`,
          [actor.id, requestId, JSON.stringify({ reference, managementStateOnly: true })],
        );
        return updated[0];
      },
    ));
  }

  async adjustment(body: Record<string, unknown>, key?: string) {
    rejectTenantOverride(body);
    const actor = await this.ensure('canManagePointPolicies');
    if (!key) throw new BadRequestException('Idempotency-Key obbligatoria');
    const userId = tenantUuid(body.userId ?? body.user_id, 'userId');
    const amount = this.amount(body.points ?? body.amount);
    const reason = boundedText(body.reason, 'reason', 2_000, true);
    await this.assertUser(actor.schema, userId);
    return this.dataSource.transaction(async (manager) => {
      const period = await this.currentPeriod(manager, actor.schema);
      return withTenantIdempotency(
        manager, actor.schema, `bonus:adjustment:${userId}`, key,
        { userId, amount, reason, periodId: period.id }, actor.id,
        async () => {
          let rows: any[];
          if (isDoflowTenant(actor.schema)) {
            const policy = await this.activePointPolicy(manager, actor.schema);
            rows = await manager.query(
              `INSERT INTO "${actor.schema}".point_ledger
               (user_id,policy_id,policy_version,event_type,source_record_type,operation_id,
                amount,state,effective_at,actor_user_id,reason,metadata)
               VALUES ($1,$2,$3,'manual_adjustment','manual',$4,$5,'adjustment',now(),$6,$7,$8::jsonb)
               ON CONFLICT (operation_id,event_type,user_id)
               DO UPDATE SET operation_id=EXCLUDED.operation_id RETURNING *`,
              [userId, policy.id, policy.current_version, this.operationUuid(`bonus-adjustment:${key}`),
                amount, actor.id, reason, JSON.stringify({ idempotency_key: key, bonus_period_id: period.id })],
            );
          } else {
            if (period.status !== 'open') throw new ConflictException('Periodo Bonus non aperto');
            rows = await manager.query(
              `INSERT INTO "${actor.schema}".bonus_ledger
               (user_id,period_id,amount,entry_type,source_type,reason,operation_key,actor_user_id)
               VALUES ($1,$2,$3,'provisional','manual',$4,$5,$6) RETURNING *`,
              [userId, period.id, amount, reason, `adjustment:${key}`, actor.id],
            );
          }
          await manager.query(
            `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
             VALUES ($1,'bonus_adjusted',$2,$3::jsonb)`, [actor.id, rows[0].id, JSON.stringify({ userId, amount, reason, periodId: period.id })],
          );
          return rows[0];
        },
      );
    });
  }

  async policyVersion(body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canManagePointPolicies');
    if (!body.rules || typeof body.rules !== 'object' || Array.isArray(body.rules)) throw new BadRequestException('rules non valide');
    const reason = boundedText(body.reason, 'reason', 2_000, true);
    const name = boundedText(body.name || 'Policy Bonus', 'name', 160, true);
    return this.dataSource.transaction(async (manager) => withTenantIdempotency(
      manager, actor.schema, 'bonus:policy', key, { name, reason, rules: body.rules }, actor.id,
      async () => {
        if (isDoflowTenant(actor.schema)) {
          const policy = await this.activePointPolicy(manager, actor.schema, true);
          const currentFormula = policy.formula && typeof policy.formula === 'object' && !Array.isArray(policy.formula)
            ? policy.formula
            : {};
          const formula = { ...currentFormula, bonus: body.rules };
          const next = Number(policy.current_version) + 1;
          await manager.query(
            `INSERT INTO "${actor.schema}".point_policy_versions (policy_id,version,formula,reason,created_by)
             VALUES ($1,$2,$3::jsonb,$4,$5)`,
            [policy.id, next, JSON.stringify(formula), reason, actor.id],
          );
          await manager.query(
            `UPDATE "${actor.schema}".point_policies SET current_version=$2,updated_at=now() WHERE id=$1`,
            [policy.id, next],
          );
          await manager.query(
            `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
             VALUES ($1,'bonus_policy_version_created',$2,$3::jsonb)`,
            [actor.id, policy.id, JSON.stringify({ version: next, reason })],
          );
          return { id: policy.id, name: policy.name, current_version: next, version: next, rules: body.rules };
        }

        let policies = await manager.query(`SELECT * FROM "${actor.schema}".bonus_policies WHERE status='active' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`);
        if (!policies[0]) policies = await manager.query(
          `INSERT INTO "${actor.schema}".bonus_policies (name,status,current_version,created_by)
           VALUES ($1,'active',0,$2) RETURNING *`, [name, actor.id],
        );
        const next = Number(policies[0].current_version) + 1;
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_policy_versions (policy_id,version,rules,reason,created_by)
           VALUES ($1,$2,$3::jsonb,$4,$5)`, [policies[0].id, next, JSON.stringify(body.rules), reason, actor.id],
        );
        const rows = await manager.query(
          `UPDATE "${actor.schema}".bonus_policies SET name=$2,current_version=$3,updated_at=now() WHERE id=$1 RETURNING *`,
          [policies[0].id, name, next],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
           VALUES ($1,'bonus_policy_version_created',$2,$3::jsonb)`, [actor.id, policies[0].id, JSON.stringify({ version: next, reason })],
        );
        return { ...rows[0], version: next, rules: body.rules };
      },
    ));
  }

  async consolidatePeriod(body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canManagePointPolicies');
    if (!key) throw new BadRequestException('Idempotency-Key obbligatoria');
    const periodId = tenantUuid(body.periodId ?? body.period_id, 'periodId');
    const reason = boundedText(body.reason || 'Consolidamento periodo Bonus', 'reason', 2_000, true);
    return this.dataSource.transaction((manager) => withTenantIdempotency(
      manager,
      actor.schema,
      `bonus:period:consolidate:${periodId}`,
      key,
      { periodId, reason },
      actor.id,
      async () => {
        const periods = await manager.query(
          `SELECT * FROM "${actor.schema}".bonus_periods WHERE id=$1 FOR UPDATE`,
          [periodId],
        );
        const period = periods[0];
        if (!period) throw new NotFoundException('Periodo Bonus non trovato');
        if (period.status === 'locked') {
          return { periodId, status: 'locked', consolidatedEntries: 0, alreadyConsolidated: true };
        }
        if (period.status !== 'open') throw new ConflictException('Periodo Bonus non consolidabile');
        let entries: any[];
        if (isDoflowTenant(actor.schema)) {
          entries = await manager.query(
            `UPDATE "${actor.schema}".point_ledger
             SET state='approved',
                 metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
                   'previousState','provisional','consolidatedAt',now(),'consolidatedBy',$3::text,
                   'bonusPeriodId',$4::text
                 )
             WHERE state='provisional'
               AND effective_at >= $1::date
               AND effective_at < ($2::date + INTERVAL '1 day')
             RETURNING id,user_id,amount`,
            [period.starts_at, period.ends_at, actor.id, periodId],
          );
        } else {
          entries = await manager.query(
            `UPDATE "${actor.schema}".bonus_ledger
             SET entry_type='consolidated',
                 metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
                   'previousEntryType','provisional','consolidatedAt',now(),'consolidatedBy',$2::text
                 )
             WHERE period_id=$1 AND entry_type='provisional'
             RETURNING id,user_id,amount`,
            [periodId, actor.id],
          );
          const totals = new Map<string, number>();
          for (const entry of entries) {
            const userId = String(entry.user_id);
            totals.set(userId, (totals.get(userId) || 0) + Number(entry.amount || 0));
          }
          for (const [userId, amount] of totals) {
            await manager.query(
              `INSERT INTO "${actor.schema}".bonus_wallets AS wallet (user_id,balance)
               VALUES ($1,$2)
               ON CONFLICT (user_id) DO UPDATE
               SET balance=wallet.balance+EXCLUDED.balance,updated_at=now()`,
              [userId, amount],
            );
          }
        }
        await manager.query(
          `UPDATE "${actor.schema}".bonus_periods SET status='locked' WHERE id=$1`,
          [periodId],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".bonus_audit (actor_user_id,action,target_id,metadata)
           VALUES ($1,'bonus_period_consolidated',$2,$3::jsonb)`,
          [actor.id, periodId, JSON.stringify({ reason, consolidatedEntries: entries.length })],
        );
        return { periodId, status: 'locked', consolidatedEntries: entries.length, alreadyConsolidated: false };
      },
    ));
  }
}
