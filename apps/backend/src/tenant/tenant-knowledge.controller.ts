import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantKnowledgeService } from './tenant-knowledge.service';

@Controller('tenant/knowledge')
@UseGuards(JwtAuthGuard)
export class TenantKnowledgeController {
  constructor(private readonly service: TenantKnowledgeService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('search')
  search(@Query() query: Record<string, any>) {
    return this.service.search(query || {});
  }

  @Post('seed-base')
  seedBase() {
    return this.service.seedBase();
  }

  @Get('categories')
  categories(@Query() query: Record<string, any>) {
    return this.service.listCategories(query || {});
  }

  @Post('categories')
  createCategory(@Body() body: Record<string, any>) {
    return this.service.createCategory(body || {});
  }

  @Get('categories/:categoryId')
  category(@Param('categoryId') categoryId: string) {
    return this.service.getCategory(categoryId);
  }

  @Patch('categories/:categoryId')
  updateCategory(@Param('categoryId') categoryId: string, @Body() body: Record<string, any>) {
    return this.service.updateCategory(categoryId, body || {});
  }

  @Delete('categories/:categoryId')
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.service.deleteCategory(categoryId);
  }

  @Get('tags')
  tags(@Query() query: Record<string, any>) {
    return this.service.listTags(query || {});
  }

  @Post('tags')
  createTag(@Body() body: Record<string, any>) {
    return this.service.createTag(body || {});
  }

  @Patch('tags/:tagId')
  updateTag(@Param('tagId') tagId: string, @Body() body: Record<string, any>) {
    return this.service.updateTag(tagId, body || {});
  }

  @Delete('tags/:tagId')
  deleteTag(@Param('tagId') tagId: string) {
    return this.service.deleteTag(tagId);
  }

  @Get('articles')
  articles(@Query() query: Record<string, any>) {
    return this.service.listArticles(query || {});
  }

  @Post('articles')
  createArticle(@Body() body: Record<string, any>) {
    return this.service.createArticle(body || {});
  }

  @Patch('articles/:articleId/publish')
  publishArticle(@Param('articleId') articleId: string) {
    return this.service.publishArticle(articleId);
  }

  @Patch('articles/:articleId/archive')
  archiveArticle(@Param('articleId') articleId: string) {
    return this.service.archiveArticle(articleId);
  }

  @Patch('articles/:articleId/review')
  reviewArticle(@Param('articleId') articleId: string, @Body() body: Record<string, any>) {
    return this.service.reviewArticle(articleId, body || {});
  }

  @Post('articles/:articleId/tags/:tagId')
  addArticleTag(@Param('articleId') articleId: string, @Param('tagId') tagId: string) {
    return this.service.addArticleTag(articleId, tagId);
  }

  @Delete('articles/:articleId/tags/:tagId')
  removeArticleTag(@Param('articleId') articleId: string, @Param('tagId') tagId: string) {
    return this.service.removeArticleTag(articleId, tagId);
  }

  @Get('articles/:articleId/versions')
  articleVersions(@Param('articleId') articleId: string) {
    return this.service.listArticleVersions(articleId);
  }

  @Post('articles/:articleId/versions')
  createArticleVersion(@Param('articleId') articleId: string, @Body() body: Record<string, any>) {
    return this.service.createArticleVersion(articleId, body || {});
  }

  @Get('articles/:articleId/links')
  articleLinks(@Param('articleId') articleId: string) {
    return this.service.listArticleLinks(articleId);
  }

  @Post('articles/:articleId/links')
  createArticleLink(@Param('articleId') articleId: string, @Body() body: Record<string, any>) {
    return this.service.createArticleLink(articleId, body || {});
  }

  @Delete('articles/:articleId/links/:linkId')
  deleteArticleLink(@Param('articleId') articleId: string, @Param('linkId') linkId: string) {
    return this.service.deleteArticleLink(articleId, linkId);
  }

  @Get('articles/:articleId/export')
  exportArticle(@Param('articleId') articleId: string) {
    return this.service.exportArticle(articleId);
  }

  @Get('articles/:articleId')
  article(@Param('articleId') articleId: string) {
    return this.service.getArticle(articleId);
  }

  @Patch('articles/:articleId')
  updateArticle(@Param('articleId') articleId: string, @Body() body: Record<string, any>) {
    return this.service.updateArticle(articleId, body || {});
  }

  @Delete('articles/:articleId')
  deleteArticle(@Param('articleId') articleId: string) {
    return this.service.deleteArticle(articleId);
  }

  @Get('favorites')
  favorites() {
    return this.service.listFavorites();
  }

  @Post('favorites')
  createFavorite(@Body() body: Record<string, any>) {
    return this.service.createFavorite(body || {});
  }

  @Delete('favorites/:favoriteId')
  deleteFavorite(@Param('favoriteId') favoriteId: string) {
    return this.service.deleteFavorite(favoriteId);
  }

