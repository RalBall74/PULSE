/**
 * PULSE Firebase Initialization Service
 * Loads Firebase Modular SDK via CDN ES Modules dynamically
 */

import { getRuntimeConfig } from '../config.js';

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let isInitialized = false;

export const FirebaseService = {
  async init() {
    if (isInitialized) return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, isLive: true };

    const config = getRuntimeConfig();

    if (!config.isFirebaseConfigured) {
      console.log('⚡ PULSE is running in Live Local Sandbox mode. Configure Firebase in Settings anytime to sync across devices.');
      return { app: null, auth: null, db: null, isLive: false };
    }

    try {
      // Dynamic import of official Firebase v10 Modular SDKs via Google CDN
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

      firebaseApp = initializeApp(config.firebase);
      firebaseAuth = getAuth(firebaseApp);
      firebaseDb = getFirestore(firebaseApp);
      isInitialized = true;

      console.log('🔥 Firebase connected successfully:', config.firebase.projectId);
      return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, isLive: true };
    } catch (err) {
      console.warn('Firebase initialization skipped or failed:', err.message);
      return { app: null, auth: null, db: null, isLive: false, error: err };
    }
  },

  getAuth() {
    return firebaseAuth;
  },

  getDb() {
    return firebaseDb;
  },

  isLive() {
    return isInitialized && firebaseDb !== null;
  }
};
