import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ActivateAuthorityRenewalDto,
  CreateAuthorityCreditNoteDto,
  CreateAuthorityInvoiceDto,
  CreateAuthorityQuoteDto,
  DocumentVersionDto,
  GenerateAuthorityContractDto,
  InvoiceTransitionDto,
  QuoteTransitionDto,
  SendAuthorityContractDto,
  SignAuthorityContractDto,
  UpdateAuthorityContractDto,
  UpdateAuthorityQuoteDto,
  UpdateAuthorityRenewalDto,
} from './tenant-doflow-document-revenue.dto';
import { TenantDoflowDocumentRevenueService } from './tenant-doflow-document-revenue.service';

@Controller('tenant/doflow/document-revenue')
@UseGuards(JwtAuthGuard)
export class TenantDoflowDocumentRevenueController {
  constructor(private readonly service: TenantDoflowDocumentRevenueService) {}

  private key(headers: Record<string, string | string[] | undefined>) {
    return headers['idempotency-key'];
  }

  @Get('state') state() { return this.service.state(); }
  @Get('summary') summary() { return this.service.summary(); }

  @Post('quotes')
  createQuote(@Body() body: CreateAuthorityQuoteDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createQuote(body || {}, this.key(headers));
  }

  @Patch('quotes/:id')
  updateQuote(@Param('id') id: string, @Body() body: UpdateAuthorityQuoteDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateQuote(id, body || {}, this.key(headers));
  }

  @Post('quotes/:id/transition')
  transitionQuote(@Param('id') id: string, @Body() body: QuoteTransitionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.transitionQuote(id, body.status, body, this.key(headers));
  }

  @Post('quotes/:id/versions')
  quoteVersion(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createQuoteVersion(id, this.key(headers));
  }

  @Delete('quotes/:id')
  archiveQuote(@Param('id') id: string, @Body() body: DocumentVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveQuote(id, body || {}, this.key(headers));
  }

  @Post('contracts')
  generateContract(@Body() body: GenerateAuthorityContractDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.generateContract(body || {}, this.key(headers));
  }

  @Patch('contracts/:id')
  updateContract(@Param('id') id: string, @Body() body: UpdateAuthorityContractDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateContract(id, body || {}, this.key(headers));
  }

  @Post('contracts/:id/send')
  sendContract(@Param('id') id: string, @Body() body: SendAuthorityContractDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.sendContract(id, body || {}, this.key(headers));
  }

  @Post('contracts/:id/signatures')
  signContract(@Param('id') id: string, @Body() body: SignAuthorityContractDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.signContract(id, body || {}, this.key(headers));
  }

  @Post('contracts/:id/versions')
  contractVersion(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createContractVersion(id, this.key(headers));
  }

  @Delete('contracts/:id')
  archiveContract(@Param('id') id: string, @Body() body: DocumentVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveContract(id, body || {}, this.key(headers));
  }

  @Post('invoices')
  createInvoice(@Body() body: CreateAuthorityInvoiceDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createInvoiceFromOrder(body || {}, this.key(headers));
  }

  @Post('invoices/:id/transition')
  transitionInvoice(@Param('id') id: string, @Body() body: InvoiceTransitionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.transitionInvoice(id, body.status, body, this.key(headers));
  }

  @Post('invoices/:id/credit-notes')
  creditNote(@Param('id') id: string, @Body() body: CreateAuthorityCreditNoteDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createCreditNote(id, body || {}, this.key(headers));
  }

  @Delete('invoices/:id')
  archiveInvoice(@Param('id') id: string, @Body() body: DocumentVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveInvoice(id, body || {}, this.key(headers));
  }

  @Post('renewals')
  activateRenewal(@Body() body: ActivateAuthorityRenewalDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.activateRenewal(body || {}, this.key(headers));
  }

  @Patch('renewals/:id')
  updateRenewal(@Param('id') id: string, @Body() body: UpdateAuthorityRenewalDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateRenewal(id, body || {}, this.key(headers));
  }

  @Post('renewals/:id/reminders')
  remindRenewal(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.remindRenewal(id, this.key(headers));
  }

  @Post('renewals/:id/order')
  renewalOrder(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.generateRenewalOrder(id, this.key(headers));
  }

  @Delete('renewals/:id')
  archiveRenewal(@Param('id') id: string, @Body() body: DocumentVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveRenewal(id, body || {}, this.key(headers));
  }
}
