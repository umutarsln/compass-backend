import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PersonalizationService } from './personalization.service';
import { CreatePersonalizationFormDto } from './dto/create-personalization-form.dto';
import { UpdatePersonalizationFormDto } from './dto/update-personalization-form.dto';
import { CreatePersonalizationFieldDto } from './dto/create-personalization-field.dto';
import { UpdatePersonalizationFieldDto } from './dto/update-personalization-field.dto';
import { CreatePersonalizationConditionDto } from './dto/create-personalization-condition.dto';
import { UpdatePersonalizationConditionDto } from './dto/update-personalization-condition.dto';
import { PublishFormVersionDto } from './dto/publish-form-version.dto';
import { ValidatePersonalizationDto } from './dto/validate-personalization.dto';
import { PersonalizationFormResponseDto } from './dto/personalization-form-response.dto';
import { CartPersonalizationValidatorService } from './cart-personalization-validator.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Personalization')
@Controller('personalization')
@ApiBearerAuth('JWT-auth')
export class PersonalizationController {
  constructor(
    private readonly personalizationService: PersonalizationService,
    private readonly validatorService: CartPersonalizationValidatorService,
  ) {}

  // ==================== FORM CRUD ====================

  @Get('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all personalization forms' })
  @ApiResponse({ status: 200, description: 'Forms retrieved successfully' })
  async findAll() {
    return await this.personalizationService.findAll();
  }

  @Get('forms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get personalization form by ID' })
  @ApiResponse({ status: 200, description: 'Form retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.personalizationService.findOne(id);
  }

  @Post('forms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new personalization form' })
  @ApiResponse({ status: 201, description: 'Form created successfully' })
  async create(@Body() createDto: CreatePersonalizationFormDto) {
    return await this.personalizationService.create(createDto);
  }

  @Patch('forms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update personalization form' })
  @ApiResponse({ status: 200, description: 'Form updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePersonalizationFormDto,
  ) {
    return await this.personalizationService.update(id, updateDto);
  }

  @Delete('forms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete personalization form' })
  @ApiResponse({ status: 200, description: 'Form deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.personalizationService.remove(id);
    return { message: 'Form deleted successfully' };
  }

  // ==================== VERSION MANAGEMENT ====================

  @Post('forms/:formId/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new form version (draft)' })
  @ApiResponse({ status: 201, description: 'Version created successfully' })
  async createVersion(@Param('formId') formId: string) {
    return await this.personalizationService.createVersion(formId);
  }

  @Post('versions/:versionId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Publish a form version' })
  @ApiResponse({ status: 200, description: 'Version published successfully' })
  async publishVersion(@Body() publishDto: PublishFormVersionDto) {
    return await this.personalizationService.publishVersion(publishDto.versionId);
  }

  @Post('versions/:versionId/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Archive a form version' })
  @ApiResponse({ status: 200, description: 'Version archived successfully' })
  async archiveVersion(@Param('versionId') versionId: string) {
    return await this.personalizationService.archiveVersion(versionId);
  }

  // ==================== FIELD CRUD ====================

  @Get('forms/:formId/fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all fields for a form' })
  @ApiResponse({ status: 200, description: 'Fields retrieved successfully' })
  async getFields(@Param('formId') formId: string) {
    return await this.personalizationService.getFields(formId);
  }

  @Post('forms/:formId/fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new field' })
  @ApiResponse({ status: 201, description: 'Field created successfully' })
  async createField(@Body() createDto: CreatePersonalizationFieldDto) {
    return await this.personalizationService.createField(createDto);
  }

  @Patch('fields/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a field' })
  @ApiResponse({ status: 200, description: 'Field updated successfully' })
  async updateField(
    @Param('id') id: string,
    @Body() updateDto: UpdatePersonalizationFieldDto,
  ) {
    return await this.personalizationService.updateField(id, updateDto);
  }

  @Delete('fields/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a field' })
  @ApiResponse({ status: 200, description: 'Field deleted successfully' })
  async removeField(@Param('id') id: string) {
    await this.personalizationService.removeField(id);
    return { message: 'Field deleted successfully' };
  }

  // ==================== CONDITION CRUD ====================

  @Get('forms/:formId/conditions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all conditions for a form' })
  @ApiResponse({ status: 200, description: 'Conditions retrieved successfully' })
  async getConditions(@Param('formId') formId: string) {
    return await this.personalizationService.getConditions(formId);
  }

  @Post('forms/:formId/conditions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new condition' })
  @ApiResponse({ status: 201, description: 'Condition created successfully' })
  async createCondition(@Body() createDto: CreatePersonalizationConditionDto) {
    return await this.personalizationService.createCondition(createDto);
  }

  @Patch('conditions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a condition' })
  @ApiResponse({ status: 200, description: 'Condition updated successfully' })
  async updateCondition(
    @Param('id') id: string,
    @Body() updateDto: UpdatePersonalizationConditionDto,
  ) {
    return await this.personalizationService.updateCondition(id, updateDto);
  }

  @Delete('conditions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a condition' })
  @ApiResponse({ status: 200, description: 'Condition deleted successfully' })
  async removeCondition(@Param('id') id: string) {
    await this.personalizationService.removeCondition(id);
    return { message: 'Condition deleted successfully' };
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('products/:productId')
  @Public()
  @ApiOperation({ summary: 'Get published form for a product (public)' })
  @ApiResponse({ status: 200, description: 'Form retrieved successfully' })
  async getProductForm(@Param('productId') productId: string) {
    const version = await this.personalizationService.getPublishedVersionForProduct(
      productId,
    );

    if (!version) {
      return null;
    }

    return {
      formId: version.formId,
      versionId: version.id,
      version: version.version,
      schemaSnapshot: version.schemaSnapshot,
    };
  }

  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Validate personalization data (public)' })
  @ApiResponse({ status: 200, description: 'Validation successful' })
  async validate(
    @Body() validateDto: ValidatePersonalizationDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId || null;
    const guestId = req.headers['x-guest-id'] || null;

    await this.validatorService.validate(
      validateDto.productId,
      validateDto.variantId,
      validateDto.formValues,
      validateDto.fileIds,
      userId,
      guestId,
    );

    return { valid: true, message: 'Personalization data is valid' };
  }
}
