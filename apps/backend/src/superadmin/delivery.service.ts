import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryTask } from './entities/delivery-task.entity';
import { CreateTaskDto, UpdateTaskDto } from './dto/delivery.dto';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryTask)
    private taskRepo: Repository<DeliveryTask>,
  ) {}

  async findAll() {
    return this.taskRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(data: CreateTaskDto) {
    const task = this.taskRepo.create(data);
    return this.taskRepo.save(task);
  }

  async update(id: string, data: UpdateTaskDto) {
    await this.taskRepo.update(id, data);
    return this.taskRepo.findOneBy({ id });
  }

  async delete(id: string) {
    return this.taskRepo.delete(id);
  }
}