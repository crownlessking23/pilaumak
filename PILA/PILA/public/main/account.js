import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } 
  from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDq2W-iCV72vdSfRUb5_E4lwFOAeroKl6Y",
  authDomain: "pila-umak.firebaseapp.com",
  projectId: "pila-umak",
  storageBucket: "pila-umak.firebasestorage.app",
  messagingSenderId: "465630207763",
  appId: "1:465630207763:web:4d3de5f5e7542654c304e6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sidebar Toggle
document.getElementById("hamburger").addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  sidebar.style.left = sidebar.style.left === "0px" ? "-250px" : "0px";
});

// Logout
document.getElementById("logout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/index.html";
});


// Modal
const modal = document.getElementById("reset-password-modal");
const closeButton = document.getElementsByClassName("close-button")[0];
const modalMessage = document.getElementById("modal-message");

function showModal(message) {
  modalMessage.textContent = message;
  modal.style.display = "block";
}

closeButton.onclick = function() {
  modal.style.display = "none";
}

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

// Main Auth & Load Data
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  if (!user.emailVerified) {
    showModal("Verify email first.");
    await signOut(auth);
    window.location.href = "/index.html";
    return;
  }

  const docRef = doc(db, "accounts", user.uid);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return;

  const data = snap.data();

  // Fill account fields
  ["fullName", "studentID", "gmail", "contact", "yearSection", "program"].forEach(id => {
    document.getElementById(id).value = data[id] || "";
  });

  // Load transaction history
  loadTransactionHistory(data.gmail); // using gmail as unique identifier
});

// Save Account Info
document.getElementById("account-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const details = {};
  ["fullName", "studentID", "gmail", "contact", "yearSection", "program"].forEach(id => {
    details[id] = document.getElementById(id).value;
  });

  try {
    await setDoc(doc(db, "accounts", user.uid), details);
    showModal("Account info saved successfully!");
    loadTransactionHistory(details.gmail);
  } catch (err) {
    console.error(err);
    showModal("Error saving info.");
  }
});

// Function to load transaction history
async function loadTransactionHistory(userEmail) {
  const transactionContainer = document.getElementById("transaction-history");
  transactionContainer.innerHTML = "<p>Loading...</p>";

  try {
    const ordersCol = collection(db, "orders");
    const q = query(ordersCol, where("user.gmail", "==", userEmail));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      transactionContainer.innerHTML = "<p>No transactions yet.</p>";
      return;
    }

    transactionContainer.innerHTML = ""; // clear loading text

    for (const docSnap of snapshot.docs) {
      const order = docSnap.data();

      let totalCost = 0;

      // Prepare an array of item names in this order
      const itemNames = (order.items || []).map(i => i.itemName);

      // Fetch all items in one go from 'items' collection
      const itemsSnapshot = await getDocs(
        query(collection(db, "items"), where("name", "in", itemNames))
      );

      // Map item name -> price for easy lookup
      const priceMap = {};
      itemsSnapshot.forEach(doc => {
        const data = doc.data();
        priceMap[data.name] = data.price || 0;
      });

      // Generate items HTML and calculate total cost
      const itemsHTML = (order.items || []).map(item => {
        const price = priceMap[item.itemName] || 0;
        const cost = price * item.qty;
        totalCost += cost;
        return `<li>${item.itemName} ${item.size ? `(${item.size})` : ""} x ${item.qty} - ₱${cost}</li>`;
      }).join("");

      // Handle timestamp safely
      let orderDate = "N/A";
      if (order.timestamp?.toDate) {
        orderDate = order.timestamp.toDate().toLocaleString();
      } else if (typeof order.timestamp === "number") {
        orderDate = new Date(order.timestamp).toLocaleString();
      } else if (typeof order.timestamp === "string") {
        orderDate = new Date(order.timestamp).toLocaleString();
      }

      const orderHTML = `
        <div class="transaction-card" style="margin-bottom: 15px; padding: 12px; border: 1px solid #ccc; border-radius: 8px;">
          <p><strong>Status:</strong> ${order.status || "N/A"}</p>
          <p><strong>Queue #:</strong> ${order.queueNumber || "N/A"}</p>
          <p><strong>Date:</strong> ${orderDate}</p>
          <p><strong>Items:</strong></p>
          <ul>${itemsHTML}</ul>
          <p><strong>Total Cost:</strong> ₱${totalCost}</p>
        </div>
      `;

      transactionContainer.insertAdjacentHTML("beforeend", orderHTML);
    }

  } catch (err) {
    console.error("Error loading transactions:", err);
    transactionContainer.innerHTML = "<p>Error loading transactions.</p>";
  }
}

// Reset Password
document.getElementById("reset-password").addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    showModal("No user is signed in.");
    return;
  }

  const userEmail = user.email;
  if (!userEmail) {
    showModal("User email is not available.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, userEmail);
    showModal(`A password reset email has been sent to ${userEmail}. Please check your inbox.`);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    showModal("Failed to send password reset email. Please try again later.");
  }
});