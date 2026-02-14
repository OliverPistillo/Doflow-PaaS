import { IsArray, IsInt, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DashboardWidgetDto {
  @IsString()
  i!: string; // <--- AGGIUNTO '!'

  @IsString()
  moduleKey!: string; // <--- AGGIUNTO '!'

  @IsInt()
  x!: number; // <--- AGGIUNTO '!'

  @IsInt()
  y!: number; // <--- AGGIUNTO '!'

  @IsInt()
  w!: number; // <--- AGGIUNTO '!'

  @IsInt()
  h!: number; // <--- AGGIUNTO '!'

  @IsOptional()
  settings?: any; // Questo è opzionale (?) quindi non serve '!'
}

export class SaveDashboardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets!: DashboardWidgetDto[]; // <--- AGGIUNTO '!'
}