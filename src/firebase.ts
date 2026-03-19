import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// Validate Connection to Firestore
async function testConnection() {
  try {
    // Attempt to fetch a non-existent doc to test connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'test'));
    console.log("Firebase connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firebase connection failed: The client is offline. Please check your Firebase configuration.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}

testConnection();
