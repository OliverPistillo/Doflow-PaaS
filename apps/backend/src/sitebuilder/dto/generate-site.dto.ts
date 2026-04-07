// apps/backend/src/sitebuilder/dto/generate-site.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateSiteDto {
  @IsString()
  @IsNotEmpty()
  themeId!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  problemSolved!: string;

  @IsString()
  @IsNotEmpty()
  services!: string;
}