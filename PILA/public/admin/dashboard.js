import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, collection, onSnapshot, query, orderBy, 
  doc, updateDoc, getDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ---------- Firebase config ---------- */
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

/* ---------- Price lookup map ---------- */
let itemsMap = {};  // itemName (lowercase) → price

async function initItemsMap() {
  const itemsSnapshot = await getDocs(collection(db, "items"));
  itemsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.name && data.price != null) {
      itemsMap[data.name.toLowerCase()] = data.price;
    }
  });
}

/* ---------- DOM refs ---------- */
const currentNumberListEl = document.getElementById("current-number-list");
const serveNextBtn = document.getElementById("serve-next-btn");
const orderTableBody = document.getElementById("order-table-body");
const totalWaitingEl = document.getElementById("total-waiting");
const completedEl = document.getElementById("completed");
const avgWaitEl = document.getElementById("avg-wait");
const longestWaitEl = document.getElementById("longest-wait");
const predictedWaitEl = document.getElementById("predicted-wait");
const lowStockList = document.getElementById("low-stock-list");
const logList = document.getElementById("admin-logs");
const logoutBtn = document.getElementById("logout");

let ordersList = [];

/* ---------- Auth ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = userDoc.exists() ? userDoc.data().role : null;

    if (role !== "admin") {
      alert("Access denied: Admins only.");
      await signOut(auth);
      window.location.href = "/index.html";
      return;
    }

    const welcome = document.getElementById("welcome");
    if (welcome) welcome.innerText = `Welcome, ${user.email}`;

    // ← Initialize price map first
    await initItemsMap();

    // ← Start real-time listeners
    initRealtimeQueue();
    initLowStockWatcher();

  } catch (err) {
    console.error("Role check error:", err);
    alert("Error verifying user role.");
    await signOut(auth);
    window.location.href = "/index.html";
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/index.html";
  });
}

/* ---------- Realtime queue listener ---------- */
function initRealtimeQueue() {
  const q = query(collection(db, "orders"), orderBy("queueNumber", "asc"));
  onSnapshot(q, (snapshot) => {
    ordersList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const pending = ordersList.filter(o => o.status === "pending");
    const serving = ordersList.filter(o => o.status === "in-progress" || o.status === "in_progress");
    const completed = ordersList.filter(o => o.status === "completed");

    renderServingCards(serving);
    renderWaitingTable(pending);
    updateStats(pending, completed);

  }, (err) => {
    console.error("Queue listener error:", err);
    logAction("❌ Queue listener error");
  });
}

/* ---------- Render waiting orders table ---------- */
function renderWaitingTable(pending) {
  if (!orderTableBody) return;

  if (pending.length === 0) {
    orderTableBody.innerHTML = `<tr><td colspan="10" class="muted">No pending orders</td></tr>`;
    return;
  }

  orderTableBody.innerHTML = pending.map(o => {
    try {
      const user = o.user || {};
      const customerName = user.fullName || user.name || "Guest";
      const contact = user.contact || "-";
      const program = user.program || "-";
      const studentID = user.studentID || "-";
      const yearSection = user.yearSection || "-";

      let products = "-";
      let orderTotal = 0;

      if (Array.isArray(o.items) && o.items.length > 0) {
        products = o.items.map(i => {
          if (!i || !i.itemName) return "Unknown Item";

          const parts = [i.itemName];
          if (i.qty) parts.push(`Qty: ${i.qty}`);
          if (i.size) parts.push(`Size: ${i.size || "-"}`);

          const price = itemsMap[i.itemName.toLowerCase()] || 0;
          orderTotal += price * (i.qty || 1);

          return parts.join(", ");
        }).join(" | ");
      }

      return `
        <tr data-id="${o.id}">
          <td>#${o.queueNumber || "-"}</td>
          <td>${escapeHtml(customerName)}</td>
          <td>${escapeHtml(contact)}</td>
          <td>${escapeHtml(program)}</td>
          <td>${escapeHtml(studentID)}</td>
          <td>${escapeHtml(yearSection)}</td>
          <td>${escapeHtml(products)}</td>
          <td><span class="status pending">Pending</span></td>
          <td>₱${orderTotal.toLocaleString()}</td>
          <td class="col-actions">
            <button class="btn-serve-now" data-id="${o.id}">Serve Now</button>
            <button class="btn-cancel" data-id="${o.id}">Cancel</button>
          </td>
        </tr>
      `;
    } catch (err) {
      console.error("Error rendering order:", o, err);
      return `<tr><td colspan="10" class="muted">Error loading this order</td></tr>`;
    }
  }).join("");
}

/* ---------- Render serving (in-progress) cards ---------- */
function renderServingCards(serving) {
  if (!currentNumberListEl) return;
  if (serving.length === 0) {
    currentNumberListEl.innerHTML = `<p class="muted">No active serving orders</p>`;
    return;
  }

  currentNumberListEl.innerHTML = serving.map(s => `
    <div class="serving-item" data-id="${s.id}">
      <span class="serving-number">#${s.queueNumber}</span>
      <div class="serving-actions">
        <button class="btn-complete" data-id="${s.id}">✅ Complete</button>
        <button class="btn-cancel" data-id="${s.id}">❌ Cancel</button>
      </div>
    </div>
  `).join("");
}

