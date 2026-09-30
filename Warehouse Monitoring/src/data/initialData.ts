import { Product, RackSlot, WarehouseAlert, WarehouseEvent } from '../types';

export const INITIAL_PRODUCTS: Record<string, Product> = {};

export const BARCODE_LOOKUP: Record<string, string> = {};

export const INITIAL_ALERTS: WarehouseAlert[] = [];

export const INITIAL_EVENTS: WarehouseEvent[] = [];

export const INITIAL_SLOTS: RackSlot[] = Array.from({ length: 8 }, (_, i) => ({
  slot: i + 1,
  isOccupied: false,
  currentSku: null,
  productName: null,
  qty: null,
  lastStatusChange: new Date().toISOString(),
}));
