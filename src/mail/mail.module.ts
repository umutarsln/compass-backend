import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '@nestjs/config';
import { google } from 'googleapis';
import { MailService } from './mail.service';
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const oAuth2Client = new google.auth.OAuth2(
          configService.get<string>('GOOGLE_CLIENT_ID'),
          configService.get<string>('GOOGLE_CLIENT_SECRET'),
          'http://localhost:3000/oauth2callback',
        );

        oAuth2Client.setCredentials({
          refresh_token: configService.get<string>('GOOGLE_REFRESH_TOKEN'),
        });

        const accessTokenResponse = await oAuth2Client.getAccessToken();
        const accessToken = accessTokenResponse?.token;

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
            from: `"Shawk Lamp" <${configService.get<string>('EMAIL_USER')}>`,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule { }
