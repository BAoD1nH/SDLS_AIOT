// js/firebase.js  (ES module, dùng compat SDK)
// Yêu cầu: đã load các script compat trong HTML:
// firebase-app-compat.js, firebase-auth-compat.js, firebase-firestore-compat.js, firebase-storage-compat.js

const firebaseConfig = {
	apiKey: "AIzaSyBJL4_QZhwMQ9lvGmRClid44-zkxhBoTKw",
	authDomain: "smart-door-lock-system-b9897.firebaseapp.com",
	projectId: "smart-door-lock-system-b9897",
	storageBucket: "smart-door-lock-system-b9897.appspot.com", // <-- sửa lại đúng domain
	messagingSenderId: "944814146140",
	appId: "1:944814146140:web:8f01ba9d1a1281b1e6dc99",
	measurementId: "G-C6BHJ1T7ZQ"
};

// Khởi tạo app (tránh init lại nếu file được import nhiều nơi)
if (!firebase.apps.length) {
	firebase.initializeApp(firebaseConfig);
}

// Export compat instances
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage };
