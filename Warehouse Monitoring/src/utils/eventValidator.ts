import { WarehouseEvent, EventType } from '../types';

export const VALID_EVENT_TYPES: EventType[] = [
  'scan_in',
  'box_placed',
  'box_removed_pending',
  'restock_to_shelf',
  'misplacement_flagged',
  'expiry_alert',
  'purchase_confirmed',
  'warehouse_audit',
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedEvent?: WarehouseEvent;
}

/**
 * Validates incoming warehouse events per event type:
 * - sku is required except for:
 *   - box_removed_pending (slot required; sku looked up from slot doc if not provided)
 *   - misplacement_flagged (slot required; accepts expected_sku / detected_sku)
 * - warehouse_audit requires sku, total_stock_out and since_timestamp
 * - All events require valid event_type and timestamp
 * - Extra fields (box_id, expiry, etc.) are preserved
 */
export function validateWarehouseEvent(event: unknown): ValidationResult {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    errors.push('Event payload must be a non-null object');
    return { isValid: false, errors };
  }

  const raw = event as Record<string, unknown>;

  // Check event_type
  if (!raw.event_type || typeof raw.event_type !== 'string') {
    errors.push('Missing or invalid "event_type"');
  } else if (!VALID_EVENT_TYPES.includes(raw.event_type as EventType)) {
    errors.push(`Unknown "event_type": "${raw.event_type}"`);
  }

  const eventType = raw.event_type as EventType;

  // Check timestamp
  if (!raw.timestamp || typeof raw.timestamp !== 'string') {
    errors.push('Missing or invalid "timestamp" (must be ISO string)');
  } else {
    const parsedDate = Date.parse(raw.timestamp);
    if (isNaN(parsedDate)) {
      errors.push(`Invalid timestamp format: "${raw.timestamp}"`);
    }
  }

  // Helper for slot validation
  const validateSlotNumber = (isRequired: boolean) => {
    if (raw.slot === undefined || raw.slot === null) {
      if (isRequired) {
        errors.push(`"slot" is required for event type "${eventType}"`);
      }
      return null;
    }
    const slotNum = Number(raw.slot);
    if (!Number.isInteger(slotNum) || slotNum < 1 || slotNum > 8) {
      errors.push(`Slot must be an integer between 1 and 8, received: ${raw.slot}`);
      return null;
    }
    return slotNum;
  };

  // Helper for sku validation
  const hasValidSku = typeof raw.sku === 'string' && raw.sku.trim().length > 0;

  // Validate per event type
  if (eventType === 'box_removed_pending') {
    validateSlotNumber(true);
    // sku is optional; can be looked up from slot
  } else if (eventType === 'misplacement_flagged') {
    validateSlotNumber(true);
    const hasExpected = typeof raw.expected_sku === 'string' && raw.expected_sku.trim().length > 0;
    const hasDetected = typeof raw.detected_sku === 'string' && raw.detected_sku.trim().length > 0;
    if (!hasValidSku && !hasExpected && !hasDetected) {
      errors.push('misplacement_flagged requires either "sku", or "expected_sku" / "detected_sku"');
    }
  } else if (eventType === 'warehouse_audit') {
    if (!hasValidSku) {
      errors.push('"sku" is required for warehouse_audit');
    }
    if (raw.total_stock_out === undefined || raw.total_stock_out === null) {
      errors.push('"total_stock_out" is required for warehouse_audit');
    } else {
      const totalNum = Number(raw.total_stock_out);
      if (!Number.isFinite(totalNum)) {
        errors.push('"total_stock_out" must be a valid number');
      }
    }
    if (!raw.since_timestamp || typeof raw.since_timestamp !== 'string' || isNaN(Date.parse(raw.since_timestamp))) {
      errors.push('"since_timestamp" is required and must be a valid timestamp for warehouse_audit');
    }
    validateSlotNumber(false);
  } else {
    // Other event types: sku is required
    if (!hasValidSku) {
      errors.push(`"sku" is required for event type "${eventType}"`);
    }
    validateSlotNumber(false);
  }

  // Validate qty if provided
  if (raw.qty !== undefined && raw.qty !== null) {
    const qtyNum = Number(raw.qty);
    if (!Number.isFinite(qtyNum)) {
      errors.push(`qty must be a finite number, received: ${raw.qty}`);
    }
  }

  if (errors.length > 0) {
    console.warn('[Warehouse Event Validation Warning] Ignored malformed event:', {
      event,
      errors,
    });
    return { isValid: false, errors };
  }

  // Build sanitized event, preserving all extra fields
  const slotVal = raw.slot !== undefined && raw.slot !== null ? Number(raw.slot) : null;
  const sanitized: WarehouseEvent = {
    ...raw, // preserves extra fields like box_id, expiry, total_stock_out, etc.
    id:
      typeof raw.id === 'string' && raw.id
        ? raw.id
        : `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    event_type: eventType,
    sku: typeof raw.sku === 'string' ? raw.sku.trim() : (raw.expected_sku as string) || (raw.detected_sku as string) || undefined,
    timestamp: String(raw.timestamp),
    slot: slotVal,
    qty: raw.qty !== undefined && raw.qty !== null ? Number(raw.qty) : undefined,
    warehouse_delta: raw.warehouse_delta !== undefined ? Number(raw.warehouse_delta) : undefined,
    shelf_delta: raw.shelf_delta !== undefined ? Number(raw.shelf_delta) : undefined,
    details: typeof raw.details === 'string' ? raw.details : undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : undefined,
  };

  return {
    isValid: true,
    errors: [],
    sanitizedEvent: sanitized,
  };
}
