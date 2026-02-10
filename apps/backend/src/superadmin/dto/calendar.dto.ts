import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsDateString()
  date!: string;

  @IsString()
  type!: string; // Accetta stringa semplice

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;
}