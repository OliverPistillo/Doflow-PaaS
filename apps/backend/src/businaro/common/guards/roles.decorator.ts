import { SetMetadata } from '@nestjs/common';
import { BusinaroDepartment } from '../enums';

export const BUSINARO_ROLES_KEY = 'businaro_roles';
export const BusinaroRoles = (...roles: BusinaroDepartment[]) =>
  SetMetadata(BUSINARO_ROLES_KEY, roles);
