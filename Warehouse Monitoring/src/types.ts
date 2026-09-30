/**
 * Data Model for Smart Shopping Warehouse Monitoring System
 */

export interface Product {
  sku: string;
  name: string;
  qty_per_box: number;
  expiry: string; // ISO date format YYYY-MM-DD
  category?: string;
  min_safety_stock?: number;
  barcode?: string;
}

export type EventType =
  | 'scan_in'
  | 'box_placed'
  | 'box_removed_pending'
  | 'restock_to_shelf'
  | 'misplacement_flagged'
  | 'expiry_alert'
  | 'purchase_confirmed'
  | 'warehouse_audit';

export interface WarehouseEvent {
  id: string;
  event_type: EventType;
  slot?: number | null;
  sku?: string;
  timestamp: string; // ISO timestamp
  qty?: number;
  warehouse_delta?: number;
  shelf_delta?: number;
  details?: string;
  box_id?: string;
  expiry?: string;
  total_stock_out?: number;
  since_timestamp?: string;
  expected_sku?: string;
  detected_sku?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RackSlot {
  slot: number; // 1 to 8
  isOccupied: boolean;
  currentSku: string | null;
  productName: string | null;
  qty: number | null;
  lastStatusChange: string; // ISO timestamp
}

export interface PendingItem {
  id: string;
  box_id: string;
  sku: string;
  name?: string;
  qty: number;
  expiry?: string;
  scannedAt: string; // ISO timestamp
}

export type AlertType = 'low_stock' | 'expiry' | 'misplacement';

export interface WarehouseAlert {
  id: string;
  type: AlertType;
  sku: string;
  slot?: number | null;
  title: string;
  message: string;
  timestamp: string;
  severity: 'amber' | 'red';
  dismissed?: boolean;
}

export interface StockDataPoint {
  date: string;
  stock: number;
  shelfStock?: number;
  timestamp?: number;
}
