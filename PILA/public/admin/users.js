document.addEventListener('DOMContentLoaded', () => {
    const userModal = document.getElementById('user-modal');
    const addUserBtn = document.getElementById('add-user-btn');
    const closeBtn = document.querySelector('.close-btn');
    const userForm = document.getElementById('user-form');
    const userList = document.getElementById('user-list');

    // Show the modal
    addUserBtn.addEventListener('click', () => {
        userModal.style.display = 'block';
        document.getElementById('modal-title').textContent = 'Add New User';
        userForm.reset();
    });

    // Hide the modal
    closeBtn.addEventListener('click', () => {
        userModal.style.display = 'none';
    });

    // Hide modal on outside click
    window.addEventListener('click', (event) => {
        if (event.target == userModal) {
            userModal.style.display = 'none';
        }
    });

    // Handle form submission
    userForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const userName = document.getElementById('user-name').value;
        const userEmail = document.getElementById('user-email').value;
        const userRole = document.getElementById('user-role').value;
        const userId = document.getElementById('user-id').value;

        if (userId) {
            // Update existing user
        } else {
            // Add new user
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userName}</td>
                <td>${userEmail}</td>
                <td>${userRole}</td>
                <td><button>Edit</button> <button>Delete</button></td>
            `;
            userList.appendChild(row);
        }

        userModal.style.display = 'none';
    });
});
