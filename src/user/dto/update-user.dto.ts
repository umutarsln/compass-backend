import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Kullanıcı adı',
    example: 'Ahmet',
    required: false,
  })
  firstname?: string;

  @ApiProperty({
    description: 'Kullanıcı soyadı',
    example: 'Yılmaz',
    required: false,
  })
  lastname?: string;

  @ApiProperty({
    description: 'Kullanıcı email adresi',
    example: 'ahmet@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Kullanıcı şifresi (minimum 6 karakter)',
    example: 'newpassword123',
    minLength: 6,
    required: false,
  })
  password?: string;

  @ApiProperty({
    description: 'Telefon numarası (uluslararası format)',
    example: '+905551234567',
    required: false,
  })
  phone?: string;
}
