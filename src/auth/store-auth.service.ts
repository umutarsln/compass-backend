import {
    Injectable,
    UnauthorizedException,
    ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { StoreRegisterDto } from './dto/store-register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/user.entity';
import { AuthService } from './auth.service';

@Injectable()
export class StoreAuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private authService: AuthService,
    ) { }

    async register(registerDto: StoreRegisterDto): Promise<{
        user: Omit<User, 'password'>;
        accessToken: string;
        refreshToken: string;
    }> {
        try {
            // Telefon yoksa, unique bir telefon numarası oluştur
            let phone = registerDto.phone;
            if (!phone) {
                // Türkiye cep telefonu formatı: +905XXXXXXXXX (11 karakter)
                // 5XX ile başlayan 10 haneli numara
                // Geçerli operatör kodları: 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
                const operatorCodes = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'];
                const randomOperator = operatorCodes[Math.floor(Math.random() * operatorCodes.length)];

                // 8 haneli random numara oluştur
                const randomNumber = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
                phone = `+90${randomOperator}${randomNumber}`;

                // Telefon numarasının unique olduğundan emin ol
                let attempts = 0;
                const maxAttempts = 10;
                while (attempts < maxAttempts) {
                    // Mevcut kullanıcıları kontrol et
                    const allUsers = await this.userService.findAll();
                    const phoneExists = allUsers.some((u) => u.phone === phone);

                    if (!phoneExists) {
                        break; // Unique telefon bulundu
                    }

                    // Telefon varsa yeni bir tane oluştur
                    const newOperator = operatorCodes[Math.floor(Math.random() * operatorCodes.length)];
                    const newRandom = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
                    phone = `+90${newOperator}${newRandom}`;
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    throw new ConflictException('Telefon numarası oluşturulamadı. Lütfen tekrar deneyin.');
                }
            }

            // CreateUserDto formatına çevir
            const fullRegisterDto = {
                firstname: registerDto.firstname,
                lastname: registerDto.lastname,
                email: registerDto.email,
                password: registerDto.password,
                phone: phone,
            };

            const user = await this.userService.create(fullRegisterDto);
            const tokens = await this.generateTokens(user);
            const { password, ...userWithoutPassword } = user;
            return {
                user: userWithoutPassword,
                ...tokens,
            };
        } catch (error) {
            if (error instanceof ConflictException) {
                throw error;
            }
            // Diğer hataları da logla
            console.error('Store register error:', error);
            throw error;
        }
    }

    async login(loginDto: LoginDto): Promise<{
        user: Omit<User, 'password'>;
        accessToken: string;
        refreshToken: string;
    }> {
        const user = await this.authService.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new UnauthorizedException('Email veya şifre hatalı');
        }

        // Store için tüm kullanıcılar giriş yapabilir (admin kontrolü yok)
        const tokens = await this.generateTokens(user);
        const { password, ...userWithoutPassword } = user;
        return {
            user: userWithoutPassword,
            ...tokens,
        };
    }

    async generateTokens(user: User): Promise<{
        accessToken: string;
        refreshToken: string;
    }> {
        const accessPayload = {
            email: user.email,
            sub: user.id,
            roles: user.roles || [],
            type: 'access',
        };

        const refreshPayload = {
            sub: user.id,
            type: 'refresh',
        };

        const accessToken = await this.jwtService.signAsync(accessPayload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
        });

        const refreshToken = await this.jwtService.signAsync(refreshPayload, {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
        });

        return {
            accessToken,
            refreshToken,
        };
    }
}
