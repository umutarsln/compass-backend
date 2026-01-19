import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Cart } from './cart.entity';
import { CartItem } from './cart-item.entity';
import { Product } from '../product/product.entity';
import { VariantCombination } from '../product/variant-combination.entity';
import { CartStatus } from '../common/enums/cart-status.enum';
import { Currency } from '../common/enums/currency.enum';
import { ProductType } from '../common/enums/product-type.enum';

@Injectable()
export class CartService {
    constructor(
        @InjectRepository(Cart)
        private cartRepository: Repository<Cart>,
        @InjectRepository(CartItem)
        private cartItemRepository: Repository<CartItem>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(VariantCombination)
        private variantCombinationRepository: Repository<VariantCombination>,
        private dataSource: DataSource,
    ) { }

    /**
     * Calculate price delta for variant combination
     */
    private calculateVariantPriceDelta(combination: VariantCombination): number {
        if (!combination.variantValues || combination.variantValues.length === 0) {
            return 0;
        }

        return combination.variantValues.reduce((total, value) => {
            const priceDelta = Number(value.priceDelta) || 0;
            return total + priceDelta;
        }, 0);
    }

    /**
     * Calculate price snapshot for a product/variant
     */
    private async calculatePriceSnapshot(
        product: Product,
        variantId?: string | null,
    ): Promise<{ basePrice: number; discountedPrice: number | null }> {
        let basePrice = Number(product.basePrice);
        let discountedPrice = product.discountedPrice
            ? Number(product.discountedPrice)
            : null;

        // If variant product, add price deltas
        if (product.type === ProductType.VARIANT && variantId) {
            const variant = await this.variantCombinationRepository.findOne({
                where: { id: variantId },
                relations: ['variantValues', 'variantValues.variantOption'],
            });

            if (variant) {
                const priceDelta = this.calculateVariantPriceDelta(variant);
                basePrice = basePrice + priceDelta;
                if (discountedPrice !== null) {
                    discountedPrice = discountedPrice + priceDelta;
                }
            }
        }

        return {
            basePrice: Math.max(0, Math.round(basePrice * 100) / 100),
            discountedPrice:
                discountedPrice !== null
                    ? Math.max(0, Math.round(discountedPrice * 100) / 100)
                    : null,
        };
    }

    /**
     * Create a guest cart
     */
    async createGuestCart(): Promise<Cart> {
        const cart = this.cartRepository.create({
            userId: null,
            status: CartStatus.ACTIVE,
        });
        return await this.cartRepository.save(cart);
    }

    /**
     * Get cart by ID with ownership validation
     */
    async getCart(cartId: string, userId?: string | null): Promise<Cart> {
        const cart = await this.cartRepository.findOne({
            where: { id: cartId },
            relations: [
                'items',
                'items.product',
                'items.product.galleries',
                'items.product.galleries.mainImage',
                'items.product.galleries.thumbnailImage',
                'items.variant',
                'items.variant.galleries',
                'items.variant.galleries.mainImage',
                'items.variant.galleries.thumbnailImage',
                'items.variant.variantValues',
                'items.variant.variantValues.variantOption',
            ],
        });

        if (!cart) {
            throw new NotFoundException('Cart not found');
        }

        // Ownership validation
        if (cart.userId !== null) {
            // User cart - must match userId
            if (!userId || cart.userId !== userId) {
                throw new ForbiddenException('Access denied to this cart');
            }
        } else {
            // Guest cart - can be accessed by anyone with cartId
            // No additional check needed
        }

        return cart;
    }

    /**
     * Get user's active cart
     */
    async getUserCart(userId: string): Promise<Cart | null> {
        return await this.cartRepository.findOne({
            where: {
                userId,
                status: CartStatus.ACTIVE,
            },
            relations: [
                'items',
                'items.product',
                'items.product.galleries',
                'items.product.galleries.mainImage',
                'items.product.galleries.thumbnailImage',
                'items.variant',
                'items.variant.galleries',
                'items.variant.galleries.mainImage',
                'items.variant.galleries.thumbnailImage',
                'items.variant.variantValues',
                'items.variant.variantValues.variantOption',
            ],
        });
    }

