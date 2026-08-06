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
      SET progress_percent=CASE WHEN $4 THEN progress_percent ELSE GREATEST(progress_percent,$1) END,
          progress_stage=$2,progress_message=$3,progress_updated_at=now(),heartbeat_at=now(),
          provider=COALESCE($5,provider),updated_at=now()
      WHERE id=$6 AND proposal_id=$7
      RETURNING progress_percent,progress_stage,progress_message,progress_updated_at,heartbeat_at,provider
    `, [percent, stage, message, update.failed === true, update.provider || null, runId, proposalId]);
    const progress = rows[0];
    if (!progress) throw new BadRequestException('Run di preparazione non trovato');
    await this.dataSource.query(`
      UPDATE "${schema}".site_proposals
      SET progress_percent=$1,progress_stage=$2,progress_message=$3,progress_updated_at=$4,
          preparation_heartbeat_at=$5,updated_at=now()
      WHERE id=$6 AND latest_preparation_job_id=$7
    `, [progress.progress_percent, progress.progress_stage, progress.progress_message, progress.progress_updated_at, progress.heartbeat_at, proposalId, runId]);
    return progress;
  }
}
