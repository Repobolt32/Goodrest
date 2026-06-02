import type { Json, Tables } from '@/types/database.types';

export type OrderRow = Tables<'orders'>;
export type OrderSummaryRow = Pick<
  OrderRow,
  'id' | 'friendly_id' | 'order_status' | 'total_amount' | 'created_at' | 'items'
>;

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price?: number;
  price_at_order?: number;
  category?: string;
  [key: string]: Json | undefined;
}

export interface OrderRecord extends Omit<OrderRow, 'items'> {
  items: OrderItem[];
}

export interface OrderSummary extends Omit<OrderSummaryRow, 'items'> {
  items: OrderItem[];
}

function isOrderItem(value: Json): value is OrderItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, Json | undefined>;

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.quantity === 'number' &&
    (candidate.id === undefined || typeof candidate.id === 'string') &&
    (candidate.price === undefined || typeof candidate.price === 'number') &&
    (candidate.price_at_order === undefined || typeof candidate.price_at_order === 'number') &&
    (candidate.category === undefined || typeof candidate.category === 'string')
  );
}

export function normalizeOrderItems(items: Json | null | undefined): OrderItem[] {
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items) as Json;
      return normalizeOrderItems(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(items)) {
    return [];
  }

  return (items as Json[]).filter(isOrderItem);
}

export function toOrderRecord(order: OrderRow): OrderRecord {
  return {
    ...order,
    items: normalizeOrderItems(order.items),
  };
}

export function toOrderSummary(order: OrderSummaryRow): OrderSummary {
  return {
    ...order,
    items: normalizeOrderItems(order.items),
  };
}
