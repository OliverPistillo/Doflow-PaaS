import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto } from './dto/delivery.dto';

@Controller('superadmin/delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get('tasks')
  getTasks() {
    return this.service.findAll();
  }

  @Post('tasks')
  createTask(@Body() body: CreateTaskDto) {
    return this.service.create(body);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: UpdateTaskDto) {
    return this.service.update(id, body);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.service.delete(id);
  }
}