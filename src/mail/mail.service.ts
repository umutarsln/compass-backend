import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { Order } from '../order/order.entity';
import { generateOrderSuccessEmailHtml } from './templates/order-success.template';
import { generateOrderFailedEmailHtml } from './templates/order-failed.template';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface OrderItemWithImage {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountedPrice: number | null;
  totalPrice: number;
  currency: string;
  image: {
    url: string;
    alt: string;
  } | null;
  variantValues?: Array<{
    value: string;
    variantOption: {
      name: string;
      type: 'COLOR' | 'TEXT';
    } | null;
    colorCode: string | null;
  }>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Send email
   * @param options Email options
   * @returns Promise<void>
   */
  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      this.logger.log(`[sendMail] Sending email to: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
      this.logger.debug(`[sendMail] Subject: ${options.subject}`);

      await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
      });

      this.logger.log(`[sendMail] Email sent successfully to: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    } catch (error) {
      this.logger.error(`[sendMail] Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send plain text email
   * @param to Recipient email(s)
   * @param subject Email subject
   * @param text Plain text content
   * @returns Promise<void>
   */
  async sendTextMail(to: string | string[], subject: string, text: string): Promise<void> {
    await this.sendMail({
      to,
      subject,
      text,
    });
  }

  /**
   * Send HTML email
   * @param to Recipient email(s)
   * @param subject Email subject
   * @param html HTML content
   * @returns Promise<void>
   */
  async sendHtmlMail(to: string | string[], subject: string, html: string): Promise<void> {
    await this.sendMail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send email with both text and HTML
   * @param to Recipient email(s)
   * @param subject Email subject
   * @param text Plain text content
   * @param html HTML content
   * @returns Promise<void>
   */
  async sendMailWithBoth(
    to: string | string[],
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    await this.sendMail({
      to,
      subject,
      text,
      html,
    });
  }

  /**
   * Send order success email
   * @param order Order entity with relations
   * @param itemsWithImages Order items with product images
   * @returns Promise<void>
   */
  async sendOrderSuccessEmail(
    order: Order,
    itemsWithImages: OrderItemWithImage[],
  ): Promise<void> {
    try {
      const recipientEmail = order.userId
        ? order.user?.email
        : order.guestEmail;

      if (!recipientEmail) {
        this.logger.warn(
          `[sendOrderSuccessEmail] No email found for order ${order.id}`,
        );
        return;
      }

      const html = generateOrderSuccessEmailHtml(
        order,
        itemsWithImages,
        this.configService,
      );

      const subject = `Sipariş Onayı - ${order.orderNo}`;

      await this.sendMail({
        to: recipientEmail,
        subject,
        html,
        text: `Siparişiniz (${order.orderNo}) başarıyla alındı ve ödeme işleminiz tamamlandı.`,
      });

      this.logger.log(
        `[sendOrderSuccessEmail] Order success email sent to ${recipientEmail} for order ${order.orderNo}`,
      );
    } catch (error) {
      this.logger.error(
        `[sendOrderSuccessEmail] Failed to send order success email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send order failed email
   * @param order Order entity with relations
   * @param errorMessage Error message (optional)
   * @returns Promise<void>
   */
  async sendOrderFailedEmail(
    order: Order,
    errorMessage: string | null = null,
  ): Promise<void> {
    try {
      const recipientEmail = order.userId
        ? order.user?.email
        : order.guestEmail;

      if (!recipientEmail) {
        this.logger.warn(
          `[sendOrderFailedEmail] No email found for order ${order.id}`,
        );
        return;
      }

      const html = generateOrderFailedEmailHtml(
        order,
        errorMessage,
        this.configService,
      );

      const subject = `Ödeme Başarısız - ${order.orderNo}`;

      await this.sendMail({
        to: recipientEmail,
        subject,
        html,
        text: `Siparişiniz (${order.orderNo}) için ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin.`,
      });

      this.logger.log(
        `[sendOrderFailedEmail] Order failed email sent to ${recipientEmail} for order ${order.orderNo}`,
      );
    } catch (error) {
      this.logger.error(
        `[sendOrderFailedEmail] Failed to send order failed email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
