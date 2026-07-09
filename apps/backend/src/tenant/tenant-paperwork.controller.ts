import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantContractsService } from './tenant-contracts.service';

@Controller('tenant/paperwork')
@UseGuards(JwtAuthGuard)
export class TenantPaperworkController {
  constructor(private readonly service: TenantContractsService) {}

  @Get('summary')
  summary() {
    return this.service.paperworkSummary();
  }

  @Get('dossiers')
  listDossiers(@Query() query: Record<string, any>) {
    return this.service.listDossiers(query || {});
  }

  @Post('dossiers')
  createDossier(@Body() body: Record<string, any>) {
    return this.service.createDossier(body || {});
  }

  @Post('from-contract/:contractId')
  fromContract(@Param('contractId') contractId: string) {
    return this.service.createPaperworkFromContract(contractId);
  }

  @Post('from-project/:projectId')
  fromProject(@Param('projectId') projectId: string) {
    return this.service.createPaperworkFromProject(projectId);
  }

  @Post('from-quote/:quoteId')
  fromQuote(@Param('quoteId') quoteId: string) {
    return this.service.createPaperworkFromQuote(quoteId);
  }

  @Get('dossiers/:id')
  getDossier(@Param('id') id: string) {
    return this.service.getDossier(id);
  }

  @Patch('dossiers/:id')
  updateDossier(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateDossier(id, body || {});
  }

  @Delete('dossiers/:id')
  deleteDossier(@Param('id') id: string) {
    return this.service.deleteDossier(id);
  }

  @Patch('dossiers/:id/status')
  setStatus(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.setDossierStatus(id, body || {});
  }

  @Patch('dossiers/:id/archive')
  archive(@Param('id') id: string) {
    return this.service.archiveDossier(id);
  }

  @Patch('dossiers/:id/restore')
  restore(@Param('id') id: string) {
    return this.service.restoreDossier(id);
  }

  @Get('dossiers/:id/items')
  listItems(@Param('id') id: string) {
    return this.service.listPaperworkItems(id);
  }

  @Post('dossiers/:id/items')
  createItem(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createPaperworkItem(id, body || {});
  }

  @Patch('dossiers/:id/items/:itemId')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: Record<string, any>) {
    return this.service.updatePaperworkItem(id, itemId, body || {});
  }

  @Delete('dossiers/:id/items/:itemId')
  deleteItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.deletePaperworkItem(id, itemId);
  }

  @Patch('dossiers/:id/items/:itemId/complete')
  completeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setPaperworkItemStatus(id, itemId, 'received');
  }

  @Patch('dossiers/:id/items/:itemId/approve')
  approveItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setPaperworkItemStatus(id, itemId, 'approved');
  }

  @Patch('dossiers/:id/items/:itemId/reject')
  rejectItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.setPaperworkItemStatus(id, itemId, 'rejected');
  }

  @Post('dossiers/:id/documents/:documentId')
  linkDossierDocument(@Param('id') id: string, @Param('documentId') documentId: string) {
    return this.service.linkDocumentToDossier(id, documentId);
  }

  @Post('dossiers/:id/items/:itemId/documents/:documentId')
  linkItemDocument(@Param('id') id: string, @Param('itemId') itemId: string, @Param('documentId') documentId: string) {
    return this.service.linkDocumentToDossier(id, documentId, itemId);
  }

  @Get('dossiers/:id/activity')
  activity(@Param('id') id: string) {
    return this.service.paperworkActivity(id);
  }

  @Get('dossiers/:id/export')
  export(@Param('id') id: string) {
    return this.service.exportDossier(id);
  }
}
