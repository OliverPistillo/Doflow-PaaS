import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BUSINARO_ROLES_KEY } from './roles.decorator';
import { BusinaroDepartment } from '../enums';

@Injectable()
export class BusinaroDepartmentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<BusinaroDepartment[]>(
      BUSINARO_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest() as any;

    // Assunzione: hai già req.user popolato dal tuo auth middleware/guard
    const user = req.user;
    const role = user?.role as BusinaroDepartment | undefined;

    if (!role) throw new ForbiddenException('Ruolo mancante (token non valido o incompleto).');
    if (!required.includes(role)) {
      throw new ForbiddenException(`Accesso negato. Richiesto ruolo: ${required.join(', ')}`);
    }
    return true;
  }
}