    /**
     * Add item to cart (idempotent - updates quantity if exists)
     */
    async addItem(
        cartId: string,
        productId: string,
        quantity: number,
        variantId?: string | null,
        userId?: string | null,
    ): Promise<CartItem> {
        // Validate cart ownership
        const cart = await this.getCart(cartId, userId);

        // Validate product
        const product = await this.productRepository.findOne({
            where: { id: productId },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Validate variant if provided
        if (variantId) {
            const variant = await this.variantCombinationRepository.findOne({
                where: { id: variantId, productId },
            });

            if (!variant) {
                throw new NotFoundException('Variant combination not found');
            }

            if (!variant.isActive || variant.isDisabled) {
                throw new BadRequestException('Variant combination is not available');
            }
        }

        // Calculate price snapshot
        const { basePrice, discountedPrice } = await this.calculatePriceSnapshot(
            product,
            variantId,
        );

        // Check if item already exists
        const existingItem = await this.cartItemRepository.findOne({
            where: {
                cartId,
                productId,
                variantId: variantId ? variantId : IsNull(),
            },
        });

        if (existingItem) {
            // Update quantity (idempotent)
            existingItem.quantity = existingItem.quantity + quantity;
            // Update prices to latest snapshot
            existingItem.basePrice = basePrice;
            existingItem.discountedPrice = discountedPrice;
            return await this.cartItemRepository.save(existingItem);
        }

        // Create new item
        const cartItem = this.cartItemRepository.create({
            cartId,
            productId,
            variantId: variantId || null,
            quantity,
            basePrice,
            discountedPrice,
            currency: Currency.TRY,
        });

        return await this.cartItemRepository.save(cartItem);
    }

    /**
     * Update item quantity
     */
    async updateItem(
        cartId: string,
        itemId: string,
        quantity: number,
        userId?: string | null,
    ): Promise<CartItem> {
        // Validate cart ownership
        await this.getCart(cartId, userId);

        if (quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        const item = await this.cartItemRepository.findOne({
            where: { id: itemId, cartId },
        });

        if (!item) {
            throw new NotFoundException('Cart item not found');
        }

        item.quantity = quantity;
        return await this.cartItemRepository.save(item);
    }

    /**
     * Remove item from cart
     */
    async removeItem(
        cartId: string,
        itemId: string,
        userId?: string | null,
    ): Promise<void> {
        // Validate cart ownership
        await this.getCart(cartId, userId);

        const item = await this.cartItemRepository.findOne({
            where: { id: itemId, cartId },
        });

        if (!item) {
            throw new NotFoundException('Cart item not found');
        }

        await this.cartItemRepository.remove(item);
    }

    /**
     * Merge guest cart into user cart (transactional)
     */
    async mergeCart(guestCartId: string, userId: string): Promise<Cart> {
        return await this.dataSource.transaction(async (manager) => {
            // Get guest cart
            const guestCart = await manager.findOne(Cart, {
                where: { id: guestCartId, userId: IsNull(), status: CartStatus.ACTIVE },
                relations: [
                    'items',
                    'items.product',
                    'items.product.galleries',
                    'items.product.galleries.mainImage',
                    'items.product.galleries.thumbnailImage',
                    'items.variant',
                    'items.variant.galleries',
                    'items.variant.galleries.mainImage',
                    'items.variant.galleries.thumbnailImage',
                    'items.variant.variantValues',
                    'items.variant.variantValues.variantOption',
                ],
            });

            if (!guestCart) {
                throw new NotFoundException('Guest cart not found');
            }

            // Get or create user cart
            let userCart = await manager.findOne(Cart, {
                where: { userId, status: CartStatus.ACTIVE },
                relations: [
                    'items',
                    'items.product',
                    'items.product.galleries',
                    'items.product.galleries.mainImage',
                    'items.product.galleries.thumbnailImage',
                    'items.variant',
                    'items.variant.galleries',
                    'items.variant.galleries.mainImage',
                    'items.variant.galleries.thumbnailImage',
                    'items.variant.variantValues',
                    'items.variant.variantValues.variantOption',
                ],
            });

            if (!userCart) {
                userCart = manager.create(Cart, {
                    userId,
                    status: CartStatus.ACTIVE,
                });
                userCart = await manager.save(Cart, userCart);
            }

            // Merge items
            for (const guestItem of guestCart.items) {
                const existingItem = userCart.items.find(
                    (item) =>
                        item.productId === guestItem.productId &&
                        item.variantId === guestItem.variantId,
                );

                if (existingItem) {
                    // Sum quantities
                    existingItem.quantity = existingItem.quantity + guestItem.quantity;
                    // Use latest price snapshot
                    existingItem.basePrice = guestItem.basePrice;
                    existingItem.discountedPrice = guestItem.discountedPrice;
                    await manager.save(CartItem, existingItem);
                } else {
                    // Create new item in user cart
                    const newItem = manager.create(CartItem, {
                        cartId: userCart.id,
                        productId: guestItem.productId,
                        variantId: guestItem.variantId,
                        quantity: guestItem.quantity,
                        basePrice: guestItem.basePrice,
                        discountedPrice: guestItem.discountedPrice,
                        currency: guestItem.currency,
                    });
                    await manager.save(CartItem, newItem);
                }
            }

            // Mark guest cart as merged
            guestCart.status = CartStatus.MERGED;
            await manager.save(Cart, guestCart);

            // Return user cart with items
            const finalCart = await manager.findOne(Cart, {
                where: { id: userCart.id },
                relations: [
                    'items',
                    'items.product',
                    'items.product.galleries',
                    'items.product.galleries.mainImage',
                    'items.product.galleries.thumbnailImage',
                    'items.variant',
                    'items.variant.galleries',
                    'items.variant.galleries.mainImage',
                    'items.variant.galleries.thumbnailImage',
                    'items.variant.variantValues',
                    'items.variant.variantValues.variantOption',
                ],
            });

            if (!finalCart) {
                throw new NotFoundException('User cart not found after merge');
            }

            return finalCart;
        });
    }
}
