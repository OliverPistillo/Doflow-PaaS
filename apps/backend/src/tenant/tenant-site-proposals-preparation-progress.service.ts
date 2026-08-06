import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { PreparationProgressStage } from './tenant-site-proposals.types';
import { cleanString, UUID_RE } from './tenant-site-proposals-validation';

export type PreparationProgressUpdate = {
  percent: number;
  stage: PreparationProgressStage;
  message: string;
  provider?: 'gemini' | 'local' | null;
  failed?: boolean;
};

type PersistedPreparationProgress = {
  progress_percent: number;
  progress_stage: string;
  progress_message: string;
  progress_updated_at: string | Date;
  heartbeat_at: string | Date;
  provider?: 'gemini' | 'local' | null;
};

const PREPARATION_PROGRESS_STAGES = new Set<PreparationProgressStage>([
  'waiting', 'queueing', 'loading-data', 'loading-theme', 'identity', 'base-content',
  'ai', 'local', 'images', 'logo', 'validation', 'html', 'zip', 'artifacts', 'ready', 'failed',
]);

@Injectable()
export class TenantSiteProposalsPreparationProgressService {
  constructor(private readonly dataSource: DataSource) {}

  async update(schemaInput: string, runId: string, proposalId: string, update: PreparationProgressUpdate) {
    const schema = safeSchema(schemaInput, 'site proposal preparation progress');
    if (schema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(runId) || !UUID_RE.test(proposalId)) throw new BadRequestException('Aggiornamento progresso non valido');
    const normalized = this.validateUpdate(update);
    const { percent, message, stage, failed, provider } = normalized;
    const rows = await this.dataSource.query(`
      WITH updated AS (
        UPDATE "${schema}".site_proposal_preparation_runs
        SET progress_percent=CASE
              WHEN $4::boolean THEN COALESCE(progress_percent,0::smallint)
              ELSE GREATEST(COALESCE(progress_percent,0::smallint),$1::smallint)
            END,
            progress_stage=$2::text,progress_message=$3::text,progress_updated_at=now(),heartbeat_at=now(),
            provider=COALESCE($5::text,provider),updated_at=now()
        WHERE id=$6::uuid AND proposal_id=$7::uuid
        RETURNING progress_percent,progress_stage,progress_message,progress_updated_at,heartbeat_at,provider
      )
      SELECT COALESCE(progress_percent,0::smallint) AS progress_percent,
        COALESCE(NULLIF(BTRIM(progress_stage),''),'waiting') AS progress_stage,
        COALESCE(NULLIF(BTRIM(progress_message),''),'In attesa') AS progress_message,
        COALESCE(progress_updated_at,now()) AS progress_updated_at,
        COALESCE(heartbeat_at,now()) AS heartbeat_at,provider
      FROM updated
    `, [percent, stage, message, failed, provider, runId, proposalId]);
    const progress = this.progressRow(rows[0], 'Run di preparazione non trovato');
    await this.dataSource.query(`
      UPDATE "${schema}".site_proposals
      SET progress_percent=COALESCE($1::smallint,0::smallint),
          progress_stage=COALESCE(NULLIF(BTRIM($2::text),''),'waiting'),
          progress_message=COALESCE(NULLIF(BTRIM($3::text),''),'In attesa'),
          progress_updated_at=COALESCE($4::timestamptz,now()),
          preparation_heartbeat_at=COALESCE($5::timestamptz,now()),updated_at=now()
      WHERE id=$6::uuid AND latest_preparation_job_id=$7::text
    `, [progress.progress_percent, progress.progress_stage, progress.progress_message, progress.progress_updated_at, progress.heartbeat_at, proposalId, runId]);
    return progress;
  }

