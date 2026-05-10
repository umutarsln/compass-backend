import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('payment_settings')
export class PaymentSettings {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Iyzico Settings
    @Column({ type: 'varchar', nullable: true })
    iyzicoApiKey: string | null;

    @Column({ type: 'varchar', nullable: true })
    iyzicoSecretKey: string | null;

    @Column({ type: 'varchar', nullable: true })
    iyzicoBaseUrl: string | null; // https://api.iyzipay.com veya https://sandbox-api.iyzipay.com

    @Column({ type: 'boolean', default: false })
    iyzicoEnabled: boolean;

    // IBAN EFT/Havale Settings
    @Column({ type: 'varchar', nullable: true })
    ibanNumber: string | null;

    @Column({ type: 'varchar', nullable: true })
    accountName: string | null;

    @Column({ type: 'varchar', nullable: true })
    bankName: string | null;

    @Column({ type: 'varchar', nullable: true })
    whatsappNumber: string | null; // WhatsApp numarası (dekont göndermek için)

    @Column({ type: 'boolean', default: false })
    ibanEftEnabled: boolean;

    // QNBpay
    @Column({ type: 'varchar', nullable: true })
    qnbpayAppId: string | null;

    @Column({ type: 'varchar', nullable: true })
    qnbpayAppSecret: string | null;

    @Column({ type: 'varchar', nullable: true })
    qnbpayMerchantKey: string | null;

    @Column({ type: 'varchar', nullable: true })
    qnbpayMerchantId: string | null;

    @Column({ type: 'varchar', nullable: true })
    qnbpayBaseUrl: string | null;

    @Column({ type: 'boolean', default: false })
    qnbpayEnabled: boolean;

    /** hosted_link | pay_smart_3d */
    @Column({ type: 'varchar', nullable: true, default: 'hosted_link' })
    qnbpayCheckoutMode: string | null;

    @Column({ type: 'varchar', nullable: true })
    qnbpaySaleWebhookKey: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
