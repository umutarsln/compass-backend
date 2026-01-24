import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Currency } from '../common/enums/currency.enum';

export interface PricingBreakdownItem {
  fieldKey: string;
  fieldTitle: string;
  amount: number;
  currency: Currency;
}

export interface PricingCalculationResult {
  pricingBreakdown: PricingBreakdownItem[];
  totalPersonalizationAmount: number;
  currency: Currency;
}

@Injectable()
export class CartPersonalizationPricingService {
  constructor(private dataSource: DataSource) {}

  async calculate(
    productId: string,
    formValues: Record<string, any>,
  ): Promise<PricingCalculationResult> {
    // Get product's published form version
    const product = await this.dataSource
      .getRepository('Product')
      .findOne({ where: { id: productId } });

    if (!product || !product.personalizationFormId) {
      return {
        pricingBreakdown: [],
        totalPersonalizationAmount: 0,
        currency: Currency.TRY,
      };
    }

    const form = await this.dataSource
      .getRepository('PersonalizationForm')
      .findOne({
        where: { id: product.personalizationFormId },
        relations: ['currentPublishedVersion'],
      });

    if (!form || !form.currentPublishedVersion) {
      return {
        pricingBreakdown: [],
        totalPersonalizationAmount: 0,
        currency: Currency.TRY,
      };
    }

    const version = form.currentPublishedVersion;
    const schema = version.schemaSnapshot;

    if (!schema || !schema.fields) {
      return {
        pricingBreakdown: [],
        totalPersonalizationAmount: 0,
        currency: Currency.TRY,
      };
    }

    const pricingBreakdown: PricingBreakdownItem[] = [];
    let totalAmount = 0;

    // Calculate pricing for each field
    for (const field of schema.fields) {
      const pricingRules = field.pricingRules;
      if (!pricingRules) continue;

      const fieldValue = formValues[field.key];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        continue;
      }

      let amount = 0;

      if (pricingRules.type === 'FLAT_IF_FILLED') {
        // Flat amount if field is filled
        amount = pricingRules.amount || 0;
      } else if (pricingRules.type === 'BY_OPTION') {
        // Price based on selected option
        const options = pricingRules.options || {};
        if (Array.isArray(fieldValue)) {
          // For MULTISELECT/CHECKBOX
          for (const val of fieldValue) {
            if (options[val] !== undefined) {
              amount += options[val] || 0;
            }
          }
        } else {
          // For SELECT/RADIO
          if (options[fieldValue] !== undefined) {
            amount = options[fieldValue] || 0;
          }
        }
      }

      if (amount > 0) {
        pricingBreakdown.push({
          fieldKey: field.key,
          fieldTitle: field.title,
          amount,
          currency: Currency.TRY, // Default currency
        });
        totalAmount += amount;
      }
    }

    return {
      pricingBreakdown,
      totalPersonalizationAmount: Math.round(totalAmount * 100) / 100,
      currency: Currency.TRY,
    };
  }
}
