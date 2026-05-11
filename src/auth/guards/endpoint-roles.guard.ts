import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { getRequiredRoles } from '../../config/endpoint-roles.config';
import { Role } from '../../common/enums/role.enum';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class EndpointRolesGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public() decorator'ı varsa, direkt geç
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      try {
        await super.canActivate(context);
      } catch (error) {
        // Public endpoint'lerde token opsiyoneldir; geçersiz veya eksik token erişimi engellemez.
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    // Route path'i al, yoksa URL'den al
    const path = request.route?.path || request.path || request.url.split('?')[0];

    // Config dosyasından gerekli rolleri al
    const requiredRoles = getRequiredRoles(method, path);

    // Eğer boş array ise, public endpoint (auth gerekmez)
    // Ama token varsa parse et ki req.user set edilsin (optional auth için)
    if (requiredRoles.length === 0) {
      // Token varsa parse et (optional), yoksa devam et
      try {
        await super.canActivate(context);
      } catch (error) {
        // Token yoksa veya geçersizse, public endpoint olduğu için devam et
        // Sadece req.user undefined kalır
      }
      return true;
    }

    // Rol gereksinimi varsa, JWT token'ı validate et
    try {
      const result = await super.canActivate(context);
      if (!result) {
        throw new UnauthorizedException('Geçersiz token');
      }
    } catch (error) {
      throw new UnauthorizedException('Bu işlem için giriş yapmanız gerekiyor');
    }

    // JWT validation başarılı, user bilgisi request'te olmalı
    const user = request.user as { userId: string; email: string; roles: Role[] } | undefined;
    if (!user || !user.roles) {
      throw new UnauthorizedException('Kullanıcı bilgisi bulunamadı');
    }

    // Kullanıcının rollerinden en az biri gerekli rollerle eşleşmeli
    const hasRequiredRole = requiredRoles.some((role) =>
      user.roles.includes(role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }

    return true;
  }
}
