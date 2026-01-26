import {
    Controller,
    Delete,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { CacheService } from './cache.service';

@ApiTags('Cache')
@Controller('cache')
@ApiBearerAuth()
export class CacheController {
    constructor(private readonly cacheService: CacheService) { }

    @Delete()
    @ApiOperation({
        summary: 'Cache\'i temizle',
        description: 'Belirtilen prefix\'e sahip tüm cache key\'lerini temizler. Prefix belirtilmezse tüm cache temizlenir. Sadece admin kullanıcılar erişebilir.'
    })
    @ApiQuery({
        name: 'prefix',
        required: false,
        description: 'Temizlenecek cache key\'lerinin prefix\'i (örn: "store:", "product:")',
        example: 'store:',
    })
    @ApiResponse({
        status: 200,
        description: 'Cache başarıyla temizlendi',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                deletedKeys: { type: 'number' },
            },
        },
    })
    @ApiResponse({
        status: 401,
        description: 'Unauthorized - Giriş yapmanız gerekiyor',
    })
    @ApiResponse({
        status: 403,
        description: 'Forbidden - Bu işlem için yetkiniz yok',
    })
    async clearCache(@Query('prefix') prefix?: string): Promise<{ message: string; deletedKeys: number }> {
        const deletedKeys = await this.cacheService.clearCache(prefix);
        return {
            message: prefix 
                ? `"${prefix}" prefix'ine sahip cache başarıyla temizlendi`
                : 'Tüm cache başarıyla temizlendi',
            deletedKeys,
        };
    }
}
