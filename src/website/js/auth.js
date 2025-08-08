function showMessage(div, message, isSuccess) {
    div.textContent = message;
    div.classList.remove('hidden', isSuccess ? 'text-red-400' : 'text-green-400');
    div.classList.add(isSuccess ? 'text-green-400' : 'text-red-400');
    setTimeout(() => div.classList.add('hidden'), 5000);
}

// Cache initialization state
let isFirebaseInitialized = false;

// Function to log user actions to Firestore
function logUserAction(userId, action) {
    if (!firebase || !firebase.firestore || !firebase.firestore.FieldValue) {
        console.error('Firebase Firestore or FieldValue not initialized in logUserAction');
        return Promise.reject(new Error('Firestore not initialized'));
    }
    const db = firebase.firestore();
    return db.collection('users').doc(userId).set(
        { history: [] },
        { merge: true }
    ).then(() => {
        return db.collection('users').doc(userId).update({
            history: firebase.firestore.FieldValue.arrayUnion({
                date: new Date().toISOString(), // Use client-side timestamp
                action: action
            })
        });
    }).catch((error) => {
        console.error('Error logging user action:', error.code, error.message);
        return Promise.reject(error);
    });
}

// Wrapper to ensure Firebase is initialized before executing a function
function withFirebaseInitialized(callback) {
    if (isFirebaseInitialized || (firebase && firebase.auth && firebase.firestore && firebase.firestore.FieldValue)) {
        isFirebaseInitialized = true;
        console.log('Firebase initialized, executing callback');
        return Promise.resolve(callback());
    } else {
        console.warn('Firebase not fully initialized, waiting for firebaseInitialized event');
        return new Promise((resolve, reject) => {
            window.addEventListener('firebaseInitialized', () => {
                console.log('Received firebaseInitialized event');
                if (firebase && firebase.auth && firebase.firestore && firebase.firestore.FieldValue) {
                    isFirebaseInitialized = true;
                    console.log('Firebase initialized after event, executing callback');
                    resolve(callback());
                } else {
                    console.error('Firebase still not initialized after event');
                    reject(new Error('Firebase initialization failed'));
                }
            }, { once: true });
            // Fallback timeout
            setTimeout(() => {
                console.error('Firebase initialization timed out');
                reject(new Error('Firebase initialization timed out'));
            }, 5000);
        });
    }
}

function signUp() {
    console.log('signUp function called');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMessageDiv = document.getElementById('error-message');

    if (!errorMessageDiv) {
        console.error('UI error: error-message div not found');
        alert('Lỗi giao diện: Không tìm thấy div thông báo lỗi.');
        return;
    }

    errorMessageDiv.classList.add('hidden');
    errorMessageDiv.textContent = '';

    if (!email || !password || !confirmPassword) {
        showMessage(errorMessageDiv, 'Vui lòng điền đầy đủ thông tin.', false);
        return;
    }

    if (password !== confirmPassword) {
        showMessage(errorMessageDiv, 'Mật khẩu và xác nhận mật khẩu không khớp.', false);
        return;
    }

    withFirebaseInitialized(() => {
        return firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log('User created:', user.email);
                // Create user document with initial history array
                return firebase.firestore().collection('users').doc(user.uid).set({
                    email: user.email,
                    history: []
                }).then(() => {
                    // Log sign-up action
                    return logUserAction(user.uid, 'Đăng ký tài khoản').then(() => user.sendEmailVerification());
                });
            })
            .then(() => {
                console.log('Verification email sent');
                showMessage(errorMessageDiv, 'Đăng ký thành công! Email xác minh đã được gửi. Đang chuyển hướng...', true);
                setTimeout(() => {
                    window.location.href = 'verify.html';
                }, 2000);
            })
            .catch((error) => {
                console.error('Sign-up error:', error.code, error.message);
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
                showMessage(errorMessageDiv, errorMessage, false);
            });
    }).catch((error) => {
        console.error('Firebase initialization error in signUp:', error);
        showMessage(errorMessageDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
    });
}

function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessageDiv = document.getElementById('error-message');

    if (!errorMessageDiv) {
        console.error('UI error: error-message div not found');
        alert('Lỗi giao diện: Không tìm thấy div thông báo lỗi.');
        return;
    }

    errorMessageDiv.classList.add('hidden');
    errorMessageDiv.textContent = '';

    if (!email || !password) {
        showMessage(errorMessageDiv, 'Vui lòng điền đầy đủ thông tin.', false);
        return;
    }

    withFirebaseInitialized(() => {
        return firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                if (user.emailVerified) {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userEmail', user.email);
                    // Log sign-in action
                    return logUserAction(user.uid, 'Đăng nhập').then(() => {
                        window.location.href = 'mylock.html';
                    });
                } else {
                    firebase.auth().signOut();
                    showMessage(errorMessageDiv, 'Vui lòng xác minh email của bạn trước khi đăng nhập.', false);
                }
            })
            .catch((error) => {
                console.error('Sign-in error:', error.code, error.message);
                showMessage(errorMessageDiv, 'Lỗi đăng nhập: ' + error.message, false);
            });
    }).catch((error) => {
        console.error('Firebase initialization error in signIn:', error);
        showMessage(errorMessageDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
    });
}

