document.addEventListener('DOMContentLoaded', function () {
  const table = document.getElementById('ordersTable');

  table.addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
      const row = e.target.closest('tr');
      const product = row.querySelector('.product-name').textContent;
      if (confirm(`Are you sure you want to delete the order for ${product}?`)) {
        row.remove();
      }
    }
  });

  table.addEventListener('change', function (e) {
    if (e.target.classList.contains('status-select')) {
      const row = e.target.closest('tr');
      const product = row.querySelector('.product-name').textContent;
      alert(`Order for ${product} is now marked as: ${e.target.value}`);
    }
  });
});
