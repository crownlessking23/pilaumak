// order.js (fixed full file)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, collection, onSnapshot, getDocs, addDoc, doc, updateDoc, getDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Config
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

// DOM refs
const orderContainer = document.getElementById("order-items-container");
const cartTotalEl = document.getElementById("cart-total");
const addItemBtn = document.getElementById("add-item");
const autofillBtn = document.getElementById("autofill");
const autofillMsg = document.getElementById("autofill-message");
const successModal = document.getElementById("successModal");
const successMessageEl = document.getElementById("success-message");
const successClose = successModal?.querySelector(".close");
const successOk = document.getElementById("ok-btn");

let itemsList = [];
let preselectedUsed = false;
let myLatestQueueNumber = null;

// small queue status div above card
const queueDiv = document.createElement("div");
queueDiv.id = "queue-position";
queueDiv.style.color = "white";
queueDiv.style.fontWeight = "bold";
queueDiv.style.marginBottom = "10px";
const mainEl = document.getElementById("main");
if (mainEl) {
  mainEl.insertBefore(queueDiv, document.querySelector(".card"));
}

// ---------- Auth ----------
onAuthStateChanged(auth, user => {
  if (user) {
    if (!user.emailVerified) {
      alert("Verify email first.");
      signOut(auth);
      window.location.href = "/index.html";
    }
  } else {
    window.location.href = "/index.html";
  }
});

// logout button
const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/index.html";
  });
}

// sidebar toggle
const hamburger = document.getElementById("hamburger");
const sidebar = document.getElementById("sidebar");
if (hamburger && sidebar) {
  hamburger.addEventListener("click", () => {
    sidebar.style.left = sidebar.style.left === "0px" ? "-250px" : "0px";
  });
}

// ---------- Fetch items (live) ----------
const itemsColRef = collection(db, "items");
onSnapshot(itemsColRef, snapshot => {
  itemsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  // if user came from browse with ?item=..., preselect once
  const urlParams = new URLSearchParams(window.location.search);
  const selectedItemFromBrowse = urlParams.get('item');
  if (selectedItemFromBrowse && !preselectedUsed) {
    createOrderRow(selectedItemFromBrowse);
    preselectedUsed = true;
  }
  // update totals in case item prices changed
  updateTotalCost();
});

// ---------- Autofill student info ----------
if (autofillBtn) {
  autofillBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    const msg = autofillMsg;
    if (msg) msg.style.display = "none";

    if (!user) {
      alert("You must be logged in to autofill your details.");
      return;
    }

    try {
      const docRef = doc(db, "accounts", user.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        let filled = false;
        ["fullName", "studentID", "gmail", "contact", "yearSection", "program"].forEach(id => {
          if (data[id]) {
            const el = document.getElementById(id);
            if (el) el.value = data[id];
            filled = true;
          }
        });

        if (filled) {
          alert("Your saved student info has been autofilled!");
        } else {
          if (msg) msg.style.display = "block";
        }
      } else {
        if (msg) msg.style.display = "block";
      }
    } catch (err) {
      console.error("Autofill error:", err);
      alert("Error fetching your account info.");
    }
  });
}

// ---------- Helper: build options HTML ----------
function buildOptionsHTML(selectedItemName = null) {
  return itemsList
    .filter(i => {
      if (typeof i.stock === "number") return i.stock > 0;
      if (typeof i.stock === "object") return Object.values(i.stock).some(q => Number(q) > 0);
      return false;
    })
    .map(i => {
      const stockText = typeof i.stock === "number" ? ` (${i.stock} left)` : '';
      return `<option value="${escapeHtml(i.name)}" ${selectedItemName === i.name ? 'selected' : ''}>
                ${escapeHtml(i.name)} - ₱${i.price}${stockText}
              </option>`;
    }).join('');
}

