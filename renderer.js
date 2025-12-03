const { ipcRenderer } = require('electron');

// State
let currentUser = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const fuelForm = document.getElementById('fuel-form');
const passForm = document.getElementById('pass-form');

// --- AUTH HANDLERS ---

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    const result = await ipcRenderer.invoke('auth:login', u, p);

    if (result.success) {
        currentUser = result.user;
        document.getElementById('login-error').classList.add('d-none');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        showDashboard();
    } else {
        document.getElementById('login-error').classList.remove('d-none');
        document.getElementById('login-error').textContent = 'Invalid credentials';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    loginSection.classList.remove('d-none');
    dashboardSection.classList.add('d-none');
});

// --- DASHBOARD LOGIC ---

async function showDashboard() {
    loginSection.classList.add('d-none');
    dashboardSection.classList.remove('d-none');

    document.getElementById('current-user-name').textContent = currentUser.fullname;

    // Setup Admin Links
    if (currentUser.role === 'admin') {
        // Ideally add create user modal logic here if expanded
        document.getElementById('admin-user-link').innerHTML =
            `<a href="#" class="nav-link text-white-50"><i class="fas fa-users-cog me-2"></i> Users (Admin)</a>`;
    } else {
        document.getElementById('admin-user-link').innerHTML = '';
    }

    // Pre-fill Date
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('f-date').value = now.toISOString().slice(0, 16);

    await loadDashboardData();
}

async function loadDashboardData() {
    const data = await ipcRenderer.invoke('data:getDashboard');

    // 1. Stats
    document.getElementById('stat-liters').textContent = data.stats.totalLiters;
    document.getElementById('stat-cost').textContent = new Intl.NumberFormat('vi-VN').format(data.stats.totalCost);
    document.getElementById('stat-top-vehicle').textContent = data.stats.topVehicle;

    // 2. Table
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = data.recentLogs.map(log => `
    <tr>
      <td>${log.date_time.replace('T', ' ')}</td>
      <td><span class="badge bg-navy">${log.plate_number}</span></td>
      <td>${log.driver_name}</td>
      <td>${log.odometer.toLocaleString()}</td>
      <td>${log.liters}</td>
      <td class="fw-bold text-success">${new Intl.NumberFormat('vi-VN').format(log.total_cost)}</td>
      <td><small class="text-muted">${log.created_by}</small></td>
    </tr>
  `).join('');

    // 3. Dropdowns for Modal
    const vSelect = document.getElementById('f-vehicle');
    vSelect.innerHTML = '<option value="">Select Vehicle...</option>' +
        data.vehicles.map(v => `<option value="${v.id}">${v.plate_number} (${v.model})</option>`).join('');

    const dSelect = document.getElementById('f-driver');
    dSelect.innerHTML = '<option value="">Select Driver...</option>' +
        data.drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
}

// --- FUEL ENTRY FORM ---

// Auto-calculate Total
function calcTotal() {
    const liters = parseFloat(document.getElementById('f-liters').value) || 0;
    const price = parseFloat(document.getElementById('f-price').value) || 0;
    document.getElementById('f-total').textContent = new Intl.NumberFormat('vi-VN').format(liters * price);
}
document.getElementById('f-liters').addEventListener('input', calcTotal);
document.getElementById('f-price').addEventListener('input', calcTotal);

fuelForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        vehicle_id: document.getElementById('f-vehicle').value,
        driver_id: document.getElementById('f-driver').value,
        date_time: document.getElementById('f-date').value,
        odometer: parseInt(document.getElementById('f-odo').value),
        liters: parseFloat(document.getElementById('f-liters').value),
        price: parseFloat(document.getElementById('f-price').value),
        created_by: currentUser.username
    };

    const res = await ipcRenderer.invoke('data:addFuel', payload);
    if (res.success) {
        // Close Modal
        const modalEl = document.getElementById('fuelModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();

        // Reset Form
        fuelForm.reset();
        document.getElementById('f-total').innerText = '0';

        // Reload Data
        await loadDashboardData();
        alert('Fuel record saved successfully!');
    } else {
        alert('Error: ' + res.error);
    }
});

// --- EXPORT CSV ---
document.getElementById('export-btn').addEventListener('click', async () => {
    const res = await ipcRenderer.invoke('data:exportCSV');
    if (res.success) {
        alert(`File exported to: ${res.path}`);
    } else if (res.message) {
        // Cancelled or empty
        if (res.message !== "Cancelled") alert(res.message);
    } else {
        alert("Export failed: " + res.error);
    }
});

// --- CHANGE PASSWORD ---
passForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-pass').value;
    const res = await ipcRenderer.invoke('user:changePass', { id: currentUser.id, newPass });

    if (res.success) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('changePassModal'));
        modal.hide();
        alert('Password updated!');
        passForm.reset();
    } else {
        alert('Error: ' + res.error);
    }
});
