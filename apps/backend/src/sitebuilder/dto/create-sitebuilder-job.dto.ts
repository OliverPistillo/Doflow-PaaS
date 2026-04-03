// apps/backend/src/sitebuilder/dto/create-sitebuilder-job.dto.ts

import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSitebuilderJobDto {
  // ──────────────────────────────────────────────
  //  Dati tenant/progetto
  // ──────────────────────────────────────────────

  @ApiProperty({ example: 'acme-corp', description: 'ID del tenant proprietario del sito' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  /**
   * Dominio target, es. "demo.acme.it".
   * Viene usato come nome univoco del docker-compose stack.
   * Sono ammessi solo caratteri DNS-safe per prevenire path-traversal.
   */
  @ApiProperty({ example: 'demo.acme.it' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?$/, {
    message:
      'siteDomain deve contenere solo lettere minuscole, numeri, trattini e punti (DNS-safe)',
  })
  siteDomain!: string;

  // ──────────────────────────────────────────────
  //  Configurazione WordPress
  // ──────────────────────────────────────────────

  @ApiProperty({ example: 'Acme Corp — Soluzioni Innovative' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  siteTitle!: string;

  @ApiProperty({ example: 'admin@acme.it' })
  @IsEmail()
  adminEmail!: string;

  /**
   * Password dell'utente admin WP.
   * Viene passata tramite variabile d'ambiente al container, mai in chiaro nei log.
   */
  @ApiProperty({ example: 'Sup3rS3cur3!' })
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  adminPassword!: string;

  // ──────────────────────────────────────────────
  //  Configurazione contenuti LLM
  // ──────────────────────────────────────────────

  /**
   * Argomenti da passare ad Anthropic per la generazione dei blocchi Gutenberg.
   * Es. ["Chi siamo", "Servizi", "Contatti"]
   */
  @ApiProperty({
    type: [String],
    example: ['Chi siamo', 'Servizi', 'Contatti', 'Blog'],
    description: 'Sezioni/pagine per le quali generare i blocchi Gutenberg',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(80, { each: true })
  contentTopics!: string[];

  /**
   * Slug WP.org dei plugin da installare dopo il tema Blocksy.
   * Es. ["yoast-seo", "contact-form-7", "woocommerce"]
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['yoast-seo', 'contact-form-7'],
    description: 'Slug WP.org dei plugin aggiuntivi da installare (max 15)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @Matches(/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/, {
    each: true,
    message: 'Ogni plugin slug deve essere DNS-safe (es. yoast-seo)',
  })
  plugins?: string[];

  @ApiPropertyOptional({ example: 'it' })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr', 'de', 'es'], {
    message: 'locale deve essere uno tra: it, en, fr, de, es',
  })
  locale?: string;
}