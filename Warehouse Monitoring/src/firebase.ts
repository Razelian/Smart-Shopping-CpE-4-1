import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  enableNetwork,
  disableNetwork,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

// Fallback config from provisioned applet if env vars are not set
let fallbackConfig: Record<string, string> = {};
try {
  import('../firebase-applet-config.json').then((mod) => {
    fallbackConfig = mod.default || mod;
  }).catch(() => {
    // ignore
  });
} catch {
  // ignore
}

// Support both .env environment variables (VITE_FIREBASE_*) and fallback config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAmpL_LCMSLFaofYVZcvF9ZgHnPzNOdVJY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mercurial-gravity-q09p9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mercurial-gravity-q09p9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mercurial-gravity-q09p9.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '980019710876',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:980019710876:web:14a61b24172c50bd655659',
};

const databaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  'ai-studio-warehousemonitor-e841cc04-5597-4181-87bf-6604293282bc';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore =
  databaseId && databaseId !== '(default)'
    ? getFirestore(app, databaseId)
    : getFirestore(app);

export { app, enableNetwork, disableNetwork };

/**
 * Validates active connection to Firestore backend
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    // Quick test ping
    await getDocFromServer(doc(db, 'warehouse_slots', '1'));
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is currently in offline mode or network is unreachable');
      return false;
    }
    // If permission or not found, connection to server was still made
    return true;
  }
}