// small helper to avoid XSS-ish issues with interpolation
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// ---------- Create an order row ----------
function createOrderRow(selectedItemName = null) {
  if (!orderContainer) return;
  if (itemsList.length === 0) return;

  const div = document.createElement("div");
  div.className = "order-item";

  // Get first selected item (or first available)
  const selectedItem = itemsList.find(i => i.name === selectedItemName) || itemsList.find(i => {
    if (typeof i.stock === "number") return i.stock > 0;
    if (typeof i.stock === "object") return Object.values(i.stock).some(q => Number(q) > 0);
    return false;
  });

  const sizeOptionsHTML = selectedItem?.stock && typeof selectedItem.stock === "object"
    ? Object.keys(selectedItem.stock).filter(s => Number(selectedItem.stock[s]) > 0).map(s => `<option value="${s}">${s}</option>`).join('')
    : '';

  div.innerHTML = `
    <select class="item-select">${buildOptionsHTML(selectedItemName)}</select>
    ${sizeOptionsHTML ? `<select class="size-select">${sizeOptionsHTML}</select>` : ''}
    <button type="button" class="qty-btn qty-minus">-</button>
    <input type="number" class="quantity" value="1" min="1">
    <button type="button" class="qty-btn qty-plus">+</button>
    <button type="button" class="remove-item">x</button>
  `;
  orderContainer.appendChild(div);

  // Attach listeners that update total
  const qtyMinus = div.querySelector(".qty-minus");
  const qtyPlus = div.querySelector(".qty-plus");
  const qtyInput = div.querySelector(".quantity");
  const removeBtn = div.querySelector(".remove-item");
  const itemSelect = div.querySelector(".item-select");

  if (qtyMinus) {
    qtyMinus.addEventListener("click", () => {
      const q = qtyInput;
      if (q && q.value > 1) q.value = Number(q.value) - 1;
      updateTotalCost();
    });
  }
  if (qtyPlus) {
    qtyPlus.addEventListener("click", () => {
      const q = qtyInput;
      if (q) q.value = Number(q.value) + 1;
      updateTotalCost();
    });
  }
  if (qtyInput) {
    qtyInput.addEventListener("input", () => {
      if (qtyInput.value === "" || Number(qtyInput.value) < 1) qtyInput.value = 1;
      updateTotalCost();
    });
  }
  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      div.remove();
      updateTotalCost();
    });
  }
  if (itemSelect) {
    itemSelect.addEventListener("change", (e) => {
      // update size select depending on new item
      const newItem = itemsList.find(i => i.name === e.target.value);
      const existingSizeSelect = div.querySelector(".size-select");
      if (newItem?.stock && typeof newItem.stock === "object") {
        const availableSizes = Object.keys(newItem.stock).filter(s => Number(newItem.stock[s]) > 0);
        if (availableSizes.length > 0) {
          const newSizeHTML = availableSizes.map(s => `<option value="${s}">${s}</option>`).join('');
          if (existingSizeSelect) existingSizeSelect.innerHTML = newSizeHTML;
          else {
            const sizeSelect = document.createElement("select");
            sizeSelect.className = "size-select";
            sizeSelect.innerHTML = newSizeHTML;
            div.insertBefore(sizeSelect, div.querySelector(".qty-minus"));
          }
        } else if (existingSizeSelect) {
          existingSizeSelect.remove();
        }
      } else if (existingSizeSelect) {
        existingSizeSelect.remove();
      }
      updateTotalCost();
    });
  }

  // initial total update
  updateTotalCost();
}

// Add item button
const addBtn = document.getElementById("add-item");
if (addBtn) addBtn.addEventListener("click", () => createOrderRow());

// ---------- Total cost function (global) ----------
function updateTotalCost() {
  let total = 0;
  document.querySelectorAll(".order-item").forEach(row => {
    const itemSelect = row.querySelector(".item-select");
    const qtyInput = row.querySelector(".quantity");
    const itemName = itemSelect ? itemSelect.value : null;
    const qty = qtyInput ? Number(qtyInput.value) || 0 : 0;
    const item = itemsList.find(i => i.name === itemName);
    if (item) {
      const price = Number(item.price) || 0;
      total += price * qty;
    }
  });
  if (cartTotalEl) cartTotalEl.innerText = `Total: ₱${total}`;
}

