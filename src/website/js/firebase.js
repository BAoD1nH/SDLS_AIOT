const firebaseConfig = {
    apiKey: "AIzaSyCmn8rOKa8i_-wUyNTtz5MPH21nfswDNYc",
    authDomain: "smart-door-lock-system-5a3ad.firebaseapp.com",
    projectId: "smart-door-lock-system-5a3ad",
    storageBucket: "smart-door-lock-system-5a3ad.firebasestorage.app",
    messagingSenderId: "959993506245",
    appId: "1:959993506245:web:f94215e5a92601c76003ac",
    measurementId: "G-XVW8GW46CR"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = firebase.auth();

// Initialize Firestore
const db = firebase.firestore();

// Initialize Storage (only if firebase.storage is available)
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;

// Export for use in other files
export { auth, db, storage };