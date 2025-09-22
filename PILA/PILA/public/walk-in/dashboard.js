import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, collection, onSnapshot, query, orderBy, 
  doc, updateDoc, addDoc, getDoc, getDocs, where 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

const itemsContainer = document.getElementById("items-list");
const searchInput = document.getElementById("search-items");
const welcome = document.getElementById("welcome");
const main = document.getElementById("main");

let itemsList = [];
let categories = [];
let currentCategoryIndex = 0;
let userEmail = "";

// --- Auth status ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html"; 
    return;
  }

  // Fetch user roles
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== "walkin") {
    alert("Access denied: Walk-in users only");
    await signOut(auth); 
    window.location.href = "../index.html";
    return;
  }

  document.body.style.display = "block"; 

  const welcome = document.getElementById("welcome");
  if (welcome) welcome.innerText = `Welcome, Fellow Heron`;

  initQueueListener();
});

document.getElementById("logout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/index.html";
});

const itemsColRef = collection(db, "items");
onSnapshot(itemsColRef, (snapshot) => {
  itemsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const catSet = new Set(itemsList.map(i => i.category));
  categories = Array.from(catSet);
  if (currentCategoryIndex >= categories.length) currentCategoryIndex = 0;
  renderItems(searchInput.value.toLowerCase());
});

searchInput.addEventListener("input", () => renderItems(searchInput.value.toLowerCase()));

function renderItems(filter = "") {
  itemsContainer.innerHTML = "";
  if (categories.length === 0) return;

  const currentCategory = categories[currentCategoryIndex];
  document.querySelector("#items-card h2").innerText = `Available Items - ${currentCategory}`;

  itemsList
    .filter(i => i.category === currentCategory &&
      (i.name.toLowerCase().includes(filter) || i.category.toLowerCase().includes(filter)))
    .forEach(i => {
      const div = document.createElement("div");
      div.className = "item";

      let stockDisplay = "";
      if (currentCategory.toLowerCase() === "books") {
        stockDisplay = `Stocks: ${i.stock || 0}`;
      } else if (i.stock) {
        stockDisplay = `S:${i.stock.S || 0} | M:${i.stock.M || 0} | L:${i.stock.L || 0} | XL:${i.stock.XL || 0}`;
      }

      div.innerHTML = `
        <img src="${i.img}" alt="${i.name}">
        <div class="item-details">
          <div class="item-header">
            <strong>${i.name}</strong>
            <span class="item-price">₱${i.price}</span>
          </div>
          <div class="item-meta">Category: ${i.category}</div>
          <div class="stock-sizes">${stockDisplay}</div>
          <button class="add-to-cart">Add to Cart</button>
        </div>
      `;

      div.querySelector(".add-to-cart").addEventListener("click", () => {
        window.location.href = `order.html?item=${encodeURIComponent(i.name)}`;
      });

      itemsContainer.appendChild(div);
    });
}

// --- Carousel navigation ---
document.getElementById("prev").addEventListener("click", () => {
  if (categories.length === 0) return;
  currentCategoryIndex = (currentCategoryIndex - 1 + categories.length) % categories.length;
  renderItems(searchInput.value.toLowerCase());
});

document.getElementById("next").addEventListener("click", () => {
  if (categories.length === 0) return;
  currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
  renderItems(searchInput.value.toLowerCase());
});

// --- Sidebar toggle ---
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
hamburger.addEventListener("click", () => {
  if (sidebar.style.left === "0px") {
    sidebar.style.left = "-250px";
    main.style.marginLeft = "0";
  } else {
    sidebar.style.left = "0px";
    main.style.marginLeft = "250px";
  }
});

// --- Queue Listener ---
function initQueueListener() {
  const queueColRef = collection(db, "orders");
  const q = query(queueColRef, orderBy("queueNumber", "asc"));

  let queueCard = document.getElementById("queue-card");
  if (!queueCard) {
    queueCard = document.createElement("div");
    queueCard.className = "card";
    queueCard.id = "queue-card";
    queueCard.innerHTML = `
      <h2>Realtime Queue Status</h2>
      <div class="queue-grid">
        <div class="queue-box pending">
          <div class="queue-number" id="pending-count">0</div>
          <div class="queue-label">Waiting</div>
        </div>
        <div class="queue-box now-serving">
          <div class="queue-number" id="now-serving">-</div>
          <div class="queue-label">Now Serving</div>
        </div>
      </div>
    `;
    main.insertBefore(queueCard, main.children[1]);
  }

  const nowServingEl = document.getElementById("now-serving");
  const pendingCountEl = document.getElementById("pending-count");

  onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Active orders (not completed/cancelled)
    const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "cancelled");
    const pendingOrders = activeOrders
      .filter(o => o.status === "pending")
      .sort((a, b) => a.queueNumber - b.queueNumber);
    const inProgressOrders = activeOrders
      .filter(o => o.status === "in-progress")
      .sort((a, b) => a.queueNumber - b.queueNumber);

    // Update UI
    nowServingEl.innerText = inProgressOrders.length > 0
      ? inProgressOrders.map(o => `#${o.queueNumber}`).join(", ")
      : "-";

    pendingCountEl.innerText = pendingOrders.length;
    
    const myOrders = activeOrders.filter(o => o.user && o.user.gmail === userEmail);
    const myQueues = myOrders.map(o => `#${o.queueNumber}`);
    userQueuesEl.innerText = myQueues.length > 0 ? myQueues.join(", ") : "-";

    // Fill modal
    const myQueuesList = document.getElementById("my-queues-list");
    myQueuesList.innerHTML = "";
    if (myOrders.length > 0) {
      myOrders.forEach(order => {
        const div = document.createElement("div");
        div.className = "queue-item";
        div.innerHTML = `
          <span>#${order.queueNumber} (${order.status})</span>
          <button class="cancel-btn">Cancel</button>
        `;

        const cancelBtn = div.querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", async () => {
          if (confirm(`Cancel queue #${order.queueNumber}?`)) {
            await updateDoc(doc(db, "orders", order.id), {
              status: "cancelled",
              cancelledAt: new Date()
            });
          }
        });

        myQueuesList.appendChild(div);
      });
    } else {
      myQueuesList.innerHTML = "<p>No active queues</p>";
    }
  });
}

// --- Create Order (always pending now) ---
export async function createOrder(newQueueNumber, userEmail) {
  const ordersRef = collection(db, "orders");

  await addDoc(ordersRef, {
    queueNumber: newQueueNumber,
    user: { gmail: userEmail },
    status: "pending", // always pending
    createdAt: new Date()
  });
}
