// apps/backend/src/sales-intelligence/dto/analyze-prospect.dto.ts
import { IsString, IsOptional, IsNotEmpty, IsEmail } from 'class-validator';

export class AnalyzeProspectDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsString()
  @IsOptional()
  seniority?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  /** ID Apollo della persona — opzionale, per riferimento futuro */
  @IsString()
  @IsOptional()
  apolloPersonId?: string;

  /** Nostre soluzioni da mappare sui pain point */
  @IsString()
  @IsOptional()
  ourSolutionsCatalog?: string;

  /** userId superadmin che avvia l'analisi — per WS notify */
  @IsString()
  @IsOptional()
  userId?: string;
}