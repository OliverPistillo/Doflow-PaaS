import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { EventType } from '../entities/calendar-event.entity';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsDateString()
  date!: string;

  @IsEnum(EventType)
  type!: EventType;

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
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsString()
  description?: string;
}