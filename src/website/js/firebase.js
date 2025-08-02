const firebaseConfig = {
    apiKey: "AIzaSyBJL4_QZhwMQ9lvGmRClid44-zkxhBoTKw",
    authDomain: "smart-door-lock-system-b9897.firebaseapp.com",
    projectId: "smart-door-lock-system-b9897",
    storageBucket: "smart-door-lock-system-b9897.firebasestorage.app",
    messagingSenderId: "944814146140",
    appId: "1:944814146140:web:8f01ba9d1a1281b1e6dc99",
    measurementId: "G-C6BHJ1T7ZQ"
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