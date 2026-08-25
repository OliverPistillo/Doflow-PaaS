import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class TenantCrmMutationDto {
  @IsOptional()
  @IsUUID(4)
  id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  legal_name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  vat_number?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  fiscal_code?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  industry?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  size?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  status?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  source?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  address?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000_000)
  logo_url?: string;

  @IsOptional()
  @IsUUID(4)
  owner_user_id?: string;

  @IsOptional()
  @IsUUID(4)
  company_id?: string;

  @IsOptional()
  @IsUUID(4)
  contact_id?: string;

  @IsOptional()
  @IsUUID(4)
  lead_id?: string;

  @IsOptional()
  @IsUUID(4)
  opportunity_id?: string;

  @IsOptional()
  @IsUUID(4)
  assigned_to?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  first_name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  last_name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  role_title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  decision_level?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  preferred_channel?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  interest?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  budget_estimate?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  urgency?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  quality?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  next_action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  next_action_at?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  lost_reason?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  service_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value_estimate?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  lead_source?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  lead_interest?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  lead_urgency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  probability?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  expected_close_date?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  due_at?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  completed_at?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kanban_order?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class OpportunityStageDto {
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  stage!: string;
}
