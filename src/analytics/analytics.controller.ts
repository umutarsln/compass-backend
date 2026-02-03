import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEventType } from '../common/enums/analytics-event-type.enum';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Post('aggregate')
    @ApiOperation({ summary: 'Manually run daily analytics aggregation (yesterday + today so far)' })
    @ApiResponse({ status: 200, description: 'Aggregation completed' })
    async runAggregation(): Promise<{ message: string }> {
        await this.analyticsService.runDailyAggregationManual(true);
        return { message: 'Günlük analiz agregasyonu tamamlandı (dün + bugün).' };
    }

    @Get('products/:productId')
    @ApiOperation({ summary: 'Get product analytics report (total + last 30 days daily)' })
    @ApiParam({ name: 'productId', description: 'Product UUID' })
    @ApiResponse({ status: 200, description: 'Product report' })
    getProductReport(@Param('productId') productId: string) {
        return this.analyticsService.getProductReport(productId);
    }

    @Get('products')
    @ApiOperation({ summary: 'Get products analytics summary for date range (paginated)' })
    @ApiQuery({ name: 'from', required: true, description: 'From date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'to', required: true, description: 'To date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiResponse({ status: 200, description: 'Products report' })
    getProductsReport(
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.analyticsService.getProductsReport(
            from,
            to,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @Get('store/daily')
    @ApiOperation({ summary: 'Get store daily analytics' })
    @ApiQuery({ name: 'from', required: true, description: 'From date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'to', required: true, description: 'To date (YYYY-MM-DD)' })
    @ApiResponse({ status: 200, description: 'Store daily list' })
    getStoreDaily(@Query('from') from: string, @Query('to') to: string) {
        return this.analyticsService.getStoreDaily(from, to);
    }

    @Get('store/summary')
    @ApiOperation({ summary: 'Get store totals summary' })
    @ApiResponse({ status: 200, description: 'Store summary' })
    getStoreSummary() {
        return this.analyticsService.getStoreSummary();
    }

    @Get('store/insights')
    @ApiOperation({ summary: 'Get store insights (conversion rates, avg time, page breakdown)' })
    @ApiQuery({ name: 'from', required: true, description: 'From date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'to', required: true, description: 'To date (YYYY-MM-DD)' })
    @ApiResponse({ status: 200, description: 'Store insights' })
    getStoreInsights(@Query('from') from: string, @Query('to') to: string) {
        return this.analyticsService.getStoreInsights(from, to);
    }

    @Get('events')
    @ApiOperation({ summary: 'Get raw events (filtered, paginated; use with care)' })
    @ApiQuery({ name: 'productId', required: false })
    @ApiQuery({ name: 'type', required: false, enum: AnalyticsEventType })
    @ApiQuery({ name: 'from', required: false })
    @ApiQuery({ name: 'to', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiResponse({ status: 200, description: 'Events list' })
    getEvents(
        @Query('productId') productId?: string,
        @Query('type') type?: AnalyticsEventType,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('limit') limit?: string,
    ) {
        return this.analyticsService.getEvents({
            productId,
            type,
            from,
            to,
            limit: limit ? parseInt(limit, 10) : 100,
        });
    }
}
