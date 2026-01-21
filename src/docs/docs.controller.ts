import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DocsService } from './docs.service';
import { DocsListResponseDto } from './dto/docs-list.dto';
import { DocResponseDto } from './dto/doc-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('Documentation')
@Controller('docs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  /**
   * Get all documentation modules
   */
  @Get()
  @ApiOperation({ summary: 'Get all documentation modules' })
  @ApiResponse({
    status: 200,
    description: 'List of all documentation modules',
    type: DocsListResponseDto,
  })
  async getAllDocs(): Promise<DocsListResponseDto> {
    return this.docsService.getAllDocs();
  }

  /**
   * Get documentation by module name
   */
  @Get(':module')
  @ApiOperation({ summary: 'Get documentation for a specific module' })
  @ApiResponse({
    status: 200,
    description: 'Documentation content',
    type: DocResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Documentation not found',
  })
  async getDocByModule(@Param('module') module: string): Promise<DocResponseDto> {
    return this.docsService.getDocByModule(module);
  }
}
