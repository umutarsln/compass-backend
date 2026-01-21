import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { IyzicoProvider } from './providers/iyzico/iyzico.provider';
import { OrderModule } from '../order/order.module';
import { Order } from '../order/order.entity';
import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PaymentAttempt, Order]),
        OrderModule,
        CartModule,
        MailModule,
    ],
    controllers: [PaymentController],
    providers: [PaymentService, IyzicoProvider],
    exports: [PaymentService],
})
export class PaymentModule { }
