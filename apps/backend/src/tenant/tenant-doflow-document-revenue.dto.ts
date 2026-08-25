import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmpty,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DocumentVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;
}

export class QuoteAuthorityLineDto {
  @IsUUID()
  serviceId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsEmpty({ message: 'Il prezzo viene risolto dal catalogo lato server' })
  unitPrice?: never;
}

export class CreateAuthorityQuoteDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsOptional() @IsUUID() opportunityId?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsDateString() validUntil!: string;
  @IsOptional() @IsString() @MaxLength(10_000) conditions?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteAuthorityLineDto)
  lines!: QuoteAuthorityLineDto[];

  @IsOptional() @IsEmpty() subtotal?: never;
  @IsOptional() @IsEmpty() vatAmount?: never;
  @IsOptional() @IsEmpty() total?: never;
  @IsOptional() @IsEmpty() code?: never;
  @IsOptional() @IsEmpty() actor?: never;
}

export class UpdateAuthorityQuoteDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(10_000) conditions?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsOptional()
  @IsIn(['Bozza', 'Inviato', 'Visualizzato', 'Accettato', 'Rifiutato', 'Scaduto'])
  status?: string;
  @IsOptional() @IsEmpty() subtotal?: never;
  @IsOptional() @IsEmpty() vatAmount?: never;
  @IsOptional() @IsEmpty() total?: never;
}

export class QuoteTransitionDto {
  @IsIn(['Inviato', 'Visualizzato', 'Accettato', 'Rifiutato', 'Scaduto'])
  status!: string;
}

export class GenerateAuthorityContractDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() quoteId?: string;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(300) signatoryName?: string;
  @IsOptional() @IsDateString() signatureDueAt?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
}

export class UpdateAuthorityContractDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
  @IsOptional() @IsString() @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(300) signatoryName?: string;
  @IsOptional() @IsDateString() signatureDueAt?: string;
  @IsOptional() @IsString() @MaxLength(500) documentName?: string;
  @IsOptional() @IsString() @MaxLength(500) documentReference?: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsOptional() @IsIn(['internal', 'client']) visibility?: string;
}

export class SendAuthorityContractDto {
  @IsIn(['Email', 'WhatsApp', 'Consegna manuale', 'Altro']) method!: string;
  @IsIn(['invio', 'reinvio', 'promemoria']) kind!: string;
  @IsOptional() @IsString() @MaxLength(2_000) note?: string;
}

export class SignAuthorityContractDto {
  @IsOptional() @IsUUID() signerId?: string;
  @IsOptional() @IsString() @MaxLength(300) signatoryName?: string;
  @IsOptional() @IsIn(['internal_record']) method?: string;
  @IsOptional() @IsString() @MaxLength(500) externalReference?: string;
  @IsOptional() @IsEmpty() signedAt?: never;
  @IsOptional() @IsEmpty() actor?: never;
}

export class CreateAuthorityInvoiceDto {
  @IsUUID() orderId!: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @IsString() @MaxLength(10_000) notes?: string;
  @IsOptional() @IsEmpty() code?: never;
  @IsOptional() @IsEmpty() lines?: never;
  @IsOptional() @IsEmpty() total?: never;
  @IsOptional() @IsEmpty() vatAmount?: never;
}

export class InvoiceTransitionDto {
  @IsIn(['Bozza', 'Proforma', 'Emessa esternamente', 'Annullata'])
  status!: string;
}

export class CreateAuthorityCreditNoteDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000)
  reason!: string;

  @IsOptional() @IsEmpty() total?: never;
  @IsOptional() @IsEmpty() tax?: never;
  @IsOptional() @IsEmpty() currency?: never;
}

export class ActivateAuthorityRenewalDto {
  @IsUUID() orderId!: string;
  @IsUUID() itemId!: string;
}

export class UpdateAuthorityRenewalDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) version?: number;
  @IsOptional() @IsDateString() nextDueAt?: string;
  @IsOptional() @IsIn(['manual', 'automatic']) mode?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional()
  @IsIn([
    'Attivo', 'In scadenza', 'Da rinnovare', 'Promemoria inviato',
    'Scaduto', 'Sospeso', 'Annullato',
  ])
  status?: string;
  @IsOptional() @IsEmpty() priceSnapshot?: never;
}
