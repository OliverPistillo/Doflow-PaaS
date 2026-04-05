import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CreateEventDto, UpdateEventDto } from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarEvent)
    private repo: Repository<CalendarEvent>,
  ) {}

  // Trova eventi in un range di date (es. mese corrente)
  async findByRange(start: string, end: string) {
    return this.repo.find({
      where: {
        date: Between(start, end),
      },
      order: { date: 'ASC' }
    });
  }

  async findAll() {
      return this.repo.find({ order: { date: 'ASC' }});
  }

  async create(data: CreateEventDto) {
    const event = this.repo.create(data);
    return this.repo.save(event);
  }

  async delete(id: string) {
    return this.repo.delete(id);
  }
}