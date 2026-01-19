import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StoreRegisterDto {
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
        description: 'Telefon numarası (opsiyonel)',
        example: '+905551234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;
}
