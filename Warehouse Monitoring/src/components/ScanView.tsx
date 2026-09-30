import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useWarehouse } from '../context/WarehouseContext';
import {
  Camera,
  CheckCircle2,
  Clock,
  PlusCircle,
  X,
  Layers,
  Barcode as BarcodeIcon,
  AlertCircle,
  Sparkles,
  Cpu,
  RotateCcw,
} from 'lucide-react';

export const ScanView: React.FC = () => {
  const {
    lookupBarcode,
    registerProduct,
    addPendingItem,
    pendingItems,
    removePendingItem,
    assignPendingToSlot,
    slots,
    lastConfirmation,
    clearConfirmation,
    products,
    hardwareMode,
    toggleHardwareMode,
  } = useWarehouse();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [registeringBarcode, setRegisteringBarcode] = useState<string | null>(null);

  // New product registration form state
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdSku, setNewProdSku] = useState<string>('');
  const [newProdQty, setNewProdQty] = useState<number>(10);
  const [newProdExpiry, setNewProdExpiry] = useState<string>('2027-06-30');
  const [newProdCategory, setNewProdCategory] = useState<string>('Snacks');
  const [newProdMinSafety, setNewProdMinSafety] = useState<number>(10);

  // Scanner ref
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-reader-viewport';

  // Dynamic ticker for second-by-second countdown (ticks every 1s)
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Process a scanned or typed barcode string
  const handleBarcodeCaptured = async (barcodeStr: string) => {
    const clean = barcodeStr.trim();
    if (!clean) return;

    // Stop scanner if active
    stopScanner();

    // Look up in database
    const lookup = lookupBarcode(clean);
    if (lookup.product) {
      // Product exists -> Add to Firestore warehouse_pending & write scan_in event
      await addPendingItem(lookup.product, clean);
      setManualCode('');
      setRegisteringBarcode(null);
    } else {
      // Not in list -> Open registration form with SKU defaulting to exact barcode text (e.g. CHIPS-01 stays CHIPS-01)
      setRegisteringBarcode(clean);
      setNewProdSku(clean);
      setNewProdName('');
      setNewProdQty(10);
      setNewProdMinSafety(10);
      setNewProdExpiry(
        new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0]
      );
    }
  };

  // Start Camera Barcode Scanner
  const startScanner = async () => {
    setScannerError(null);
    setIsScanning(true);

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore
        }
      }

      setTimeout(async () => {
        try {
          const qrCode = new Html5Qrcode(scannerContainerId);
          html5QrCodeRef.current = qrCode;

          const config = {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
          };

          await qrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              handleBarcodeCaptured(decodedText);
            },
            () => {
              // scanning...
            }
          );
        } catch (err: unknown) {
          console.error('Camera init error:', err);
          setScannerError(
            err instanceof Error
              ? err.message
              : 'Camera access denied or unavailable. Use manual barcode input below.'
          );
          setIsScanning(false);
        }
      }, 100);
    } catch {
      setScannerError('Could not initialize camera feed. Please check camera permissions.');
      setIsScanning(false);
    }
  };

  // Stop Camera Scanner
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // Handle register new product submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registeringBarcode || !newProdName.trim() || !newProdSku.trim()) return;

    const registered = await registerProduct({
      barcode: registeringBarcode,
      sku: newProdSku.trim(),
      name: newProdName.trim(),
      qty_per_box: Number(newProdQty) || 10,
      expiry: newProdExpiry,
      category: newProdCategory,
      min_safety_stock: Number(newProdMinSafety) || 10,
    });

    await addPendingItem(registered, registeringBarcode);
    setRegisteringBarcode(null);
    setManualCode('');
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop();
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const registeredProductList = Object.values(products);

  return (
    <div className="space-y-6">
      {/* Top Banner Confirmation: Scanned: [name] — Qty [n] — place in rack */}
      {lastConfirmation && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 transition-all animate-fadeIn shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  Scanned: {lastConfirmation.name} — Qty {lastConfirmation.qty} — place in rack
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Package registered at receiving dock and synced to Firestore. Insert into any open rack slot.
                </p>
              </div>
            </div>
            <button
              onClick={clearConfirmation}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md hover:bg-emerald-100"
              title="Dismiss confirmation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Scan Control Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <BarcodeIcon className="w-5 h-5 text-slate-700" />
              Dock Intake Barcode Reader
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan packaging barcodes via camera or enter product barcode for intake.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-xs transition-colors w-full sm:w-auto"
              >
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>Scan Barcode (Camera)</span>
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors w-full sm:w-auto"
              >
                <X className="w-4 h-4" />
                <span>Stop Scanner</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Camera Viewport Modal / In-line Box */}
        {isScanning && (
          <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>Live Optical Sensor Active · Aim at barcode</span>
              </div>
              <button
                onClick={stopScanner}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex justify-center">
              <div
                id={scannerContainerId}
                className="w-full max-w-sm rounded-lg overflow-hidden border border-slate-700 bg-black min-h-[260px]"
              />
            </div>
            <p className="text-center text-xs text-slate-400 mt-3">
              Position barcode within frame. Supports EAN-13, UPC, Code 128, and QR codes.
            </p>
          </div>
        )}

        {/* Scanner Error Fallback Notice */}
        {scannerError && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Camera note:</span> {scannerError}
              <p className="text-amber-700 mt-1">
                You can enter barcodes manually or use registered product chips below.
              </p>
            </div>
          </div>
        )}

        {/* Manual Barcode Input & Registered Product Barcode Quick Scan */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleBarcodeCaptured(manualCode);
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan or enter barcode / SKU (e.g. CHIPS-01, MILK-12, or custom tag)"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent font-mono placeholder:font-sans placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-sm font-medium rounded-lg border border-slate-300 transition-colors"
            >
              Lookup & Restock
            </button>
          </form>

          {/* Quick test buttons from REAL registered products */}
          <div className="mt-3">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Registered Products (1-Click Quick Scan)</span>
            </div>

            {registeredProductList.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs text-slate-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span>No products registered in Firestore yet. Enter a barcode above (e.g. <span className="font-mono font-medium text-slate-800">CHIPS-01</span>) to register your first item!</span>
                <button
                  type="button"
                  onClick={() => handleBarcodeCaptured('CHIPS-01')}
                  className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-medium whitespace-nowrap"
                >
                  + Register Sample: CHIPS-01
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {registeredProductList.map((prod) => (
                  <button
                    key={prod.sku}
                    type="button"
                    onClick={() => handleBarcodeCaptured(prod.barcode || prod.sku)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <span className="font-mono font-medium text-slate-900">{prod.sku}</span>
                    <span className="text-slate-400">·</span>
                    <span>{prod.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({prod.qty_per_box}x)</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleBarcodeCaptured(`BOX-${Math.floor(1000 + Math.random() * 9000)}`)}
                  className="px-2.5 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md text-amber-800 flex items-center gap-1.5 transition-colors"
                  title="Test an unknown barcode to open registration form"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium">Test New Barcode</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Product Registration Form */}
      {registeringBarcode && (
        <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                +
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Register New Product for Barcode
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Tag ID: {registeringBarcode} (Not recognized in catalog)
                </p>
              </div>
            </div>
            <button
              onClick={() => setRegisteringBarcode(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kettle Cooked Sea Salt Chips 150g"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned SKU * <span className="font-normal text-slate-400">(defaults to barcode)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CHIPS-01"
                  value={newProdSku}
                  onChange={(e) => setNewProdSku(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity per Box *
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={newProdQty}
                  onChange={(e) => setNewProdQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Min Safety Stock (Alert Threshold) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={newProdMinSafety}
                  onChange={(e) => setNewProdMinSafety(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Snacks, Dairy, Pantry"
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={newProdExpiry}
                  onChange={(e) => setNewProdExpiry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRegisteringBarcode(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
              >
                Register & Commit to Firestore
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Placement List (Firestore warehouse_pending collection) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Pending Rack Placement
              </h3>
              <p className="text-xs text-slate-500">
                Live Firestore collection <span className="font-mono text-slate-700">warehouse_pending</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Hardware Mode Toggle */}
            <button
              onClick={toggleHardwareMode}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                hardwareMode
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="When ON, rack hardware sensors automatically place boxes into slots. Manual buttons appear in fallback mode."
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Hardware Mode: {hardwareMode ? 'ON' : 'OFF (Fallback)'}</span>
            </button>

            <span className="text-xs font-medium text-slate-600 px-2.5 py-1 bg-slate-100 rounded-md">
              {pendingItems.length} awaiting placement
            </span>
          </div>
        </div>

        {pendingItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No boxes pending placement</p>
            <p className="text-xs text-slate-400 mt-1">
              Scan a package above to queue items into Firestore <span className="font-mono">warehouse_pending</span>.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {pendingItems.map((item) => {
              // 30-second countdown calculation
              const elapsedSec = Math.floor((Date.now() - Date.parse(item.scannedAt)) / 1000);
              const remainingSec = Math.max(30 - elapsedSec, 0);
              const isExpired = remainingSec === 0;

              return (
                <div
                  key={item.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{item.name || item.sku}</span>
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                        {item.sku}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Box ID: {item.box_id}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Qty: <strong>{item.qty} units</strong></span>
                      {item.expiry && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Expiry: <strong>{item.expiry}</strong></span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>

                      {/* 30-Second Countdown vs Not placed - rescan */}
                      {isExpired ? (
                        <span className="flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          <RotateCcw className="w-3 h-3 text-rose-600" />
                          Not placed - rescan
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 animate-spin" />
                          Place within {remainingSec}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot Placement Controls: Hidden when hardwareMode is ON */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    {hardwareMode ? (
                      <div className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        Awaiting hardware sensor insertion...
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <span>Assign:</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {slots.map((s) => {
                            const isEmpty = !s.isOccupied;
                            return (
                              <button
                                key={s.slot}
                                onClick={() => assignPendingToSlot(item.id, s.slot)}
                                title={
                                  isEmpty
                                    ? `Assign box to empty Slot ${s.slot}`
                                    : `Slot ${s.slot} occupied by ${s.currentSku}. Click to overwrite.`
                                }
                                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md border transition-all ${
                                  isEmpty
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 font-semibold'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                              >
                                S{s.slot}
                                {isEmpty && ' ✓'}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <button
                      onClick={() => removePendingItem(item.id)}
                      title="Discard pending scan"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Catalog Reference Info */}
      <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Master Product Catalog ({registeredProductList.length} items in Firestore)
        </h4>

        {registeredProductList.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No products registered yet. Scan or enter a barcode above to add items.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {registeredProductList.map((prod) => (
              <div
                key={prod.sku}
                className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900 truncate max-w-[180px]">{prod.name}</p>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                    {prod.sku} · {prod.qty_per_box} pcs/box · Safety: {prod.min_safety_stock ?? 10}
                  </p>
                </div>
                <button
                  onClick={() => handleBarcodeCaptured(prod.barcode || prod.sku)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 bg-indigo-50 rounded hover:bg-indigo-100"
                >
                  Scan Box
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
