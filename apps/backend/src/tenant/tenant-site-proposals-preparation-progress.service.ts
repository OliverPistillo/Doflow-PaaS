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

@Injectable()
export class TenantSiteProposalsPreparationProgressService {
  constructor(private readonly dataSource: DataSource) {}

  async update(schemaInput: string, runId: string, proposalId: string, update: PreparationProgressUpdate) {
    const schema = safeSchema(schemaInput, 'site proposal preparation progress');
    if (schema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(runId) || !UUID_RE.test(proposalId)) throw new BadRequestException('Aggiornamento progresso non valido');
    const percent = Math.max(0, Math.min(100, Math.trunc(update.percent)));
    const message = cleanString(update.message, 180) || 'Preparazione in corso';
    const stage = update.failed ? 'failed' : update.stage;
    const rows = await this.dataSource.query(`
      UPDATE "${schema}".site_proposal_preparation_runs
      SET progress_percent=CASE
            WHEN $4::boolean THEN COALESCE(progress_percent,0::smallint)
            ELSE GREATEST(COALESCE(progress_percent,0::smallint),$1::smallint)
          END,
          progress_stage=$2::text,progress_message=$3::text,progress_updated_at=now(),heartbeat_at=now(),
          provider=COALESCE($5::text,provider),updated_at=now()
      WHERE id=$6::uuid AND proposal_id=$7::uuid
      RETURNING COALESCE(progress_percent,0::smallint) AS progress_percent,
        progress_stage,progress_message,progress_updated_at,heartbeat_at,provider
    `, [percent, stage, message, update.failed === true, update.provider || null, runId, proposalId]);
    const progress = rows[0];
    if (!progress) throw new BadRequestException('Run di preparazione non trovato');
    await this.dataSource.query(`
      UPDATE "${schema}".site_proposals
      SET progress_percent=COALESCE($1::smallint,0::smallint),progress_stage=$2::text,
          progress_message=$3::text,progress_updated_at=$4::timestamptz,
          preparation_heartbeat_at=$5::timestamptz,updated_at=now()
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
      const progress = (await runner.query(`
        UPDATE "${schema}".site_proposal_preparation_runs
        SET status='failed',completed_at=now(),last_error=$3::text,
            progress_percent=COALESCE(progress_percent,0::smallint),progress_stage='failed',
            progress_message=$3::text,progress_updated_at=now(),heartbeat_at=now(),updated_at=now()
        WHERE id=$1::uuid AND proposal_id=$2::uuid
        RETURNING COALESCE(progress_percent,0::smallint) AS progress_percent,
          progress_stage,progress_message,progress_updated_at,heartbeat_at
      `, [runId, proposalId, message]))[0];
      await runner.query(`
        UPDATE "${schema}".site_proposals
        SET preparation_status='failed',preparation_error=$3::text,preparation_completed_at=now(),
            progress_percent=COALESCE($4::smallint,0::smallint),progress_stage='failed',
            progress_message=$3::text,progress_updated_at=$5::timestamptz,
            preparation_heartbeat_at=$6::timestamptz,updated_at=now()
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
}
