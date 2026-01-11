import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { StockService } from './stock.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { Stock } from './stock.entity';
import { SellableType } from '../common/enums/sellable-type.enum';

@ApiTags('Stock')
@Controller('stock')
@ApiBearerAuth('JWT-auth')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':sellableType/:sellableId')
  @ApiOperation({ summary: 'Stok bilgisini getir' })
  @ApiParam({
    name: 'sellableType',
    enum: SellableType,
    description: 'Sellable tip',
  })
  @ApiParam({
    name: 'sellableId',
    description: 'Sellable ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Stok bilgisi başarıyla döndürüldü',
    type: Stock,
  })
  @ApiResponse({ status: 404, description: 'Stok kaydı bulunamadı' })
  async findOne(
    @Param('sellableType') sellableType: SellableType,
    @Param('sellableId') sellableId: string,
  ): Promise<Stock> {
    return await this.stockService.findOne(sellableType, sellableId);
  }

  @Patch(':sellableType/:sellableId')
  @ApiOperation({ summary: 'Stok bilgisini güncelle' })
  @ApiParam({
    name: 'sellableType',
    enum: SellableType,
    description: 'Sellable tip',
  })
  @ApiParam({
    name: 'sellableId',
    description: 'Sellable ID',
  })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({
    status: 200,
    description: 'Stok başarıyla güncellendi',
    type: Stock,
  })
  async update(
    @Param('sellableType') sellableType: SellableType,
    @Param('sellableId') sellableId: string,
    @Body() updateStockDto: UpdateStockDto,
  ): Promise<Stock> {
    return await this.stockService.update(sellableType, sellableId, updateStockDto);
  }

  @Post('reserve')
  @ApiOperation({ summary: 'Stok rezerve et' })
  @ApiBody({ type: ReserveStockDto })
  @ApiResponse({
    status: 200,
    description: 'Stok başarıyla rezerve edildi',
    type: Stock,
  })
  @ApiResponse({ status: 400, description: 'Yetersiz stok' })
  async reserve(@Body() reserveStockDto: ReserveStockDto): Promise<Stock> {
    return await this.stockService.reserve(reserveStockDto);
  }

  @Post('release')
  @ApiOperation({ summary: 'Rezerve edilmiş stoku serbest bırak' })
  @ApiBody({ type: ReleaseStockDto })
  @ApiResponse({
    status: 200,
    description: 'Stok başarıyla serbest bırakıldı',
    type: Stock,
  })
  @ApiResponse({ status: 400, description: 'Rezerve edilmiş stok yetersiz' })
  async release(@Body() releaseStockDto: ReleaseStockDto): Promise<Stock> {
    return await this.stockService.release(releaseStockDto);
  }
}
