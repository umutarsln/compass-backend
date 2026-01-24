import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalizationForm } from './personalization-form.entity';
import { PersonalizationFormVersion } from './personalization-form-version.entity';
import { PersonalizationField } from './personalization-field.entity';
import { PersonalizationCondition } from './personalization-condition.entity';
import { PersonalizationService } from './personalization.service';
import { CartPersonalizationValidatorService } from './cart-personalization-validator.service';
import { CartPersonalizationPricingService } from './cart-personalization-pricing.service';
import { PersonalizationSnapshotService } from './personalization-snapshot.service';
import { PersonalizationController } from './personalization.controller';
import { UploadModule } from '../upload/upload.module';
import { Upload } from '../upload/upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalizationForm,
      PersonalizationFormVersion,
      PersonalizationField,
      PersonalizationCondition,
      Upload,
    ]),
    UploadModule,
  ],
  controllers: [PersonalizationController],
  providers: [
    PersonalizationService,
    CartPersonalizationValidatorService,
    CartPersonalizationPricingService,
    PersonalizationSnapshotService,
  ],
  exports: [
    PersonalizationService,
    CartPersonalizationValidatorService,
    CartPersonalizationPricingService,
    PersonalizationSnapshotService,
  ],
})
export class PersonalizationModule {}
