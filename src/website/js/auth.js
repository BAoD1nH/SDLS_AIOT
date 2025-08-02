// Utility function to show success/error messages
function showMessage(div, message, isSuccess) {
    div.textContent = message;
    div.classList.remove('hidden', isSuccess ? 'text-red-400' : 'text-green-400');
    div.classList.add(isSuccess ? 'text-green-400' : 'text-red-400');
    setTimeout(() => div.classList.add('hidden'), 5000);
}

// Sign up with email and password
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
            console.log('User created:', user.email); // Debug log
            return user.sendEmailVerification();
            }).then(() => {
                console.log('User data saved to Firestore'); // Debug log
                return window.firebase.firestore().collection('users').doc(user.uid).set({
                    email: user.email,
                    username: email.split('@')[0],
                    phoneNumber: '',
                    lockPassword: '',
                    avatarUrl: 'https://static.vecteezy.com/system/resources/thumbnails/067/602/357/small/minimalist-user-icon-free-png.png'
            });
        })
        .then(() => {
            console.log('Verification email sent'); // Debug log
            errorMessageDiv.textContent = 'Đăng ký thành công! Đang chuyển hướng để xác minh email...';
            errorMessageDiv.classList.remove('hidden');
            errorMessageDiv.classList.remove('text-red-400');
            errorMessageDiv.classList.add('text-green-400');
            setTimeout(() => {
                window.location.href = 'verify.html';
            }, 2000);
        })
        .catch((error) => {
            console.error('Sign-up error:', error); // Debug log
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

// Sign in with email and password
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

// Log out the current user
function logout() {
    if (!window.firebase || !window.firebase.auth) {
        alert('Lỗi: Firebase chưa được khởi tạo.');
        return;
    }

    window.firebase.auth().signOut()
        .then(() => {
            alert('Đã đăng xuất thành công!');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            window.location.href = 'signin.html';
        })
        .catch((error) => {
            alert('Lỗi: ' + error.message);
        });
}

// Upload user avatar
function uploadAvatar() {
    if (!window.firebase || !window.firebase.auth) {
        const errorDiv = document.getElementById('avatar-error');
        if (errorDiv) {
            errorDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    const user = window.firebase.auth().currentUser;
    const fileInput = document.getElementById('avatar-input');
    const errorDiv = document.getElementById('avatar-error');

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để tải ảnh lên.', false);
        return;
    }

    const file = fileInput.files[0];
    if (!file) {
        showMessage(errorDiv, 'Vui lòng chọn một ảnh.', false);
        return;
    }

    const storageRef = window.firebase.storage().ref(`avatars/${user.uid}/${file.name}`);
    storageRef.put(file)
        .then((snapshot) => snapshot.ref.getDownloadURL())
        .then((url) => {
            return window.firebase.firestore().collection('users').doc(user.uid).set(
                { avatarUrl: url },
                { merge: true }
            ).then(() => url);
        })
        .then((url) => {
            document.getElementById('avatar-preview').src = url;
            document.getElementById('account-image').src = url;
            showMessage(errorDiv, 'Tải ảnh lên thành công!', true);
        })
        .catch((error) => {
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
}

// Update user password
function updatePassword() {
    if (!window.firebase || !window.firebase.auth) {
        const errorDiv = document.getElementById('password-error');
        if (errorDiv) {
            errorDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    const user = window.firebase.auth().currentUser;
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const errorDiv = document.getElementById('password-error');

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để đổi mật khẩu tài khoản.', false);
        return;
    }

    if (!currentPassword || !newPassword) {
        showMessage(errorDiv, 'Vui lòng điền đầy đủ thông tin.', false);
        return;
    }

    const credential = window.firebase.auth().EmailAuthProvider.credential(user.email, currentPassword);
    user.reauthenticateWithCredential(credential)
        .then(() => user.updatePassword(newPassword))
        .then(() => {
            return window.firebase.firestore().collection('users').doc(user.uid).set(
                { email: user.email },
                { merge: true }
            );
        })
        .then(() => {
            showMessage(errorDiv, 'Đổi mật khẩu tài khoản thành công!', true);
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
        })
        .catch((error) => {
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
}

// Update user email
async function updateEmail() {
    if (!window.firebase || !window.firebase.auth) {
        const errorDiv = document.getElementById('email-error');
        if (errorDiv) {
            errorDiv.textContent = 'Error: Firebase not initialized.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    const user = window.firebase.auth().currentUser;
    const newEmail = document.getElementById('new-email').value;
    const errorDiv = document.getElementById('email-error');

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để cập nhật email.', false);
        return;
    }

    if (!newEmail) {
        showMessage(errorDiv, 'Vui lòng nhập email mới.', false);
        return;
    }

    try {
        await user.updateEmail(newEmail);
        await user.sendEmailVerification();
        await window.firebase.firestore().collection('users').doc(user.uid).set(
            { email: newEmail },
            { merge: true }
        );
        showMessage(errorDiv, 'Cập nhật email thành công! Vui lòng kiểm tra email mới để xác minh.', true);
        document.getElementById('new-email').value = '';
        window.location.href = 'verify.html';
    } catch (error) {
        showMessage(errorDiv, 'Lỗi: ' + error.message, false);
    }
}

// Update user phone number
function updatePhoneNumber() {
    if (!window.firebase || !window.firebase.auth) {
        const errorDiv = document.getElementById('phone-error');
        if (errorDiv) {
            errorDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    const user = window.firebase.auth().currentUser;
    const phoneNumber = document.getElementById('phone-number').value;
    const errorDiv = document.getElementById('phone-error');

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để cập nhật số điện thoại.', false);
        return;
    }

    if (!phoneNumber) {
        showMessage(errorDiv, 'Vui lòng nhập số điện thoại.', false);
        return;
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
        showMessage(errorDiv, 'Số điện thoại không hợp lệ.', false);
        return;
    }

    window.firebase.firestore().collection('users').doc(user.uid).set(
        { phoneNumber: phoneNumber },
        { merge: true }
    )
        .then(() => {
            showMessage(errorDiv, 'Cập nhật số điện thoại thành công!', true);
            document.getElementById('phone-number').value = phoneNumber;
        })
        .catch((error) => {
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
}

// Update user username
function updateUsername() {
    if (!window.firebase || !window.firebase.auth) {
        const errorDiv = document.getElementById('username-error');
        if (errorDiv) {
            errorDiv.textContent = 'Lỗi: Firebase chưa được khởi tạo.';
            errorDiv.classList.remove('hidden');
        }
        return;
    }

    const user = window.firebase.auth().currentUser;
    const username = document.getElementById('username').value;
    const errorDiv = document.getElementById('username-error');

    if (!user) {
        showMessage(errorDiv, 'Vui lòng đăng nhập để cập nhật tên người dùng.', false);
        return;
    }

    if (!username) {
        showMessage(errorDiv, 'Vui lòng nhập tên người dùng.', false);
        return;
    }

    window.firebase.firestore().collection('users').doc(user.uid).set(
        { username: username },
        { merge: true }
    )
        .then(() => {
            showMessage(errorDiv, 'Cập nhật tên người dùng thành công!', true);
            document.getElementById('username').value = username;
        })
        .catch((error) => {
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
}

// Export functions for global access
window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.uploadAvatar = uploadAvatar;
window.updatePassword = updatePassword;
window.updateEmail = updateEmail;
window.updatePhoneNumber = updatePhoneNumber;
window.updateUsername = updateUsername;