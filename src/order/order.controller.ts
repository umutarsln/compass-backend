import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    ForbiddenException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { OrderStatus } from '../common/enums/order-status.enum';

@Controller('orders')
export class OrderController {
    constructor(private readonly orderService: OrderService) { }

    /**
     * Create order from cart (guest or authenticated)
     */
    @Post()
    async createOrder(
        @Body() createOrderDto: CreateOrderDto,
        @Request() req: any,
    ): Promise<OrderResponseDto> {
        const userId = req.user?.userId || req.user?.id || null;
        return this.orderService.createOrder(createOrderDto, userId);
    }

    /**
     * Get order by ID or order number
     * Public endpoint - allows guest users to access their orders
     */
    @Get(':id')
    async getOrder(
        @Param('id') id: string,
        @Request() req: any,
    ): Promise<OrderResponseDto> {
        const userId = req.user?.userId || req.user?.id || null;

        // Check if id is 8 digits (orderNo) or UUID (orderId)
        const isOrderNo = /^\d{8}$/.test(id);

        if (isOrderNo) {
            return this.orderService.getOrderByOrderNo(id, userId);
        } else {
            // For UUID, allow both authenticated and guest access
            return this.orderService.getOrder(id, userId);
        }
    }

    /**
     * Get user's orders
     */
    @Get('me/orders')
    @UseGuards(JwtAuthGuard)
    async getUserOrders(@Request() req: any): Promise<OrderResponseDto[]> {
        const userId = req.user?.userId || req.user?.id;
        return this.orderService.getUserOrders(userId);
    }

    /**
     * Get all orders (admin only)
     */
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAllOrders(
        @Query('status') status?: OrderStatus,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<{ orders: OrderResponseDto[]; total: number }> {
        return this.orderService.getAllOrders(
            status,
            limit ? parseInt(limit, 10) : 50,
            offset ? parseInt(offset, 10) : 0,
        );
    }

    /**
     * Update order status (admin only)
     */
    @Patch(':id/status')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateOrderStatus(
        @Param('id') orderId: string,
        @Body() updateDto: UpdateOrderStatusDto,
    ): Promise<OrderResponseDto> {
        return this.orderService.updateOrderStatus(orderId, updateDto);
    }
}
