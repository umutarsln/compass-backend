import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from '../cart.service';

@Injectable()
export class GuestCartGuard implements CanActivate {
  constructor(private cartService: CartService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const cartId = request.params.id || request.params.cartId;

    if (!cartId) {
      throw new NotFoundException('Cart ID is required');
    }

    // Get cart and validate it's a guest cart (userId is null)
    const cart = await this.cartService.getCart(cartId, null);

    if (cart.userId !== null) {
      throw new NotFoundException('Cart not found');
    }

    return true;
  }
}
