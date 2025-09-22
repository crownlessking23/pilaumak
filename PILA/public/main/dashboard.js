import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, collection, onSnapshot, query, orderBy, 
  doc, updateDoc, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// --- Firebase Config ---
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

document.addEventListener("DOMContentLoaded", () => {
  const itemsContainer = document.getElementById("items-list");
  const searchInput = document.getElementById("search-items");
  const welcome = document.getElementById("welcome");
  const main = document.getElementById("main");

  const inquiryBtn = document.getElementById("inquiry-button");
  const inquiryBox = document.getElementById("inquiry-box");
  const closeInquiry = document.getElementById("close-inquiry");
  const humanOption = document.getElementById("human-option");
  const contactModal = document.getElementById("contactModal");
  const closeContact = document.getElementById("closeContact");
  const contactForm = document.getElementById("contactForm");

  let notificationBox = document.getElementById("notification-box");
  if (!notificationBox) {
    notificationBox = document.createElement("div");
    notificationBox.id = "notification-box";
    notificationBox.style.cssText = `
      background: #fef3c7; 
      border: 1px solid #f59e0b; 
      color: #92400e; 
      padding: 10px; 
      border-radius: 8px; 
      margin: 10px 0; 
      display: none;
    `;
    main.insertBefore(notificationBox, main.firstChild);
  }

  function showInternalNotification(msg) {
    notificationBox.innerText = msg;
    notificationBox.style.display = "block";
    const sound = document.getElementById("notifSound");
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(err => console.log("Audio play blocked:", err));
    }
  }

  function clearInternalNotification() {
    notificationBox.innerText = "";
    notificationBox.style.display = "none";
  }

  let itemsList = [];
  let categories = [];
  let currentCategoryIndex = 0;
  let userEmail = "";
  let notifiedOrders = new Map();

  // --- Auth ---
  onAuthStateChanged(auth, user => {
    if (!user) return window.location.href = "/index.html";
    if (!user.emailVerified) {
      alert("Please verify your email first.");
      signOut(auth);
      return window.location.href = "/index.html";
    }
    userEmail = user.email;
    welcome.innerText = `Welcome, ${userEmail}`;
    initQueueListener();
  });

  // --- Logout ---
  document.getElementById("logout").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/index.html";
  });

  // --- Fetch Items ---
  const itemsColRef = collection(db, "items");
  onSnapshot(itemsColRef, snapshot => {
    itemsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const catSet = new Set(itemsList.map(i => i.category));
    categories = Array.from(catSet);
    if (currentCategoryIndex >= categories.length) currentCategoryIndex = 0;
    renderItems(searchInput.value.toLowerCase());
  });

  searchInput.addEventListener("input", () => renderItems(searchInput.value.toLowerCase()));

  // --- Render Items with smooth slide + fade ---
  function renderItems(filter = "") {
    if (!categories.length) return;
    const currentCategory = categories[currentCategoryIndex];
    document.querySelector("#items-card h2").innerText = `Available Items - ${currentCategory}`;

    const filteredItems = itemsList.filter(i =>
      i.category === currentCategory &&
      (i.name.toLowerCase().includes(filter) || i.category.toLowerCase().includes(filter))
    );

    itemsContainer.style.transition = "none";
    itemsContainer.style.opacity = 0;
    itemsContainer.style.transform = "translateX(20px)";

    setTimeout(() => {
      itemsContainer.innerHTML = "";
      filteredItems.forEach(i => {
        const div = document.createElement("div");
        div.className = "item";
        div.style.opacity = 0;
        div.style.transform = "translateX(20px)";
        div.style.transition = "opacity 0.4s ease, transform 0.4s ease";

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

        setTimeout(() => {
          div.style.opacity = 1;
          div.style.transform = "translateX(0)";
        }, 50);
      });

      itemsContainer.style.transition = "opacity 0.4s ease";
      itemsContainer.style.opacity = 1;
      itemsContainer.style.transform = "translateX(0)";
    }, 50);
  }

  // --- Carousel Sliding ---
  document.getElementById("prev").addEventListener("click", () => {
    if (!categories.length) return;
    currentCategoryIndex = (currentCategoryIndex - 1 + categories.length) % categories.length;
    renderItems(searchInput.value.toLowerCase());
  });
  document.getElementById("next").addEventListener("click", () => {
    if (!categories.length) return;
    currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
    renderItems(searchInput.value.toLowerCase());
  });

  // --- Sidebar ---
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
        <h2 style="display:flex; justify-content:space-between; align-items:center;">
          Realtime Queue Status
          <button id="enableSoundBtn" style="padding:2px 6px; font-size:12px; border:1px solid #ccc; border-radius:4px; background:#f3f4f6; cursor:pointer;">🔔</button>
        </h2>
        <div class="queue-grid">
          <div class="queue-box pending">
            <div class="queue-number" id="pending-count">0</div>
            <div class="queue-label">Waiting</div>
          </div>
          <div class="queue-box now-serving">
            <div class="queue-number" id="now-serving">-</div>
            <div class="queue-label">Now Serving</div>
          </div>
          <div class="queue-box yours">
            <span id="queue-info" class="info-icon">ⓘ</span>
            <div class="queue-number" id="user-queues">-</div>
            <div class="queue-label">Your Queue</div>
          </div>
        </div>
        <div id="myQueuesModal" class="modal">
          <div class="modal-content">
            <span class="close">&times;</span>
            <h3>My Queues</h3>
            <div id="my-queues-list"></div>
          </div>
        </div>
      `;
      main.insertBefore(queueCard, document.querySelector("header").nextSibling);

const enableSoundBtn = document.getElementById("enableSoundBtn");
if (enableSoundBtn) {
  enableSoundBtn.addEventListener("click", () => {
    const sound = document.getElementById("notifSound");
    if (sound) {
      sound.currentTime = 0;
      sound.play().then(() => {
        // Floating ✔️ text
        const floatText = document.createElement("span");
        floatText.innerText = "✔️ Notification Sound Tested";
        floatText.style.cssText = `
          position: absolute;
          top: -25px;
          left: 50%;
          transform: translateX(-50%);
          background: #22c55e;
          color: white;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 12px;
          opacity: 1;
          pointer-events: none;
          transition: transform 2s ease, opacity 2s ease;
          z-index: 1000;
        `;

        const parent = enableSoundBtn.parentElement;
        if (getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }

        parent.appendChild(floatText);
        setTimeout(() => {
          floatText.style.transform = "translateX(-50%) translateY(-60px)";
          floatText.style.opacity = "0";
        }, 20);
        setTimeout(() => floatText.remove(), 2500);
      }).catch(err => console.log("Unlock error:", err));
    }
  });
}}

    const infoIcon = document.getElementById("queue-info");
    const modal = document.getElementById("myQueuesModal");
    const closeBtn = modal.querySelector(".close");
    infoIcon.addEventListener("click", () => modal.style.display = "block");
    closeBtn.addEventListener("click", () => modal.style.display = "none");
    window.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });

    onSnapshot(q, snapshot => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeOrders = orders.filter(o => !["completed", "cancelled"].includes(o.status));
      const pendingOrders = activeOrders.filter(o => o.status === "pending").sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));
      const inProgressOrders = activeOrders.filter(o => o.status === "in-progress").sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));
      const nowServingNumber = inProgressOrders.length ? Number(inProgressOrders[0].queueNumber) : null;
      const myOrders = activeOrders.filter(o => o.user && o.user.gmail === userEmail);

      clearInternalNotification();
      myOrders.forEach(order => {
        const queueNum = Number(order.queueNumber);
        if (!nowServingNumber) return;
        if (queueNum === nowServingNumber) {
          showInternalNotification(`✅ You may proceed inside. Queue #${queueNum}`);
        } else if (queueNum - nowServingNumber <= 5 && queueNum > nowServingNumber) {
          showInternalNotification(`⚠️ Your turn is near (Queue #${queueNum}). Please standby.`);
        }
      });

      document.getElementById("pending-count").innerText = pendingOrders.length;
      document.getElementById("now-serving").innerText = nowServingNumber ? `#${nowServingNumber}` : "-";
      document.getElementById("user-queues").innerText = myOrders.length
        ? myOrders.map(o => `#${o.queueNumber}`).join(", ")
        : "-";

      const myQueuesList = document.getElementById("my-queues-list");
      myQueuesList.innerHTML = "";
      if (myOrders.length) {
        myOrders.forEach(order => {
          const div = document.createElement("div");
          div.className = "queue-item";
          div.innerHTML = `<span>#${order.queueNumber} (${order.status})</span><button class="cancel-btn">Cancel</button>`;
          div.querySelector(".cancel-btn").addEventListener("click", async () => {
            if (confirm(`Cancel queue #${order.queueNumber}?`)) {
              await updateDoc(doc(db, "orders", order.id), { 
                status: "cancelled", 
                cancelledAt: new Date() 
              });
              notifiedOrders.delete(order.id);
            }
          });
          myQueuesList.appendChild(div);
        });
      } else {
        myQueuesList.innerHTML = "<p>No active queues</p>";
      }
    });
  }

  async function createOrder(newQueueNumber, userEmail) {
    await addDoc(collection(db, "orders"), {
      queueNumber: newQueueNumber,
      user: { gmail: userEmail },
      status: "pending",
      createdAt: new Date()
    });
  }

  // --- Inquiry Button ---
  if (inquiryBtn && inquiryBox && closeInquiry) {
    inquiryBtn.addEventListener("click", () => {
      if (inquiryBox.style.display === "flex") {
        inquiryBox.style.opacity = 0;
        inquiryBox.style.transform = "translateY(-20px)";
        setTimeout(() => inquiryBox.style.display = "none", 200);
      } else {
        inquiryBox.style.display = "flex";
        setTimeout(() => {
          inquiryBox.style.opacity = 1;
          inquiryBox.style.transform = "translateY(0)";
        }, 20);
      }
      inquiryBtn.classList.remove("active");
      void inquiryBtn.offsetWidth;
      inquiryBtn.classList.add("active");
    });

    closeInquiry.addEventListener("click", () => {
      inquiryBox.style.opacity = 0;
      inquiryBox.style.transform = "translateY(-20px)";
      setTimeout(() => inquiryBox.style.display = "none", 200);
    });
  }

  // --- Contact Form ---
  if (humanOption && contactModal && closeContact && contactForm) {
    humanOption.addEventListener("click", () => {
      if (inquiryBox) inquiryBox.style.display = "none";
      contactModal.style.display = "block";
    });
    closeContact.addEventListener("click", () => contactModal.style.display = "none");
    window.addEventListener("click", (e) => { if (e.target === contactModal) contactModal.style.display = "none"; });
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("contactName").value;
      const email = document.getElementById("contactEmail").value;
      const message = document.getElementById("contactMessage").value;
      try {
        await addDoc(collection(db, "inquiries"), {
          name,
          email,
          message,
          timestamp: serverTimestamp()
        });
        alert("✅ Your inquiry has been sent to the admin!");
        contactForm.reset();
        contactModal.style.display = "none";
      } catch (error) {
        console.error("Error saving inquiry:", error);
        alert("❌ Failed to send. Please try again.");
      }
    });
  }
});
