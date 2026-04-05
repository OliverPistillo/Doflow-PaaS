import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateEventDto } from './dto/calendar.dto';

@Controller('superadmin/calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get('events')
  getEvents(@Query('start') start: string, @Query('end') end: string) {
    if (start && end) {
        return this.service.findByRange(start, end);
    }
    return this.service.findAll();
  }

  @Post('events')
  createEvent(@Body() body: CreateEventDto) {
    return this.service.create(body);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.service.delete(id);
  }
}