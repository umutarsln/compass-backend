import { Logger, Module } from '@nestjs/common';
import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { google } from 'googleapis';
import { MailService } from './mail.service';

/**
 * Gmail OAuth2 transport ayarlarını üretir; token alınamazsa uyarı verir, uygulama yine de başlar.
 */
async function buildMailerOptions(
  configService: ConfigService,
): Promise<MailerOptions> {
  const logger = new Logger('MailModule');

  const oAuth2Client = new google.auth.OAuth2(
    configService.get<string>('GOOGLE_CLIENT_ID'),
    configService.get<string>('GOOGLE_CLIENT_SECRET'),
    'http://localhost:3000/oauth2callback',
  );

  oAuth2Client.setCredentials({
    refresh_token: configService.get<string>('GOOGLE_REFRESH_TOKEN'),
  });

  let accessToken: string | undefined;
  try {
    const accessTokenResponse = await oAuth2Client.getAccessToken();
    const token = accessTokenResponse?.token;
    accessToken = token ?? undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      `Gmail OAuth erişim token alınamadı; uygulama başlıyor. Mail gönderimi çalışmayabilir. (${message})`,
    );
  }

  return {
    transport: {
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: configService.get<string>('EMAIL_USER'),
        clientId: configService.get<string>('GOOGLE_CLIENT_ID'),
        clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
        refreshToken: configService.get<string>('GOOGLE_REFRESH_TOKEN'),
        accessToken,
      },
    },
    defaults: {
      from: `"compass Lamp" <${configService.get<string>('EMAIL_USER')}>`,
    },
  };
}

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        buildMailerOptions(configService),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
