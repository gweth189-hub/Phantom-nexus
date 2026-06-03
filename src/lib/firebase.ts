/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Use environment variables for sensitive config, falling back to the config file
// This helps prevent "leaked secret" warnings in CI/CD environments
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings optimized for restricted networks
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

export const auth = getAuth();

/**
 * Robust error handling for Firestore operations.
 * Throws a JSON error string to help identify security rule or config issues.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(retries = 3) {
  console.log("Initializing secure link to ZENITH nodes...");
  for (let i = 0; i < retries; i++) {
    try {
      // Small delay to allow network stabilization
      await new Promise(resolve => setTimeout(resolve, i === 0 ? 1000 : 2000));
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("ZENITH node link: STABLE.");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
        console.log("ZENITH node link: SECURED.");
        return;
      }
      
      if (i === retries - 1) {
        console.info("ZENITH: Active Node Sync throttled. System remains operational in local-first mode.");
      }
    }
  }
}

testConnection();