  @Get('assets/collections')
  assetCollections(@Query() query: Record<string, any>) {
    return this.service.listAssetCollections(query || {});
  }

  @Post('assets/collections')
  createAssetCollection(@Body() body: Record<string, any>) {
    return this.service.createAssetCollection(body || {});
  }

  @Get('assets/collections/:collectionId')
  assetCollection(@Param('collectionId') collectionId: string) {
    return this.service.getAssetCollection(collectionId);
  }

  @Patch('assets/collections/:collectionId')
  updateAssetCollection(@Param('collectionId') collectionId: string, @Body() body: Record<string, any>) {
    return this.service.updateAssetCollection(collectionId, body || {});
  }

  @Delete('assets/collections/:collectionId')
  deleteAssetCollection(@Param('collectionId') collectionId: string) {
    return this.service.deleteAssetCollection(collectionId);
  }

  @Get('assets')
  assets(@Query() query: Record<string, any>) {
    return this.service.listAssets(query || {});
  }

  @Post('assets')
  createAsset(@Body() body: Record<string, any>) {
    return this.service.createAsset(body || {});
  }

  @Patch('assets/:assetId/archive')
  archiveAsset(@Param('assetId') assetId: string) {
    return this.service.archiveAsset(assetId);
  }

  @Post('assets/:assetId/tags/:tagId')
  addAssetTag(@Param('assetId') assetId: string, @Param('tagId') tagId: string) {
    return this.service.addAssetTag(assetId, tagId);
  }

  @Delete('assets/:assetId/tags/:tagId')
  removeAssetTag(@Param('assetId') assetId: string, @Param('tagId') tagId: string) {
    return this.service.removeAssetTag(assetId, tagId);
  }

  @Get('assets/:assetId/export')
  exportAsset(@Param('assetId') assetId: string) {
    return this.service.exportAsset(assetId);
  }

  @Get('assets/:assetId')
  asset(@Param('assetId') assetId: string) {
    return this.service.getAsset(assetId);
  }

  @Patch('assets/:assetId')
  updateAsset(@Param('assetId') assetId: string, @Body() body: Record<string, any>) {
    return this.service.updateAsset(assetId, body || {});
  }

  @Delete('assets/:assetId')
  deleteAsset(@Param('assetId') assetId: string) {
    return this.service.deleteAsset(assetId);
  }

  @Get('templates')
  templates(@Query() query: Record<string, any>) {
    return this.service.listTemplates(query || {});
  }

  @Post('templates')
  createTemplate(@Body() body: Record<string, any>) {
    return this.service.createTemplate(body || {});
  }

  @Patch('templates/:templateId/activate')
  activateTemplate(@Param('templateId') templateId: string) {
    return this.service.setTemplateStatus(templateId, 'active');
  }

  @Patch('templates/:templateId/archive')
  archiveTemplate(@Param('templateId') templateId: string) {
    return this.service.setTemplateStatus(templateId, 'archived');
  }

  @Post('templates/:templateId/duplicate')
  duplicateTemplate(@Param('templateId') templateId: string) {
    return this.service.duplicateTemplate(templateId);
  }

  @Post('templates/:templateId/preview')
  previewTemplate(@Param('templateId') templateId: string, @Body() body: Record<string, any>) {
    return this.service.previewTemplate(templateId, body || {});
  }

  @Post('templates/:templateId/use')
  useTemplate(@Param('templateId') templateId: string, @Body() body: Record<string, any>) {
    return this.service.useTemplate(templateId, body || {});
  }

  @Get('templates/:templateId/versions')
  templateVersions(@Param('templateId') templateId: string) {
    return this.service.listTemplateVersions(templateId);
  }

  @Post('templates/:templateId/versions')
  createTemplateVersion(@Param('templateId') templateId: string, @Body() body: Record<string, any>) {
    return this.service.createTemplateVersion(templateId, body || {});
  }

  @Get('templates/:templateId/usage')
  templateUsage(@Param('templateId') templateId: string) {
    return this.service.listTemplateUsage(templateId);
  }

  @Get('templates/:templateId/export')
  exportTemplate(@Param('templateId') templateId: string) {
    return this.service.exportTemplate(templateId);
  }

  @Get('templates/:templateId')
  template(@Param('templateId') templateId: string) {
    return this.service.getTemplate(templateId);
  }

  @Patch('templates/:templateId')
  updateTemplate(@Param('templateId') templateId: string, @Body() body: Record<string, any>) {
    return this.service.updateTemplate(templateId, body || {});
  }

  @Delete('templates/:templateId')
  deleteTemplate(@Param('templateId') templateId: string) {
    return this.service.deleteTemplate(templateId);
  }

  @Get('activity')
  activity(@Query() query: Record<string, any>) {
    return this.service.activity(query || {});
  }

  @Get('export')
  exportKnowledge(@Query() query: Record<string, any>) {
    return this.service.exportKnowledge(query || {});
  }
}
