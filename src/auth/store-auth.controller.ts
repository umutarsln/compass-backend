import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { StoreAuthService } from './store-auth.service';
import { StoreRegisterDto } from './dto/store-register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../user/user.entity';

@ApiTags('Store Auth')
@Controller('auth/store')
export class StoreAuthController {
  constructor(private readonly storeAuthService: StoreAuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Store için yeni kullanıcı kaydı' })
  @ApiBody({ type: StoreRegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Kullanıcı başarıyla kaydedildi',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstname: { type: 'string' },
            lastname: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            roles: { type: 'array', items: { type: 'string', enum: ['USER', 'ADMIN'] } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email zaten kullanılıyor' })
  async register(
    @Body() registerDto: StoreRegisterDto,
  ): Promise<{
    user: Omit<User, 'password'>;
    accessToken: string;
    refreshToken: string;
  }> {
    return await this.storeAuthService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Store için kullanıcı girişi' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Giriş başarılı',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstname: { type: 'string' },
            lastname: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            roles: { type: 'array', items: { type: 'string', enum: ['USER', 'ADMIN'] } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Email veya şifre hatalı' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<{
    user: Omit<User, 'password'>;
    accessToken: string;
    refreshToken: string;
  }> {
    return await this.storeAuthService.login(loginDto);
  }
}
