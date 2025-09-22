document.addEventListener('DOMContentLoaded', () => {
  const addItemBtn = document.getElementById('add-item-btn');
  const itemModal = document.getElementById('item-modal');
  const closeBtn = document.querySelector('.close-btn');
  const itemForm = document.getElementById('item-form');
  const modalTitle = document.getElementById('modal-title');
  const itemId = document.getElementById('item-id');
  const itemName = document.getElementById('item-name');
  const itemCategory = document.getElementById('item-category');
  const itemPrice = document.getElementById('item-price');
  const itemImg = document.getElementById('item-img');
  const stockInputs = document.getElementById('stock-inputs');
  const saveItemBtn = document.getElementById('save-item-btn');
  const inventoryList = document.getElementById('inventory-list');

  // Dummy data - replace with actual data from your backend
  let inventoryData = [
    {
      id: 1,
      name: 'Laptop',
      category: 'Electronics',
      price: 1200,
      img: 'https://via.placeholder.com/50',
      stock: { 'Main': 10, 'Warehouse': 25 },
      disabled: false
    },
    {
      id: 2,
      name: 'T-shirt',
      category: 'Apparel',
      price: 25,
      img: 'https://via.placeholder.com/50',
      stock: { 'Small': 50, 'Medium': 100, 'Large': 75 },
      disabled: false
    }
  ];

  // Render inventory table
  function renderInventory() {
    inventoryList.innerHTML = '';
    inventoryData.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${item.img}" alt="${item.name}"></td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td>${Object.entries(item.stock).map(([size, quantity]) => `${size}: ${quantity}`).join('<br>')}</td>
        <td>${item.disabled ? 'Disabled' : 'Enabled'}</td>
        <td class="actions">
          <button class="edit-btn" data-id="${item.id}">Edit</button>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
          <button class="disable-btn" data-id="${item.id}">${item.disabled ? 'Enable' : 'Disable'}</button>
        </td>
      `;
      inventoryList.appendChild(tr);
    });
  }

  // Open/close modal
  function openModal() {
    itemModal.style.display = 'block';
  }

  function closeModal() {
    itemModal.style.display = 'none';
    itemForm.reset();
    itemId.value = '';
    stockInputs.innerHTML = ''; // Clear dynamic stock inputs
  }

  addItemBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Add New Item';
    openModal();
  });

  closeBtn.addEventListener('click', closeModal);
  window.addEventListener('click', (e) => {
    if (e.target === itemModal) {
      closeModal();
    }
  });

  // Form submission (Add/Edit)
  itemForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = itemName.value;
    const category = itemCategory.value;
    const price = parseFloat(itemPrice.value);
    const img = itemImg.value;
    const id = itemId.value;

    // Collect stock data
    const stock = {};
    const stockSizeInputs = stockInputs.querySelectorAll('.stock-size');
    const stockQuantityInputs = stockInputs.querySelectorAll('.stock-quantity');
    stockSizeInputs.forEach((sizeInput, index) => {
        const quantityInput = stockQuantityInputs[index];
        if (sizeInput.value && quantityInput.value) {
            stock[sizeInput.value] = parseInt(quantityInput.value);
        }
    });


    if (id) { // Edit item
      const item = inventoryData.find(item => item.id == id);
      item.name = name;
      item.category = category;
      item.price = price;
      item.img = img;
      item.stock = stock;
    } else { // Add item
      const newItem = {
        id: Date.now(),
        name,
        category,
        price,
        img,
        stock,
        disabled: false
      };
      inventoryData.push(newItem);
    }

    renderInventory();
    closeModal();
  });

  // Actions (Edit, Delete, Disable)
  inventoryList.addEventListener('click', (e) => {
    const target = e.target;
    const id = target.dataset.id;

    if (target.classList.contains('edit-btn')) {
      const item = inventoryData.find(item => item.id == id);
      modalTitle.textContent = 'Edit Item';
      itemId.value = item.id;
      itemName.value = item.name;
      itemCategory.value = item.category;
      itemPrice.value = item.price;
      itemImg.value = item.img;

      // Populate stock inputs
      stockInputs.innerHTML = '';
      for (const [size, quantity] of Object.entries(item.stock)) {
          addStockInput(size, quantity);
      }
      addStockInput(); // Add an empty one for adding more

      openModal();
    } else if (target.classList.contains('delete-btn')) {
      if (confirm('Are you sure you want to delete this item?')) {
        inventoryData = inventoryData.filter(item => item.id != id);
        renderInventory();
      }
    } else if (target.classList.contains('disable-btn')) {
      const item = inventoryData.find(item => item.id == id);
      item.disabled = !item.disabled;
      renderInventory();
    }
  });

    // Dynamically add stock input fields
    function addStockInput(size = '', quantity = '') {
        const div = document.createElement('div');
        div.innerHTML = `
            <input type="text" class="stock-size" placeholder="Size/Type" value="${size}">
            <input type="number" class="stock-quantity" placeholder="Quantity" value="${quantity}">
        `;
        stockInputs.appendChild(div);
    }

  // Initial render
  renderInventory();
});