  async failRun(schemaInput: string, runId: string, proposalId: string, failure: string) {
    const schema = safeSchema(schemaInput, 'site proposal preparation failure');
    if (schema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(runId) || !UUID_RE.test(proposalId)) throw new BadRequestException('Finalizzazione preparazione non valida');
    const message = cleanString(failure, 500) || 'Preparazione non riuscita';
    const runner = this.dataSource.createQueryRunner();
    let original: unknown;
    try {
      await runner.connect();
      await runner.startTransaction();
      const proposal = (await runner.query(`SELECT id FROM "${schema}".site_proposals WHERE id=$1::uuid FOR UPDATE`, [proposalId]))[0];
      if (!proposal) throw new BadRequestException('Proposta non trovata');
      const run = (await runner.query(`
        SELECT id FROM "${schema}".site_proposal_preparation_runs
        WHERE id=$1::uuid AND proposal_id=$2::uuid
        FOR UPDATE
      `, [runId, proposalId]))[0];
      if (!run) throw new BadRequestException('Run di preparazione non trovato');
      const rows = await runner.query(`
        WITH updated AS (
          UPDATE "${schema}".site_proposal_preparation_runs
          SET status='failed',completed_at=now(),last_error=$3::text,
              progress_percent=COALESCE(progress_percent,0::smallint),progress_stage='failed',
              progress_message=$3::text,progress_updated_at=now(),heartbeat_at=now(),updated_at=now()
          WHERE id=$1::uuid AND proposal_id=$2::uuid
          RETURNING progress_percent,progress_stage,progress_message,progress_updated_at,heartbeat_at
        )
        SELECT COALESCE(progress_percent,0::smallint) AS progress_percent,
          COALESCE(NULLIF(BTRIM(progress_stage),''),'failed') AS progress_stage,
          COALESCE(NULLIF(BTRIM(progress_message),''),'Preparazione non riuscita') AS progress_message,
          COALESCE(progress_updated_at,now()) AS progress_updated_at,
          COALESCE(heartbeat_at,now()) AS heartbeat_at
        FROM updated
      `, [runId, proposalId, message]);
      const progress = this.progressRow(rows[0], 'Finalizzazione preparazione non riuscita');
      if (progress.progress_stage !== 'failed') throw new BadRequestException('Stato finale preparazione non valido');
      await runner.query(`
        UPDATE "${schema}".site_proposals
        SET preparation_status='failed',preparation_error=$3::text,preparation_completed_at=now(),
            progress_percent=COALESCE($4::smallint,0::smallint),progress_stage='failed',
            progress_message=COALESCE(NULLIF(BTRIM($3::text),''),'Preparazione non riuscita'),
            progress_updated_at=COALESCE($5::timestamptz,now()),
            preparation_heartbeat_at=COALESCE($6::timestamptz,now()),updated_at=now()
        WHERE id=$2::uuid AND latest_preparation_job_id=$1::text
      `, [runId, proposalId, message, progress.progress_percent, progress.progress_updated_at, progress.heartbeat_at]);
      await runner.commitTransaction();
      return progress;
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await runner.release().catch((error) => { if (!original) throw error; });
    }
  }

  private validateUpdate(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Dati progresso non validi');
    const update = value as Record<string, unknown>;
    if (typeof update.percent !== 'number' || !Number.isFinite(update.percent)) throw new BadRequestException('Percentuale progresso non valida');
    if (typeof update.message !== 'string') throw new BadRequestException('Messaggio progresso non valido');
    if (update.failed !== undefined && typeof update.failed !== 'boolean') throw new BadRequestException('Stato fallimento progresso non valido');
    if (update.provider !== undefined && update.provider !== null && update.provider !== 'gemini' && update.provider !== 'local') throw new BadRequestException('Provider progresso non valido');
    const failed = update.failed === true;
    if (!failed && (typeof update.stage !== 'string' || !PREPARATION_PROGRESS_STAGES.has(update.stage as PreparationProgressStage))) throw new BadRequestException('Fase progresso non valida');
    const message = cleanString(update.message, 180);
    if (!message) throw new BadRequestException('Messaggio progresso non valido');
    return {
      percent: Math.max(0, Math.min(100, Math.trunc(update.percent))),
      stage: failed ? 'failed' as const : update.stage as PreparationProgressStage,
      message,
      failed,
      provider: update.provider === 'gemini' || update.provider === 'local' ? update.provider : null,
    };
  }

  private progressRow(value: unknown, missingMessage: string): PersistedPreparationProgress {
    if (!value) throw new BadRequestException(missingMessage);
    if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Risultato progresso non valido');
    const row = value as Record<string, unknown>;
    const validTimestamp = (timestamp: unknown) => (timestamp instanceof Date && Number.isFinite(timestamp.getTime())) || (typeof timestamp === 'string' && timestamp.trim().length > 0);
    if (typeof row.progress_percent !== 'number' || !Number.isFinite(row.progress_percent)
      || typeof row.progress_stage !== 'string' || !row.progress_stage.trim()
      || typeof row.progress_message !== 'string' || !row.progress_message.trim()
      || !validTimestamp(row.progress_updated_at) || !validTimestamp(row.heartbeat_at)
      || (row.provider !== undefined && row.provider !== null && row.provider !== 'gemini' && row.provider !== 'local')) {
      throw new BadRequestException('Risultato progresso non valido');
    }
    return row as PersistedPreparationProgress;
  }
}
