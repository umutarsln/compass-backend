import {
    Controller,
    Get,
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
