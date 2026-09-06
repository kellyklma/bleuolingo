import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCTzZQ4wRsAg2NuyowSUeJOCSl7v_lR-GI",
  authDomain: "bleuolingo.firebaseapp.com",
  projectId: "bleuolingo",
  storageBucket: "bleuolingo.firebasestorage.app",
  messagingSenderId: "398198308507",
  appId: "1:398198308507:web:d271f0444c2809c516503e",
  measurementId: "G-VSRDSC8JT5"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Initialize Analytics only in supported browser environments
export const analyticsPromise = isSupported().then((supported) =>
  supported ? getAnalytics(app) : null
);