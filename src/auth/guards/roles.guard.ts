import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/enums/role.enum';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // Eğer endpoint için rol gereksinimi yoksa, erişime izin ver
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Kullanıcı bilgisi yoksa erişim reddedilir
    if (!user || !user.roles) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    // Kullanıcının rollerinden en az biri gerekli rollerle eşleşmeli
    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));
    
    if (!hasRequiredRole) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    return true;
  }
}
