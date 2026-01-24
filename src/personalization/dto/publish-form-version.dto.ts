import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishFormVersionDto {
  @ApiProperty({
    description: 'Version ID to publish',
    example: 'uuid',
  })
  @IsUUID()
  versionId: string;
}
