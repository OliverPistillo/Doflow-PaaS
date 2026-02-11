import { IsString, IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  // Regex: solo lettere minuscole, numeri e trattini (no spazi o caratteri speciali per lo schema DB)
  @Matches(/^[a-z0-9-]+$/, { message: 'Lo slug può contenere solo lettere minuscole, numeri e trattini.' })
  slug!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  plan!: string;
}