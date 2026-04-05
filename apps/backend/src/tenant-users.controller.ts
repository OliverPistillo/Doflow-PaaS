import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';

type CreateUserDto = {
  email: string;
};

@Controller('tenant/users')
export class TenantUsersController {
  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return tenantId ?? 'public';
  }

  @Get()
  async list(@Req() req: Request) {
    const user = (req as any).authUser;
    if (!user) return { error: 'Not authenticated' };

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `select id, email, created_at, '${tenantId}' as schema
      from ${tenantId}.users
      order by id`
    );

    return { users: rows, currentUser: user };
  }

  @Post()
  async create(@Body() body: CreateUserDto, @Req() req: Request) {
    const user = (req as any).authUser;
    if (!user) return { error: 'Not authenticated' };

    if (!body.email) return { error: 'email required' };

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const row = await conn.query(
      `insert into ${tenantId}.users (email)
      values ($1)
      returning id, email, created_at, '${tenantId}' as schema`,
      [body.email]
    );

    return { user: row[0], currentUser: user };
  }

}
