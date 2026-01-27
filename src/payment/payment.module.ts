import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAttempt } from './payment-attempt.entity';
import { PaymentSettings } from './payment-settings.entity';
import { PaymentService } from './payment.service';
import { PaymentSettingsService } from './payment-settings.service';
import { PaymentController } from './payment.controller';
import { PaymentSettingsController } from './payment-settings.controller';
import { IyzicoProvider } from './providers/iyzico/iyzico.provider';
import { IbanEftProvider } from './providers/iban-eft/iban-eft.provider';
import { OrderModule } from '../order/order.module';
import { Order } from '../order/order.entity';
import { CartModule } from '../cart/cart.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PaymentAttempt, PaymentSettings, Order]),
        OrderModule,
        CartModule,
        MailModule,
    ],
    controllers: [PaymentController, PaymentSettingsController],
    providers: [PaymentService, PaymentSettingsService, IyzicoProvider, IbanEftProvider],
    exports: [PaymentService, PaymentSettingsService],
})
export class PaymentModule { }
