import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { CartService } from '../cart.service';

@Injectable()
export class UserCartGuard implements CanActivate {
  constructor(private cartService: CartService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const cartId = request.params.id || request.params.cartId;

    if (cartId) {
      // Validate cart belongs to user
      await this.cartService.getCart(cartId, user.id);
    }

    return true;
  }
}
