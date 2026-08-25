// apps/backend/src/auth/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request?.user?.sub && request?.webSession) return true;
    return super.canActivate(context);
  }
}
