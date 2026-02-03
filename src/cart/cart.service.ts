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
import { CartPersonalizationValidatorService } from '../personalization/cart-personalization-validator.service';
import { CartPersonalizationPricingService } from '../personalization/cart-personalization-pricing.service';
import { PersonalizationSnapshotService } from '../personalization/personalization-snapshot.service';
import { CouponService } from '../coupon/coupon.service';
import { Coupon } from '../coupon/coupon.entity';

export interface CartTotals {
    subtotal: number;
    discountAmount: number;
    total: number;
    appliedCoupon: {
        id: string;
        code: string;
        name: string;
        type: string;
        discountValue: number;
        discountAmount: number;
    } | null;
}

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
        private personalizationValidator: CartPersonalizationValidatorService,
        private personalizationPricing: CartPersonalizationPricingService,
        private personalizationSnapshot: PersonalizationSnapshotService,
        private couponService: CouponService,
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
                'coupon',
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
                'coupon',
            ],
        });
    }

    /**
     * Calculate subtotal from cart items
     */
    getCartSubtotal(cart: Cart): number {
        if (!cart.items || cart.items.length === 0) {
            return 0;
        }
        return cart.items.reduce((sum, item) => {
            const price = item.discountedPrice ?? item.basePrice;
            return sum + Number(price) * item.quantity;
        }, 0);
    }

    /**
     * Get cart totals (subtotal, discountAmount, total, appliedCoupon).
     * If coupon is applied but no longer valid, clears it and returns 0 discount.
     */
    async getCartTotals(cart: Cart): Promise<CartTotals> {
        const subtotal = Math.round(this.getCartSubtotal(cart) * 100) / 100;

        if (!cart.couponId || !cart.coupon) {
            return {
                subtotal,
                discountAmount: 0,
                total: subtotal,
                appliedCoupon: null,
            };
        }

        try {
            const { coupon, discountAmount } = await this.couponService.validateForCart(
                cart.coupon.code,
                subtotal,
            );
            const total = Math.round((subtotal - discountAmount) * 100) / 100;
            return {
                subtotal,
                discountAmount,
                total,
                appliedCoupon: {
                    id: coupon.id,
                    code: coupon.code,
                    name: coupon.name,
                    type: coupon.type,
                    discountValue: Number(coupon.discountValue),
                    discountAmount,
                },
            };
        } catch {
            // Coupon no longer valid - clear it from cart
            cart.couponId = null;
            cart.coupon = null;
            await this.cartRepository.save(cart);
            return {
                subtotal,
                discountAmount: 0,
                total: subtotal,
                appliedCoupon: null,
            };
        }
    }

    /**
     * Apply coupon to cart
     */
    async applyCoupon(cartId: string, code: string, userId?: string | null): Promise<Cart> {
        const cart = await this.getCart(cartId, userId);
        const subtotal = this.getCartSubtotal(cart);
        const { coupon } = await this.couponService.validateForCart(code, subtotal);
        cart.couponId = coupon.id;
        cart.coupon = coupon as Coupon;
        await this.cartRepository.save(cart);
        return this.getCart(cartId, userId);
    }

    /**
     * Remove coupon from cart
     */
    async removeCoupon(cartId: string, userId?: string | null): Promise<Cart> {
        const cart = await this.getCart(cartId, userId);
        cart.couponId = null;
        cart.coupon = null;
        await this.cartRepository.save(cart);
        return this.getCart(cartId, userId);
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
        personalization?: { formValues: Record<string, any>; fileIds?: string[] } | null,
        guestId?: string | null,
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

        // Validate and process personalization if provided
        let personalizationSnapshot: any = null;
        let personalizationAmount = 0;

        if (personalization) {
            // Validate personalization data
            await this.personalizationValidator.validate(
                productId,
                variantId,
                personalization.formValues,
                personalization.fileIds,
                userId || null,
                guestId || null,
            );

            // Calculate personalization pricing
            const pricingResult = await this.personalizationPricing.calculate(
                productId,
                personalization.formValues,
            );
            personalizationAmount = pricingResult.totalPersonalizationAmount;

            // Generate snapshot
            personalizationSnapshot = await this.personalizationSnapshot.generate(
                productId,
                personalization.formValues,
            );
        }

        // Calculate price snapshot
        const { basePrice, discountedPrice } = await this.calculatePriceSnapshot(
            product,
            variantId,
        );

        // Add personalization amount to base price
        const finalBasePrice = basePrice + personalizationAmount;
        const finalDiscountedPrice = discountedPrice
            ? discountedPrice + personalizationAmount
            : null;

        // Check if item already exists
        // For personalized items, we need to check both productId/variantId AND personalization
        // If personalization exists, treat as separate item even if productId/variantId match
        const hasPersonalization = personalizationSnapshot !== null && personalizationSnapshot !== undefined;

        let existingItem: CartItem | null = null;

        if (hasPersonalization) {
            // For personalized items, find item with same productId, variantId AND personalization
            // We need to check all items and compare personalization JSON
            const allItems = await this.cartItemRepository.find({
                where: {
                    cartId,
                    productId,
                    variantId: variantId ? variantId : IsNull(),
                },
            });

            // Find item with matching personalization (deep comparison)
            existingItem = allItems.find((item) => {
                if (!item.personalization) return false;
                // Compare personalization snapshots by JSON stringify
                // This compares the entire snapshot structure
                return JSON.stringify(item.personalization) === JSON.stringify(personalizationSnapshot);
            }) || null;
        } else {
            // For non-personalized items, match by productId and variantId only
            // Also ensure existing item has no personalization
            const allItems = await this.cartItemRepository.find({
                where: {
                    cartId,
                    productId,
                    variantId: variantId ? variantId : IsNull(),
                },
            });

            // Find item without personalization
            existingItem = allItems.find((item) =>
                !item.personalization || item.personalization === null
            ) || null;
        }

        if (existingItem) {
            // Update quantity (idempotent) - same product + variant + personalization
            existingItem.quantity = existingItem.quantity + quantity;
            // Update prices to latest snapshot
            existingItem.basePrice = finalBasePrice;
            existingItem.discountedPrice = finalDiscountedPrice;
            // Preserve personalization if it exists
            if (hasPersonalization) {
                existingItem.personalization = personalizationSnapshot;
            }
            return await this.cartItemRepository.save(existingItem);
        }

        // Create new item
        const cartItem = this.cartItemRepository.create({
            cartId,
            productId,
            variantId: variantId || null,
            quantity,
            basePrice: finalBasePrice,
            discountedPrice: finalDiscountedPrice,
            currency: Currency.TRY,
            personalization: personalizationSnapshot,
        });

        return await this.cartItemRepository.save(cartItem);
    }

    /**
     * Update item quantity and/or personalization
     */
    async updateItem(
        cartId: string,
        itemId: string,
        quantity: number,
        userId?: string | null,
        personalization?: { formValues: Record<string, any>; fileIds?: string[] } | null,
        guestId?: string | null,
    ): Promise<CartItem> {
        // Validate cart ownership
        await this.getCart(cartId, userId);

        if (quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        const item = await this.cartItemRepository.findOne({
            where: { id: itemId, cartId },
            relations: ['product'],
        });

        if (!item) {
            throw new NotFoundException('Cart item not found');
        }

        item.quantity = quantity;

        // Update personalization if provided
        if (personalization) {
            // Validate personalization data
            await this.personalizationValidator.validate(
                item.productId,
                item.variantId,
                personalization.formValues,
                personalization.fileIds,
                userId || null,
                guestId || null,
            );

            // Calculate new personalization pricing
            const pricingResult = await this.personalizationPricing.calculate(
                item.productId,
                personalization.formValues,
            );
            const personalizationAmount = pricingResult.totalPersonalizationAmount;

            // Generate new snapshot
            const personalizationSnapshot = await this.personalizationSnapshot.generate(
                item.productId,
                personalization.formValues,
            );

            // Update personalization snapshot
            item.personalization = personalizationSnapshot;

            // Recalculate prices (base price from product + new personalization amount)
            const { basePrice, discountedPrice } = await this.calculatePriceSnapshot(
                item.product,
                item.variantId,
            );

            // Update prices with new personalization amount
            item.basePrice = basePrice + personalizationAmount;
            item.discountedPrice = discountedPrice
                ? discountedPrice + personalizationAmount
                : null;
        }

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
                    'coupon',
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
                    'coupon',
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
                // For personalized items, we need to check both productId/variantId AND personalization
                // If personalization exists, treat as separate item even if productId/variantId match
                const hasPersonalization = guestItem.personalization !== null && guestItem.personalization !== undefined;

                let existingItem: CartItem | undefined;

                if (hasPersonalization) {
                    // For personalized items, check if exact same personalization exists
                    existingItem = userCart.items.find(
                        (item) =>
                            item.productId === guestItem.productId &&
                            item.variantId === guestItem.variantId &&
                            JSON.stringify(item.personalization) === JSON.stringify(guestItem.personalization),
                    );
                } else {
                    // For non-personalized items, match by productId and variantId only
                    existingItem = userCart.items.find(
                        (item) =>
                            item.productId === guestItem.productId &&
                            item.variantId === guestItem.variantId &&
                            (item.personalization === null || item.personalization === undefined),
                    );
                }

                if (existingItem) {
                    // Sum quantities for matching items
                    existingItem.quantity = existingItem.quantity + guestItem.quantity;
                    // Use latest price snapshot
                    existingItem.basePrice = guestItem.basePrice;
                    existingItem.discountedPrice = guestItem.discountedPrice;
                    // Preserve personalization if it exists
                    if (hasPersonalization) {
                        existingItem.personalization = guestItem.personalization;
                    }
                    await manager.save(CartItem, existingItem);
                } else {
                    // Create new item in user cart (including personalization)
                    const newItem = manager.create(CartItem, {
                        cartId: userCart.id,
                        productId: guestItem.productId,
                        variantId: guestItem.variantId,
                        quantity: guestItem.quantity,
                        basePrice: guestItem.basePrice,
                        discountedPrice: guestItem.discountedPrice,
                        currency: guestItem.currency,
                        personalization: guestItem.personalization, // Copy personalization data
                    });
                    await manager.save(CartItem, newItem);
                }
            }

            // Guest sepetinde kupon varsa, birleşen sepete uygula (geçerliyse)
            if (guestCart.couponId && guestCart.coupon) {
                const mergedUserCart = await manager.findOne(Cart, {
                    where: { id: userCart.id },
                    relations: [
                        'items',
                        'coupon',
                    ],
                });
                if (mergedUserCart) {
                    const mergedSubtotal = this.getCartSubtotal(mergedUserCart);
                    try {
                        await this.couponService.validateForCart(guestCart.coupon.code, mergedSubtotal);
                        mergedUserCart.couponId = guestCart.couponId;
                        mergedUserCart.coupon = guestCart.coupon as Coupon;
                        await manager.save(Cart, mergedUserCart);
                    } catch {
                        // Kupon birleşen sepet için geçersizse uygulama (sessizce atla)
                    }
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
                    'coupon',
                ],
            });

            if (!finalCart) {
                throw new NotFoundException('User cart not found after merge');
            }

            return finalCart;
        });
    }

    /**
     * Clear cart items and mark as ORDERED (used after successful payment)
     */
    async clearCart(cartId: string): Promise<void> {
        const cart = await this.cartRepository.findOne({
            where: { id: cartId },
            relations: ['items'],
        });

        if (!cart) {
            return; // Cart not found, nothing to clear
        }

        // Mark cart as ORDERED first (payment was successful)
        cart.status = CartStatus.ORDERED;
        await this.cartRepository.save(cart);

        // Delete all cart items
        if (cart.items && cart.items.length > 0) {
            await this.cartItemRepository.remove(cart.items);
        }

        // Cart is now ORDERED and empty
    }

    /**
     * Reactivate cart (used when payment fails)
     * Changes cart status from ORDERED back to ACTIVE
     */
    async reactivateCart(cartId: string): Promise<Cart> {
        const cart = await this.cartRepository.findOne({
            where: { id: cartId },
        });

        if (!cart) {
            throw new NotFoundException('Cart not found');
        }

        cart.status = CartStatus.ACTIVE;
        return await this.cartRepository.save(cart);
    }
}
