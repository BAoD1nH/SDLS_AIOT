// auth.js

function signUp() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value; // Thêm trường xác nhận mật khẩu

    if (password !== confirmPassword) {
        alert("❌ Mật khẩu xác nhận không khớp. Vui lòng thử lại.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Đăng ký thành công
            const user = userCredential.user;
            alert("✅ Đăng ký thành công!");
            // Lưu trạng thái đăng nhập vào localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email); // Lưu email để hiển thị hoặc sử dụng sau này
            window.location.href = "mylock.html";
        })
        .catch(error => alert("❌ " + error.message));
}

function signIn() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Đăng nhập thành công
            const user = userCredential.user;
            alert("✅ Đăng nhập thành công!");
            // Lưu trạng thái đăng nhập vào localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email); // Lưu email để hiển thị hoặc sử dụng sau này
            window.location.href = "mylock.html";
        })
        .catch(error => alert("❌ " + error.message));
}