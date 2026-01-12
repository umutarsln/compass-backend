import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('me')
    @ApiOperation({ summary: 'Giriş yapmış kullanıcının bilgilerini getir' })
    @ApiResponse({
        status: 200,
        description: 'Kullanıcı bilgileri başarıyla döndürüldü',
        type: User,
    })
    @ApiResponse({ status: 401, description: 'Yetkilendirme hatası' })
    async getMe(@Request() req: any): Promise<User> {
        const userId = req.user?.userId;
        if (!userId) {
            throw new UnauthorizedException('Kullanıcı bilgisi bulunamadı');
        }
        return await this.userService.findOne(userId);
    }

    @Get()
    @ApiOperation({ summary: 'Tüm kullanıcıları listele' })
    @ApiResponse({
        status: 200,
        description: 'Kullanıcı listesi başarıyla döndürüldü',
        type: [User],
    })
    async findAll(): Promise<User[]> {
        return await this.userService.findAll();
    }

    @Get('customers')
    @ApiOperation({ summary: 'Tüm müşterileri listele (Sadece USER rolüne sahip kullanıcılar)' })
    @ApiResponse({
        status: 200,
        description: 'Müşteri listesi başarıyla döndürüldü',
        type: [User],
    })
    async findAllCustomers(): Promise<User[]> {
        return await this.userService.findAllCustomers();
    }

    // Admin Management Endpoints - :id route'undan ÖNCE tanımlanmalı
    @Get('admins')
    @ApiOperation({ summary: 'Tüm admin kullanıcılarını listele (Sadece ADMIN)' })
    @ApiResponse({
        status: 200,
        description: 'Admin listesi başarıyla döndürüldü',
        type: [User],
    })
    async findAllAdmins(): Promise<User[]> {
        return await this.userService.findAllAdmins();
    }

    @Post('admins')
    @ApiOperation({ summary: 'Yeni admin kullanıcısı oluştur (Sadece ADMIN)' })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'Admin kullanıcısı başarıyla oluşturuldu',
        type: User,
    })
    @ApiResponse({ status: 409, description: 'Email zaten kullanılıyor' })
    async createAdmin(@Body() createUserDto: CreateUserDto): Promise<User> {
        return await this.userService.createAdmin(createUserDto);
    }

    @Patch('admins/:id')
    @ApiOperation({ summary: 'Admin kullanıcısı bilgilerini güncelle (Sadece ADMIN)' })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({
        status: 200,
        description: 'Admin kullanıcısı başarıyla güncellendi',
        type: User,
    })
    @ApiResponse({ status: 404, description: 'Admin kullanıcısı bulunamadı' })
    @ApiResponse({ status: 409, description: 'Email zaten kullanılıyor' })
    async updateAdmin(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<User> {
        return await this.userService.updateAdmin(id, updateUserDto);
    }

    @Delete('admins/:id')
    @ApiOperation({ summary: 'Admin kullanıcısını sil (Sadece ADMIN)' })
    @ApiResponse({
        status: 200,
        description: 'Admin kullanıcısı başarıyla silindi',
    })
    @ApiResponse({ status: 404, description: 'Admin kullanıcısı bulunamadı' })
    async removeAdmin(@Param('id') id: string): Promise<{ message: string }> {
        await this.userService.removeAdmin(id);
        return { message: 'Admin kullanıcısı başarıyla silindi' };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Kullanıcı detayını getir' })
    @ApiResponse({
        status: 200,
        description: 'Kullanıcı detayı başarıyla döndürüldü',
        type: User,
    })
    @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
    async findOne(@Param('id') id: string): Promise<User> {
        return await this.userService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Kullanıcı bilgilerini güncelle' })
    @ApiBody({ type: UpdateUserDto })
    @ApiResponse({
        status: 200,
        description: 'Kullanıcı başarıyla güncellendi',
        type: User,
    })
    @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
    @ApiResponse({ status: 409, description: 'Email zaten kullanılıyor' })
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<User> {
        return await this.userService.update(id, updateUserDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Kullanıcıyı sil' })
    @ApiResponse({
        status: 200,
        description: 'Kullanıcı başarıyla silindi',
    })
    @ApiResponse({ status: 404, description: 'Kullanıcı bulunamadı' })
    async remove(@Param('id') id: string): Promise<{ message: string }> {
        await this.userService.remove(id);
        return { message: 'Kullanıcı başarıyla silindi' };
    }
}
