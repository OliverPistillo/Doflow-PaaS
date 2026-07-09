import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantCalendarService } from './tenant-calendar.service';

@Controller('tenant/calendar')
@UseGuards(JwtAuthGuard)
export class TenantCalendarController {
  constructor(private readonly service: TenantCalendarService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('events')
  events(@Query() query: Record<string, any>) {
    return this.service.listEvents(query || {});
  }

  @Post('events')
  createEvent(@Body() body: Record<string, any>) {
    return this.service.createEvent(body || {});
  }

  @Patch('events/:eventId/complete')
  completeEvent(@Param('eventId') eventId: string) {
    return this.service.setEventStatus(eventId, 'completed');
  }

  @Patch('events/:eventId/cancel')
  cancelEvent(@Param('eventId') eventId: string) {
    return this.service.setEventStatus(eventId, 'cancelled');
  }

  @Get('events/:eventId/export')
  exportEvent(@Param('eventId') eventId: string) {
    return this.service.exportEvent(eventId);
  }

  @Get('events/:eventId/attendees')
  attendees(@Param('eventId') eventId: string) {
    return this.service.listAttendees(eventId);
  }

  @Post('events/:eventId/attendees')
  addAttendee(@Param('eventId') eventId: string, @Body() body: Record<string, any>) {
    return this.service.addAttendee(eventId, body || {});
  }

  @Patch('events/:eventId/attendees/:attendeeId')
  updateAttendee(@Param('eventId') eventId: string, @Param('attendeeId') attendeeId: string, @Body() body: Record<string, any>) {
    return this.service.updateAttendee(eventId, attendeeId, body || {});
  }

  @Delete('events/:eventId/attendees/:attendeeId')
  deleteAttendee(@Param('eventId') eventId: string, @Param('attendeeId') attendeeId: string) {
    return this.service.deleteAttendee(eventId, attendeeId);
  }

  @Get('events/:eventId/reminders')
  reminders(@Param('eventId') eventId: string) {
    return this.service.listReminders(eventId);
  }

  @Post('events/:eventId/reminders')
  addReminder(@Param('eventId') eventId: string, @Body() body: Record<string, any>) {
    return this.service.addReminder(eventId, body || {});
  }

  @Get('reminders/due')
  dueReminders() {
    return this.service.dueReminders();
  }

  @Patch('reminders/:reminderId/dismiss')
  dismissReminder(@Param('reminderId') reminderId: string) {
    return this.service.dismissReminder(reminderId);
  }

  @Delete('reminders/:reminderId')
  deleteReminder(@Param('reminderId') reminderId: string) {
    return this.service.deleteReminder(reminderId);
  }

  @Get('events/:eventId/links')
  links(@Param('eventId') eventId: string) {
    return this.service.listLinks(eventId);
  }

  @Post('events/:eventId/links')
  addLink(@Param('eventId') eventId: string, @Body() body: Record<string, any>) {
    return this.service.addLink(eventId, body || {});
  }

  @Delete('events/:eventId/links/:linkId')
  deleteLink(@Param('eventId') eventId: string, @Param('linkId') linkId: string) {
    return this.service.deleteLink(eventId, linkId);
  }

  @Get('events/:eventId')
  event(@Param('eventId') eventId: string) {
    return this.service.getEvent(eventId);
  }

  @Patch('events/:eventId')
  updateEvent(@Param('eventId') eventId: string, @Body() body: Record<string, any>) {
    return this.service.updateEvent(eventId, body || {});
  }

  @Delete('events/:eventId')
  deleteEvent(@Param('eventId') eventId: string) {
    return this.service.deleteEvent(eventId);
  }

  @Get('agenda')
  agenda(@Query() query: Record<string, any>) {
    return this.service.agenda(query || {});
  }

  @Get('week')
  week(@Query() query: Record<string, any>) {
    return this.service.week(query || {});
  }

  @Get('timeline')
  timeline(@Query() query: Record<string, any>) {
    return this.service.timeline(query || {});
  }

  @Get('deadlines')
  deadlines(@Query() query: Record<string, any>) {
    return this.service.deadlines(query || {});
  }

  @Get('workload')
  workload(@Query() query: Record<string, any>) {
    return this.service.workload(query || {});
  }

  @Get('conflicts')
  conflicts(@Query() query: Record<string, any>) {
    return this.service.conflicts(query || {});
  }

  @Get('availability')
  availability(@Query() query: Record<string, any>) {
    return this.service.availability(query || {});
  }

  @Post('sync-derived')
  syncDerived(@Body() body: Record<string, any>) {
    return this.service.syncDerived(body || {});
  }

  @Get('derived-preview')
  derivedPreview() {
    return this.service.derivedPreview();
  }

  @Get('views')
  views(@Query() query: Record<string, any>) {
    return this.service.listViews(query || {});
  }

  @Post('views')
  createView(@Body() body: Record<string, any>) {
    return this.service.createView(body || {});
  }

  @Post('views/seed-base')
  seedViews() {
    return this.service.seedViews();
  }

  @Get('views/:viewId')
  view(@Param('viewId') viewId: string) {
    return this.service.getView(viewId);
  }

  @Patch('views/:viewId')
  updateView(@Param('viewId') viewId: string, @Body() body: Record<string, any>) {
    return this.service.updateView(viewId, body || {});
  }

  @Delete('views/:viewId')
  deleteView(@Param('viewId') viewId: string) {
    return this.service.deleteView(viewId);
  }

  @Get('activity')
  activity(@Query() query: Record<string, any>) {
    return this.service.activity(query || {});
  }

  @Get('export')
  exportCalendar(@Query() query: Record<string, any>) {
    return this.service.exportCalendar(query || {});
  }
}
