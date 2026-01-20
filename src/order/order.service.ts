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

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private cartService: CartService,
    private dataSource: DataSource,
  ) {}

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

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      const price = item.discountedPrice || item.basePrice;
      return sum + Number(price) * item.quantity;
    }, 0);

    const shippingCost = createOrderDto.shippingCost || 0;
    const discount = createOrderDto.discount || 0;
    const total = subtotal + shippingCost - discount;

    if (total <= 0) {
      throw new BadRequestException('Order total must be greater than 0');
    }

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
        const unitPrice = Number(cartItem.discountedPrice || cartItem.basePrice);
        const totalPrice = unitPrice * cartItem.quantity;

        return queryRunner.manager.create(OrderItem, {
          orderId: savedOrder.id,
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          productName: cartItem.product.name,
          quantity: cartItem.quantity,
          unitPrice,
          discountedPrice: cartItem.discountedPrice ? Number(cartItem.discountedPrice) : null,
          totalPrice,
          currency: cartItem.currency,
        });
      });

      await queryRunner.manager.save(OrderItem, orderItems);

      // Update cart status to ORDERED
      cart.status = CartStatus.ORDERED;
      await queryRunner.manager.save(Cart, cart);

      await queryRunner.commitTransaction();

      // Load order with items
      const orderWithItems = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items', 'items.product', 'items.variant'],
      });

      return this.mapToResponseDto(orderWithItems!);
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
    const relations = ['items', 'items.product', 'items.variant'];
    if (includeUser) {
      relations.push('user');
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check access: user can only see their own orders, or admin can see all
    if (userId && order.userId && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.mapToResponseDto(order);
  }

  /**
   * Get order by order number
   */
  async getOrderByOrderNo(orderNo: string, userId?: string | null): Promise<OrderResponseDto> {
    this.logger.log(`[getOrderByOrderNo] Searching for order with orderNo: ${orderNo}`);

    const order = await this.orderRepository.findOne({
      where: { orderNo },
      relations: ['items', 'items.product', 'items.variant'],
    });

    if (!order) {
      this.logger.warn(`[getOrderByOrderNo] Order not found with orderNo: ${orderNo}`);
      throw new NotFoundException('Order not found');
    }

    // Check access: user can only see their own orders, or admin can see all
    // For guest orders, allow access if email matches
    if (userId && order.userId && order.userId !== userId) {
      this.logger.warn(`[getOrderByOrderNo] Access denied for orderNo: ${orderNo}, userId: ${userId}`);
      throw new ForbiddenException('You do not have access to this order');
    }

    this.logger.log(`[getOrderByOrderNo] Order found: ${order.id}, orderNo: ${order.orderNo}`);
    return this.mapToResponseDto(order);
  }

  /**
   * Get user's orders
   */
  async getUserOrders(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.variant'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.mapToResponseDto(order));
  }

  /**
   * Get all orders (admin only)
   */
  async getAllOrders(
    status?: OrderStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ orders: OrderResponseDto[]; total: number }> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      relations: ['items', 'items.product', 'items.variant', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      orders: orders.map((order) => this.mapToResponseDto(order)),
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

    return this.mapToResponseDto(updatedOrder);
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
  private mapToResponseDto(order: Order): OrderResponseDto {
    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
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
      items: order.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountedPrice: item.discountedPrice ? Number(item.discountedPrice) : null,
        totalPrice: Number(item.totalPrice),
        currency: item.currency,
        createdAt: item.createdAt,
      })) || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