function logout() {
    withFirebaseInitialized(() => {
        const user = firebase.auth().currentUser;
        if (user) {
            // Log logout action
            return logUserAction(user.uid, 'Đăng xuất').then(() => {
                return firebase.auth().signOut()
                    .then(() => {
                        console.log('User signed out');
                        alert('Đã đăng xuất thành công!');
                        localStorage.removeItem('isLoggedIn');
                        localStorage.removeItem('userEmail');
                        window.location.href = 'signin.html';
                    })
                    .catch((error) => {
                        console.error('Logout error:', error.code, error.message);
                        alert('Lỗi: ' + error.message);
                    });
            }).catch((error) => {
                console.error('Error logging logout action:', error);
                alert('Lỗi: Không thể ghi lịch sử đăng xuất.');
            });
        } else {
            console.log('No user to log out');
            alert('Đã đăng xuất thành công!');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            window.location.href = 'signin.html';
        }
    }).catch((error) => {
        console.error('Firebase initialization error in logout:', error);
        alert('Lỗi: Firebase chưa được khởi tạo.');
    });
}

function uploadAvatar() {
    withFirebaseInitialized(() => {
        const user = firebase.auth().currentUser;
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

        const storageRef = firebase.storage().ref(`avatars/${user.uid}/${file.name}`);
        return storageRef.put(file)
            .then((snapshot) => snapshot.ref.getDownloadURL())
            .then((url) => {
                return firebase.firestore().collection('users').doc(user.uid).set(
                    { avatarUrl: url },
                    { merge: true }
                ).then(() => {
                    // Log avatar upload action
                    return logUserAction(user.uid, 'Tải lên ảnh đại diện').then(() => url);
                });
            })
            .then((url) => {
                document.getElementById('avatar-preview').src = url;
                document.getElementById('account-image').src = url;
                showMessage(errorDiv, 'Tải ảnh lên thành công!', true);
            })
            .catch((error) => {
                console.error('Avatar upload error:', error.code, error.message);
                showMessage(errorDiv, 'Lỗi: ' + error.message, false);
            });
    }).catch((error) => {
        console.error('Firebase initialization error in uploadAvatar:', error);
        const errorDiv = document.getElementById('avatar-error');
        if (errorDiv) {
            showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        }
    });
}

function updatePassword() {
    withFirebaseInitialized(() => {
        const user = firebase.auth().currentUser;
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

        const credential = firebase.auth().EmailAuthProvider.credential(user.email, currentPassword);
        return user.reauthenticateWithCredential(credential)
            .then(() => user.updatePassword(newPassword))
            .then(() => {
                return firebase.firestore().collection('users').doc(user.uid).set(
                    { email: user.email },
                    { merge: true }
                );
            })
            .then(() => {
                // Log password update action
                return logUserAction(user.uid, 'Cập nhật mật khẩu tài khoản');
            })
            .then(() => {
                showMessage(errorDiv, 'Đổi mật khẩu tài khoản thành công!', true);
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
            })
            .catch((error) => {
                console.error('Password update error:', error.code, error.message);
                showMessage(errorDiv, 'Lỗi: ' + error.message, false);
            });
    }).catch((error) => {
        console.error('Firebase initialization error in updatePassword:', error);
        const errorDiv = document.getElementById('password-error');
        if (errorDiv) {
            showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        }
    });
}

async function updateEmail() {
    withFirebaseInitialized(async () => {
        const user = firebase.auth().currentUser;
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
            await firebase.firestore().collection('users').doc(user.uid).set(
                { email: newEmail },
                { merge: true }
            );
            // Log email update action
            await logUserAction(user.uid, 'Cập nhật email');
            showMessage(errorDiv, 'Cập nhật email thành công! Vui lòng kiểm tra email mới để xác minh.', true);
            document.getElementById('new-email').value = '';
            window.location.href = 'verify.html';
        } catch (error) {
            console.error('Email update error:', error.code, error.message);
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        }
    }).catch((error) => {
        console.error('Firebase initialization error in updateEmail:', error);
        const errorDiv = document.getElementById('email-error');
        if (errorDiv) {
            showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        }
    });
}

function updateUsername() {
    withFirebaseInitialized(() => {
        const user = firebase.auth().currentUser;
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

        return firebase.firestore().collection('users').doc(user.uid).set(
            { username: username },
            { merge: true }
        ).then(() => {
            // Log username update action
            return logUserAction(user.uid, 'Cập nhật tên người dùng');
        }).then(() => {
            showMessage(errorDiv, 'Cập nhật tên người dùng thành công!', true);
            document.getElementById('username').value = username;
        }).catch((error) => {
            console.error('Username update error:', error.code, error.message);
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
    }).catch((error) => {
        console.error('Firebase initialization error in updateUsername:', error);
        const errorDiv = document.getElementById('username-error');
        if (errorDiv) {
            showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        }
    });
}

function updatePhoneNumber() {
    withFirebaseInitialized(() => {
        const user = firebase.auth().currentUser;
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

        return firebase.firestore().collection('users').doc(user.uid).set(
            { phoneNumber: phoneNumber },
            { merge: true }
        ).then(() => {
            // Log phone number update action
            return logUserAction(user.uid, 'Cập nhật số điện thoại');
        }).then(() => {
            showMessage(errorDiv, 'Cập nhật số điện thoại thành công!', true);
            document.getElementById('phone-number').value = phoneNumber;
        }).catch((error) => {
            console.error('Phone number update error:', error.code, error.message);
            showMessage(errorDiv, 'Lỗi: ' + error.message, false);
        });
    }).catch((error) => {
        console.error('Firebase initialization error in updatePhoneNumber:', error);
        const errorDiv = document.getElementById('phone-error');
        if (errorDiv) {
            showMessage(errorDiv, 'Lỗi: Firebase chưa được khởi tạo.', false);
        }
    });
}

window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
window.uploadAvatar = uploadAvatar;
window.updatePassword = updatePassword;
window.updateEmail = updateEmail;
window.updatePhoneNumber = updatePhoneNumber;
window.updateUsername = updateUsername;