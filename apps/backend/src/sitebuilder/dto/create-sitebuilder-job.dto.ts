// apps/backend/src/sitebuilder/dto/create-sitebuilder-job.dto.ts
import {
  IsString, IsEmail, IsNotEmpty, IsArray,
  ArrayMinSize, ArrayMaxSize, IsOptional,
  IsIn, MaxLength, MinLength, Matches, IsObject,
  IsEnum, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BreakpointKey, DesignTokens } from '../sitebuilder.types';

// ════════════════════════════════════════════════════════════════
//  DESIGN TOKENS DTO
// ════════════════════════════════════════════════════════════════

export class DesignTokensDto {
  @IsOptional() @IsString() colorPrimary?: string;
  @IsOptional() @IsString() colorSecondary?: string;
  @IsOptional() @IsString() colorAccent?: string;
  @IsOptional() @IsString() colorBackground?: string;
  @IsOptional() @IsString() colorSurface?: string;
  @IsOptional() @IsString() colorText?: string;
  @IsOptional() @IsString() colorTextMuted?: string;
  
  @IsOptional() @IsString() fontHeading?: string;
  @IsOptional() @IsString() fontBody?: string;
  @IsOptional() @IsString() fontSizeBase?: string;
  @IsOptional() @IsIn(['minor-second', 'major-second', 'minor-third', 'major-third', 'perfect-fourth', 'augmented-fourth', 'perfect-fifth', 'golden-ratio'])
  fontSizeScale?: DesignTokens['fontSizeScale'];
  
  @IsOptional() @IsString() spacingUnit?: string;
  @IsOptional() @IsIn(['none', 'small', 'medium', 'large', 'huge'])
  spacingScale?: DesignTokens['spacingScale'];
  
  @IsOptional() @IsString() borderRadiusBase?: string;
  @IsOptional() @IsIn(['none', 'small', 'medium', 'large', 'full'])
  borderRadiusScale?: DesignTokens['borderRadiusScale'];
  
  @IsOptional() @IsIn(['none', 'sm', 'md', 'lg', 'xl', '2xl'])
  boxShadowBase?: DesignTokens['boxShadowBase'];
  
  @IsOptional() @IsString() transitionBase?: string;
}

// ════════════════════════════════════════════════════════════════
//  BREAKPOINT CONFIG DTO
// ════════════════════════════════════════════════════════════════

export class BreakpointDto {
  @IsOptional() @IsNumber() minWidth?: number;
  @IsOptional() @IsNumber() maxWidth?: number;
  @IsOptional() @IsString() label?: string;
}

export class BreakpointsDto {
  @IsOptional() @ValidateNested() @Type(() => BreakpointDto)
  desktop?: BreakpointDto;
  @IsOptional() @ValidateNested() @Type(() => BreakpointDto)
  tablet?: BreakpointDto;
  @IsOptional() @ValidateNested() @Type(() => BreakpointDto)
  mobile?: BreakpointDto;
}

// ════════════════════════════════════════════════════════════════
//  MAIN DTO
// ════════════════════════════════════════════════════════════════

export class CreateSitebuilderJobDto {
  // ... existing fields (tenantId, siteDomain, etc.) ...
  
  @ApiProperty({ example: 'tenant-001' })
  @IsString() @IsNotEmpty()
  tenantId!: string;
  
  @ApiProperty({ example: 'shop.acme.it' })
  @IsString() @IsNotEmpty() @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9-.]*[a-z0-9])?$/, {
    message: 'siteDomain deve contenere solo caratteri DNS-safe',
  })
  siteDomain!: string;
  
  // ... altri campi esistenti ...

  // ════════════════════════════════════════════════════════════
  //  NEW: DESIGN SYSTEM FIELDS
  // ════════════════════════════════════════════════════════════
  
  @ApiPropertyOptional({ type: DesignTokensDto })
  @IsOptional() @ValidateNested() @Type(() => DesignTokensDto)
  designTokens?: DesignTokensDto;
  
  @ApiPropertyOptional({ type: BreakpointsDto })
  @IsOptional() @ValidateNested() @Type(() => BreakpointsDto)
  breakpoints?: BreakpointsDto;
  
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { '--custom-color': '#ff0000' }
  })
  @IsOptional() @IsObject()
  cssVariables?: Record<string, string>;
  
  @ApiPropertyOptional({ example: '/* Custom CSS */ .hero { animation: fadeIn 0.5s; }' })
  @IsOptional() @IsString() @MaxLength(50000)
  customCSS?: string;
  
  // Componenti custom da includere
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional() @IsArray()
  components?: Array<{
    id: string;
    name: string;
    brickType: string;
    defaultProps: Record<string, unknown>;
  }>;
  
  // ... xmlBlocks e altri campi esistenti ...
}