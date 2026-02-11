import { IsString, IsEmail, IsNotEmpty, Matches, IsOptional, IsEnum } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  // Accetta lettere minuscole, numeri e trattini
  @Matches(/^[a-z0-9-]+$/, { message: 'Lo slug può contenere solo lettere minuscole, numeri e trattini.' })
  slug!: string;

  @IsEmail({}, { message: 'Inserisci una email valida' })
  @IsNotEmpty()
  email!: string;

  // Rendi opzionale o stringa semplice per evitare blocchi se il frontend manda qualcosa di diverso
  @IsString()
  @IsOptional()
  plan?: string;
}