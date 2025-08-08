// js/firebase.js  (ES module, dùng compat SDK)
// Yêu cầu: đã load các script compat trong HTML:
// firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js, firebase-storage-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyAT-c-aYKmdicXZjNk_E1Q7xUsH18C-UHs",
  authDomain: "sdls-15cb4.firebaseapp.com",
  projectId: "sdls-15cb4",
  storageBucket: "sdls-15cb4.firebasestorage.app",
  messagingSenderId: "168653757922",
  appId: "1:168653757922:web:fc32614c2b91bdada0edbb",
  measurementId: "G-PF8HFXFMQR"
};


// Khởi tạo app (tránh init lại nếu file được import nhiều nơi)
if (!firebase.apps.length) {
	firebase.initializeApp(firebaseConfig);
}

// Export compat instances
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage;

export { auth, db, storage };
