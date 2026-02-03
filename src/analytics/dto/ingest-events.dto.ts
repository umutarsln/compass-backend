import { IsArray, IsEnum, IsOptional, IsString, IsNumber, IsUUID, Max, Min, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsEventType } from '../../common/enums/analytics-event-type.enum';

export class IngestEventItemDto {
    @IsEnum(AnalyticsEventType)
    type: AnalyticsEventType;

    @IsOptional()
    @IsUUID()
    productId?: string;

    @IsOptional()
    @IsUUID()
    variantId?: string;

    @IsOptional()
    @IsString()
    sessionId?: string;

    @IsOptional()
    @IsUUID()
    userId?: string;

    /** Required for PRODUCT_TIME */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(86400)
    durationSeconds?: number;

    /** Required for PAGE_VIEW: page path/slug (e.g. home, cart, checkout) */
    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsString()
    orderId?: string;
}

export class IngestEventsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IngestEventItemDto)
    @ArrayMaxSize(50)
    events: IngestEventItemDto[];
}
