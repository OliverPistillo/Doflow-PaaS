import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContractsService } from './tenant-contracts.service';

@Controller('tenant/contracts')
@UseGuards(JwtAuthGuard)
export class TenantContractsController {
  constructor(private readonly service: TenantContractsService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('templates')
  listTemplates(@Query() query: Record<string, any>) {
    return this.service.listTemplates(query || {});
  }

  @Post('templates')
  createTemplate(@Body() body: Record<string, any>) {
    return this.service.createTemplate(body || {});
  }

  @Post('templates/seed-base')
  seedTemplates() {
    return this.service.seedTemplates();
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplateById(id);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateTemplate(id, body || {});
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.service.deleteTemplate(id);
  }

  @Get()
  listContracts(@Query() query: Record<string, any>) {
    return this.service.listContracts(query || {});
  }

  @Post()
  createContract(@Body() body: Record<string, any>) {
    return this.service.createContract(body || {});
  }

  @Post('from-quote/:quoteId')
  fromQuote(@Param('quoteId') quoteId: string, @Body() body: Record<string, any>) {
    return this.service.createContractFromQuote(quoteId, body || {});
  }

  @Post('from-project/:projectId')
  fromProject(@Param('projectId') projectId: string, @Body() body: Record<string, any>) {
    return this.service.createContractFromProject(projectId, body || {});
  }

  @Get(':id')
  getContract(@Param('id') id: string) {
    return this.service.getContract(id);
  }

  @Patch(':id')
  updateContract(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateContract(id, body || {});
  }

  @Delete(':id')
  deleteContract(@Param('id') id: string) {
    return this.service.deleteContract(id);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.setContractStatus(id, body || {});
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.service.archiveContract(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.service.restoreContract(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions')
  createVersion(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createVersion(id, body || {});
  }

  @Patch(':id/versions/:versionId')
  updateVersion(@Param('id') id: string, @Param('versionId') versionId: string, @Body() body: Record<string, any>) {
    return this.service.updateVersion(id, versionId, body || {});
  }

  @Delete(':id/versions/:versionId')
  deleteVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.deleteVersion(id, versionId);
  }

  @Get(':id/signers')
  listSigners(@Param('id') id: string) {
    return this.service.listSigners(id);
  }

  @Post(':id/signers')
  createSigner(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createSigner(id, body || {});
  }

  @Patch(':id/signers/:signerId')
  updateSigner(@Param('id') id: string, @Param('signerId') signerId: string, @Body() body: Record<string, any>) {
    return this.service.updateSigner(id, signerId, body || {});
  }

  @Delete(':id/signers/:signerId')
  deleteSigner(@Param('id') id: string, @Param('signerId') signerId: string) {
    return this.service.deleteSigner(id, signerId);
  }

  @Get(':id/checklist')
  listChecklist(@Param('id') id: string) {
    return this.service.listChecklist(id);
  }

  @Post(':id/checklist')
  createChecklistItem(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createChecklistItem(id, body || {});
  }

  @Patch(':id/checklist/:itemId')
  updateChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: Record<string, any>) {
    return this.service.updateChecklistItem(id, itemId, body || {});
  }

  @Delete(':id/checklist/:itemId')
  deleteChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.deleteChecklistItem(id, itemId);
  }

  @Patch(':id/checklist/:itemId/complete')
  completeChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setChecklistStatus(id, itemId, 'received');
  }

  @Patch(':id/checklist/:itemId/approve')
  approveChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setChecklistStatus(id, itemId, 'approved');
  }

  @Patch(':id/checklist/:itemId/reject')
  rejectChecklistItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setChecklistStatus(id, itemId, 'rejected');
  }

  @Post(':id/documents/:documentId')
  linkDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.service.linkDocumentToContract(id, documentId);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.service.contractActivity(id);
  }

  @Get(':id/export')
  export(@Param('id') id: string) {
    return this.service.exportContract(id);
  }
}