/* ---------- Stats ---------- */
function updateStats(pending, completed) {
  if (totalWaitingEl) totalWaitingEl.textContent = pending.length;
  if (completedEl) completedEl.textContent = completed.length;

  const completedWithTimes = ordersList.filter(o => o.status === "completed" && o.calledAt && o.completedAt);
  let avgMinutes = 2;
  if (completedWithTimes.length > 0) {
    const diffs = completedWithTimes.map(o => o.completedAt - o.calledAt);
    const avgMs = diffs.reduce((a,b)=>a+b,0) / diffs.length;
    avgMinutes = Math.max(1, Math.round(avgMs/60000));
  }
  if (avgWaitEl) avgWaitEl.textContent = `${avgMinutes} mins`;

  const pendingWithCreated = pending.filter(o => o.createdAt);
  if (pendingWithCreated.length > 0) {
    const now = Date.now();
    const longestMs = Math.max(...pendingWithCreated.map(o => now - o.createdAt));
    if (longestWaitEl) longestWaitEl.textContent = `${Math.ceil(longestMs/60000)} mins`;
  } else if (longestWaitEl) longestWaitEl.textContent = "-";

  if (predictedWaitEl) predictedWaitEl.textContent = pending.length > 0 ? `${pending.length * avgMinutes} mins` : "-";
}

/* ---------- Inventory watcher (threshold <= 15) ---------- */
function initLowStockWatcher() {
  const itemsCol = collection(db, "items");
  onSnapshot(itemsCol, (snap) => {
    try {
      const lowStock = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(i => {
          if (!i.stock) return false;
          if (typeof i.stock === "number") return i.stock <= 15;
          if (typeof i.stock === "object") {
            const sum = Object.values(i.stock).reduce((a,b)=>a+(Number(b)||0),0);
            return sum <= 15;
          }
          return false;
        });

      if (!lowStockList) return;
      lowStockList.innerHTML = lowStock.length
        ? lowStock.map(i => {
            const qty = typeof i.stock === "number" ? i.stock : Object.values(i.stock).reduce((a,b)=>a+(Number(b)||0),0);
            const status = qty <= 5 ? "critical" : "low";
            return `<li status="${status}"><span>${escapeHtml(i.name)}</span><strong>${qty} left</strong></li>`;
          }).join("")
        : `<li class="muted">All stocks healthy</li>`;
    } catch (err) {
      console.error("Low stock snapshot error:", err);
      if (lowStockList) lowStockList.innerHTML = `<li class="muted">Error loading inventory</li>`;
    }
  }, (err) => {
    console.error("Inventory listener error:", err);
  });
}

/* ---------- Actions (serve, complete, cancel) ---------- */
async function updateOrderStatusById(id, data) {
  if (!id) return;
  try {
    await updateDoc(doc(db, "orders", id), { ...data, updatedAt: Date.now() });
  } catch (err) {
    console.error("updateOrderStatusById error:", err);
    throw err;
  }
}

async function serveOrder(id) {
  const order = ordersList.find(o => o.id === id);
  if (!order) return logAction("⚠️ Order not found.");
  await updateOrderStatusById(id, { status: "in-progress", calledAt: Date.now() });
  logAction(`➡ Served now: #${order.queueNumber}`);
}

async function completeOrder(id) {
  const order = ordersList.find(o => o.id === id);
  if (!order) return;
  await updateOrderStatusById(id, { status: "completed", completedAt: Date.now() });
  logAction(`✅ Completed: #${order.queueNumber}`);
}

async function cancelOrder(id) {
  const order = ordersList.find(o => o.id === id);
  if (!order) return;
  await updateOrderStatusById(id, { status: "cancelled" });
  logAction(`❌ Cancelled: #${order.queueNumber}`);
}

async function serveNext() {
  const next = ordersList.find(o => o.status === "pending");
  if (!next) {
    logAction("⚠️ No pending orders to serve.");
    return;
  }
  await serveOrder(next.id);
}

/* ---------- Event wiring ---------- */
if (serveNextBtn) serveNextBtn.addEventListener("click", serveNext);

if (orderTableBody) {
  orderTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.classList.contains("btn-serve-now")) serveOrder(id);
    else if (btn.classList.contains("btn-cancel")) cancelOrder(id);
  });
}

if (currentNumberListEl) {
  currentNumberListEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.classList.contains("btn-complete")) completeOrder(id);
    else if (btn.classList.contains("btn-cancel")) cancelOrder(id);
  });
}

/* ---------- Helpers ---------- */
function logAction(msg) {
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  if (logList) logList.prepend(li);
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'", "&#39;");
}
