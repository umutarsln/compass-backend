import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Favorite } from './favorite.entity';
import { Product } from '../product/product.entity';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private favoriteRepository: Repository<Favorite>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  /**
   * Get user favorites
   */
  async getFavorites(userId: string): Promise<Favorite[]> {
    return await this.favoriteRepository.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Add favorite
   */
  async addFavorite(userId: string, productId: string): Promise<Favorite> {
    // Validate product exists
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already favorited
    const existing = await this.favoriteRepository.findOne({
      where: { userId, productId },
    });

    if (existing) {
      return existing; // Idempotent - return existing if already favorited
    }

    // Create favorite
    const favorite = this.favoriteRepository.create({
      userId,
      productId,
    });

    return await this.favoriteRepository.save(favorite);
  }

  /**
   * Remove favorite
   */
  async removeFavorite(userId: string, productId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { userId, productId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }

    await this.favoriteRepository.remove(favorite);
  }

  /**
   * Sync favorites (bulk upsert for login sync)
   */
  async syncFavorites(
    userId: string,
    productIds: string[],
  ): Promise<Favorite[]> {
    if (productIds.length === 0) {
      return [];
    }

    // Validate all products exist
    const products = await this.productRepository.find({
      where: { id: In(productIds) },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('Some products not found');
    }

    // Get existing favorites
    const existingFavorites = await this.favoriteRepository.find({
      where: { userId, productId: In(productIds) },
    });

    const existingProductIds = new Set(
      existingFavorites.map((f) => f.productId),
    );

    // Create new favorites for products not already favorited
    const newProductIds = productIds.filter(
      (id) => !existingProductIds.has(id),
    );

    if (newProductIds.length > 0) {
      const newFavorites = newProductIds.map((productId) =>
        this.favoriteRepository.create({
          userId,
          productId,
        }),
      );

      await this.favoriteRepository.save(newFavorites);
    }

    // Return all favorites (existing + new)
    return await this.favoriteRepository.find({
      where: { userId, productId: In(productIds) },
      relations: ['product'],
    });
  }
}
