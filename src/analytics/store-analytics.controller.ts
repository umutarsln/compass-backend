import { Controller, Post, Body, Request, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AnalyticsService } from './analytics.service';
import { IngestEventsDto } from './dto/ingest-events.dto';

@ApiTags('Store Analytics')
@Controller('store/analytics')
export class StoreAnalyticsController {
    private readonly logger = new Logger(StoreAnalyticsController.name);

    constructor(private readonly analyticsService: AnalyticsService) { }

    @Post('events')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Public()
    @ApiOperation({ summary: 'Ingest analytics events from store frontend' })
    @ApiResponse({ status: 204, description: 'Events accepted' })
    @ApiResponse({ status: 400, description: 'Validation error' })
    ingestEvents(@Body() dto: IngestEventsDto, @Request() req: any): void {
        const userId = req.user?.id ?? null;
        const count = dto?.events?.length ?? 0;
        const types = count > 0
            ? [...new Set((dto.events as { type?: string }[]).map((e) => e.type).filter(Boolean))].join(', ')
            : 'none';
        this.logger.log(
            `[Analytics] POST /store/analytics/events received: events=${count} types=[${types}] userId=${userId ?? 'anonymous'}`,
        );
        this.analyticsService.ingestEvents(dto, userId);
    }
}
