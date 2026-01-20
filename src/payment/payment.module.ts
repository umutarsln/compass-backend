import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { IyzicoProvider } from './providers/iyzico/iyzico.provider';
import { OrderModule } from '../order/order.module';
import { Order } from '../order/order.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([PaymentAttempt, Order]),
        OrderModule,
    ],
    controllers: [PaymentController],
    providers: [PaymentService, IyzicoProvider],
    exports: [PaymentService],
})
export class PaymentModule { }
