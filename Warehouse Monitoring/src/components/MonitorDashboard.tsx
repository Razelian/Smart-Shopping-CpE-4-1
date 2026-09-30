import React, { useState, useEffect } from 'react';
import { useWarehouse } from '../context/WarehouseContext';
import { StockChart } from './StockChart';
import {
  Clock,
  CheckCircle,
  TrendingDown,
  Activity,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { EventType } from '../types';

export const MonitorDashboard: React.FC = () => {
  const {
    slots,
    alerts,
    dismissAlert,
    triggerManualAlert,
    manualSlotOverride,
    events,
    products,
    selectedSku,
    setSelectedSku,
    getStockTrend,
    getDaysUntilStockout,
    triggerRandomEvent,
  } = useWarehouse();

  // Dynamic relative time updater (ticks every 5 seconds)
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // Registered products list
  const registeredProducts = Object.values(products);
  const firstSku = registeredProducts[0]?.sku || '';

  // Dropdown target for manual slot restocks
  const [restockTargetSku, setRestockTargetSku] = useState<string>(selectedSku || firstSku);

  // Dropdown target for simulated manual alerts
  const [alertTargetSku, setAlertTargetSku] = useState<string>(selectedSku || firstSku);

  useEffect(() => {
    if (!restockTargetSku && firstSku) {
      setRestockTargetSku(firstSku);
    }
    if (!alertTargetSku && firstSku) {
      setAlertTargetSku(firstSku);
    }
  }, [firstSku, restockTargetSku, alertTargetSku]);

  // Format time elapsed
  const formatTimeElapsed = (isoTime: string) => {
    const diffMs = Date.now() - new Date(isoTime).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(diffSec, 1)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Activity log filter state
  const [eventFilter, setEventFilter] = useState<'all' | 'slots' | 'transfers' | 'alerts' | 'audits'>('all');

  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'all') return true;
    if (eventFilter === 'slots') return e.event_type === 'box_placed' || e.event_type === 'box_removed_pending';
    if (eventFilter === 'transfers') return e.event_type === 'restock_to_shelf' || e.event_type === 'purchase_confirmed';
    if (eventFilter === 'alerts') return e.event_type === 'misplacement_flagged' || e.event_type === 'expiry_alert';
    if (eventFilter === 'audits') return e.event_type === 'warehouse_audit';
    return true;
  });

  // Active product details for chart & forecast
  const currentProduct = products[selectedSku] || registeredProducts[0];
  const stockoutForecast = getDaysUntilStockout(selectedSku || (registeredProducts[0]?.sku ?? ''));
  const trendData = getStockTrend(selectedSku || (registeredProducts[0]?.sku ?? ''));

  // Badge helper for event types
  const getEventBadge = (type: EventType) => {
    switch (type) {
      case 'box_placed':
        return <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">box_placed</span>;
      case 'box_removed_pending':
        return <span className="text-[11px] font-semibold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">box_removed</span>;
      case 'restock_to_shelf':
        return <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">restock_to_shelf</span>;
      case 'purchase_confirmed':
        return <span className="text-[11px] font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">purchase</span>;
      case 'misplacement_flagged':
        return <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">misplacement</span>;
      case 'expiry_alert':
        return <span className="text-[11px] font-semibold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">expiry_alert</span>;
      case 'warehouse_audit':
        return <span className="text-[11px] font-semibold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded">warehouse_audit</span>;
      case 'scan_in':
        return <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">scan_in</span>;
      default:
        return <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 8-Slot Rack Telemetry Array */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Rack Array Telemetry (8 Channel Slots)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                Smart Shelf Node #1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live optical & load-cell sensor status. Use manual overrides to force-correct hardware sensor drift.
            </p>
          </div>

          {/* Restock Target SKU Dropdown for Override & Status Counters */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {registeredProducts.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span className="text-slate-500 text-[11px] font-medium">Restock SKU:</span>
                <select
                  value={restockTargetSku}
                  onChange={(e) => setRestockTargetSku(e.target.value)}
                  className="bg-transparent font-mono font-semibold text-slate-800 text-xs focus:outline-none"
                >
                  {registeredProducts.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} ({p.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Occupied ({slots.filter((s) => s.isOccupied).length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Empty ({slots.filter((s) => !s.isOccupied).length})</span>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Slots Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {slots.map((s) => (
            <div
              key={s.slot}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all relative ${
                s.isOccupied
                  ? 'bg-white border-emerald-300 ring-1 ring-emerald-200/60 shadow-xs'
                  : 'bg-slate-50/60 border-dashed border-slate-300 text-slate-400'
              }`}
            >
              {/* Slot Header */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      Slot {s.slot}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full ${
                      s.isOccupied
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {s.isOccupied ? 'Occupied' : 'Empty'}
                  </span>
                </div>

                {/* Slot Content */}
                <div className="mt-3 min-h-[58px]">
                  {s.isOccupied ? (
                    <div>
                      <p className="font-semibold text-xs text-slate-900 line-clamp-1">
                        {s.productName || 'Assigned SKU'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                          {s.currentSku}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {s.qty ? `${s.qty} units` : '1 box'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                      No active package detected
                    </div>
                  )}
                </div>
              </div>

              {/* Status change timestamp & Manual override buttons */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Changed:</span>
                  </span>
                  <span className="font-mono text-slate-600">
                    {formatTimeElapsed(s.lastStatusChange)}
                  </span>
                </div>

                {/* Manager Manual Override Controls (uses registered products dropdown) */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {s.isOccupied ? (
                    <button
                      onClick={() => manualSlotOverride(s.slot, 'empty')}
                      title="Manager override: Force clear slot if sensor falsely reports occupied"
                      className="w-full text-[11px] font-medium py-1 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors text-center"
                    >
                      Force Empty
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        manualSlotOverride(
                          s.slot,
                          'restock',
                          restockTargetSku || registeredProducts[0]?.sku
                        )
                      }
                      disabled={registeredProducts.length === 0}
                      title="Manager override: Force restock slot using selected SKU"
                      className="w-full text-[11px] font-medium py-1 px-1.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-300 rounded transition-colors text-center"
                    >
                      Force Restock
                    </button>
                  )}

                  <button
                    onClick={() =>
                      s.isOccupied
                        ? manualSlotOverride(s.slot, 'empty')
                        : manualSlotOverride(
                            s.slot,
                            'restock',
                            restockTargetSku || registeredProducts[0]?.sku
                          )
                    }
                    disabled={!s.isOccupied && registeredProducts.length === 0}
                    className="w-full text-[11px] py-1 px-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded transition-colors text-center"
                  >
                    Toggle State
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Row 2: Active Alerts Panel & Real Days Until Stockout Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Alerts Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Active Alerts</h3>
                  <p className="text-xs text-slate-500">
                    Low Stock · Expiry · Misplacement
                  </p>
                </div>
              </div>

              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  alerts.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {alerts.length} Active
              </span>
            </div>

            {/* Alert List */}
            <div className="mt-3 space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                  <p className="text-xs font-medium text-slate-600">All Systems Nominal</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No active expiry, load cell, or low stock warnings.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-2.5 transition-all ${
                      alert.severity === 'red' || alert.type === 'expiry'
                        ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                        : 'bg-amber-50/70 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold tracking-wide uppercase text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            alert.severity === 'red'
                              ? 'bg-rose-200/90 text-rose-900'
                              : 'bg-amber-200/90 text-amber-900'
                          }`}
                        >
                          {alert.type.replace('_', ' ')}
                        </span>
                        {alert.slot && (
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-white/80 px-1 rounded border border-slate-200">
                            Slot {alert.slot}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-600">
                          {alert.sku}
                        </span>
                      </div>

                      <p className="font-medium text-xs leading-snug">{alert.message}</p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatTimeElapsed(alert.timestamp)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="shrink-0 text-xs font-medium px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded shadow-2xs transition-colors"
                      title="Dismiss this alert"
                    >
                      Dismiss
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick trigger alerts using Dropdown of Registered Products */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Target:</span>
              {registeredProducts.length === 0 ? (
                <span className="text-slate-400 italic text-[11px]">No products registered</span>
              ) : (
                <select
                  value={alertTargetSku}
                  onChange={(e) => setAlertTargetSku(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono"
                >
                  {registeredProducts.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => triggerManualAlert('expiry', alertTargetSku || firstSku, 4)}
                disabled={!alertTargetSku && !firstSku}
                className="px-2 py-1 text-[11px] bg-rose-50 disabled:opacity-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100"
              >
                + Expiry
              </button>
              <button
                onClick={() => triggerManualAlert('misplacement', alertTargetSku || firstSku, 2)}
                disabled={!alertTargetSku && !firstSku}
                className="px-2 py-1 text-[11px] bg-amber-50 disabled:opacity-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
              >
                + Misplacement
              </button>
              <button
                onClick={() => triggerManualAlert('low_stock', alertTargetSku || firstSku)}
                disabled={!alertTargetSku && !firstSku}
                className="px-2 py-1 text-[11px] bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-200"
              >
                + Low Stock
              </button>
            </div>
          </div>
        </div>

        {/* Real Forecast & Stockout Analytics (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-indigo-600" />
                  Real Stockout Velocity & Forecast
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated from 7-day restock-to-shelf consumption velocity / days active.
                </p>
              </div>

              {/* SKU Selector Dropdown (from registered products) */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">SKU:</label>
                {registeredProducts.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No products</span>
                ) : (
                  <select
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                    className="text-xs font-mono font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {registeredProducts.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.sku} — {p.name.slice(0, 22)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Key Forecast Metrics */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Days Until Stockout
                </span>
                <div className="mt-1">
                  {stockoutForecast.days === null ? (
                    <div className="text-sm font-semibold text-slate-600 py-1">
                      No usage data yet
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-bold font-mono ${
                          stockoutForecast.status === 'critical'
                            ? 'text-rose-600'
                            : stockoutForecast.status === 'warning'
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {stockoutForecast.days}
                      </span>
                      <span className="text-xs text-slate-500">days left</span>
                    </div>
                  )}
                </div>
                <div className="mt-1">
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                      stockoutForecast.status === 'critical'
                        ? 'bg-rose-100 text-rose-800'
                        : stockoutForecast.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : stockoutForecast.status === 'healthy'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {stockoutForecast.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  7-Day Consumption Rate
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  {stockoutForecast.dailyBurnRate === null ? (
                    <span className="text-sm font-medium text-slate-500 py-1">N/A</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold font-mono text-slate-900">
                        {stockoutForecast.dailyBurnRate}
                      </span>
                      <span className="text-xs text-slate-500">units / day</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  7-day total / max(days active, 1)
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Current Rack Stock
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {stockoutForecast.currentStock}
                  </span>
                  <span className="text-xs text-slate-500">units in rack</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Safety min: {currentProduct?.min_safety_stock ?? 10} units
                </p>
              </div>
            </div>

            {/* Real Stock Trend History by Replaying Events */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <StockChart data={trendData} skuName={currentProduct?.name || selectedSku} />
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Live Activity Log (Feed of Events) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Warehouse Activity Event Stream (500 Limit)
              </h3>
              <p className="text-xs text-slate-500">
                Live stream of box_placed, restock_to_shelf, purchase, misplacement, expiry, scan_in, and warehouse_audit events.
              </p>
            </div>
          </div>

          {/* Filter tabs & manual event trigger */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setEventFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  eventFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => setEventFilter('slots')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  eventFilter === 'slots' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Slots
              </button>
              <button
                onClick={() => setEventFilter('transfers')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  eventFilter === 'transfers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Transfers
              </button>
              <button
                onClick={() => setEventFilter('alerts')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  eventFilter === 'alerts' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Alerts
              </button>
              <button
                onClick={() => setEventFilter('audits')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  eventFilter === 'audits' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Audits
              </button>
            </div>

            <button
              onClick={triggerRandomEvent}
              disabled={registeredProducts.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              title="Simulates next event with metadata.simulated = true using registered products"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Simulate Next Event</span>
            </button>
          </div>
        </div>

        {/* Scrollable Event Feed Table / List */}
        <div className="mt-3 max-h-[380px] overflow-y-auto divide-y divide-slate-100 font-sans">
          {filteredEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching events found for filter.
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="py-3 px-2 hover:bg-slate-50/80 rounded transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-28 shrink-0">{getEventBadge(evt.event_type)}</div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">
                        {evt.sku || evt.expected_sku || 'N/A'}
                      </span>
                      {evt.slot && (
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          Slot {evt.slot}
                        </span>
                      )}
                      {evt.qty !== undefined && (
                        <span className="text-[11px] text-slate-600 font-medium">
                          Qty: {evt.qty}
                        </span>
                      )}
                      {evt.box_id && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Box: {evt.box_id}
                        </span>
                      )}
                      {Boolean(evt.metadata?.simulated) && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 rounded">
                          simulated
                        </span>
                      )}
                    </div>

                    {/* Display warehouse_audit total_stock_out and details */}
                    {evt.event_type === 'warehouse_audit' ? (
                      <div className="text-cyan-900 font-medium text-xs flex items-center gap-2">
                        <span>Total Stock Out: <strong>{String(evt.total_stock_out ?? 'N/A')} units</strong></span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500 text-[11px]">Since: {evt.since_timestamp ? new Date(evt.since_timestamp).toLocaleString() : 'N/A'}</span>
                      </div>
                    ) : (
                      <p className="text-slate-600 text-xs">{evt.details || 'Telemetry event processed'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right self-end sm:self-auto shrink-0">
                  {/* Delta indicator if any */}
                  {evt.warehouse_delta !== undefined && (
                    <span
                      className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        evt.warehouse_delta > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {evt.warehouse_delta > 0 ? `+${evt.warehouse_delta}` : evt.warehouse_delta} WH
                    </span>
                  )}
                  {evt.shelf_delta !== undefined && (
                    <span
                      className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        evt.shelf_delta > 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {evt.shelf_delta > 0 ? `+${evt.shelf_delta}` : evt.shelf_delta} Shelf
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatTimeElapsed(evt.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
