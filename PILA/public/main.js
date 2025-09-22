
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ---------------- Firebase Config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyDq2W-iCV72vdSfRUb5_E4lwFOAeroKl6Y",
  authDomain: "pila-umak.firebaseapp.com",
  projectId: "pila-umak",
  storageBucket: "pila-umak.appspot.com",
  messagingSenderId: "465630207763",
  appId: "1:465630207763:web:4d3de5f5e7542654c304e6"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- Walk-in Emails ----------------
const walkInEmails = ["ryzenpards@gmail.com"];

// ---------------- DOM References ----------------
const statusEl = document.getElementById("status");
const resendBtn = document.getElementById("resendVerificationBtn");
const signupPasswordEl = document.getElementById("signup-password");
const repeatPasswordEl = document.getElementById("signup-repeat-password");
const passwordInfoEl = document.getElementById("password-requirements");

// ---------------- Password Validation ----------------
function validatePassword(password) {
  const requirements = [
    { regex: /.{8,}/, message: "At least 8 characters" },
    { regex: /[A-Z]/, message: "At least 1 uppercase letter" },
    { regex: /\d/, message: "At least 1 number" },
    { regex: /[!@#$%^&*(),.?\":{}|<>]/, message: "At least 1 symbol" }
  ];
  const unmet = requirements.filter(r => !r.regex.test(password));
  return { valid: unmet.length === 0, unmet: unmet.map(r => r.message) };
}

// ---------------- Show/Hide Password ----------------
window.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  document.querySelectorAll(".toggle-password").forEach(wrapper => {
    const targetId = wrapper.dataset.target;
    const input = document.getElementById(targetId);
    const icon = wrapper.querySelector("i");
    wrapper.style.cursor = "pointer";

    wrapper.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        icon.setAttribute("data-lucide", "eye-off");
      } else {
        input.type = "password";
        icon.setAttribute("data-lucide", "eye");
      }
      lucide.createIcons();
    });
  });
});

// ---------------- Password Feedback ----------------
signupPasswordEl.addEventListener("input", () => {
  const result = validatePassword(signupPasswordEl.value);
  if (signupPasswordEl.value === "") {
    passwordInfoEl.textContent = "Must be at least 8 characters, include 1 capital letter, 1 number, and 1 symbol.";
    passwordInfoEl.className = "password-info";
    return;
  }
  if (result.valid) {
    passwordInfoEl.textContent = "✅ Strong password";
    passwordInfoEl.className = "password-info valid";
  } else {
    passwordInfoEl.textContent = "❌ " + result.unmet.join(", ");
    passwordInfoEl.className = "password-info invalid";
  }
});

// ---------------- Resend Verification Cooldown ----------------
let cooldownActive = false;
function startCooldown() {
  cooldownActive = true;
  resendBtn.disabled = true;
  let remaining = 30;
  resendBtn.innerText = `Resend (${remaining})`;
  const interval = setInterval(() => {
    remaining--;
    resendBtn.innerText = `Resend (${remaining})`;
    if (remaining <= 0) {
      clearInterval(interval);
      resendBtn.disabled = false;
      resendBtn.innerText = "Resend";
      cooldownActive = false;
    }
  }, 1000);
}

resendBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (user && !user.emailVerified && !cooldownActive) {
    try {
      await sendEmailVerification(user);
      statusEl.innerText = "📩 Verification email resent! Please check your inbox/spam.";
      startCooldown();
    } catch (error) {
      statusEl.innerText = error.message;
    }
  }
});

// ---------------- Signup Form ----------------
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signup-email").value;
  const password = signupPasswordEl.value;
  const repeatPassword = repeatPasswordEl.value;

  const result = validatePassword(password);
  if (!result.valid) {
    statusEl.innerText = "❌ Password too weak: " + result.unmet.join(", ");
    return;
  }
  if (password !== repeatPassword) {
    statusEl.innerText = "❌ Passwords do not match!";
    return;
  }
  if (!email.endsWith("@umak.edu.ph")) {
    statusEl.innerText = "Only @umak.edu.ph emails allowed for signup!";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create Firestore doc for new user
    await setDoc(doc(db, "users", user.uid), { email: user.email, role: "student" });

    await sendEmailVerification(user);
    statusEl.innerText = "✅ Registration successful! Please verify your email. (Check Spam too)";
    resendBtn.classList.remove("hidden");
    startCooldown();
  } catch (error) {
    statusEl.innerText = "❌ " + error.message;
  }
});

// ---------------- Forgot Password ----------------
document.getElementById("forgot-password").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value;
  if (!email) {
    statusEl.innerText = "⚠️ Please enter your email to reset password.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    statusEl.innerText = "📩 Password reset email sent! Check your inbox/spam.";
  } catch (error) {
    statusEl.innerText = "❌ " + error.message;
  }
});

// ---------------- Login Form ----------------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check UMAK email verification
    if (email.endsWith("@umak.edu.ph") && !user.emailVerified) {
      if (!cooldownActive) await sendEmailVerification(user);
      statusEl.innerText = "⚠️ Your UMAK email is not verified. A new verification link has been sent.";
      resendBtn.classList.remove("hidden");
      await signOut(auth);
      return;
    } else {
      resendBtn.classList.add("hidden");
    }

    // Fetch role from Firestore (fallback to student if doc doesn't exist)
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = userDoc.exists() ? userDoc.data().role : "student";

    // Redirect based on role
    if (role === "admin") {
  window.location.href = "/admin/dashboard.html";
} else if (role === "walkin") {
  if (window.location.pathname.includes("/walk-in/")) {
  } else {
    window.location.href = "/walk-in/dashboard.html";
  }
} else {
  window.location.href = "/main/dashboard.html";
}

  } catch (error) {
    statusEl.innerText = error.message;
  }
});

