import { IsString, IsOptional } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  name!: string;

  @IsString()
  serviceName!: string;

  @IsString()
  category!: string;

  @IsOptional()
  dueDate?: string; // Accetta qualsiasi stringa o null

  @IsOptional()
  @IsString()
  priority?: string; // Accetta "Alta", "Media", ecc. come testo semplice

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}