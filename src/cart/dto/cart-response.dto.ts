import { ApiProperty } from '@nestjs/swagger';
import { CartStatus } from '../../common/enums/cart-status.enum';
import { Currency } from '../../common/enums/currency.enum';

export class CartItemResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    productId: string;

    @ApiProperty({ nullable: true })
    variantId: string | null;

    @ApiProperty()
    quantity: number;

    @ApiProperty()
    basePrice: number;

    @ApiProperty({ nullable: true })
    discountedPrice: number | null;

    @ApiProperty({ enum: Currency })
    currency: Currency;

    @ApiProperty({ nullable: true })
    product: {
        id: string;
        name: string;
        slug: string;
        basePrice: number;
        discountedPrice: number | null;
        gallery: {
            mainImage: {
                id: string;
                s3Url: string;
                displayName: string | null;
                filename: string;
            } | null;
            thumbnailImage: {
                id: string;
                s3Url: string;
                displayName: string | null;
                filename: string;
            } | null;
        } | null;
    } | null;

    @ApiProperty({ nullable: true })
    variant: {
        id: string;
        slug: string | null;
        gallery: {
            mainImage: {
                id: string;
                s3Url: string;
                displayName: string | null;
                filename: string;
            } | null;
            thumbnailImage: {
                id: string;
                s3Url: string;
                displayName: string | null;
                filename: string;
            } | null;
        } | null;
        variantValues: Array<{
            id: string;
            value: string;
            colorCode: string | null;
            variantOption: {
                id: string;
                name: string;
                type: 'COLOR' | 'TEXT';
            };
        }>;
    } | null;

    @ApiProperty({ nullable: true, description: 'Personalization snapshot data' })
    personalization: any | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class CartResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ nullable: true })
    userId: string | null;

    @ApiProperty({ enum: CartStatus })
    status: CartStatus;

    @ApiProperty({ type: [CartItemResponseDto] })
    items: CartItemResponseDto[];

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}
