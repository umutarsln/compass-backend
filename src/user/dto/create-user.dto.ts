import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    IsOptional,
    Validate,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { isValidPhoneNumber } from 'libphonenumber-js';

@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class PhoneNumberValidator implements ValidatorConstraintInterface {
    validate(value: string, args: ValidationArguments): boolean {
        if (!value) return false;
        return isValidPhoneNumber(value);
    }

    defaultMessage(args: ValidationArguments): string {
        return 'Geçerli bir telefon numarası giriniz';
    }
}

export class CreateUserDto {
    @ApiProperty({
        description: 'Kullanıcı adı',
        example: 'Ahmet',
    })
    @IsNotEmpty()
    @IsString()
    firstname: string;

    @ApiProperty({
        description: 'Kullanıcı soyadı',
        example: 'Yılmaz',
    })
    @IsNotEmpty()
    @IsString()
    lastname: string;

    @ApiProperty({
        description: 'Kullanıcı email adresi',
        example: 'ahmet@example.com',
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'Kullanıcı şifresi (minimum 6 karakter)',
        example: 'password123',
        minLength: 6,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({
        description: 'Telefon numarası (uluslararası format)',
        example: '+905551234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Validate(PhoneNumberValidator)
    phone?: string | null;
}
