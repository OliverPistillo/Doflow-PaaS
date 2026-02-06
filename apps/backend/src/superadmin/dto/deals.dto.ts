import { IsOptional, IsString, IsNumber, IsArray, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Per i filtri nella lista (Search bar & Dropdowns)
export class GetDealsQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stages?: string[]; // Es: ['Lead qualificato', 'Preventivo inviato']

  @IsOptional()
  @IsString()
  month?: string; // Formato 'YYYY-MM' per filtrare per data chiusura

  @IsOptional()
  @IsString()
  clientName?: string; // Ricerca parziale nome cliente

  @IsOptional()
  @IsString()
  search?: string; // Ricerca libera (nome offerta o cliente)
  
  @IsOptional()
  @IsString()
  sortBy?: string; // 'value', 'expectedCloseDate', 'createdAt'
  
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

// Per l'aggiornamento (Edit Form)
export class UpdateDealDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  winProbability?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string; // ISO Date
}