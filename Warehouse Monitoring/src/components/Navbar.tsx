import React from 'react';
import { useWarehouse } from '../context/WarehouseContext';
import {
  Barcode,
  LayoutDashboard,
  Wifi,
  WifiOff,
  Activity,
  Play,
  Pause,
  Box,
  AlertTriangle,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    pendingItems,
    alerts,
    products,
    connectionStatus,
    toggleConnectionStatus,
    autoSimulate,
    toggleAutoSimulate,
    lastSynced,
    triggerRandomEvent,
    syncError,
    clearSyncError,
  } = useWarehouse();

  const hasRegisteredProducts = Object.keys(products).length > 0;

  // Format last synced
  const formattedSync = React.useMemo(() => {
    try {
      const d = new Date(lastSynced);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  }, [lastSynced]);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Lab Branding */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Box className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-base tracking-tight">
                  SmartShopping Lab
                </span>
                <span className="text-xs text-slate-400 font-normal">/</span>
                <span className="text-xs font-medium text-slate-600 tracking-wide uppercase">
                  Warehouse Node
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Embedded Telemetry & Barcode Intake Hub
              </p>
            </div>
          </div>

          {/* View Navigation Tabs */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button
              onClick={() => setActiveView('scan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                activeView === 'scan'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Scan & Restock</span>
              {pendingItems.length > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700">
                  {pendingItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('monitor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                activeView === 'monitor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Monitor Dashboard</span>
              {alerts.length > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                  {alerts.length}
                </span>
              )}
            </button>
          </nav>

          {/* Embedded Connection & Simulation Controls */}
          <div className="flex items-center gap-2">
            {/* Simulation manual pulse */}
            <button
              onClick={triggerRandomEvent}
              disabled={!hasRegisteredProducts}
              title={
                hasRegisteredProducts
                  ? 'Trigger a simulated event immediately'
                  : 'Register a product first to simulate events'
              }
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 border border-slate-200 rounded-md transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-600" />
              <span>Trigger Event</span>
            </button>

            {/* Auto-Simulation Toggle */}
            <button
              onClick={toggleAutoSimulate}
              title={autoSimulate ? 'Pause 12s background simulation' : 'Resume 12s background simulation'}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                autoSimulate
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {autoSimulate ? (
                <>
                  <span className="relative flex h-2 w-2 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Pause className="w-3 h-3 text-emerald-700" />
                  <span className="hidden md:inline">Sim Live</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-slate-500" />
                  <span className="hidden md:inline">Sim Paused</span>
                </>
              )}
            </button>

            {/* Connection Toggle */}
            <button
              onClick={toggleConnectionStatus}
              title={`Simulate backend state (Currently ${connectionStatus})`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                connectionStatus === 'connected'
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Connectivity & Last Synced Strip */}
      <div className="bg-slate-50/80 border-t border-slate-200/60 px-4 sm:px-6 lg:px-8 py-1">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>
              Firestore / CAN-Bus: {connectionStatus === 'connected' ? 'Live onSnapshot Sync Active' : 'Offline / Network Paused'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Last synced: {formattedSync}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span>Rack Array: 8 Channels</span>
            <span aria-hidden="true">·</span>
            <span>Smart Shopping Node #01</span>
          </div>
        </div>
      </div>

      {/* Sync Error State Banner */}
      {syncError && (
        <div className="bg-rose-50 border-t border-b border-rose-200 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">Sync Error:</span>
              <span className="truncate max-w-xl">{syncError}</span>
            </div>
            <button
              onClick={clearSyncError}
              className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-100/80 hover:bg-rose-200 px-2 py-0.5 rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
