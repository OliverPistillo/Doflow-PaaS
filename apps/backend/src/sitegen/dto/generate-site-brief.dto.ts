import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SiteKind } from '../contracts/site-manifest';

const SITE_KIND_VALUES: SiteKind[] = ['agency', 'startup', 'studio', 'local-business', 'ecommerce'];

export class GenerateSiteBriefDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsIn(SITE_KIND_VALUES)
  siteKind!: SiteKind;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  goals?: string[];

  @IsString()
  @IsOptional()
  usp?: string;

  @IsString()
  @IsOptional()
  toneOfVoice?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pages?: string[];

  @IsString()
  @IsOptional()
  additionalInfo?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsString()
  @IsOptional()
  language?: string;
}
