import { IsString, IsOptional, IsEmail, IsPhoneNumber, IsObject, ValidateNested, IsEnum, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from '../../common/enums/currency.enum';

class AddressDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsOptional()
  country?: string;
}

class BillingAddressDto extends AddressDto {
  @IsString()
  @IsOptional()
  taxNumber?: string;

  @IsString()
  @IsOptional()
  taxOffice?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  cartId: string;

  // Guest checkout için (userId yoksa zorunlu)
  @IsEmail()
  @IsOptional()
  guestEmail?: string;

  @IsString()
  @IsOptional()
  guestPhone?: string;

  @IsString()
  @IsOptional()
  guestFirstName?: string;

  @IsString()
  @IsOptional()
  guestLastName?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress: AddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  @IsOptional()
  billingAddress?: BillingAddressDto;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shippingCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
