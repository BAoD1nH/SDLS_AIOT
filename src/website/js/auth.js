function signUp() {
	const email = document.getElementById("email").value;
	const password = document.getElementById("password").value;

	auth.createUserWithEmailAndPassword(email, password)
		.then(() => {
			alert("✅ Registered!");
			window.location.href = "mylock.html";
		})
		.catch(error => alert("❌ " + error.message));
}

function signIn() {
	const email = document.getElementById("email").value;
	const password = document.getElementById("password").value;

	auth.signInWithEmailAndPassword(email, password)
		.then(() => {
			alert("✅ Logged in!");
			window.location.href = "mylock.html";
		})
		.catch(error => alert("❌ " + error.message));
}
