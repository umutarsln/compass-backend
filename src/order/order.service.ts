import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { CartService } from '../cart/cart.service';
import { CartStatus } from '../common/enums/cart-status.enum';
import { OrderStatus } from '../common/enums/order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto, OrderItemResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { FolderService } from '../folder/folder.service';
import { UploadService } from '../upload/upload.service';
import { UserService } from '../user/user.service';
import { S3Service } from '../upload/s3/s3.service';
import { Upload } from '../upload/upload.entity';
import { PaymentAttempt } from '../payment/payment-attempt.entity';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentProvider } from '../common/enums/payment-provider.enum';
import { CouponService } from '../coupon/coupon.service';
import { addVat } from '../common/vat';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    @InjectRepository(PaymentAttempt)
    private paymentAttemptRepository: Repository<PaymentAttempt>,
    private cartService: CartService,
    private couponService: CouponService,
    private dataSource: DataSource,
    private folderService: FolderService,
    private uploadService: UploadService,
    private userService: UserService,
    private s3Service: S3Service,
  ) { }

  /**
   * Generate unique 8-digit order number
   */
  private async generateOrderNo(): Promise<string> {
    let orderNo: string;
    let exists: boolean;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Generate 8-digit number (00000000-99999999)
      const randomNum = Math.floor(Math.random() * 100000000);
      orderNo = randomNum.toString().padStart(8, '0');

      // Check if it already exists
      exists = await this.orderRepository.exists({ where: { orderNo } });
      attempts++;

      if (attempts >= maxAttempts) {
        this.logger.error(`[generateOrderNo] Failed to generate unique orderNo after ${maxAttempts} attempts`);
        throw new BadRequestException('Failed to generate unique order number. Please try again.');
      }
    } while (exists);

    this.logger.debug(`[generateOrderNo] Generated unique orderNo: ${orderNo} (attempts: ${attempts})`);
    return orderNo;
  }

  /**
   * Create order from cart
   */
  async createOrder(
    createOrderDto: CreateOrderDto,
    userId?: string | null,
  ): Promise<OrderResponseDto> {
    // Get cart with items
    const cart = await this.cartService.getCart(createOrderDto.cartId, userId);

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    if (cart.status !== CartStatus.ACTIVE) {
      throw new BadRequestException('Cart is not active');
    }

    // Validate guest checkout
    if (!userId) {
      if (!createOrderDto.guestEmail || !createOrderDto.guestPhone) {
        throw new BadRequestException('Guest email and phone are required for guest checkout');
      }
    }

    // Ara toplam (ürün fiyatları KDV hariç; sipariş kaydında KDV dahil tutulur)
    const subtotalExVat = Math.round(
      cart.items.reduce((sum, item) => {
        const price = item.discountedPrice || item.basePrice;
        return sum + Number(price) * item.quantity;
      }, 0) * 100,
    ) / 100;

    // Validate and resolve coupon discount (backend always re-validates)
    let discountExVat = 0;
    let orderCouponId: string | null = null;
    if (cart.couponId && cart.coupon) {
      try {
        const result = await this.couponService.validateForCart(cart.coupon.code, subtotalExVat);
        discountExVat = result.discountAmount;
        orderCouponId = result.coupon.id;
      } catch {
        throw new BadRequestException('Kupon artık geçerli değil. Lütfen kuponu kaldırıp tekrar deneyin.');
      }
    }

    const shippingCost = createOrderDto.shippingCost || 0;
    const netExVat = Math.round((subtotalExVat + shippingCost - discountExVat) * 100) / 100;
    const total = netExVat <= 0 ? 0 : addVat(netExVat);
    const subtotal = addVat(subtotalExVat);
    const discount = addVat(discountExVat);

    // Create order in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique order number
      const orderNo = await this.generateOrderNo();
      this.logger.log(`[createOrder] Generated orderNo: ${orderNo} for order`);

      // Create order
      const order = queryRunner.manager.create(Order, {
        orderNo,
        userId: userId || null,
        cartId: cart.id,
        couponId: orderCouponId,
        guestEmail: createOrderDto.guestEmail || null,
        guestPhone: createOrderDto.guestPhone || null,
        guestFirstName: createOrderDto.guestFirstName || null,
        guestLastName: createOrderDto.guestLastName || null,
        status: OrderStatus.PENDING,
        subtotal,
        shippingCost,
        discount,
        total,
        currency: cart.items[0]?.currency || 'TRY',
        shippingAddress: createOrderDto.shippingAddress,
        billingAddress: createOrderDto.billingAddress || createOrderDto.shippingAddress,
        notes: createOrderDto.notes || null,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);

      // Create order items
      const orderItems = cart.items.map((cartItem) => {
        const unitPriceExVat = Number(cartItem.discountedPrice || cartItem.basePrice);
        const unitPrice = addVat(unitPriceExVat);
        const totalPrice =
          Math.round(unitPrice * cartItem.quantity * 100) / 100;

        return queryRunner.manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          productName: cartItem.product.name,
          quantity: cartItem.quantity,
          unitPrice,
          discountedPrice: cartItem.discountedPrice
            ? addVat(Number(cartItem.discountedPrice))
            : null,
          totalPrice,
          currency: cartItem.currency,
          personalization: cartItem.personalization || null, // Copy snapshot from cart
        });
      });

      await queryRunner.manager.save(OrderItem, orderItems);

      // Don't update cart status to ORDERED here - wait for payment success
      // Cart will be marked as ORDERED only after successful payment
      // This allows the cart to be reused if payment fails

      await queryRunner.commitTransaction();

      // Move personalization files from Sepetler/{cartId} to Siparişler/{orderNo}
      try {
        await this.movePersonalizationFilesToOrderFolder(cart.items, orderNo);
      } catch (error) {
        // Log error but don't fail the order creation
        this.logger.error(
          `[createOrder] Failed to move personalization files for order ${orderNo}:`,
          error,
        );
      }

      // Load order with items
      const orderWithItems = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.variant'],
      });

      return await this.mapToResponseDto(orderWithItems!);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, userId?: string | null, includeUser: boolean = false): Promise<OrderResponseDto> {
    const relations = [
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
      'user', // Kayıtlı kullanıcı siparişlerinde isim/email için
    ];

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access:
    // - Guest orders (order.userId is null) are publicly accessible
    // - Authenticated orders: only the owner can access, unless userId matches
    if (order.userId && userId && order.userId !== userId) {
      this.logger.warn(`[getOrder] Access denied for order ${orderId}: userId ${userId} does not match order.userId ${order.userId}`);
      throw new ForbiddenException('You do not have access to this order');
    }

    // Guest orders are accessible without authentication
    this.logger.debug(`[getOrder] Order ${orderId} accessed - isGuest: ${!order.userId}, requestUserId: ${userId || 'guest'}`);
    return await this.mapToResponseDto(order);
  }

  /**
   * Get order by order number
   */
  async getOrderByOrderNo(orderNo: string, userId?: string | null): Promise<OrderResponseDto> {
    this.logger.log(`[getOrderByOrderNo] Searching for order with orderNo: ${orderNo}`);

    const order = await this.orderRepository.findOne({
      where: { orderNo },
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
        'user',
      ],
    });

    if (!order) {
      this.logger.warn(`[getOrderByOrderNo] Order not found with orderNo: ${orderNo}`);
      throw new NotFoundException('Order not found');
    }

    // Check access:
    // - Guest orders (order.userId is null) are publicly accessible
    // - Authenticated orders: only the owner can access, unless userId matches
    if (order.userId && userId && order.userId !== userId) {
      this.logger.warn(`[getOrderByOrderNo] Access denied for orderNo: ${orderNo}, userId: ${userId} does not match order.userId: ${order.userId}`);
      throw new ForbiddenException('You do not have access to this order');
    }

    // Guest orders are accessible without authentication
    this.logger.debug(`[getOrderByOrderNo] Order ${order.orderNo} accessed - isGuest: ${!order.userId}, requestUserId: ${userId || 'guest'}`);

    this.logger.log(`[getOrderByOrderNo] Order found: ${order.id}, orderNo: ${order.orderNo}`);
    return await this.mapToResponseDto(order);
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: [
        'items',
        'items.product',
        'items.variant',
        'items.variant.variantValues',
        'items.variant.variantValues.variantOption',
        'user',
      ],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(orders.map((order) => this.mapToResponseDto(order)));
  }

  /**
   * Get all orders (admin only)
   */
  async getAllOrders(
    status?: OrderStatus,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ orders: OrderResponseDto[]; total: number }> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('items.variant', 'variant')
      .leftJoinAndSelect('order.user', 'user')
      .andWhere('order.deletedAt IS NULL');

    // Status filter
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    // Search filter - müşteri bilgileriyle arama
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        '(order.orderNo ILIKE :search OR ' +
        'order.guestEmail ILIKE :search OR ' +
        'order.guestPhone ILIKE :search OR ' +
        'order.guestFirstName ILIKE :search OR ' +
        'order.guestLastName ILIKE :search OR ' +
        'user.email ILIKE :search OR ' +
        'user.phone ILIKE :search OR ' +
        'user.firstname ILIKE :search OR ' +
        'user.lastname ILIKE :search OR ' +
        'CAST(order.shippingAddress AS TEXT) ILIKE :search OR ' +
        'CAST(order.billingAddress AS TEXT) ILIKE :search)',
        { search: searchTerm },
      );
    }

    // Sorting
    const validSortFields: Record<string, string> = {
      createdAt: 'order.createdAt',
      updatedAt: 'order.updatedAt',
      total: 'order.total',
      status: 'order.status',
      orderNo: 'order.orderNo',
    };

    const sortField = sortBy && validSortFields[sortBy] ? validSortFields[sortBy] : 'order.createdAt';
    queryBuilder.orderBy(sortField, sortOrder);

    // Pagination
    queryBuilder.take(limit).skip(offset);

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      orders: await Promise.all(orders.map((order) => this.mapToResponseDto(order))),
      total,
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    updateDto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'items.variant'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = updateDto.status;
    const updatedOrder = await this.orderRepository.save(order);

    return await this.mapToResponseDto(updatedOrder);
  }

  /**
   * Admin görünümünden siparişi kaldırmak için siparişi soft delete olarak işaretler.
   */
  async softDeleteOrder(orderId: string): Promise<{ message: string }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.orderRepository.softDelete(orderId);
    return { message: 'Sipariş görünümden kaldırıldı' };
  }

  /**
   * Mark order as paid
   */
  async markOrderAsPaid(
    orderId: string,
    providerPaymentId: string,
    attemptId: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is already ${order.status}, cannot mark as paid`);
    }

    order.status = OrderStatus.PAID;
    await this.orderRepository.save(order);

    return order;
  }

  /**
   * Map order entity to response DTO
   */
  private async mapToResponseDto(order: Order): Promise<OrderResponseDto> {
    // Get payment provider from the most recent successful payment attempt
    let paymentProvider: PaymentProvider | null = null;
    let paymentAttemptId: string | null = null;
    let paymentProviderOrderRef: string | null = null;
    try {
      const paymentAttempt = await this.paymentAttemptRepository.findOne({
        where: {
          orderId: order.id,
          status: PaymentStatus.SUCCESS,
        },
        order: { createdAt: 'DESC' },
      });
      if (paymentAttempt) {
        paymentProvider = paymentAttempt.provider;
        paymentAttemptId = paymentAttempt.id;
        paymentProviderOrderRef = paymentAttempt.providerPaymentId;
      }
    } catch (error) {
      this.logger.warn(`[mapToResponseDto] Failed to get payment provider for order ${order.id}: ${error}`);
    }

    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      user: order.user
        ? {
          email: order.user.email,
          firstname: order.user.firstname,
          lastname: order.user.lastname,
          phone: order.user.phone ?? null,
        }
        : undefined,
      cartId: order.cartId,
      guestEmail: order.guestEmail,
      guestPhone: order.guestPhone,
      guestFirstName: order.guestFirstName,
      guestLastName: order.guestLastName,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discount: Number(order.discount),
      total: Number(order.total),
      currency: order.currency,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      notes: order.notes,
      paymentProvider,
      paymentAttemptId,
      paymentProviderOrderRef,
      items: await Promise.all(
        (order.items || []).map(async (item) => {
          const itemDto: any = {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
            totalPrice: Number(item.totalPrice),
            currency: item.currency,
            personalization: item.personalization
              ? await this.enrichPersonalizationWithUrls(item.personalization)
              : null,
            createdAt: item.createdAt,
          };

          // Product bilgilerini ekle (slug ve gallery)
          if (item.product) {
            itemDto.product = {
              id: item.product.id,
              slug: item.product.slug,
              galleries: item.product.galleries?.map((gallery) => ({
                mainImage: gallery.mainImage ? {
                  id: gallery.mainImage.id,
                  s3Url: gallery.mainImage.s3Url,
                  filename: gallery.mainImage.filename,
                  displayName: gallery.mainImage.displayName,
                } : null,
                thumbnailImage: gallery.thumbnailImage ? {
                  id: gallery.thumbnailImage.id,
                  s3Url: gallery.thumbnailImage.s3Url,
                  filename: gallery.thumbnailImage.filename,
                  displayName: gallery.thumbnailImage.displayName,
                } : null,
              })) || [],
            };
          }

          // Variant bilgilerini ekle (gallery + seçilen varyasyon değerleri)
          if (item.variant) {
            itemDto.variant = {
              id: item.variant.id,
              galleries: item.variant.galleries?.map((gallery) => ({
                mainImage: gallery.mainImage ? {
                  id: gallery.mainImage.id,
                  s3Url: gallery.mainImage.s3Url,
                  filename: gallery.mainImage.filename,
                  displayName: gallery.mainImage.displayName,
                } : null,
                thumbnailImage: gallery.thumbnailImage ? {
                  id: gallery.thumbnailImage.id,
                  s3Url: gallery.thumbnailImage.s3Url,
                  filename: gallery.thumbnailImage.filename,
                  displayName: gallery.thumbnailImage.displayName,
                } : null,
              })) || [],
              variantValues:
                item.variant.variantValues?.map((vv) => ({
                  id: vv.id,
                  value: vv.value,
                  colorCode: vv.colorCode ?? null,
                  variantOption: vv.variantOption
                    ? {
                      id: vv.variantOption.id,
                      name: vv.variantOption.name,
                      type: vv.variantOption.type,
                    }
                    : null,
                })) || [],
            };
          }

          return itemDto;
        }),
      ),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Kişiselleştirme snapshot'taki dosya ID'lerini S3 URL'leriyle zenginleştirir (sipariş detayında fotoğraf göstermek için).
   */
  private async enrichPersonalizationWithUrls(personalization: any): Promise<any> {
    if (!personalization) return personalization;
    // TypeORM jsonb bazen string dönebiliyor
    const parsed =
      typeof personalization === 'string'
        ? (() => {
          try {
            return JSON.parse(personalization) as any;
          } catch {
            return personalization;
          }
        })()
        : personalization;
    if (!parsed.userValues || typeof parsed.userValues !== 'object') return parsed;

    const userValues = parsed.userValues as Record<string, unknown>;
    const enrichedUserValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(userValues)) {
      enrichedUserValues[key] = await this.resolvePersonalizationValue(value);
    }

    return { ...parsed, userValues: enrichedUserValues };
  }

  private async resolvePersonalizationValue(value: unknown): Promise<unknown> {
    if (value == null) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (OrderService.UUID_REGEX.test(trimmed)) {
        const upload = await this.uploadRepository.findOne({ where: { id: trimmed } });
        if (upload?.s3Url) {
          return { id: trimmed, url: upload.s3Url };
        }
        this.logger.warn(`[enrichPersonalizationWithUrls] Upload not found for id: ${trimmed}`);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((v) => this.resolvePersonalizationValue(v)));
    }
    return value;
  }

  /**
   * Move personalization files from Sepetler/{cartId} to Siparişler/{orderNo}
   */
  private async movePersonalizationFilesToOrderFolder(
    cartItems: any[],
    orderNo: string,
  ): Promise<void> {
    // Collect all file IDs from cart items' personalization
    const fileIds = new Set<string>();

    for (const item of cartItems) {
      if (item.personalization?.userValues) {
        const userValues = item.personalization.userValues;
        // Extract file IDs from userValues (they can be strings or arrays)
        Object.values(userValues).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach((id) => {
              if (typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                fileIds.add(id);
              }
            });
          } else if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            fileIds.add(value);
          }
        });
      }
    }

    if (fileIds.size === 0) {
      this.logger.log(`[movePersonalizationFilesToOrderFolder] No files to move for order ${orderNo}`);
      return;
    }

    this.logger.log(
      `[movePersonalizationFilesToOrderFolder] Moving ${fileIds.size} files to Siparişler/${orderNo}`,
    );

    // Get system user ID for folder creation
    const admins = await this.userService.findAllAdmins();
    const systemUserId = admins.length > 0 ? admins[0].id : null;
    if (!systemUserId) {
      this.logger.warn('[movePersonalizationFilesToOrderFolder] No admin user found, skipping file move');
      return;
    }

    // Create or find "Siparişler" folder
    const siparislerFolder = await this.folderService.findOrCreateFolder(
      null,
      'Siparişler',
      systemUserId,
    );

    // Create or find "Siparişler/{orderNo}" folder
    const orderFolder = await this.folderService.findOrCreateFolder(
      'Siparişler',
      orderNo,
      systemUserId,
    );

    // Move each file
    for (const fileId of fileIds) {
      try {
        const upload = await this.uploadService.findOne(fileId);
        const oldS3Key = upload.s3Key;

        // Extract filename from old S3 key
        const filename = oldS3Key.split('/').pop() || upload.filename;
        const newS3Key = `${orderFolder.s3Prefix}${filename}`;

        // Move file in S3
        const newS3Url = await this.s3Service.moveFile(oldS3Key, newS3Key);

        // Update upload entity
        upload.s3Key = newS3Key;
        upload.s3Url = newS3Url;
        upload.folderId = orderFolder.id;
        await this.uploadRepository.save(upload);

        this.logger.log(
          `[movePersonalizationFilesToOrderFolder] Moved file ${fileId} to ${newS3Key}`,
        );
      } catch (error) {
        this.logger.error(
          `[movePersonalizationFilesToOrderFolder] Failed to move file ${fileId}:`,
          error,
        );
        // Continue with other files even if one fails
      }
    }

    this.logger.log(
      `[movePersonalizationFilesToOrderFolder] Successfully moved files for order ${orderNo}`,
    );
  }
}