// ---------- Submit order ----------
const orderForm = document.getElementById("order-form");
if (orderForm) {
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // collect user details
    const details = {};
    ["fullName", "studentID", "gmail", "contact", "yearSection", "program"].forEach(id => {
      const el = document.getElementById(id);
      details[id] = el ? el.value : "";
    });

    // gather items, check stock
    let outOfStock = false;
    const orderItems = [];

    document.querySelectorAll(".order-item").forEach(row => {
      const itemName = row.querySelector(".item-select")?.value;
      const sizeSelect = row.querySelector(".size-select");
      const size = sizeSelect ? sizeSelect.value : null;
      const qty = Number(row.querySelector(".quantity")?.value) || 0;

      const item = itemsList.find(i => i.name === itemName);
      if (!item) return;

      let available = 0;
      if (typeof item.stock === "number") available = item.stock;
      else if (size && item.stock[size] !== undefined) available = Number(item.stock[size]);

      if (qty > available) outOfStock = true;
      orderItems.push({ itemName, size, qty });
    });

    if (outOfStock) {
      alert("Error: One or more items in your cart exceed the available stock.");
      return;
    }
    if (orderItems.length === 0) {
      alert("Add at least one item.");
      return;
    }

    try {
      const ordersColRef = collection(db, "orders");
      let snapshot = await getDocs(ordersColRef);
      const currentQueueNumber = snapshot.size + 1;

      // create order (always pending initially)
      await addDoc(ordersColRef, {
        user: details,
        items: orderItems,
        timestamp: new Date(),
        queueNumber: currentQueueNumber,
        status: "pending"
      });
      myLatestQueueNumber = currentQueueNumber;

      // deduct stock
      for (const o of orderItems) {
        const item = itemsList.find(i => i.name === o.itemName);
        if (!item) continue;
        const itemRef = doc(db, "items", item.id);

        if (typeof item.stock === "number") {
          await updateDoc(itemRef, { stock: item.stock - o.qty });
        } else if (o.size) {
          const newStock = { ...item.stock };
          newStock[o.size] = Number(newStock[o.size]) - o.qty;
          await updateDoc(itemRef, { stock: newStock });
        }
      }

      // show success modal with correct queue number
      if (successMessageEl && successModal) {
        successMessageEl.innerText = `Your queue number is #${currentQueueNumber}`;
        successModal.style.display = "flex";
      } else {
        alert(`Order successfully submitted!\nYour queue number is #${currentQueueNumber}`);
      }

      // clear form rows and update total
      orderContainer.innerHTML = "";
      updateTotalCost();

      // live track position among pending orders
      const pendingQuery = query(ordersColRef, where("status", "==", "pending"), orderBy("queueNumber"));
      onSnapshot(pendingQuery, snap => {
        const activeQueue = snap.docs.map(d => d.data().queueNumber).sort((a, b) => a - b);
        const position = activeQueue.indexOf(myLatestQueueNumber) + 1;
        if (position <= 0) {
    queueDiv.textContent = "You have been served or your order was completed!";
    } else {
    queueDiv.textContent = ""; // clear, since popup handles success
    }
      });

    } catch (err) {
      console.error("Order error:", err);
      alert("Error submitting order. Please try again.");
    }
  });
}

// ---------- Success modal handlers ----------
if (successClose) {
  successClose.addEventListener("click", () => {
    successModal.style.display = "none";
  });
}
if (successOk) {
  successOk.addEventListener("click", () => {
    successModal.style.display = "none";
   window.location.href = "/main/dashboard.html";
  });
}
window.addEventListener("click", (e) => {
  if (e.target === successModal) successModal.style.display = "none";
});
