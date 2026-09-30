import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db, enableNetwork, disableNetwork } from '../firebase';
import {
  Product,
  RackSlot,
  WarehouseAlert,
  WarehouseEvent,
  PendingItem,
  StockDataPoint,
} from '../types';
import {
  INITIAL_PRODUCTS,
  BARCODE_LOOKUP,
  INITIAL_SLOTS,
  INITIAL_ALERTS,
  INITIAL_EVENTS,
} from '../data/initialData';
import { validateWarehouseEvent } from '../utils/eventValidator';

export interface ForecastResult {
  days: number | null;
  displayText: string;
  dailyBurnRate: number | null;
  currentStock: number;
  status: 'critical' | 'warning' | 'healthy' | 'unknown';
}

interface WarehouseContextType {
  products: Record<string, Product>;
  barcodeMap: Record<string, string>;
  slots: RackSlot[];
  pendingItems: PendingItem[];
  alerts: WarehouseAlert[];
  events: WarehouseEvent[];
  connectionStatus: 'connected' | 'disconnected';
  lastSynced: string;
  autoSimulate: boolean;
  hardwareMode: boolean;
  activeView: 'scan' | 'monitor';
  selectedSku: string;
  syncError: string | null;
  clearSyncError: () => void;
  setActiveView: (view: 'scan' | 'monitor') => void;
  setSelectedSku: (sku: string) => void;
  toggleHardwareMode: () => void;
  toggleConnectionStatus: () => Promise<void>;
  toggleAutoSimulate: () => void;
  lookupBarcode: (barcode: string) => { product: Product | null; barcode: string };
  registerProduct: (productData: {
    barcode: string;
    sku: string;
    name: string;
    qty_per_box: number;
    expiry: string;
    category?: string;
    min_safety_stock?: number;
  }) => Promise<Product>;
  addPendingItem: (product: Product, barcode: string) => Promise<PendingItem>;
  removePendingItem: (id: string) => Promise<void>;
  assignPendingToSlot: (pendingId: string, slotNumber: number) => Promise<boolean>;
  manualSlotOverride: (
    slotNumber: number,
    action: 'empty' | 'restock',
    skuToPlace?: string
  ) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  triggerManualAlert: (
    type: WarehouseAlert['type'],
    sku: string,
    slot?: number
  ) => Promise<void>;
  processEvent: (rawEvent: unknown) => Promise<boolean>;
  triggerRandomEvent: () => Promise<void>;
  getStockTrend: (sku: string) => StockDataPoint[];
  getDaysUntilStockout: (sku: string) => ForecastResult;
  lastConfirmation: { name: string; qty: number; timestamp: number } | null;
  clearConfirmation: () => void;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

export const WarehouseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Empty initial data (no mock data)
  const [products, setProducts] = useState<Record<string, Product>>(INITIAL_PRODUCTS);
  const [barcodeMap, setBarcodeMap] = useState<Record<string, string>>(BARCODE_LOOKUP);
  const [slots, setSlots] = useState<RackSlot[]>(INITIAL_SLOTS);
  const [alerts, setAlerts] = useState<WarehouseAlert[]>(INITIAL_ALERTS);
  const [events, setEvents] = useState<WarehouseEvent[]>(INITIAL_EVENTS);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Telemetry & Settings
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');
  const [lastSynced, setLastSynced] = useState<string>(new Date().toISOString());
  const [autoSimulate, setAutoSimulate] = useState<boolean>(false); // Default to false
  const [hardwareMode, setHardwareMode] = useState<boolean>(true); // Default ON
  const [activeView, setActiveView] = useState<'scan' | 'monitor'>('scan');
  const [selectedSku, setSelectedSku] = useState<string>(''); // Default to first registered or empty
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastConfirmation, setLastConfirmation] = useState<{
    name: string;
    qty: number;
    timestamp: number;
  } | null>(null);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  const clearConfirmation = useCallback(() => {
    setLastConfirmation(null);
  }, []);

  const toggleHardwareMode = useCallback(() => {
    setHardwareMode((prev) => !prev);
  }, []);

  // Update selectedSku when products list changes if empty or invalidated
  useEffect(() => {
    const keys = Object.keys(products);
    if (keys.length > 0) {
      if (!selectedSku || !products[selectedSku]) {
        setSelectedSku(keys[0]);
      }
    } else {
      setSelectedSku('');
    }
  }, [products, selectedSku]);

  // Ensure Slots 1 to 8 exist in Firestore if collection is empty
  useEffect(() => {
    let isMounted = true;
    async function ensureEmptySlotsInFirestore() {
      try {
        const snap = await getDocs(collection(db, 'warehouse_slots'));
        if (isMounted && snap.empty) {
          // Initialize 8 empty slots in Firestore
          for (let i = 1; i <= 8; i++) {
            await setDoc(doc(db, 'warehouse_slots', String(i)), {
              slot: i,
              isOccupied: false,
              currentSku: null,
              productName: null,
              qty: null,
              lastStatusChange: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn('Check empty slots error:', err);
      }
    }
    ensureEmptySlotsInFirestore();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Listen to warehouse_events (limit 500, newest first)
    const eventsQuery = query(
      collection(db, 'warehouse_events'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const liveEvents: WarehouseEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          liveEvents.push({
            ...data,
            id: docSnap.id,
            event_type: data.event_type,
            sku: data.sku,
            slot: data.slot ?? null,
            timestamp: data.timestamp,
            qty: data.qty,
            warehouse_delta: data.warehouse_delta,
            shelf_delta: data.shelf_delta,
            details: data.details,
            box_id: data.box_id,
            expiry: data.expiry,
            total_stock_out: data.total_stock_out,
            since_timestamp: data.since_timestamp,
            expected_sku: data.expected_sku,
            detected_sku: data.detected_sku,
            metadata: data.metadata,
          });
        });

        setEvents(liveEvents);
        setLastSynced(new Date().toISOString());
        setSyncError(null);
      },
      (error) => {
        console.error('Firestore events sync error:', error);
        setSyncError(`Events sync error: ${error.message}`);
      }
    );

    // 2. Listen to warehouse_slots (Slots 1-8)
    const slotsQuery = collection(db, 'warehouse_slots');
    const unsubscribeSlots = onSnapshot(
      slotsQuery,
      (snapshot) => {
        const slotMap: Record<number, RackSlot> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const slotNum = Number(data.slot || docSnap.id);
          if (slotNum >= 1 && slotNum <= 8) {
            slotMap[slotNum] = {
              slot: slotNum,
              isOccupied: Boolean(data.isOccupied),
              currentSku: data.currentSku || null,
              productName: data.productName || null,
              qty: data.qty !== undefined ? Number(data.qty) : null,
              lastStatusChange: data.lastStatusChange || new Date().toISOString(),
            };
          }
        });

        const updatedSlots: RackSlot[] = [];
        for (let i = 1; i <= 8; i++) {
          if (slotMap[i]) {
            updatedSlots.push(slotMap[i]);
          } else {
            updatedSlots.push({
              slot: i,
              isOccupied: false,
              currentSku: null,
              productName: null,
              qty: null,
              lastStatusChange: new Date().toISOString(),
            });
          }
        }

        setSlots(updatedSlots);
        setLastSynced(new Date().toISOString());
      },
      (error) => {
        console.error('Firestore slots sync error:', error);
        setSyncError(`Slots sync error: ${error.message}`);
      }
    );

    // 3. Listen to warehouse_alerts (ordered by timestamp desc)
    const alertsQuery = query(
      collection(db, 'warehouse_alerts'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeAlerts = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const liveAlerts: WarehouseAlert[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.dismissed) {
            liveAlerts.push({
              id: docSnap.id,
              type: data.type,
              sku: data.sku,
              slot: data.slot ?? null,
              title: data.title,
              message: data.message,
              timestamp: data.timestamp,
              severity: data.severity || 'amber',
              dismissed: Boolean(data.dismissed),
            });
          }
        });

        setAlerts(liveAlerts);
        setLastSynced(new Date().toISOString());
      },
      (error) => {
        console.error('Firestore alerts sync error:', error);
        setSyncError(`Alerts sync error: ${error.message}`);
      }
    );

    // 4. Listen to warehouse_products
    const productsQuery = collection(db, 'warehouse_products');
    const unsubscribeProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        const prodMap: Record<string, Product> = {};
        const barcodeMapUpdate: Record<string, string> = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const sku = data.sku || docSnap.id;
          const prod: Product = {
            sku,
            name: data.name || sku,
            qty_per_box: Number(data.qty_per_box) || 10,
            expiry: data.expiry || '2027-01-01',
            category: data.category || 'General',
            min_safety_stock: data.min_safety_stock ?? 10,
            barcode: data.barcode,
          };
          prodMap[sku] = prod;
          barcodeMapUpdate[sku] = sku;
          if (data.barcode) {
            barcodeMapUpdate[data.barcode] = sku;
          }
        });

        setProducts(prodMap);
        setBarcodeMap(barcodeMapUpdate);
        setLastSynced(new Date().toISOString());
      },
      (error) => {
        console.error('Firestore products sync error:', error);
        setSyncError(`Products sync error: ${error.message}`);
      }
    );

    // 5. Listen to warehouse_pending (Firestore collection)
    const pendingQuery = query(
      collection(db, 'warehouse_pending'),
      orderBy('scannedAt', 'desc')
    );

    const unsubscribePending = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const livePending: PendingItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          livePending.push({
            id: docSnap.id,
            box_id: data.box_id || docSnap.id,
            sku: data.sku,
            name: data.name || data.sku,
            qty: Number(data.qty) || 10,
            expiry: data.expiry,
            scannedAt: data.scannedAt || new Date().toISOString(),
          });
        });

        setPendingItems(livePending);
      },
      (error) => {
        console.error('Firestore pending sync error:', error);
      }
    );

    return () => {
      unsubscribeEvents();
      unsubscribeSlots();
      unsubscribeAlerts();
      unsubscribeProducts();
      unsubscribePending();
    };
  }, []);

  // Network monitoring
  useEffect(() => {
    const handleOnline = async () => {
      try {
        await enableNetwork(db);
        setConnectionStatus('connected');
        setSyncError(null);
      } catch (err) {
        console.warn('Network enable error:', err);
      }
    };

    const handleOffline = async () => {
      try {
        await disableNetwork(db);
        setConnectionStatus('disconnected');
      } catch (err) {
        console.warn('Network disable error:', err);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleConnectionStatus = useCallback(async () => {
    try {
      if (connectionStatus === 'connected') {
        await disableNetwork(db);
        setConnectionStatus('disconnected');
      } else {
        await enableNetwork(db);
        setConnectionStatus('connected');
        setSyncError(null);
      }
      setLastSynced(new Date().toISOString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(`Connection toggle failed: ${msg}`);
    }
  }, [connectionStatus]);

  // Helper to re-check safety stock for a SKU and auto-create/clear low_stock alert
  const checkSafetyStockForSku = useCallback(
    async (sku: string, updatedSlots: RackSlot[]) => {
      if (!sku) return;
      const prod = products[sku];
      if (!prod) return;

      const minSafety = prod.min_safety_stock ?? 10;
      const currentRackStock = updatedSlots
        .filter((s) => s.isOccupied && s.currentSku === sku)
        .reduce((sum, s) => sum + (s.qty || 0), 0);

      const alertDocId = `low_stock_${sku}`;

      try {
        if (currentRackStock < minSafety) {
          await setDoc(doc(db, 'warehouse_alerts', alertDocId), {
            id: alertDocId,
            type: 'low_stock',
            sku,
            slot: null,
            title: 'Critical Low Rack Stock',
            message: `Current rack stock for ${prod.name} (${currentRackStock} units) is below minimum safety threshold (${minSafety} units).`,
            timestamp: new Date().toISOString(),
            severity: 'amber',
            dismissed: false,
          });
        } else {
          // Clear alert if restocked
          await deleteDoc(doc(db, 'warehouse_alerts', alertDocId));
        }
      } catch (err) {
        console.warn('Auto safety stock alert error:', err);
      }
    },
    [products]
  );

  // Strict processEvent: Writes event to Firestore & reconciles slot/alert documents
  const processEvent = useCallback(
    async (rawEvent: unknown): Promise<boolean> => {
      const validation = validateWarehouseEvent(rawEvent);
      if (!validation.isValid || !validation.sanitizedEvent) {
        return false;
      }

      const event = validation.sanitizedEvent;

      try {
        // Look up sku for box_removed_pending from slot doc if not provided
        let effectiveSku = event.sku;
        if (event.event_type === 'box_removed_pending' && !effectiveSku && event.slot) {
          const currentSlotDoc = slots.find((s) => s.slot === event.slot);
          effectiveSku = currentSlotDoc?.currentSku || 'UNKNOWN';
          event.sku = effectiveSku;
        }

        // 1. Add event to warehouse_events
        await addDoc(collection(db, 'warehouse_events'), {
          ...event,
          sku: event.sku || effectiveSku || 'UNKNOWN',
        });

        // Track updated slots to check low_stock safety
        let nextSlots = [...slots];

        // 2. Reconcile Firestore warehouse_slots
        if (event.event_type === 'box_placed' && event.slot) {
          const prod = products[event.sku || ''];
          const slotPayload = {
            slot: event.slot,
            isOccupied: true,
            currentSku: event.sku || null,
            productName: prod ? prod.name : 'Unknown Product',
            qty: event.qty || prod?.qty_per_box || 10,
            lastStatusChange: event.timestamp,
          };

          await setDoc(
            doc(db, 'warehouse_slots', String(event.slot)),
            slotPayload,
            { merge: true }
          );

          nextSlots = nextSlots.map((s) => (s.slot === event.slot ? slotPayload : s));

          // Auto-remove a pending item for the same SKU when box_placed arrives after its scan time (oldest first)
          try {
            const candidatePending = pendingItems
              .filter(
                (p) =>
                  p.sku === event.sku &&
                  Date.parse(p.scannedAt) <= Date.parse(event.timestamp)
              )
              .sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));

            if (candidatePending.length > 0) {
              const oldest = candidatePending[0];
              await deleteDoc(doc(db, 'warehouse_pending', oldest.id));
            }
          } catch (pendingErr) {
            console.warn('Auto remove pending item note:', pendingErr);
          }
        } else if (
          (event.event_type === 'box_removed_pending' || event.event_type === 'restock_to_shelf') &&
          event.slot
        ) {
          const slotPayload = {
            slot: event.slot,
            isOccupied: false,
            currentSku: null,
            productName: null,
            qty: null,
            lastStatusChange: event.timestamp,
          };

          await setDoc(
            doc(db, 'warehouse_slots', String(event.slot)),
            slotPayload,
            { merge: true }
          );

          nextSlots = nextSlots.map((s) => (s.slot === event.slot ? slotPayload : s));
        }

        // Check safety stock for affected SKU
        if (effectiveSku || event.sku) {
          checkSafetyStockForSku(effectiveSku || event.sku || '', nextSlots);
        }

        // 3. Reconcile Firestore alerts
        if (event.event_type === 'misplacement_flagged') {
          await addDoc(collection(db, 'warehouse_alerts'), {
            type: 'misplacement',
            sku: event.sku || (event.expected_sku as string) || (event.detected_sku as string) || 'UNKNOWN',
            slot: event.slot ?? null,
            title: 'Sensor Misplacement Warning',
            message:
              event.details ||
              `Slot ${event.slot ?? 'unknown'} flagged: Expected ${event.expected_sku || 'item'}, detected ${
                event.detected_sku || 'mismatch'
              }.`,
            timestamp: event.timestamp,
            severity: 'amber',
            dismissed: false,
          });
        } else if (event.event_type === 'expiry_alert') {
          await addDoc(collection(db, 'warehouse_alerts'), {
            type: 'expiry',
            sku: event.sku || 'UNKNOWN',
            slot: event.slot ?? null,
            title: 'Batch Expiry Near Threshold',
            message:
              event.details ||
              `SKU ${event.sku} nearing rotation deadline. Expedite transfer to floor.`,
            timestamp: event.timestamp,
            severity: 'red',
            dismissed: false,
          });
        }

        setLastSynced(new Date().toISOString());
        return true;
      } catch (err: unknown) {
        console.error('Firestore processEvent write error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setSyncError(`Failed to sync event to Firestore: ${msg}`);
        return false;
      }
    },
    [slots, products, pendingItems, checkSafetyStockForSku]
  );

  const lookupBarcode = useCallback(
    (barcode: string): { product: Product | null; barcode: string } => {
      const clean = barcode.trim();
      const mappedSku =
        barcodeMap[clean] || barcodeMap[clean.toUpperCase()] || (products[clean] ? clean : null);
      if (mappedSku && products[mappedSku]) {
        return { product: products[mappedSku], barcode: clean };
      }
      return { product: null, barcode: clean };
    },
    [barcodeMap, products]
  );

  // Register product in warehouse_products collection
  const registerProduct = useCallback(
    async (data: {
      barcode: string;
      sku: string;
      name: string;
      qty_per_box: number;
      expiry: string;
      category?: string;
      min_safety_stock?: number;
    }): Promise<Product> => {
      const formattedSku = data.sku.trim();
      const newProd: Product = {
        sku: formattedSku,
        name: data.name.trim(),
        qty_per_box: Number(data.qty_per_box) || 10,
        expiry: data.expiry,
        category: data.category || 'General Grocery',
        min_safety_stock: data.min_safety_stock ?? Math.max(Number(data.qty_per_box) * 2, 10),
        barcode: data.barcode.trim(),
      };

      try {
        await setDoc(doc(db, 'warehouse_products', formattedSku), newProd);

        await processEvent({
          event_type: 'scan_in',
          sku: formattedSku,
          box_id: data.barcode.trim(),
          qty: newProd.qty_per_box,
          expiry: newProd.expiry,
          timestamp: new Date().toISOString(),
          details: `Registered new product ${newProd.name} (${formattedSku}) via dock scanner`,
        });

        return newProd;
      } catch (err: unknown) {
        console.error('Firestore registerProduct error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setSyncError(`Failed to save product to Firestore: ${msg}`);
        return newProd;
      }
    },
    [processEvent]
  );

  // Add pending item into Firestore "warehouse_pending" collection
  const addPendingItem = useCallback(
    async (product: Product, barcode: string): Promise<PendingItem> => {
      const box_id = barcode.trim();
      const nowIso = new Date().toISOString();

      const pendingPayload = {
        box_id,
        sku: product.sku,
        name: product.name,
        qty: product.qty_per_box,
        expiry: product.expiry,
        scannedAt: nowIso,
      };

      try {
        const docRef = await addDoc(collection(db, 'warehouse_pending'), pendingPayload);

        const item: PendingItem = {
          id: docRef.id,
          ...pendingPayload,
        };

        setLastConfirmation({
          name: product.name,
          qty: product.qty_per_box,
          timestamp: Date.now(),
        });

        // Write scan_in event with { sku, box_id, qty, expiry }
        await processEvent({
          event_type: 'scan_in',
          sku: product.sku,
          box_id,
          qty: product.qty_per_box,
          expiry: product.expiry,
          timestamp: nowIso,
          details: `Scanned box ID: ${box_id} (${product.name}) — Placed in pending queue`,
        });

        return item;
      } catch (err) {
        console.error('Error adding pending item:', err);
        throw err;
      }
    },
    [processEvent]
  );

  const removePendingItem = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'warehouse_pending', id));
    } catch (err) {
      console.warn('Error deleting pending item:', err);
    }
  }, []);

  const assignPendingToSlot = useCallback(
    async (pendingId: string, slotNumber: number): Promise<boolean> => {
      const item = pendingItems.find((p) => p.id === pendingId);
      if (!item) return false;

      const targetSlot = slots.find((s) => s.slot === slotNumber);
      if (!targetSlot) return false;

      const nowIso = new Date().toISOString();

      // Delete from pending in Firestore
      await removePendingItem(pendingId);

      // Process event through Firestore
      const ok = await processEvent({
        event_type: 'box_placed',
        slot: slotNumber,
        sku: item.sku,
        box_id: item.box_id,
        timestamp: nowIso,
        qty: item.qty,
        warehouse_delta: item.qty,
        details: `Box ${item.box_id} (${item.name || item.sku}) assigned to Slot ${slotNumber}`,
      });

      return ok;
    },
    [pendingItems, slots, removePendingItem, processEvent]
  );

  const manualSlotOverride = useCallback(
    async (slotNumber: number, action: 'empty' | 'restock', skuToPlace?: string) => {
      const targetSlot = slots.find((s) => s.slot === slotNumber);
      if (!targetSlot) return;

      const nowIso = new Date().toISOString();

      if (action === 'empty') {
        const previousSku = targetSlot.currentSku || 'UNKNOWN';
        await processEvent({
          event_type: 'box_removed_pending',
          slot: slotNumber,
          sku: previousSku,
          timestamp: nowIso,
          details: `Manual sensor override by manager: Slot ${slotNumber} marked EMPTY`,
        });
      } else {
        const firstSku = Object.keys(products)[0] || '';
        const chosenSku = skuToPlace || targetSlot.currentSku || firstSku;
        if (!chosenSku) {
          setSyncError('Cannot restock slot: No products registered in catalog.');
          return;
        }
        const prod = products[chosenSku];
        const qty = prod ? prod.qty_per_box : 10;

        await processEvent({
          event_type: 'box_placed',
          slot: slotNumber,
          sku: chosenSku,
          timestamp: nowIso,
          qty,
          warehouse_delta: qty,
          details: `Manual sensor override: Slot ${slotNumber} force-marked RESTOCKED (${chosenSku})`,
        });
      }
    },
    [slots, products, processEvent]
  );

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'warehouse_alerts', alertId));
      setLastSynced(new Date().toISOString());
    } catch (err: unknown) {
      console.error('Firestore dismissAlert error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setSyncError(`Failed to dismiss alert in Firestore: ${msg}`);
    }
  }, []);

  const triggerManualAlert = useCallback(
    async (type: WarehouseAlert['type'], sku: string, slot?: number) => {
      const prod = products[sku];
      const prodName = prod ? prod.name : sku;
      const titles: Record<WarehouseAlert['type'], string> = {
        low_stock: 'Critical Low Stock Warning',
        expiry: 'Impending Batch Expiry',
        misplacement: 'Embedded Slot Tag Anomaly',
      };
      const messages: Record<WarehouseAlert['type'], string> = {
        low_stock: `Warehouse inventory for ${prodName} critically depleted. Reorder advised.`,
        expiry: `Batch ${sku} shelf-life nearing expiry date. Expedite transfer to sales floor.`,
        misplacement: `Weight / optical mismatch on Slot ${slot || '?'}. Physical audit required.`,
      };

      const nowIso = new Date().toISOString();

      try {
        await addDoc(collection(db, 'warehouse_alerts'), {
          type,
          sku,
          slot: slot ?? null,
          title: titles[type],
          message: messages[type],
          timestamp: nowIso,
          severity: type === 'expiry' ? 'red' : 'amber',
          dismissed: false,
        });

        await processEvent({
          event_type:
            type === 'expiry'
              ? 'expiry_alert'
              : type === 'misplacement'
              ? 'misplacement_flagged'
              : 'warehouse_audit',
          sku,
          slot: slot ?? null,
          timestamp: nowIso,
          details: `Diagnostic alert generated: ${titles[type]}`,
        });
      } catch (err: unknown) {
        console.error('Firestore triggerManualAlert error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setSyncError(`Failed to create alert in Firestore: ${msg}`);
      }
    },
    [products, processEvent]
  );

  const toggleAutoSimulate = useCallback(() => {
    setAutoSimulate((prev) => !prev);
  }, []);

  // 2. REAL FORECAST:
  // For each SKU, daily rate = total qty of restock_to_shelf events in the last 7 days
  // divided by max(days since that SKU's first restock event, 1).
  // days_until_stockout = current rack stock / rate.
  // If there are no restock events, show "No usage data yet" instead of a number.
  const getDaysUntilStockout = useCallback(
    (sku: string): ForecastResult => {
      const currentStock = slots
        .filter((s) => s.isOccupied && s.currentSku === sku)
        .reduce((sum, s) => sum + (s.qty || 0), 0);

      if (!sku) {
        return {
          days: null,
          displayText: 'No usage data yet',
          dailyBurnRate: null,
          currentStock: 0,
          status: 'unknown',
        };
      }

      const allRestockEvents = events.filter(
        (e) => e.sku === sku && e.event_type === 'restock_to_shelf'
      );

      if (allRestockEvents.length === 0) {
        return {
          days: null,
          displayText: 'No usage data yet',
          dailyBurnRate: null,
          currentStock,
          status: 'unknown',
        };
      }

      // First restock event timestamp
      const timestamps = allRestockEvents
        .map((e) => Date.parse(e.timestamp))
        .filter((t) => !isNaN(t));

      if (timestamps.length === 0) {
        return {
          days: null,
          displayText: 'No usage data yet',
          dailyBurnRate: null,
          currentStock,
          status: 'unknown',
        };
      }

      const firstRestockTime = Math.min(...timestamps);
      const daysSinceFirst = Math.max((Date.now() - firstRestockTime) / (24 * 3600 * 1000), 1);

      // Restock events in last 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const recentRestocks = allRestockEvents.filter(
        (e) => Date.parse(e.timestamp) >= sevenDaysAgo
      );

      const totalQty = recentRestocks.reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
      const dailyRate = totalQty / daysSinceFirst;

      if (dailyRate <= 0) {
        return {
          days: null,
          displayText: 'No usage data yet',
          dailyBurnRate: 0,
          currentStock,
          status: 'unknown',
        };
      }

      const daysRemaining = Number((currentStock / dailyRate).toFixed(1));

      let status: 'critical' | 'warning' | 'healthy' | 'unknown' = 'healthy';
      if (daysRemaining <= 3) {
        status = 'critical';
      } else if (daysRemaining <= 7) {
        status = 'warning';
      }

      return {
        days: daysRemaining,
        displayText: `${daysRemaining} days`,
        dailyBurnRate: Number(dailyRate.toFixed(1)),
        currentStock,
        status,
      };
    },
    [slots, events]
  );

  // 3. REAL TREND:
  // Build each SKU's warehouse stock over time by replaying box_placed (+qty)
  // and restock_to_shelf (-qty) events; show empty state when no data.
  const getStockTrend = useCallback(
    (sku: string): StockDataPoint[] => {
      if (!sku) return [];

      const relevant = events
        .filter(
          (e) =>
            e.sku === sku &&
            (e.event_type === 'box_placed' || e.event_type === 'restock_to_shelf')
        )
        .slice()
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)); // Chronological: oldest to newest

      if (relevant.length === 0) {
        return [];
      }

      let runningStock = 0;
      const points: StockDataPoint[] = [];

      for (const evt of relevant) {
        const qty = Number(evt.qty) || 1;
        if (evt.event_type === 'box_placed') {
          runningStock += qty;
        } else if (evt.event_type === 'restock_to_shelf') {
          runningStock = Math.max(0, runningStock - qty);
        }

        const d = new Date(evt.timestamp);
        const dateLabel = isNaN(d.getTime())
          ? evt.timestamp
          : d.toLocaleDateString([], { month: 'numeric', day: 'numeric' }) +
            ' ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        points.push({
          date: dateLabel,
          stock: runningStock,
          timestamp: Date.parse(evt.timestamp),
        });
      }

      return points;
    },
    [events]
  );

  // 1. RANDOM SIMULATION:
  // Simulated events must include metadata.simulated = true and only use registered products.
  const triggerRandomEvent = useCallback(async () => {
    const skuKeys = Object.keys(products);
    if (skuKeys.length === 0) {
      console.warn('Simulation skipped: No registered products in catalog.');
      return;
    }

    const randomSku = skuKeys[Math.floor(Math.random() * skuKeys.length)];
    const prod = products[randomSku];

    const possibleActions = [
      'restock_shelf',
      'cart_purchase',
      'box_placed',
      'box_removed',
      'audit',
      'alert',
    ];
    const action = possibleActions[Math.floor(Math.random() * possibleActions.length)];
    const nowIso = new Date().toISOString();

    if (action === 'restock_shelf') {
      const occupied = slots.filter((s) => s.isOccupied);
      if (occupied.length > 0) {
        const slotObj = occupied[Math.floor(Math.random() * occupied.length)];
        const qty = Math.min(slotObj.qty || 6, 4);
        await processEvent({
          event_type: 'restock_to_shelf',
          slot: slotObj.slot,
          sku: slotObj.currentSku || randomSku,
          timestamp: nowIso,
          qty,
          warehouse_delta: -qty,
          shelf_delta: qty,
          details: `Autonomous AGV transfer to Gondola: ${qty} units of ${
            slotObj.productName || slotObj.currentSku
          }`,
          metadata: { simulated: true },
        });
      }
    } else if (action === 'cart_purchase') {
      const qty = Math.floor(Math.random() * 3) + 1;
      await processEvent({
        event_type: 'purchase_confirmed',
        sku: randomSku,
        timestamp: nowIso,
        qty,
        shelf_delta: -qty,
        details: `Smart shopping cart RFID gate checkout: ${qty}x ${prod?.name || randomSku}`,
        metadata: { simulated: true },
      });
    } else if (action === 'box_placed') {
      const emptySlots = slots.filter((s) => !s.isOccupied);
      if (emptySlots.length > 0) {
        const target = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        const qty = prod?.qty_per_box || 10;
        await processEvent({
          event_type: 'box_placed',
          slot: target.slot,
          sku: randomSku,
          timestamp: nowIso,
          qty,
          warehouse_delta: qty,
          details: `Pallet intake sensor placed ${prod?.name || randomSku} in Slot ${target.slot}`,
          metadata: { simulated: true },
        });
      }
    } else if (action === 'box_removed') {
      const occupied = slots.filter((s) => s.isOccupied);
      if (occupied.length > 1) {
        const target = occupied[Math.floor(Math.random() * occupied.length)];
        await processEvent({
          event_type: 'box_removed_pending',
          slot: target.slot,
          sku: target.currentSku || randomSku,
          timestamp: nowIso,
          details: `Forklift removed container from Slot ${target.slot} for staging`,
          metadata: { simulated: true },
        });
      }
    } else if (action === 'audit') {
      const slotNum = Math.floor(Math.random() * 8) + 1;
      await processEvent({
        event_type: 'warehouse_audit',
        slot: slotNum,
        sku: randomSku,
        total_stock_out: Math.floor(Math.random() * 20) + 5,
        since_timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        timestamp: nowIso,
        details: `ESP32 embedded lidar audit validated inventory throughput`,
        metadata: { simulated: true },
      });
    } else if (action === 'alert') {
      if (alerts.length < 6) {
        const alertTypes: WarehouseAlert['type'][] = ['low_stock', 'expiry', 'misplacement'];
        const chosenType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const slotNum = Math.floor(Math.random() * 8) + 1;
        await triggerManualAlert(chosenType, randomSku, slotNum);
      }
    }
  }, [products, slots, alerts, processEvent, triggerManualAlert]);

  // Periodic simulation timer (only when autoSimulate is true)
  useEffect(() => {
    if (!autoSimulate || connectionStatus === 'disconnected') return;

    const interval = setInterval(() => {
      triggerRandomEvent();
    }, 12000);

    return () => clearInterval(interval);
  }, [autoSimulate, connectionStatus, triggerRandomEvent]);

  const value = useMemo(
    () => ({
      products,
      barcodeMap,
      slots,
      pendingItems,
      alerts,
      events,
      connectionStatus,
      lastSynced,
      autoSimulate,
      hardwareMode,
      activeView,
      selectedSku,
      syncError,
      clearSyncError,
      setActiveView,
      setSelectedSku,
      toggleHardwareMode,
      toggleConnectionStatus,
      toggleAutoSimulate,
      lookupBarcode,
      registerProduct,
      addPendingItem,
      removePendingItem,
      assignPendingToSlot,
      manualSlotOverride,
      dismissAlert,
      triggerManualAlert,
      processEvent,
      triggerRandomEvent,
      getStockTrend,
      getDaysUntilStockout,
      lastConfirmation,
      clearConfirmation,
    }),
    [
      products,
      barcodeMap,
      slots,
      pendingItems,
      alerts,
      events,
      connectionStatus,
      lastSynced,
      autoSimulate,
      hardwareMode,
      activeView,
      selectedSku,
      syncError,
      clearSyncError,
      toggleHardwareMode,
      toggleConnectionStatus,
      toggleAutoSimulate,
      lookupBarcode,
      registerProduct,
      addPendingItem,
      removePendingItem,
      assignPendingToSlot,
      manualSlotOverride,
      dismissAlert,
      triggerManualAlert,
      processEvent,
      triggerRandomEvent,
      getStockTrend,
      getDaysUntilStockout,
      lastConfirmation,
      clearConfirmation,
    ]
  );

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
};

export const useWarehouse = (): WarehouseContextType => {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
};
