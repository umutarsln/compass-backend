import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Favorites')
@Controller('me/favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  @ApiOperation({ summary: "Get user's favorites" })
  @ApiResponse({
    status: 200,
    description: 'Favorites retrieved',
  })
  async getFavorites(@Request() req: any) {
    const userId = req.user.id;
    const favorites = await this.favoriteService.getFavorites(userId);
    return favorites.map((fav) => ({
      id: fav.id,
      productId: fav.productId,
      product: fav.product,
      createdAt: fav.createdAt,
    }));
  }

  @Post()
  @ApiOperation({ summary: 'Add favorite' })
  @ApiResponse({
    status: 201,
    description: 'Favorite added',
  })
  async addFavorite(
    @Request() req: any,
    @Body() body: { productId: string },
  ) {
    const userId = req.user.id;
    const favorite = await this.favoriteService.addFavorite(
      userId,
      body.productId,
    );
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt,
    };
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove favorite' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Favorite removed',
  })
  async removeFavorite(
    @Request() req: any,
    @Param('productId') productId: string,
  ) {
    const userId = req.user.id;
    await this.favoriteService.removeFavorite(userId, productId);
    return { message: 'Favorite removed' };
  }
}
