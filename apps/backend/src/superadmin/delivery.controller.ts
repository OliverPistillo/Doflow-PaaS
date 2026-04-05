import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto } from './dto/delivery.dto';
import { Roles } from './superadmin-dashboard.controller'; // Riutilizziamo il decorator se esiste, o rimuovilo se da errore

@Controller('superadmin/delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get('tasks')
  getTasks() {
    return this.service.findAll();
  }

  @Post('tasks')
  async createTask(@Body() body: CreateTaskDto) {
    // --- LOG DI DEBUG ---
    console.log('Tentativo creazione Task. Dati ricevuti:', body);
    try {
      const result = await this.service.create(body);
      console.log('Task creato con successo:', result);
      return result;
    } catch (error) {
      console.error('ERRORE CREAZIONE TASK:', error);
      throw error; // Rilancia l'errore al frontend
    }
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