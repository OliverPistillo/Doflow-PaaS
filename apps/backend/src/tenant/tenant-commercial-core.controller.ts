import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ActivityReorderDto,
  ArchiveCommercialDto,
  CommercialAttributionDto,
  CommercialCommunicationDto,
  CreateCommercialLeadDto,
  ConvertOpportunityDto,
  DuplicateDecisionDto,
  MergeDuplicateDto,
  PipelineReorderDto,
  PipelineTransitionDto,
  VersionedCommercialDto,
  UpdateCommercialCommunicationDto,
} from './dto/commercial-core.dto';
import { TenantCommercialCoreService } from './tenant-commercial-core.service';

@Controller('tenant/commercial')
@UseGuards(JwtAuthGuard)
export class TenantCommercialCoreController {
  constructor(private readonly service: TenantCommercialCoreService) {}

  @Patch('pipeline/:id/transition')
  transition(
    @Param('id') id: string,
    @Body() body: PipelineTransitionDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.transitionOpportunity(id, { ...body }, key);
  }

  @Post('leads')
  createLead(
    @Body() body: CreateCommercialLeadDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.createLead({ ...body }, key);
  }

  @Patch('pipeline/reorder')
  reorder(
    @Body() body: PipelineReorderDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.reorderPipeline({ ...body }, key);
  }

  @Patch('activities/reorder')
  reorderActivities(
    @Body() body: ActivityReorderDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.reorderActivities({ ...body }, key);
  }

  @Post('archive/:resource/:id')
  archive(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: ArchiveCommercialDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.archive(resource, id, { ...body }, key);
  }

  @Post('archive/:resource/:id/restore')
  restore(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() body: VersionedCommercialDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.restore(resource, id, { ...body }, key);
  }

  @Post('leads/:id/convert')
  convert(
    @Param('id') id: string,
    @Body() body: ConvertOpportunityDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.convertOpportunity(id, { ...body }, key);
  }

  @Patch('leads/:id/attribution')
  attribution(
    @Param('id') id: string,
    @Body() body: CommercialAttributionDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.updateAttribution(id, { ...body }, key);
  }

  @Get('duplicates')
  duplicates() {
    return this.service.duplicateGroups();
  }

  @Post('duplicates/decision')
  decide(
    @Body() body: DuplicateDecisionDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.decideDuplicate({ ...body }, key);
  }

  @Post('duplicates/merge')
  merge(
    @Body() body: MergeDuplicateDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.mergeDuplicates({ ...body }, key);
  }

  @Get('customers/:id')
  customer(@Param('id') id: string) {
    return this.service.customerAggregate(id);
  }

  @Get('communications')
  communications() {
    return this.service.listCommunications();
  }

  @Post('customers/:id/contacts/:contactId/primary')
  primaryContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() body: VersionedCommercialDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.setPrimaryContact(id, contactId, { ...body }, key);
  }

  @Post('customers/:id/communications')
  communication(
    @Param('id') id: string,
    @Body() body: CommercialCommunicationDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.createCommunication(id, { ...body }, key);
  }

  @Patch('customers/:id/communications/:communicationId')
  updateCommunication(
    @Param('id') id: string,
    @Param('communicationId') communicationId: string,
    @Body() body: UpdateCommercialCommunicationDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.updateCommunication(id, communicationId, { ...body }, key);
  }
}
