import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, IsArray, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DealStage } from '../enums/deal-stage.enum';

export class GetDealsQueryDto {
  // Filtro Multiplo per Fase (es. ?stages=Lead qualificato&stages=Negoziazione)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // Trasforma stringa singola in array se necessario
    if (typeof value === 'string') return [value];
    return value;
  })
  stages?: string[];

  // Filtro Mese Chiusura (1-12)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  expectedCloseMonth?: number;

  // Filtro Anno Chiusura (es. 2024)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  expectedCloseYear?: number;

  // Filtro Cliente
  @IsOptional()
  @IsString()
  clientName?: string;

  // Ricerca Globale (Titolo offerta)
  @IsOptional()
  @IsString()
  search?: string;

  // Ordinamento
  @IsOptional()
  @IsString()
  sortBy?: string; // 'value', 'date', 'created_at'

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class UpdateDealDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(DealStage)
  stage?: DealStage;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number; // Arriverà in Euro dal FE, il service lo convertirà in Cents se necessario, o viceversa.
                  // *Convenzione*: I DTO di input meglio che ricevano il valore "umano" (float) 
                  // e il service lo trasformi in centesimi, oppure il FE manda centesimi.
                  // Decidiamo qui: IL FE MANDA EURO (FLOAT), IL BE CONVERTE.

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  winProbability?: number; // 0-100 float

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string; // ISO Date YYYY-MM-DD

  @IsOptional()
  @IsString()
  clientName?: string;
}