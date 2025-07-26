function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMessageDiv = document.getElementById('error-message');

    if (!errorMessageDiv) {
        alert('Lỗi giao diện: Không tìm thấy div thông báo lỗi.');
        return;
    }

    errorMessageDiv.classList.add('hidden');
    errorMessageDiv.textContent = '';

    if (!email || !password || !confirmPassword) {
        errorMessageDiv.textContent = 'Vui lòng điền đầy đủ thông tin.';
        errorMessageDiv.classList.remove('hidden');
        return;
    }

    if (password !== confirmPassword) {
        errorMessageDiv.textContent = 'Mật khẩu và xác nhận mật khẩu không khớp.';
        errorMessageDiv.classList.remove('hidden');
        return;
    }

    if (!window.firebase || !window.firebase.auth) {
        errorMessageDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
        errorMessageDiv.classList.remove('hidden');
        return;
    }

    window.firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return window.firebase.firestore().collection('users').doc(user.uid).set({
                email: user.email,
                username: email.split('@')[0],
                phoneNumber: '',
                lockPassword: '',
                avatarUrl: 'https://static.vecteezy.com/system/resources/thumbnails/067/602/357/small/minimalist-user-icon-free-png.png'
            }).then(() => user.sendEmailVerification());
        })
        .then(() => {
            errorMessageDiv.textContent = 'Đăng ký thành công! Đang chuyển hướng để xác minh email...';
            errorMessageDiv.classList.remove('hidden');
            errorMessageDiv.classList.remove('text-red-400');
            errorMessageDiv.classList.add('text-green-400');
            setTimeout(() => {
                window.location.href = 'verify.html';
            }, 2000);
        })
        .catch((error) => {
            let errorMessage = 'Lỗi khi đăng ký: ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'Email đã được sử dụng.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Email không hợp lệ.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
                    break;
                default:
                    errorMessage += error.message;
            }
            errorMessageDiv.textContent = errorMessage;
            errorMessageDiv.classList.remove('hidden');
        });
}

function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessageDiv = document.getElementById('error-message');

    if (!errorMessageDiv) {
        alert('Lỗi giao diện: Không tìm thấy div thông báo lỗi.');
        return;
    }

    errorMessageDiv.classList.add('hidden');
    errorMessageDiv.textContent = '';

    if (!email || !password) {
        errorMessageDiv.textContent = 'Vui lòng điền đầy đủ thông tin.';
        errorMessageDiv.classList.remove('hidden');
        return;
    }

    if (!window.firebase || !window.firebase.auth) {
        errorMessageDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
        errorMessageDiv.classList.remove('hidden');
        return;
    }

    window.firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            if (user.emailVerified) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', user.email);
                window.location.href = 'mylock.html';
            } else {
                window.firebase.auth().signOut();
                errorMessageDiv.textContent = 'Vui lòng xác minh email của bạn trước khi đăng nhập.';
                errorMessageDiv.classList.remove('hidden');
            }
        })
        .catch((error) => {
            errorMessageDiv.textContent = 'Lỗi đăng nhập: ' + error.message;
            errorMessageDiv.classList.remove('hidden');
        });
}