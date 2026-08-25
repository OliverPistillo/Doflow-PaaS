import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsNumber,
  IsObject, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export const DELIVERY_PROJECT_STATES = [
  'not_started', 'onboarding', 'in_progress', 'blocked', 'qa_internal',
  'internal_review', 'ready_client', 'client_review', 'changes_requested',
  'ready_publish', 'published', 'delivered', 'support', 'suspended', 'cancelled',
] as const;
export const DELIVERY_TASK_STATES = [
  'backlog', 'ready', 'in_progress', 'internal_review', 'client_review', 'blocked', 'done',
] as const;

export class VersionedDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class CreateDeliveryProjectDto {
  @IsString() @IsNotEmpty() @MaxLength(500) name!: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @IsString() @MaxLength(100) type?: string;
  @IsOptional() @IsIn(DELIVERY_PROJECT_STATES) status?: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsUUID() company_id?: string;
  @IsOptional() @IsUUID() contact_id?: string;
  @IsOptional() @IsUUID() opportunity_id?: string;
  @IsOptional() @IsUUID() lead_id?: string;
  @IsOptional() @IsUUID() quote_id?: string;
  @IsOptional() @IsUUID() order_id?: string;
  @IsOptional() @IsString() @MaxLength(200) source_event_id?: string;
  @IsOptional() @IsUUID() project_manager_id?: string;
  @IsOptional() @IsISO8601({ strict: true }) start_date?: string;
  @IsOptional() @IsISO8601({ strict: true }) due_date?: string;
  @IsOptional() @IsArray() @IsObject({ each: true }) members?: Record<string, unknown>[];
  @IsOptional() @IsArray() @IsObject({ each: true }) phases?: Record<string, unknown>[];
  @IsOptional() @IsArray() @IsObject({ each: true }) tasks?: Record<string, unknown>[];
  @IsOptional() @IsArray() @IsObject({ each: true }) dependencies?: Record<string, unknown>[];
}

export class UpdateDeliveryProjectDto extends VersionedDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) name?: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @IsString() @MaxLength(100) type?: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsUUID() company_id?: string;
  @IsOptional() @IsUUID() contact_id?: string;
  @IsOptional() @IsUUID() opportunity_id?: string;
  @IsOptional() @IsUUID() lead_id?: string;
  @IsOptional() @IsUUID() quote_id?: string;
  @IsOptional() @IsUUID() order_id?: string;
  @IsOptional() @IsUUID() project_manager_id?: string;
  @IsOptional() @IsISO8601({ strict: true }) start_date?: string;
  @IsOptional() @IsISO8601({ strict: true }) due_date?: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

export class TransitionDeliveryProjectDto extends VersionedDto {
  @IsIn(DELIVERY_PROJECT_STATES) status!: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

export class DeliveryMemberDto {
  @IsUUID() user_id!: string;
  @IsIn(['project_manager', 'supervisor', 'member', 'developer', 'designer', 'seo', 'copywriter']) role!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) allocation_percent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity_minutes_week?: number;
}
export class UpdateDeliveryMemberDto extends VersionedDto {
  @IsOptional() @IsIn(['project_manager', 'supervisor', 'member', 'developer', 'designer', 'seo', 'copywriter']) role?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) allocation_percent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity_minutes_week?: number;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

export class CreateDeliveryPhaseDto {
  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.001) weight?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort_order?: number;
  @IsOptional() @IsUUID() responsible_user_id?: string;
  @IsOptional() @IsISO8601({ strict: true }) planned_start_at?: string;
  @IsOptional() @IsISO8601({ strict: true }) planned_due_at?: string;
}
export class UpdateDeliveryPhaseDto extends VersionedDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) title?: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.001) weight?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort_order?: number;
  @IsOptional() @IsUUID() responsible_user_id?: string;
  @IsOptional() @IsISO8601({ strict: true }) planned_start_at?: string;
  @IsOptional() @IsISO8601({ strict: true }) planned_due_at?: string;
  @IsOptional() @IsIn(['pending', 'in_progress', 'completed', 'blocked']) status?: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}
