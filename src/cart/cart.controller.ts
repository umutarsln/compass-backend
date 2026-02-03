import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService, CartTotals } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ApplyCouponDto } from '../coupon/dto/apply-coupon.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { GuestCartGuard } from './guards/guest-cart.guard';
import { UserCartGuard } from './guards/user-cart.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Cart')
@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) { }

  @Post('guest')
  @Public()
  @ApiOperation({ summary: 'Create guest cart' })
  @ApiResponse({
    status: 201,
    description: 'Guest cart created',
    type: CartResponseDto,
  })
  async createGuestCart(): Promise<CartResponseDto> {
    const cart = await this.cartService.createGuestCart();
    const totals: CartTotals = {
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      appliedCoupon: null,
    };
    return this.mapToResponseDto(cart, totals);
  }

  @Get(':id')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Get cart by ID' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({
    status: 200,
    description: 'Cart retrieved',
    type: CartResponseDto,
  })
  async getCart(@Param('id') id: string, @Request() req: any): Promise<CartResponseDto> {
    const userId = req.user?.id ?? null;
    const cart = await this.cartService.getCart(id, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Post(':id/items')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart',
  })
  async addItem(
    @Param('id') cartId: string,
    @Body() addItemDto: AddItemDto,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const guestId = req.headers['x-guest-id'] || null;

    await this.cartService.addItem(
      cartId,
      addItemDto.productId,
      addItemDto.quantity,
      addItemDto.variantId,
      userId,
      addItemDto.personalization || null,
      guestId,
    );
    const cart = await this.cartService.getCart(cartId, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Update item quantity' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiParam({ name: 'itemId', description: 'Cart item ID' })
  @ApiResponse({
    status: 200,
    description: 'Item updated',
  })
  async updateItem(
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateItemDto,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    const guestId = req.headers['x-guest-id'] || null;

    await this.cartService.updateItem(
      cartId,
      itemId,
      updateItemDto.quantity,
      userId,
      updateItemDto.personalization || null,
      guestId,
    );
    const cart = await this.cartService.getCart(cartId, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiParam({ name: 'itemId', description: 'Cart item ID' })
  @ApiResponse({
    status: 200,
    description: 'Item removed',
  })
  async removeItem(
    @Param('id') cartId: string,
    @Param('itemId') itemId: string,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id ?? null;
    await this.cartService.removeItem(cartId, itemId, userId);
    const cart = await this.cartService.getCart(cartId, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Post(':id/merge')
  @UseGuards(JwtAuthGuard, UserCartGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart into user cart' })
  @ApiParam({ name: 'id', description: 'Guest cart ID' })
  @ApiResponse({
    status: 200,
    description: 'Cart merged successfully',
    type: CartResponseDto,
  })
  async mergeCart(
    @Param('id') guestCartId: string,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user.id;
    const cart = await this.cartService.mergeCart(guestCartId, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Post(':id/coupon')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Apply coupon to cart' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({ status: 200, description: 'Coupon applied', type: CartResponseDto })
  async applyCoupon(
    @Param('id') cartId: string,
    @Body() body: ApplyCouponDto,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id ?? null;
    const cart = await this.cartService.applyCoupon(cartId, body.code, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Delete(':id/coupon')
  @UseGuards(GuestCartGuard)
  @Public()
  @ApiOperation({ summary: 'Remove coupon from cart' })
  @ApiParam({ name: 'id', description: 'Cart ID' })
  @ApiResponse({ status: 200, description: 'Coupon removed', type: CartResponseDto })
  async removeCoupon(
    @Param('id') cartId: string,
    @Request() req: any,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id ?? null;
    const cart = await this.cartService.removeCoupon(cartId, userId);
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  @Get('me/cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's active cart" })
  @ApiResponse({
    status: 200,
    description: 'User cart retrieved',
    type: CartResponseDto,
  })
  async getUserCart(@Request() req: any): Promise<CartResponseDto | null> {
    const userId = req.user.id;
    const cart = await this.cartService.getUserCart(userId);
    if (!cart) {
      return null;
    }
    const totals = await this.cartService.getCartTotals(cart);
    return this.mapToResponseDto(cart, totals);
  }

  private mapToResponseDto(cart: any, totals: CartTotals): CartResponseDto {
    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      items: cart.items?.map((item: any) => {
        // Get product gallery (first gallery for product)
        const productGallery = item.product?.galleries?.[0];

        // Get variant gallery (first gallery for variant) or use product gallery
        const variantGallery = item.variant?.galleries?.[0] || productGallery;

        // Map variant values
        const variantValues = item.variant?.variantValues?.map((vv: any) => ({
          id: vv.id,
          value: vv.value,
          colorCode: vv.colorCode,
          variantOption: vv.variantOption ? {
            id: vv.variantOption.id,
            name: vv.variantOption.name,
            type: vv.variantOption.type,
          } : null,
        })) || [];

        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          basePrice: Number(item.basePrice),
          discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
          currency: item.currency,
          product: item.product ? {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            basePrice: Number(item.product.basePrice),
            discountedPrice: item.product.discountedPrice ? Number(item.product.discountedPrice) : null,
            gallery: productGallery ? {
              mainImage: productGallery.mainImage ? {
                id: productGallery.mainImage.id,
                s3Url: productGallery.mainImage.s3Url,
                displayName: productGallery.mainImage.displayName,
                filename: productGallery.mainImage.filename,
              } : null,
              thumbnailImage: productGallery.thumbnailImage ? {
                id: productGallery.thumbnailImage.id,
                s3Url: productGallery.thumbnailImage.s3Url,
                displayName: productGallery.thumbnailImage.displayName,
                filename: productGallery.thumbnailImage.filename,
              } : null,
            } : null,
          } : null,
          variant: item.variant ? {
            id: item.variant.id,
            slug: item.variant.slug,
            gallery: variantGallery ? {
              mainImage: variantGallery.mainImage ? {
                id: variantGallery.mainImage.id,
                s3Url: variantGallery.mainImage.s3Url,
                displayName: variantGallery.mainImage.displayName,
                filename: variantGallery.mainImage.filename,
              } : null,
              thumbnailImage: variantGallery.thumbnailImage ? {
                id: variantGallery.thumbnailImage.id,
                s3Url: variantGallery.thumbnailImage.s3Url,
                displayName: variantGallery.thumbnailImage.displayName,
                filename: variantGallery.thumbnailImage.filename,
              } : null,
            } : null,
            variantValues: variantValues,
          } : null,
          personalization: item.personalization || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }) || [],
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      total: totals.total,
      appliedCoupon: totals.appliedCoupon,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
