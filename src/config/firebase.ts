
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
// import { getFirestore, Firestore } from 'firebase/firestore'; // Example if you need Firestore
// import { getStorage, FirebaseStorage } from 'firebase/storage'; // Example if you need Storage

const VITE_RESERVED_PREFIX = "YOUR_"; // Common prefix for placeholders

if (
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith(VITE_RESERVED_PREFIX)
) {
  console.error(
    "CRITICAL Firebase Config Error: NEXT_PUBLIC_FIREBASE_API_KEY is missing or is a placeholder. " +
    "Please set it correctly in your .env file with the value from your Firebase project settings (profitscout-lx6bb)."
  );
}
if (
  !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.startsWith(VITE_RESERVED_PREFIX) ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "profitscout-lx6bb"
) {
  console.error(
    "CRITICAL Firebase Config Error: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing, is a placeholder, or does not match 'profitscout-lx6bb'. " +
    "Please set it correctly in your .env file."
  );
}
if (
  !process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID.startsWith(VITE_RESERVED_PREFIX)
) {
  console.error(
    "CRITICAL Firebase Config Error: NEXT_PUBLIC_FIREBASE_APP_ID is missing or is a placeholder. " +
    "This is a very common cause for 'Installations: request-failed' errors. " +
    "Please set it correctly in your .env file with the Web App ID from your Firebase project settings (profitscout-lx6bb)."
  );
}
if (
  !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID.startsWith(VITE_RESERVED_PREFIX)
) {
  console.error(
    "CRITICAL Firebase Config Error: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID is missing or is a placeholder. " +
    "Please set it correctly in your .env file with the Project Number from your Firebase project settings (profitscout-lx6bb)."
  );
}


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp;

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
} else {
  console.error("Firebase initialization skipped due to missing or placeholder critical configuration. Please check .env file and Firebase project settings for profitscout-lx6bb.");
  // Avoid throwing error here to let other console messages appear, but app/auth will be undefined
  // Consider how your app should behave if Firebase doesn't initialize.
  // For this error, the Firebase SDK itself will likely throw an error when its services are called without proper init.
}


// @ts-ignore app might be uninitialized if config is bad
const auth: Auth = getAuth(app);
let analytics: Analytics | undefined;

// Initialize Firebase Analytics only on the client side and if measurementId is provided and app is initialized
if (typeof window !== 'undefined' && firebaseConfig.measurementId && !firebaseConfig.measurementId.startsWith(VITE_RESERVED_PREFIX) && app) {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.error("Error initializing Firebase Analytics:", e);
  }
}

export { app, auth, analytics };