export class ReorderDeliveryPhasesDto extends VersionedDto {
  @IsArray() @IsUUID('4', { each: true }) phase_ids!: string[];
}

export class CreateDeliveryTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @IsUUID() phase_id?: string;
  @IsOptional() @IsUUID() assignee_id?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) collaborator_ids?: string[];
  @IsOptional() @IsIn(DELIVERY_TASK_STATES) status?: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsISO8601({ strict: true }) due_at?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimated_minutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() recurrence_rule?: Record<string, unknown>;
}
export class UpdateDeliveryTaskDto extends VersionedDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) title?: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @IsOptional() @IsUUID() phase_id?: string;
  @IsOptional() @IsUUID() assignee_id?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) collaborator_ids?: string[];
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsISO8601({ strict: true }) due_at?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimated_minutes?: number;
  @IsOptional() @IsString() @MaxLength(2_000) blocked_reason?: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}
export class TaskStateDto extends VersionedDto {
  @IsIn(DELIVERY_TASK_STATES) status!: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}
export class GenerateTaskRecurrenceDto extends VersionedDto {}
export class ReorderDeliveryTasksDto {
  @IsUUID() moved_task_id!: string;
  @IsIn(DELIVERY_TASK_STATES) status!: string;
  @IsArray() @IsObject({ each: true }) items!: Record<string, unknown>[];
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

export class CreateTaskDependencyDto {
  @IsUUID() predecessor_task_id!: string;
  @IsUUID() successor_task_id!: string;
  @IsOptional() @IsIn(['finish_to_start']) dependency_type?: string;
}

export class CreateChecklistItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) title!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort_order?: number;
}
export class UpdateChecklistItemDto extends VersionedDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) title?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsBoolean() is_done?: boolean;
}

export class StartTimerDto {
  @IsUUID() project_id!: string;
  @IsOptional() @IsUUID() task_id?: string;
}
export class StopTimerDto extends VersionedDto {
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) stop_key!: string;
}
export class CorrectTimerDto extends VersionedDto {
  @IsISO8601({ strict: true }) started_at!: string;
  @IsISO8601({ strict: true }) ended_at!: string;
  @IsString() @IsNotEmpty() @MaxLength(4_000) reason!: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
}

export class CreateQaItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) label!: string;
  @IsOptional() @IsUUID() phase_id?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort_order?: number;
}
export class UpdateQaItemDto extends VersionedDto {
  @IsBoolean() completed!: boolean;
  @IsOptional() @IsString() @MaxLength(2_000) comment?: string;
}
export class QaDecisionDto extends VersionedDto {
  @IsOptional() @IsUUID() task_id?: string;
  @IsString() @IsNotEmpty() @MaxLength(4_000) note!: string;
  @IsOptional() @IsString() @MaxLength(4_000) override_reason?: string;
}
export class SubmitQaDto extends VersionedDto {
  @IsUUID() task_id!: string;
}
export class PublishDeliveryProjectDto extends VersionedDto {
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(2_000) artifact_url?: string;
  @IsOptional() @IsString() @MaxLength(4_000) notes?: string;
}
export class ReasonDto extends VersionedDto {
  @IsString() @IsNotEmpty() @MaxLength(4_000) reason!: string;
}
export class DeliveryNoteDto extends VersionedDto {
  @IsOptional() @IsString() @MaxLength(4_000) notes?: string;
}
export class LinkCommercialActivityDto extends VersionedDto {
  @IsOptional() @IsUUID() phase_id?: string;
  @IsOptional() @IsString() @MaxLength(2_000) reason?: string;
}

export class CreateDeliveryCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(10_000) body!: string;
  @IsOptional() @IsUUID() task_id?: string;
  @IsOptional() @IsUUID() phase_id?: string;
  @IsOptional() @IsIn(['internal', 'private']) visibility?: string;
}
