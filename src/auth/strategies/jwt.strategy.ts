import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';

/** Bearer JWT ile kimlik doğrulaması yapan Passport stratejisi. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    /**
     * Stratejiyi JWT imza doğrulaması için yapılandırır; JWT_SECRET zorunludur.
     */
    constructor(
        private configService: ConfigService,
        private userService: UserService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
        });
    }

    /**
     * Token payload'ından kullanıcıyı yükler; yoksa 401 fırlatır.
     */
    async validate(payload: any) {
        const user = await this.userService.findOne(payload.sub);
        if (!user) {
            throw new UnauthorizedException();
        }
        return {
            userId: user.id,
            email: user.email,
            roles: user.roles || [],
        };
    }
}
