import {
  Controller,
  Get,
  INestApplication,
  Injectable,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import {
  ALL_MIDDLEWARE_ROUTES,
  AUTH_MIDDLEWARE_EXCLUDED_ROUTES,
  TENANCY_MIDDLEWARE_EXCLUDED_ROUTES,
} from './app.module';

@Injectable()
class AuthContractMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction) {
    response.setHeader('x-auth-middleware', 'applied');
    next();
  }
}

@Injectable()
class TenancyContractMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction) {
    response.setHeader('x-tenancy-middleware', 'applied');
    next();
  }
}

@Controller()
class RoutingContractController {
  @Get('public/lead-intake/doflow') publicLead() { return { ok: true }; }
  @Get('billing/webhook') billingWebhook() { return { ok: true }; }
  @Get('superadmin/system/health') superadmin() { return { ok: true }; }
  @Get('tenant/self-service/plan') selfService() { return { ok: true }; }
  @Get('auth/google/callback') googleCallback() { return { ok: true }; }
  @Get('tenant/projects') tenantProject() { return { ok: true }; }
}

@Module({
  controllers: [RoutingContractController],
  providers: [AuthContractMiddleware, TenancyContractMiddleware],
})
class RoutingContractModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthContractMiddleware)
      .exclude(...AUTH_MIDDLEWARE_EXCLUDED_ROUTES)
      .forRoutes(ALL_MIDDLEWARE_ROUTES);
    consumer
      .apply(TenancyContractMiddleware)
      .exclude(...TENANCY_MIDDLEWARE_EXCLUDED_ROUTES)
      .forRoutes(ALL_MIDDLEWARE_ROUTES);
  }
}

describe('Nest 11 / Express 5 middleware routing contract', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RoutingContractModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  async function get(pathname: string) {
    const response = await fetch(`${baseUrl}${pathname}`);
    return {
      status: response.status,
      auth: response.headers.get('x-auth-middleware'),
      tenancy: response.headers.get('x-tenancy-middleware'),
    };
  }

  it.each([
    ['/api/public/lead-intake/doflow', null, null],
    ['/api/billing/webhook', null, null],
    ['/api/superadmin/system/health', 'applied', null],
    ['/api/tenant/self-service/plan', 'applied', null],
    ['/api/auth/google/callback', 'applied', null],
    ['/api/tenant/projects', 'applied', 'applied'],
  ])('routes %s through the expected middleware', async (pathname, auth, tenancy) => {
    await expect(get(pathname)).resolves.toEqual({ status: 200, auth, tenancy });
  });

  it('keeps unknown routes at 404 while cross-cutting middleware still runs', async () => {
    await expect(get('/api/not-a-real-route')).resolves.toEqual({
      status: 404,
      auth: 'applied',
      tenancy: 'applied',
    });
  });
});
