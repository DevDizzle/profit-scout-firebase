
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';

const VITE_RESERVED_PREFIX = "YOUR_"; // Common prefix for placeholders

// Client-side Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Helper to log critical config errors
const logConfigError = (variableName: string, projectContext: string, specificMessage: string = "") => {
  console.error(
    `CRITICAL Firebase Config Error: ${variableName} is missing or is a placeholder. ` +
    `${specificMessage} ` +
    `Please set it correctly in your .env file with the value from your Firebase project settings (${projectContext}).`
  );
};

// Validate critical Firebase configurations
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith(VITE_RESERVED_PREFIX)) {
  logConfigError("NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.projectId || "profitscout-lx6bb");
}
if (!firebaseConfig.projectId || firebaseConfig.projectId.startsWith(VITE_RESERVED_PREFIX) || firebaseConfig.projectId !== "profitscout-lx6bb") {
  logConfigError("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "profitscout-lx6bb", `Ensure it is set to 'profitscout-lx6bb'. Current value: ${firebaseConfig.projectId}.`);
}
if (!firebaseConfig.appId || firebaseConfig.appId.startsWith(VITE_RESERVED_PREFIX)) {
  logConfigError("NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.projectId || "profitscout-lx6bb", "This is a very common cause for 'Installations: request-failed' errors.");
}
if (!firebaseConfig.messagingSenderId || firebaseConfig.messagingSenderId.startsWith(VITE_RESERVED_PREFIX)) {
  logConfigError("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebaseConfig.projectId || "profitscout-lx6bb");
}


let app: FirebaseApp;
let auth: Auth | undefined;
let analytics: Analytics | undefined;
export let db: Firestore | undefined; // Export Firestore instance

// Check if all critical configurations are present before initializing
if (
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith(VITE_RESERVED_PREFIX) &&
  firebaseConfig.projectId && !firebaseConfig.projectId.startsWith(VITE_RESERVED_PREFIX) &&
  firebaseConfig.appId && !firebaseConfig.appId.startsWith(VITE_RESERVED_PREFIX) &&
  firebaseConfig.messagingSenderId && !firebaseConfig.messagingSenderId.startsWith(VITE_RESERVED_PREFIX)
) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
  db = getFirestore(app); // Initialize Firestore

  // Initialize Firebase Analytics only on the client side and if measurementId is provided and app is initialized
  if (typeof window !== 'undefined' && firebaseConfig.measurementId && !firebaseConfig.measurementId.startsWith(VITE_RESERVED_PREFIX) && app) {
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.error("Error initializing Firebase Analytics:", e);
    }
  }

} else {
  console.error("Firebase initialization skipped due to missing or placeholder critical configuration. Please check .env file and Firebase project settings for profitscout-lx6bb.");
  // auth and db will remain undefined
}

// Export auth even if undefined, so consuming modules don't break on import, but can check its presence
export { app, auth, analytics };
