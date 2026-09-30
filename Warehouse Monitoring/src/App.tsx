import React from 'react';
import { WarehouseProvider, useWarehouse } from './context/WarehouseContext';
import { Navbar } from './components/Navbar';
import { ScanView } from './components/ScanView';
import { MonitorDashboard } from './components/MonitorDashboard';
import { Layers, Terminal, Cpu } from 'lucide-react';

const WarehouseAppContent: React.FC = () => {
  const { activeView } = useWarehouse();

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'scan' ? <ScanView /> : <MonitorDashboard />}
      </main>

      {/* Embedded Lab Architecture Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>
              Smart Shopping Prototype · Embedded Edge Node (ESP32 / CAN-Bus / RFID / Load-Cells)
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>In-Memory Mock Telemetry API</span>
            <span aria-hidden="true">·</span>
            <span>REST / WebSocket Ready</span>
            <span aria-hidden="true">·</span>
            <span>v1.2-prototype</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <WarehouseProvider>
      <WarehouseAppContent />
    </WarehouseProvider>
  );
}
