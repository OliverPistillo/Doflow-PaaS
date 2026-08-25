import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class VersionedCommercialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class CreateCommercialLeadDto {
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  companyName!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  title!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  firstName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  lastName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  email?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  serviceType?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  probability?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stage?: string;

  @IsOptional()
  @IsUUID(4)
  assignedTo?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nextAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nextActionAt?: string;

  @IsOptional()
  @IsUUID(4)
  campaignId?: string;
}

export class PipelineTransitionDto extends VersionedCommercialDto {
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  stage!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class PipelineReorderDto {
  @Transform(trim)
  @IsString()
  @MaxLength(64)
  stage!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID(4, { each: true })
  leadIds!: string[];
}

export class ActivityOrderItemDto extends VersionedCommercialDto {
  @IsUUID(4)
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order!: number;
}

export class ActivityReorderDto {
  @IsUUID(4)
  activityId!: string;

  @Transform(trim)
  @IsIn(['todo', 'in_progress', 'waiting_client', 'completed', 'cancelled'])
  status!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ActivityOrderItemDto)
  items!: ActivityOrderItemDto[];
}

export class ArchiveCommercialDto extends VersionedCommercialDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ConvertOpportunityDto extends VersionedCommercialDto {
  @IsOptional()
  @IsUUID(4)
  existingCompanyId?: string;

  @IsOptional()
  @IsBoolean()
  createOnboardingActivity?: boolean;
}

export class CommercialAttributionDto extends VersionedCommercialDto {
  @IsOptional()
  @IsUUID(4)
  campaignId?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  source?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  medium?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  content?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  term?: string;
}

export class DuplicateDecisionDto {
  @IsUUID(4)
  leftId!: string;

  @IsUUID(4)
  rightId!: string;

  @IsIn(['ignored', 'pending'])
  decision!: 'ignored' | 'pending';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MergeDuplicateDto {
  @IsUUID(4)
  primaryId!: string;

  @IsUUID(4)
  secondaryId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  primaryVersion!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  secondaryVersion!: number;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

export class CommercialCommunicationDto {
  @Transform(trim)
  @IsIn(['whatsapp', 'email', 'chiamata', 'nota', 'phone', 'note'])
  channel!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(300)
  title!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsUUID(4)
  contactId?: string;

  @IsOptional()
  @IsUUID(4)
  leadId?: string;

  @IsOptional()
  @IsUUID(4)
  opportunityId?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  direction?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCommercialCommunicationDto extends VersionedCommercialDto {
  @IsObject()
  updates!: Record<string, unknown>;
}
