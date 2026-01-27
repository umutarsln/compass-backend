import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    IsOptional,
    Validate,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PhoneNumberValidator } from './create-user.dto';

export class RegisterDto {
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
        description: 'Kullanıcı telefon numarası (opsiyonel)',
        example: '+905551234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Validate(PhoneNumberValidator)
    phone?: string | null;
}
