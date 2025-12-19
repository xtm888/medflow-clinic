/**
 * usePricing Hook
 *
 * Handles pricing calculation logic for optical shop sales.
 */

import { useCallback } from 'react';
import { LENS_PRICES, LENS_OPTIONS } from '../constants';

export default function usePricing(orderData, setOrderData, conventionInfo) {
  const calculatePricing = useCallback((data = orderData) => {
    let subtotal = 0;

    // Frame price
    if (data.frame?.price) {
      subtotal += data.frame.price;
    }

    // Lens price (based on material) - price per lens, so multiply by 2
    const lensPrice = LENS_PRICES[data.lensType?.material] || LENS_PRICES['cr39'];
    subtotal += lensPrice * 2;

    // Progressive/Bifocal add-on
    if (data.lensType?.design === 'progressive') {
      subtotal += 50000;
    } else if (data.lensType?.design === 'bifocal') {
      subtotal += 25000;
    }

    // Lens options/coatings
    if (data.lensOptions?.antiReflective?.selected) {
      subtotal += data.lensOptions.antiReflective.price || LENS_OPTIONS.antiReflective.price;
    }
    if (data.lensOptions?.photochromic?.selected) {
      subtotal += data.lensOptions.photochromic.price || LENS_OPTIONS.photochromic.price;
    }
    if (data.lensOptions?.blueLight?.selected) {
      subtotal += data.lensOptions.blueLight.price || LENS_OPTIONS.blueLight.price;
    }
    if (data.lensOptions?.tint?.selected) {
      subtotal += data.lensOptions.tint.price || LENS_OPTIONS.tint.price;
    }

    // Apply discount
    let discountAmount = data.pricing?.discount || 0;
    if (data.pricing?.discountType === 'percent') {
      discountAmount = subtotal * (discountAmount / 100);
    }

    const finalTotal = Math.max(0, subtotal - discountAmount);

    // Calculate convention split if applicable
    let companyPortion = 0;
    let patientPortion = finalTotal;

    if (conventionInfo?.hasConvention && conventionInfo?.opticalCovered) {
      const coveragePercent = conventionInfo.coveragePercentage || 0;
      companyPortion = Math.round(finalTotal * coveragePercent / 100);
      patientPortion = finalTotal - companyPortion;
    }

    setOrderData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        subtotal,
        discountAmount,
        finalTotal,
        companyPortion,
        patientPortion
      }
    }));

    return { subtotal, discountAmount, finalTotal, companyPortion, patientPortion };
  }, [orderData, setOrderData, conventionInfo]);

  return { calculatePricing };
}
