import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFirestore, collection, onSnapshot, doc, updateDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

// --- Firebase Initialization ---
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

let currentInquiryId = null;

// --- Authentication ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        alert('Access denied. You are not an admin.');
        window.location.href = '../index.html';
    }
});

document.getElementById('logout').addEventListener('click', () => {
    signOut(auth).then(() => { window.location.href = '../index.html'; });
});

// --- DOM Elements ---
const inquiryList = document.getElementById('inquiry-list');
const noMessageSelected = document.getElementById('no-message-selected');
const messageContent = document.getElementById('message-content');
const messageSubject = document.getElementById('message-subject');
const messageSender = document.getElementById('message-sender');
const messageEmail = document.getElementById('message-email');
const messageStatus = document.getElementById('message-status');
const messageBody = document.getElementById('message-body');
const adminReplyContainer = document.getElementById('admin-reply-container');
const adminReplyBody = document.getElementById('admin-reply-body');
const replyFormContainer = document.getElementById('reply-form-container');
const replyForm = document.getElementById('reply-form');
const replyBody = document.getElementById('reply-body');

// --- Firestore Snapshot Listener ---
const inquiriesCollection = collection(db, 'inquiries');
onSnapshot(inquiriesCollection, (snapshot) => {
    const inquiries = [];
    snapshot.forEach(doc => inquiries.push({ id: doc.id, ...doc.data() }));

    inquiries.sort((a, b) => (a.read ? 1 : -1) - (b.read ? 1 : -1) || (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

    inquiryList.innerHTML = '';
    if (inquiries.length === 0) {
        inquiryList.innerHTML = '<p class="muted no-inquiries">No inquiries yet.</p>';
        return;
    }

    inquiries.forEach((inquiry) => {
        const inquiryElement = document.createElement('div');
        inquiryElement.className = `inquiry-item ${inquiry.read ? 'read' : ''} ${inquiry.status === 'replied' ? 'replied' : ''}`;
        inquiryElement.dataset.inquiryId = inquiry.id;
        
        inquiryElement.innerHTML = `
            <div class="inquiry-header">
                <h4>${inquiry.name || 'No Name'}</h4>
                <span class="status-indicator">${inquiry.status === 'replied' ? 'Replied' : 'Unread'}</span>
            </div>
            <p>${inquiry.subject || 'No Subject'}</p>
        `;

        inquiryElement.addEventListener('click', () => displayMessage(inquiry.id, inquiry));
        inquiryList.appendChild(inquiryElement);
    });
     // Re-apply active class after re-render
    if (currentInquiryId) {
        const activeItem = inquiryList.querySelector(`.inquiry-item[data-inquiry-id="${currentInquiryId}"]`);
        if (activeItem) activeItem.classList.add('active');
    }
});

// --- Display Message Logic ---
async function displayMessage(inquiryId, inquiry) {
    if (currentInquiryId === inquiryId) return;
    currentInquiryId = inquiryId;

    document.querySelectorAll('.inquiry-item').forEach(item => item.classList.remove('active'));
    inquiryList.querySelector(`.inquiry-item[data-inquiry-id="${inquiryId}"]`)?.classList.add('active');

    noMessageSelected.classList.add('hidden');
    messageContent.classList.remove('hidden');

    // Safely access properties
    messageSubject.textContent = inquiry.subject || 'No Subject';
    messageSender.textContent = inquiry.name || 'Anonymous';
    messageEmail.textContent = inquiry.email || 'No email provided';
    messageBody.textContent = inquiry.message || 'No message content.';
    messageStatus.textContent = inquiry.status === 'replied' ? 'Replied' : 'Pending Reply';

    if (inquiry.status === 'replied' && inquiry.reply) {
        adminReplyBody.textContent = inquiry.reply;
        adminReplyContainer.classList.remove('hidden');
        replyFormContainer.classList.add('hidden');
    } else {
        adminReplyContainer.classList.add('hidden');
        replyFormContainer.classList.remove('hidden');
        replyBody.value = '';
    }

    if (!inquiry.read) {
        await updateDoc(doc(db, 'inquiries', inquiryId), { read: true });
    }
}

// --- Reply Form Logic ---
replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentInquiryId) return alert('Please select a message.');

    const replyText = replyBody.value.trim();
    if (!replyText) return alert('Reply cannot be empty.');

    try {
        await updateDoc(doc(db, 'inquiries', currentInquiryId), {
            reply: replyText,
            status: 'replied',
            repliedAt: serverTimestamp()
        });
        alert('Reply sent successfully!');
    } catch (error) {
        console.error('Error sending reply:', error);
        alert('Failed to send reply.');
    }
});