document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('admin-token');

  if (!token) {
    document.body.innerHTML = '<h1>Please log in as an admin first.</h1>';
    return;
  }

  fetch('/api/admin/stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (response.status === 401 || response.status === 403) {
      document.body.innerHTML = '<h1>Access Denied. You are not authorized to view this page.</h1>';
      return;
    }
    return response.json();
  })
  .then(data => {
    if (data) {
      document.getElementById('total-users').textContent = data.totalUsers;
      document.getElementById('total-bets').textContent = data.totalBets;
      document.getElementById('total-transactions').textContent = data.totalTransactions;
    }
  })
  .catch(error => {
    console.error('Error fetching stats:', error);
    document.body.innerHTML = '<h1>Error loading data.</h1>';
  });
}); 