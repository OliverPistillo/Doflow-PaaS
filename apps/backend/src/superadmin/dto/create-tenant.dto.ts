import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString() // Cambiato temporaneamente da @IsEmail a @IsString per debug
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsOptional()
  plan?: string;
}