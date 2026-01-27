import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { CartModule } from '../cart/cart.module';
import { Cart } from '../cart/cart.entity';
import { FolderModule } from '../folder/folder.module';
import { UploadModule } from '../upload/upload.module';
import { UserModule } from '../user/user.module';
import { Upload } from '../upload/upload.entity';
import { PaymentAttempt } from '../payment/payment-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Cart, Upload, PaymentAttempt]),
    CartModule,
    FolderModule,
    UploadModule,
    UserModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
