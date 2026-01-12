import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Stock } from './stock.entity';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { SellableType } from '../common/enums/sellable-type.enum';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(Stock)
    private stockRepository: Repository<Stock>,
  ) {}

  /**
   * Stock kaydını bulur veya oluşturur
   */
  async findOrCreate(
    sellableType: SellableType,
    sellableId: string,
  ): Promise<Stock> {
    let stock = await this.stockRepository.findOne({
      where: { sellableType, sellableId },
      relations: ['product', 'variantCombination'],
    });

    if (!stock) {
      // Product veya VariantCombination relation'ını set et
      let productId: string | null = null;
      let variantCombinationId: string | null = null;

      if (sellableType === SellableType.PRODUCT) {
        productId = sellableId;
      } else if (sellableType === SellableType.VARIANT_COMBINATION) {
        variantCombinationId = sellableId;
      }

      stock = this.stockRepository.create({
        sellableType,
        sellableId,
        productId,
        variantCombinationId,
        availableQuantity: 0,
        reservedQuantity: 0,
      });
      stock = await this.stockRepository.save(stock);
    }

    return stock;
  }

  async findOne(
    sellableType: SellableType,
    sellableId: string,
  ): Promise<Stock> {
    const stock = await this.stockRepository.findOne({
      where: { sellableType, sellableId },
    });

    if (!stock) {
      throw new NotFoundException('Stok kaydı bulunamadı');
    }

    return stock;
  }

  async update(
    sellableType: SellableType,
    sellableId: string,
    updateStockDto: UpdateStockDto,
  ): Promise<Stock> {
    const stock = await this.findOrCreate(sellableType, sellableId);

    stock.availableQuantity = updateStockDto.availableQuantity;
    if (updateStockDto.lowStockThreshold !== undefined) {
      stock.lowStockThreshold = updateStockDto.lowStockThreshold;
    }

    return await this.stockRepository.save(stock);
  }

  async reserve(reserveStockDto: ReserveStockDto): Promise<Stock> {
    const stock = await this.findOrCreate(
      reserveStockDto.sellableType,
      reserveStockDto.sellableId,
    );

    const availableAfterReserve =
      stock.availableQuantity - stock.reservedQuantity;

    if (availableAfterReserve < reserveStockDto.quantity) {
      throw new BadRequestException(
        `Yetersiz stok. Mevcut: ${availableAfterReserve}, İstenen: ${reserveStockDto.quantity}`,
      );
    }

    stock.reservedQuantity += reserveStockDto.quantity;

    return await this.stockRepository.save(stock);
  }

  async release(releaseStockDto: ReleaseStockDto): Promise<Stock> {
    const stock = await this.findOne(
      releaseStockDto.sellableType,
      releaseStockDto.sellableId,
    );

    if (stock.reservedQuantity < releaseStockDto.quantity) {
      throw new BadRequestException(
        `Rezerve edilmiş stok yetersiz. Rezerve: ${stock.reservedQuantity}, İstenen: ${releaseStockDto.quantity}`,
      );
    }

    stock.reservedQuantity -= releaseStockDto.quantity;

    return await this.stockRepository.save(stock);
  }

  /**
   * Rezerve edilmiş stoku satışa çevirir (reservedQuantity'yi azaltır, availableQuantity'yi azaltır)
   */
  async commit(
    sellableType: SellableType,
    sellableId: string,
    quantity: number,
  ): Promise<Stock> {
    const stock = await this.findOne(sellableType, sellableId);

    if (stock.reservedQuantity < quantity) {
      throw new BadRequestException(
        `Rezerve edilmiş stok yetersiz. Rezerve: ${stock.reservedQuantity}, İstenen: ${quantity}`,
      );
    }

    stock.reservedQuantity -= quantity;
    stock.availableQuantity -= quantity;

    return await this.stockRepository.save(stock);
  }

  /**
   * Stok miktarını artırır
   */
  async increase(
    sellableType: SellableType,
    sellableId: string,
    quantity: number,
  ): Promise<Stock> {
    const stock = await this.findOrCreate(sellableType, sellableId);

    stock.availableQuantity += quantity;

    return await this.stockRepository.save(stock);
  }

  /**
   * Stok miktarını azaltır (rezerve olmadan)
   */
  async decrease(
    sellableType: SellableType,
    sellableId: string,
    quantity: number,
  ): Promise<Stock> {
    const stock = await this.findOrCreate(sellableType, sellableId);

    if (stock.availableQuantity < quantity) {
      throw new BadRequestException(
        `Yetersiz stok. Mevcut: ${stock.availableQuantity}, İstenen: ${quantity}`,
      );
    }

    stock.availableQuantity -= quantity;

    return await this.stockRepository.save(stock);
  }
}
