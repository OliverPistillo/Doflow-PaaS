// apps/backend/src/sitebuilder/dto/generate-site.dto.ts
import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';

export class GenerateSiteDto {
  @IsString()
  @IsNotEmpty()
  themeId!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsArray()
  @IsString({ each: true })
  pages!: string[];

  @IsArray()
  @IsString({ each: true })
  goals!: string[];

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  usp?: string;

  @IsString()
  @IsNotEmpty()
  toneOfVoice!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @IsString()
  @IsOptional()
  additionalInfo?: string;
}