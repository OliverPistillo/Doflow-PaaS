import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PUBLIC_LEAD_FORM_VERSIONS = ['doflow-contact-v1'] as const;
export const PUBLIC_LEAD_PROJECT_TYPES = [
  'Sito vetrina',
  'E-commerce',
  'Landing page',
  'Altro progetto',
] as const;
export const PUBLIC_LEAD_GOALS = [
  'Ricevere più contatti',
  'Vendere online',
  'Rafforzare il brand',
  'Lanciare un nuovo progetto',
] as const;
export const PUBLIC_LEAD_TIMELINES = [
  'Il prima possibile',
  'Entro 1-2 mesi',
  'Tra 3 mesi o più',
  'Sto valutando',
] as const;

function trim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptional(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class PublicLeadIntakeDto {
  @IsUUID(4, { message: 'Riferimento richiesta non valido.' })
  submission_id!: string;

  @IsIn(PUBLIC_LEAD_FORM_VERSIONS, { message: 'Versione form non valida.' })
  form_version!: string;

  @IsIn(PUBLIC_LEAD_PROJECT_TYPES, { message: 'Tipo progetto non valido.' })
  project_type!: string;

  @IsArray({ message: 'Obiettivi non validi.' })
  @ArrayMinSize(1, { message: 'Seleziona almeno un obiettivo.' })
  @ArrayMaxSize(2, { message: 'Seleziona al massimo due obiettivi.' })
  @IsIn(PUBLIC_LEAD_GOALS, { each: true, message: 'Obiettivo non valido.' })
  goals!: string[];

  @IsIn(PUBLIC_LEAD_TIMELINES, { message: 'Tempistica non valida.' })
  timeline!: string;

  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Nome non valido.' })
  @MinLength(3, { message: 'Inserisci nome e cognome.' })
  @MaxLength(120, { message: 'Nome troppo lungo.' })
  name!: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString({ message: 'Azienda non valida.' })
  @MaxLength(160, { message: 'Azienda troppo lunga.' })
  company?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString({ message: 'Email non valida.' })
  @MaxLength(254, { message: 'Email troppo lunga.' })
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Email non valida.' })
  email!: string;

  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Telefono non valido.' })
  @MinLength(7, { message: 'Telefono troppo corto.' })
  @MaxLength(30, { message: 'Telefono troppo lungo.' })
  @Matches(/^\+?[0-9][0-9\s()./-]{6,29}$/, { message: 'Telefono non valido.' })
  phone!: string;

  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Provincia non valida.' })
  @MinLength(2, { message: 'Provincia non valida.' })
  @MaxLength(100, { message: 'Provincia troppo lunga.' })
  province!: string;

  @IsBoolean({ message: 'Consenso privacy obbligatorio.' })
  @Transform(({ value }) => value === true || value === 'true')
  privacy_accepted!: boolean;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Richiesta non valida.' })
  website?: string;

  @Transform(({ value }) => trim(value))
  @IsUrl({ require_tld: false }, { message: 'Pagina di origine non valida.' })
  @MaxLength(2048, { message: 'Pagina di origine troppo lunga.' })
  landing_url!: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Referrer non valido.' })
  @MaxLength(2048, { message: 'Referrer troppo lungo.' })
  referrer?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'UTM source troppo lungo.' })
  utm_source?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'UTM medium troppo lungo.' })
  utm_medium?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'UTM campaign troppo lungo.' })
  utm_campaign?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'UTM content troppo lungo.' })
  utm_content?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'UTM term troppo lungo.' })
  utm_term?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: 'Google click ID troppo lungo.' })
  gclid?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: 'Meta click ID troppo lungo.' })
  fbclid?: string;

  @Transform(({ value }) => trimOptional(value))
  @IsOptional()
  @IsString()
  @MaxLength(512, { message: 'TikTok click ID troppo lungo.' })
  ttclid?: string;

  @Transform(({ value }) => Number(value))
  @IsInt({ message: 'Tempo compilazione non valido.' })
  @Min(1, { message: 'Tempo compilazione non valido.' })
  @Max(7200, { message: 'Tempo compilazione non valido.' })
  completion_seconds!: number;
}
