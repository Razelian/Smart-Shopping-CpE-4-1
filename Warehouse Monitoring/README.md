# Smart Shopping Warehouse Monitoring System

Embedded warehouse node and barcode intake prototype for the Smart Shopping project. Features real-time optical/load-cell telemetry, barcode scanning via camera, automated stockout velocity forecasts, active anomaly alerts, and full cloud persistence powered by **Firebase Firestore**.

---

## Firebase Firestore Integration & Setup

This web application integrates the Firebase Modular SDK (v9+) to persist all warehouse state, audit logs, slot statuses, and alerts directly into Firestore. Real-time synchronization is maintained through live `onSnapshot` listeners.

### 1. Create a Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give your project a name (e.g. `smart-shopping-warehouse`).
3. (Optional) Disable or enable Google Analytics based on your preference, then click **Create Project**.

### 2. Enable Cloud Firestore
1. In your project dashboard, navigate to **Build** > **Firestore Database**.
2. Click **Create Database**.
3. Choose your database location (cloud region) closest to your warehouse node.
4. Select **Start in test mode** for initial lab prototyping, or configure security rules based on `firestore.rules`.
5. Click **Enable**.

### 3. Register a Web App & Retrieve Credentials
1. In Project Settings (gear icon in the top left) > **General** tab, scroll to **Your apps**.
2. Click the Web icon (`</>`) to add a web app.
3. Name your app (e.g. `Warehouse Web Node`) and click **Register app**.
4. Firebase will display your `firebaseConfig` keys:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### 4. Configure Environment Variables
Create a `.env` file in the root directory of this repository (or copy from `.env.example`):

```bash
cp .env.example .env
```

Populate the `.env` file with your credentials:

```ini
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef..."
# Optional: if you provisioned a named database rather than "(default)"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"
```

Restart your dev server:
```bash
npm run dev
```

---

## Firestore Data Architecture & Collections

| Collection Name | Document Key | Description |
| :--- | :--- | :--- |
| `warehouse_slots` | `1` through `8` | Real-time state of the 8 physical rack slots (`slot`, `isOccupied`, `currentSku`, `productName`, `qty`, `lastStatusChange`). |
| `warehouse_events` | Auto-generated ID | Audited telemetry event stream (`box_placed`, `restock_to_shelf`, `purchase_confirmed`, `misplacement_flagged`, `expiry_alert`, `scan_in`, etc.). |
| `warehouse_alerts` | Auto-generated ID | Active operational alerts for low stock, batch expiry, and load-cell misplacement anomalies. |
| `warehouse_products` | `SKU` (e.g. `SKU-8921`) | Master inventory catalog (`sku`, `name`, `qty_per_box`, `expiry`, `category`, `min_safety_stock`). |

### Automatic Database Seeding
Upon initial launch, if Firestore collections are unpopulated, the application automatically seeds the 8 rack slots, starter products catalog, baseline alerts, and historical event stream to ensure an immediate functional experience.

---

## System Views

- **View 1: Scan & Restock**: Camera barcode reader powered by `html5-qrcode` with front/back camera support, product lookup, new product registration form, and pending rack assignment buffer.
- **View 2: Monitor Dashboard**: 8-slot rack telemetry grid with manager manual override buttons (`Force Empty` / `Force Restock`), active alerts panel with dismiss controls, moving-average stockout forecast, dual-series SVG inventory trend chart, and real-time activity log.

---

## Hardware Simulation & Offline Mode

- **Background Simulator**: Dispatches randomized restock, cart purchase, placement, and sensor telemetry events every 12 seconds through Firestore's `processEvent` pipeline.
- **Connection Switch**: Leverages Firestore's native `enableNetwork(db)` and `disableNetwork(db)` APIs to test offline caching and reconnect resynchronization.
