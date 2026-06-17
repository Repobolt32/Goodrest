export interface ActiveOffer {
  id: string;
  type: 'discount_percent' | 'free_delivery';
  config: {
    percent?: number;
    max_amount?: number;
    threshold?: number;
  };
}

export interface OfferResult {
  discountAmount: number;
  finalDeliveryFee: number;
  finalTotal: number;
  appliedOffers: ActiveOffer[];
}

export function applyOffers(
  subtotal: number,
  deliveryFee: number,
  offers: ActiveOffer[]
): OfferResult {
  const appliedOffers: ActiveOffer[] = [];

  let discountAmount = 0;
  const discountOffer = offers.find(o => o.type === 'discount_percent');
  if (discountOffer) {
    const percent = discountOffer.config.percent ?? 0;
    const maxAmount = discountOffer.config.max_amount;
    let rawDiscount = subtotal * (percent / 100);
    if (maxAmount !== undefined) {
      rawDiscount = Math.min(rawDiscount, maxAmount);
    }
    discountAmount = Math.min(rawDiscount, subtotal);
    appliedOffers.push(discountOffer);
  }

  let finalDeliveryFee = deliveryFee;
  const freeDeliveryOffer = offers.find(o => o.type === 'free_delivery');
  if (freeDeliveryOffer) {
    const threshold = freeDeliveryOffer.config.threshold ?? 0;
    if (subtotal >= threshold) {
      finalDeliveryFee = 0;
      appliedOffers.push(freeDeliveryOffer);
    }
  }

  const finalTotal = Math.max(0, subtotal - discountAmount) + finalDeliveryFee;

  return {
    discountAmount,
    finalDeliveryFee,
    finalTotal,
    appliedOffers,
  };
}
