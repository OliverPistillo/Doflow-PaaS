import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { TaskPriority, TaskStatus } from '../entities/delivery-task.entity';

export class CreateTaskDto {
  @IsString()
  name!: string;

  @IsString()
  serviceName!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string; // Opzionale col ? va bene, ma se serve forzare ! usa quello

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  // Altri campi opzionali se necessario aggiornarli
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}