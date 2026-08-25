import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEmpty, IsIn, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

const SERVICE_CATEGORIES = [
  'Siti web', 'E-commerce', 'Software', 'Gestionale SaaS',
  'Marketing', 'Assistenza', 'Altro',
] as const;
const SALE_STATUSES = ['Bozza', 'In trattativa', 'Vinta', 'Persa', 'Annullata'] as const;
const SALE_ORIGINS = [
  'Commerciale', 'Acquisto diretto DoFlow', 'Demo commerciale',
  'Referral', 'Campagna', 'Altro',
] as const;

export class CommerceVersionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class ServiceCategoryCreateDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ServiceCategoryUpdateDto extends CommerceVersionDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ServicePromotionDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsIn(['percentage', 'fixed']) kind!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value!: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) minimumQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) maximumQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maximumDiscount?: number;
  @IsOptional() @IsBoolean() combinable?: boolean;
}

export class ServiceExtraDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ServicePlanDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2_000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) oneTimePrice!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) recurringPrice!: number;
  @IsIn(['monthly', 'annual']) recurrence!: string;
  @IsIn(['required', 'optional']) renewal!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) included?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ServiceRenewalDto {
  @IsBoolean() enabled!: boolean;
  @IsIn(['monthly', 'quarterly', 'annual']) interval!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
}

export class ServiceProjectTemplateDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) projectType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) phases?: string[];
}

export class CreateCommerceServiceDto {
  @IsString() @IsNotEmpty() @MaxLength(300) name!: string;
  @IsIn(SERVICE_CATEGORIES) category!: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() @MaxLength(50) unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsIn(['one_time', 'recurring', 'mixed']) billingType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
  @IsOptional() @IsIn(['available', 'limited', 'unavailable']) availability?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deposit?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) balance?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) installments?: number;
  @IsOptional() @ValidateNested() @Type(() => ServiceRenewalDto) renewal?: ServiceRenewalDto;
  @IsOptional() @ValidateNested() @Type(() => ServiceProjectTemplateDto) projectTemplate?: ServiceProjectTemplateDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServicePromotionDto) promotions?: ServicePromotionDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServiceExtraDto) extras?: ServiceExtraDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServicePlanDto) billingPlans?: ServicePlanDto[];
}

export class UpdateCommerceServiceDto extends PartialType(CreateCommerceServiceDto) {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class CreateCommerceSaleDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsUUID() serviceId!: string;
  @IsOptional() @IsUUID() salespersonId?: string;
  @IsIn(SALE_ORIGINS) origin!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsDateString() date!: string;
  @IsIn(SALE_STATUSES) status!: string;
  @IsString() @IsNotEmpty() @MaxLength(300) dealId!: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
}

export class UpdateCommerceSaleDto extends PartialType(CreateCommerceSaleDto) {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class CommerceOrderItemDto {
  @IsUUID() serviceId!: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsUUID() promotionId?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) extraIds?: string[];
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @IsDateString() nextDueAt?: string;
}

export class CreateCommerceOrderDto {
  @IsUUID() customerId!: string;
  @IsOptional() @IsUUID() saleId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsOptional() @IsString() @MaxLength(300) dealId?: string;
  @IsOptional() @IsUUID() salespersonId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CommerceOrderItemDto) items!: CommerceOrderItemDto[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) deposit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) installments?: number;
  @IsOptional() @IsIn(['Bozza', 'Confermato', 'Acconto richiesto']) administrativeStatus?: string;
  @IsDateString() orderDate!: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsEmpty({ message: 'code è assegnato dal server' }) code?: never;
  @IsEmpty({ message: 'currency è derivata dagli snapshot catalogo' }) currency?: never;
  @IsEmpty({ message: 'subtotal è calcolato dal server' }) subtotal?: never;
  @IsEmpty({ message: 'taxTotal è calcolato dal server' }) taxTotal?: never;
  @IsEmpty({ message: 'total è calcolato dal server' }) total?: never;
  @IsEmpty({ message: 'balance è calcolato dal server' }) balance?: never;
  @IsEmpty({ message: 'grossCollected è calcolato dal server' }) grossCollected?: never;
  @IsEmpty({ message: 'refundedTotal è calcolato dal server' }) refundedTotal?: never;
  @IsEmpty({ message: 'netCollected è calcolato dal server' }) netCollected?: never;
  @IsEmpty({ message: 'residual è calcolato dal server' }) residual?: never;
  @IsEmpty({ message: 'paymentStatus è derivato dal server' }) paymentStatus?: never;
  @IsEmpty({ message: 'projectId è assegnato dalla generazione server' }) projectId?: never;
}

export class UpdateCommerceOrderDto extends CommerceVersionDto {
  @IsOptional() @IsIn(['Bozza', 'Confermato', 'Acconto richiesto', 'Annullato']) administrativeStatus?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsOptional() @IsString() @MaxLength(2_000) cancellationReason?: string;
}

export class CreateCommercePaymentDto {
  @IsUUID() orderId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsString() @MaxLength(50) method?: string;
  @IsString() @IsNotEmpty() @MaxLength(300) reference!: string;
  @IsOptional() @IsString() @MaxLength(50) status?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsEmpty({ message: 'currency è derivata dall’ordine' }) currency?: never;
}

export class CreateCommerceRefundDto {
  @IsUUID() originalPaymentId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsString() @MaxLength(50) method?: string;
  @IsString() @IsNotEmpty() @MaxLength(300) reference!: string;
  @IsOptional() @IsString() @MaxLength(50) status?: string;
  @IsString() @IsNotEmpty() @MaxLength(2_000) refundReason!: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsEmpty({ message: 'currency è derivata dal pagamento originale' }) currency?: never;
}

export class UpdateCommercePaymentDto extends CommerceVersionDto {
  @IsOptional() @IsString() @MaxLength(50) status?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsString() @MaxLength(50) method?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
}
