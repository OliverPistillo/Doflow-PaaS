// apps/backend/src/auth/dto/signup-tenant.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, Matches, ValidateIf } from 'class-validator';

export class SignupTenantDto {
  // Account fields
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ValidateIf((o: SignupTenantDto) => !o.googleSignupToken)
  @IsString()
  @MinLength(8, { message: 'La password deve avere almeno 8 caratteri' })
  password?: string;

  /**
   * Token firmato dal backend dopo callback Google.
   * Permette la creazione tenant senza password, senza fidarsi dei query param del frontend.
   */
  @IsString()
  @IsOptional()
  googleSignupToken?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  // Company fields
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Lo slug può contenere solo lettere minuscole, numeri e trattini',
  })
  @MinLength(3, { message: 'Lo slug deve avere almeno 3 caratteri' })
  slug!: string;

  @IsString()
  @IsOptional()
  sector?: string; // 'crm-generic' | 'hospitality' | 'beauty' | 'manufacturing' | etc.

  @IsString()
  @IsOptional()
  planTier?: 'STARTER' | 'PRO' | 'ENTERPRISE';

  @IsString()
  @IsOptional()
  acceptTerms?: string; // 'true'
}

export class CheckSlugDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
