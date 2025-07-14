// js/firebase.js

// Firebase v9.6.1 compat SDK – dùng cho kiểu viết cổ điển
const firebaseConfig = {
	apiKey: "AIzaSyBJL4_QZhwMQ9lvGmRClid44-zkxhBoTKw",
	authDomain: "smart-door-lock-system-b9897.firebaseapp.com",
	projectId: "smart-door-lock-system-b9897",
	storageBucket: "smart-door-lock-system-b9897.firebasestorage.app",
	messagingSenderId: "944814146140",
	appId: "1:944814146140:web:8f01ba9d1a1281b1e6dc99",
	measurementId: "G-C6BHJ1T7ZQ"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // dùng để đăng nhập, đăng ký
