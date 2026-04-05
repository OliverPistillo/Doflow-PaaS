// apps/backend/src/sitebuilder/dto/create-sitebuilder-job.dto.ts

import {
  IsString, IsEmail, IsNotEmpty, IsArray,
  ArrayMinSize, ArrayMaxSize, IsOptional,
  IsIn, MaxLength, MinLength, Matches, IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DesignSchemeDto {
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() secondaryColor?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() backgroundColor?: string;
  @IsOptional() @IsString() textColor?: string;
  @IsOptional() @IsString() headingFont?: string;
  @IsOptional() @IsString() bodyFont?: string;
}

export class CreateSitebuilderJobDto {
  @ApiProperty({ example: 'tenant-001' })
  @IsString() @IsNotEmpty()
  tenantId!: string;

  @ApiProperty({ example: 'shop.acme.it' })
  @IsString() @IsNotEmpty() @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/, {
    message: 'siteDomain deve contenere solo caratteri DNS-safe',
  })
  siteDomain!: string;

  @ApiProperty({ example: 'Acme Shop' })
  @IsString() @IsNotEmpty() @MinLength(2) @MaxLength(100)
  siteTitle!: string;

  @ApiProperty({ example: 'admin@acme.it' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'Ristorante' })
  @IsString() @IsNotEmpty() @MaxLength(60)
  businessType!: string;

  @ApiPropertyOptional({
    example: 'Ristorante italiano nel centro di Milano, specializzato in cucina tradizionale...',
  })
  @IsOptional() @IsString() @MaxLength(3000)
  businessDescription?: string;

  @ApiProperty({ example: 'restaurant' })
  @IsString() @IsNotEmpty()
  starterSite!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  designScheme?: DesignSchemeDto;

  @ApiProperty({ type: [String], example: ['Home', 'Chi Siamo', 'Menu', 'Contatti'] })
  @IsOptional()
  @IsArray() @ArrayMaxSize(10)
  @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(80, { each: true })
  contentTopics?: string[];

  @ApiPropertyOptional({ example: 'it' })
  @IsOptional() @IsString()
  @IsIn(['it', 'en', 'fr', 'de', 'es'])
  locale?: string;

  /**
   * Blocchi JSON pre-parsati da un XML sitebuilder_master_doc.
   * Se presenti, il processor salta la generazione LLM e usa direttamente
   * questi dati per costruire il WXR WordPress.
   */
  @ApiPropertyOptional({ description: 'Blocchi JSON prodotti dal parser XML (/parse-xml)' })
  @IsOptional()
  xmlBlocks?: { strategy?: Record<string, string>; pages: unknown[] };
}