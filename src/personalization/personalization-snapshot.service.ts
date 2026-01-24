import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { CartPersonalizationPricingService } from './cart-personalization-pricing.service';

export interface PersonalizationSnapshot {
  form: {
    formId: string;
    versionId: string;
    title: string;
    slug: string;
  };
  schemaSnapshot: {
    fields: any[];
    conditions: any[];
  };
  userValues: Record<string, any>;
  pricingBreakdown: Array<{
    fieldKey: string;
    fieldTitle: string;
    amount: number;
    currency: Currency;
  }>;
  totalPersonalizationAmount: number;
  currency: Currency;
}

@Injectable()
export class PersonalizationSnapshotService {
  constructor(
    private dataSource: DataSource,
    private pricingService: CartPersonalizationPricingService,
  ) {}

  async generate(
    productId: string,
    formValues: Record<string, any>,
  ): Promise<PersonalizationSnapshot> {
    // Get product's published form version
    const product = await this.dataSource
      .getRepository('Product')
      .findOne({ where: { id: productId } });

    if (!product || !product.personalizationFormId) {
      throw new Error('Product does not have a personalization form');
    }

    const form = await this.dataSource
      .getRepository('PersonalizationForm')
      .findOne({
        where: { id: product.personalizationFormId },
        relations: ['currentPublishedVersion'],
      });

    if (!form || !form.currentPublishedVersion) {
      throw new Error('Published form version not found');
    }

    const version = form.currentPublishedVersion;
    const schema = version.schemaSnapshot;

    // Calculate pricing
    const pricingResult = await this.pricingService.calculate(
      productId,
      formValues,
    );

    // Generate snapshot
    return {
      form: {
        formId: form.id,
        versionId: version.id,
        title: form.title,
        slug: form.slug,
      },
      schemaSnapshot: {
        fields: schema.fields || [],
        conditions: schema.conditions || [],
      },
      userValues: formValues,
      pricingBreakdown: pricingResult.pricingBreakdown,
      totalPersonalizationAmount: pricingResult.totalPersonalizationAmount,
      currency: pricingResult.currency,
    };
  }
}
