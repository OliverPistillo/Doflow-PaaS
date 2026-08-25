import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CommerceVersionDto,
  CreateCommerceOrderDto,
  CreateCommercePaymentDto,
  CreateCommerceRefundDto,
  CreateCommerceSaleDto,
  CreateCommerceServiceDto,
  ServiceCategoryCreateDto,
  ServiceCategoryUpdateDto,
  UpdateCommerceOrderDto,
  UpdateCommercePaymentDto,
  UpdateCommerceSaleDto,
  UpdateCommerceServiceDto,
} from './tenant-doflow-commerce.dto';
import { TenantDoflowCommerceService } from './tenant-doflow-commerce.service';

@Controller('tenant/doflow/commerce')
@UseGuards(JwtAuthGuard)
export class TenantDoflowCommerceController {
  constructor(private readonly service: TenantDoflowCommerceService) {}

  private key(headers: Record<string, string | string[] | undefined>) {
    return headers['idempotency-key'];
  }

  @Get('categories')
  categories() { return this.service.listCategories(); }

  @Post('categories')
  createCategory(@Body() body: ServiceCategoryCreateDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createCategory(body || {}, this.key(headers));
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: ServiceCategoryUpdateDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateCategory(id, body || {}, this.key(headers));
  }

  @Delete('categories/:id')
  archiveCategory(@Param('id') id: string, @Body() body: CommerceVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveCategory(id, body || {}, this.key(headers));
  }

  @Post('categories/:id/restore')
  restoreCategory(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.restoreCategory(id, this.key(headers));
  }

  @Get('services')
  services() { return this.service.listServices(); }

  @Post('services')
  createService(@Body() body: CreateCommerceServiceDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.createService(body || {}, this.key(headers)); }

  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() body: UpdateCommerceServiceDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.updateService(id, body || {}, this.key(headers)); }

  @Delete('services/:id')
  archiveService(@Param('id') id: string, @Body() body: CommerceVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.archiveService(id, body || {}, this.key(headers)); }

  @Post('services/:id/restore')
  restoreService(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.restoreService(id, this.key(headers)); }

  @Get('sales')
  sales() { return this.service.listSales(); }

  @Post('sales')
  createSale(@Body() body: CreateCommerceSaleDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.createSale(body || {}, this.key(headers)); }

  @Patch('sales/:id')
  updateSale(@Param('id') id: string, @Body() body: UpdateCommerceSaleDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.updateSale(id, body || {}, this.key(headers)); }

  @Delete('sales/:id')
  archiveSale(@Param('id') id: string, @Body() body: CommerceVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.archiveSale(id, body || {}, this.key(headers)); }

  @Get('orders')
  orders() { return this.service.listOrders(); }

  @Get('orders/:id')
  order(@Param('id') id: string) { return this.service.findOrder(id); }

  @Post('orders')
  createOrder(@Body() body: CreateCommerceOrderDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.createOrder(body || {}, this.key(headers)); }

  @Patch('orders/:id')
  updateOrder(@Param('id') id: string, @Body() body: UpdateCommerceOrderDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.updateOrder(id, body || {}, this.key(headers)); }

  @Delete('orders/:id')
  archiveOrder(@Param('id') id: string, @Body() body: CommerceVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.archiveOrder(id, body || {}, this.key(headers)); }

  @Post('orders/:id/restore')
  restoreOrder(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.restoreOrder(id, this.key(headers));
  }

  @Post('orders/:id/project')
  generateOrderProject(@Param('id') id: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.generateOrderProject(id, this.key(headers));
  }

  @Get('payments')
  payments() { return this.service.listPayments(); }

  @Post('payments')
  createPayment(@Body() body: CreateCommercePaymentDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createPayment(body || {}, this.key(headers));
  }

  @Post('refunds')
  createRefund(@Body() body: CreateCommerceRefundDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createRefund(body || {}, this.key(headers));
  }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @Body() body: UpdateCommercePaymentDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updatePayment(id, body || {}, this.key(headers));
  }

  @Delete('payments/:id')
  archivePayment(@Param('id') id: string, @Body() body: CommerceVersionDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archivePayment(id, body || {}, this.key(headers));
  }

  @Get('economics/summary')
  economics(@Query() query: Record<string, any>) { return this.service.economicsSummary(query); }

  @Get('customers/:id/economics')
  customerEconomics(@Param('id') id: string) { return this.service.customerEconomics(id); }

  @Get('projects/:id/economics')
  projectEconomics(@Param('id') id: string) { return this.service.projectEconomics(id); }

  @Get('history/:aggregateType/:aggregateId')
  history(@Param('aggregateType') aggregateType: string, @Param('aggregateId') aggregateId: string) {
    return this.service.history(aggregateType, aggregateId);
  }

  @Get('campaigns')
  campaigns() { return this.service.listCampaigns(); }

  @Post('campaigns')
  createCampaign(@Body() body: Record<string, any>) { return this.service.createCampaign(body || {}); }

  @Patch('campaigns/:id')
  updateCampaign(@Param('id') id: string, @Body() body: Record<string, any>) { return this.service.updateCampaign(id, body || {}); }

  @Delete('campaigns/:id')
  archiveCampaign(@Param('id') id: string) { return this.service.archiveCampaign(id); }
}
