import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { RegisterDto } from '../user/dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { User } from '../user/user.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(registerDto: RegisterDto): Promise<{
    user: Omit<User, 'password'>;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const user = await this.userService.create({
        firstname: registerDto.firstname,
        lastname: registerDto.lastname,
        email: registerDto.email,
        password: registerDto.password,
        phone: registerDto.phone || null,
      });
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
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<{
    user: Omit<User, 'password'>;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email veya şifre hatalı');
    }

    // Sadece ADMIN rolüne sahip kullanıcılar giriş yapabilir
    const isAdmin = user.roles && user.roles.includes(Role.ADMIN);
    if (!isAdmin) {
      throw new UnauthorizedException('Bu panele sadece admin kullanıcılar giriş yapabilir');
    }

    const tokens = await this.generateTokens(user);
    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Refresh token'ı validate et (JWT olarak)
      const payload = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken,
        {
          secret: this.configService.get('JWT_SECRET'),
        },
      );

      // Kullanıcıyı bul
      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Kullanıcı bulunamadı');
      }

      // Yeni token'lar oluştur
      return await this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş refresh token');
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
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

  async logout(): Promise<void> {
    // Stateless sistemde logout sadece client-side'da token'ı silmek yeterli
    // Bu metod geriye uyumluluk için bırakıldı
    return;
  }
}
