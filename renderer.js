
const { ipcRenderer } = require('electron');

// --- GLOBAL STATE ---
let currentUser = null;
let vehicleCache = [];
let driverCache = [];

// --- NAVIGATION ---
window.switchTab = (tabId) => {
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    document.getElementById(tabId).classList.remove('d-none');

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Load data on switch
    if (tabId === 'tab-tongquan') loadDashboard();
    if (tabId === 'tab-capphat') setupCapPhatForm();
    if (tabId === 'tab-hoso-xe') renderVehicles();
    if (tabId === 'tab-hoso-taixe') renderDrivers();
};

// --- AUTHENTICATION ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const res = await ipcRenderer.invoke('hethong:dangNhap', u, p);

    if (res.success) {
        currentUser = res.user;
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('dashboard-section').classList.remove('d-none');
        document.getElementById('current-user-name').innerText = currentUser.fullname;

        loadAllData();
        loadDashboard();
    } else {
        document.getElementById('login-error').classList.remove('d-none');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => location.reload());

// --- DATA LOADING ---
async function loadAllData() {
    vehicleCache = await ipcRenderer.invoke('xe:layDanhSach');
    driverCache = await ipcRenderer.invoke('taixe:layDanhSach');
}

// --- MODULE: DASHBOARD ---
async function loadDashboard() {
    const data = await ipcRenderer.invoke('nghiepvu:layDashboard');
    const { thongKe, nhatKy } = data;

    document.getElementById('tk-lit').innerText = thongKe.tongLit;
    document.getElementById('tk-tien').innerText = new Intl.NumberFormat('vi-VN').format(thongKe.tongTien);
    document.getElementById('tk-xe').innerText = thongKe.xeHoatDong;
    document.getElementById('tk-km').innerText = new Intl.NumberFormat('vi-VN').format(thongKe.tongKm);

    const tbody = document.getElementById('table-logs');
    tbody.innerHTML = nhatKy.map(log => `
        <tr>
            <td>${log.ngay_gio.replace('T', ' ')}</td>
            <td class="fw-bold text-danger">${log.bien_so}</td>
            <td>${log.ten_tai_xe}</td>
            <td>${log.odo_cu}</td>
            <td>${log.odo_moi}</td>
            <td class="text-primary fw-bold">+${log.quang_duong}</td>
            <td>${log.so_lit}</td>
            <td>${new Intl.NumberFormat('vi-VN').format(log.thanh_tien)}</td>
        </tr>
    `).join('');
}

// --- MODULE: CẤP PHÁT (OPERATIONS) ---
async function setupCapPhatForm() {
    await loadAllData();

    // Set Time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('cp-ngay').value = now.toISOString().slice(0, 16);

    // Populate Selects
    const xeSelect = document.getElementById('cp-xe');
    xeSelect.innerHTML = `<option value="">-- Chọn Phương Tiện --</option>` +
        vehicleCache.map(v => `<option value="${v.id}" data-odo="${v.odo_hien_tai}" data-nl="${v.loai_nhien_lieu}" data-dm="${v.dinh_muc}">${v.bien_so} - ${v.nhan_hieu}</option>`).join('');

    const txSelect = document.getElementById('cp-taixe');
    txSelect.innerHTML = `<option value="">-- Chọn Tài Xế --</option>` +
        driverCache.map(d => `<option value="${d.id}">${d.ho_ten} (${d.cap_bac})</option>`).join('');
}

// Auto-fill logic
document.getElementById('cp-xe').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const infoDiv = document.getElementById('cp-info-xe');

    if (opt.value) {
        const odo = opt.getAttribute('data-odo');
        const nl = opt.getAttribute('data-nl');
        const dm = opt.getAttribute('data-dm');

        document.getElementById('cp-odo-cu').value = odo;
        infoDiv.innerHTML = `<i class="fas fa-info-circle"></i> Loại: ${nl} | Định mức: ${dm}L/100km`;
    } else {
        document.getElementById('cp-odo-cu').value = '';
        infoDiv.innerHTML = '';
    }
    updateCalc();
});

function updateCalc() {
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;
    const odoMoi = parseInt(document.getElementById('cp-odo-moi').value) || 0;
    const lit = parseFloat(document.getElementById('cp-lit').value) || 0;
    const gia = parseFloat(document.getElementById('cp-gia').value) || 0;

    const km = odoMoi - odoCu;
    const tien = lit * gia;

    const kmText = document.getElementById('cp-km-text');
    if (km > 0) {
        kmText.innerText = `${km} km`;
        kmText.className = "text-success fw-bold";
    } else {
        kmText.innerText = km < 0 ? "Lỗi: ODO Mới < Cũ" : "0 km";
        kmText.className = km < 0 ? "text-danger fw-bold" : "text-muted";
    }

    document.getElementById('cp-thanhtien').value = new Intl.NumberFormat('vi-VN').format(tien);
}

['cp-odo-moi', 'cp-lit', 'cp-gia'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCalc);
});

document.getElementById('form-capphat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        xe_id: document.getElementById('cp-xe').value,
        tai_xe_id: document.getElementById('cp-taixe').value,
        ngay_gio: document.getElementById('cp-ngay').value,
        odo_moi: parseInt(document.getElementById('cp-odo-moi').value),
        so_lit: parseFloat(document.getElementById('cp-lit').value),
        don_gia: parseFloat(document.getElementById('cp-gia').value),
        nguoi_tao: currentUser.username
    };

    const res = await ipcRenderer.invoke('nghiepvu:capPhat', data);
    if (res.success) {
        alert("Đã lưu lệnh cấp phát thành công!");
        document.getElementById('form-capphat').reset();
        document.getElementById('cp-odo-cu').value = "";
        document.getElementById('cp-km-text').innerText = "0 km";
        loadAllData();
    } else {
        alert(res.error);
    }
});

// --- MODULE: HỒ SƠ XE ---
function renderVehicles() {
    loadAllData().then(() => {
        const tbody = document.getElementById('table-xe');
        tbody.innerHTML = vehicleCache.map(v => `
            <tr>
                <td class="fw-bold text-danger">${v.bien_so}</td>
                <td>${v.nhan_hieu}</td>
                <td><span class="badge ${v.loai_nhien_lieu === 'Dầu' ? 'bg-dark' : 'bg-success'}">${v.loai_nhien_lieu}</span></td>
                <td>${v.dinh_muc}</td>
                <td>
                    <span class="badge ${v.trang_thai === 'Sẵn sàng' ? 'bg-primary' : 'bg-warning text-dark'}">${v.trang_thai}</span>
                </td>
                <td class="fw-bold">${v.odo_hien_tai.toLocaleString()} km</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewHistoryXe(${v.id}, '${v.bien_so}')" title="Lịch sử"><i class="fas fa-history"></i></button>
                    <button class="btn btn-sm btn-outline-primary" onclick="editXe(${v.id})" title="Sửa"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `).join('');
    });
}

window.openModalXe = () => {
    document.getElementById('form-xe').reset();
    document.getElementById('xe-id').value = '';
    document.getElementById('btn-xoa-xe').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('modalXe')).show();
};

window.editXe = (id) => {
    const v = vehicleCache.find(x => x.id === id);
    if (!v) return;

    document.getElementById('xe-id').value = v.id;
    document.getElementById('xe-bienso').value = v.bien_so;
    document.getElementById('xe-hieu').value = v.nhan_hieu;
    document.getElementById('xe-loainl').value = v.loai_nhien_lieu;
    document.getElementById('xe-dinhmuc').value = v.dinh_muc;
    document.getElementById('xe-namsx').value = v.nam_san_xuat;
    document.getElementById('xe-sokhung').value = v.so_khung;
    document.getElementById('xe-somay').value = v.so_may;
    document.getElementById('xe-odo').value = v.odo_hien_tai;
    document.getElementById('xe-trangthai').value = v.trang_thai;

    document.getElementById('btn-xoa-xe').classList.remove('d-none');
    new bootstrap.Modal(document.getElementById('modalXe')).show();
};

document.getElementById('form-xe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('xe-id').value;
    const data = {
        bien_so: document.getElementById('xe-bienso').value,
        nhan_hieu: document.getElementById('xe-hieu').value,
        loai_nhien_lieu: document.getElementById('xe-loainl').value,
        dinh_muc: parseFloat(document.getElementById('xe-dinhmuc').value),
        nam_san_xuat: document.getElementById('xe-namsx').value,
        so_khung: document.getElementById('xe-sokhung').value,
        so_may: document.getElementById('xe-somay').value,
        odo_hien_tai: parseInt(document.getElementById('xe-odo').value),
        trang_thai: document.getElementById('xe-trangthai').value
    };

    const action = id ? 'xe:sua' : 'xe:them';
    if (id) data.id = id;

    const res = await ipcRenderer.invoke(action, data);
    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
        renderVehicles();
    } else { alert(res.error); }
});

window.xoaXe = async () => {
    if (confirm('Cảnh báo: Xóa xe sẽ mất toàn bộ lịch sử! Tiếp tục?')) {
        await ipcRenderer.invoke('xe:xoa', document.getElementById('xe-id').value);
        bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
        renderVehicles();
    }
};

window.viewHistoryXe = async (id, bienso) => {
    const logs = await ipcRenderer.invoke('xe:lichSu', id);
    const tbody = document.getElementById('table-history-content');
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td>${l.lai_xe}</td>
            <td>+${l.quang_duong} km</td>
            <td>${l.so_lit} L</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};

// --- MODULE: HỒ SƠ TÀI XẾ ---
function renderDrivers() {
    loadAllData().then(() => {
        const container = document.getElementById('grid-taixe');
        container.innerHTML = driverCache.map(d => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-sm border-0 driver-card">
                    <div class="card-body">
                        <div class="d-flex">
                            <img src="${d.anh_dai_dien || 'assets/avatar-placeholder.png'}" class="rounded border me-3" style="width: 90px; height: 110px; object-fit: cover;">
                            <div class="flex-grow-1">
                                <h6 class="fw-bold text-military text-uppercase mb-1">${d.ho_ten}</h6>
                                <div class="small text-danger fw-bold mb-1">${d.cap_bac}</div>
                                <div class="small text-muted mb-1"><i class="fas fa-id-badge me-1"></i> ${d.so_hieu_quan_nhan || '---'}</div>
                                <div class="small text-muted"><i class="fas fa-briefcase me-1"></i> ${d.chuc_vu}</div>
                            </div>
                        </div>
                        <div class="mt-3 pt-2 border-top small">
                            <div><span class="fw-bold">Đơn vị:</span> ${d.don_vi || '---'}</div>
                        </div>
                    </div>
                    <div class="card-footer bg-white d-flex justify-content-end gap-2 border-top-0 pb-3">
                        <button class="btn btn-sm btn-outline-info" onclick="viewHistoryTaiXe(${d.id})">Lịch sử</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="editTaiXe(${d.id})">Chi tiết</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

window.openModalTaiXe = () => {
    document.getElementById('form-taixe').reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-preview').src = 'assets/avatar-placeholder.png';
    document.getElementById('btn-xoa-tx').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('modalTaiXe')).show();
};

window.editTaiXe = (id) => {
    const d = driverCache.find(x => x.id === id);
    if (!d) return;

    // Fill data
    document.getElementById('tx-id').value = d.id;
    document.getElementById('tx-ten').value = d.ho_ten;
    document.getElementById('tx-ngaysinh').value = d.ngay_sinh;
    document.getElementById('tx-quequan').value = d.que_quan;
    document.getElementById('tx-truquan').value = d.tru_quan;
    document.getElementById('tx-sohieu').value = d.so_hieu_quan_nhan;
    document.getElementById('tx-capbac').value = d.cap_bac;
    document.getElementById('tx-chucvu').value = d.chuc_vu;
    document.getElementById('tx-donvi').value = d.don_vi;
    document.getElementById('tx-anh-path').value = d.anh_dai_dien || '';
    document.getElementById('tx-preview').src = d.anh_dai_dien || 'assets/avatar-placeholder.png';

    document.getElementById('btn-xoa-tx').classList.remove('d-none');
    new bootstrap.Modal(document.getElementById('modalTaiXe')).show();
};

window.chonAnh = async () => {
    const path = await ipcRenderer.invoke('taixe:chonAnh');
    if (path) {
        document.getElementById('tx-anh-path').value = path;
        document.getElementById('tx-preview').src = path;
    }
};

document.getElementById('form-taixe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const data = {
        ho_ten: document.getElementById('tx-ten').value,
        ngay_sinh: document.getElementById('tx-ngaysinh').value,
        que_quan: document.getElementById('tx-quequan').value,
        tru_quan: document.getElementById('tx-truquan').value,
        so_hieu_quan_nhan: document.getElementById('tx-sohieu').value,
        cap_bac: document.getElementById('tx-capbac').value,
        chuc_vu: document.getElementById('tx-chucvu').value,
        don_vi: document.getElementById('tx-donvi').value,
        anh_dai_dien: document.getElementById('tx-anh-path').value
    };

    const action = id ? 'taixe:sua' : 'taixe:them';
    if (id) data.id = id;

    const res = await ipcRenderer.invoke(action, data);
    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalTaiXe')).hide();
        renderDrivers();
    }
});

window.xoaTaiXe = async () => {
    if (confirm('Xóa hồ sơ này?')) {
        await ipcRenderer.invoke('taixe:xoa', document.getElementById('tx-id').value);
        bootstrap.Modal.getInstance(document.getElementById('modalTaiXe')).hide();
        renderDrivers();
    }
};

window.viewHistoryTaiXe = async (id) => {
    const logs = await ipcRenderer.invoke('taixe:lichSu', id);
    const tbody = document.getElementById('table-history-content');
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td>Xe: ${l.bien_so}</td>
            <td>${l.quang_duong} km</td>
            <td>${l.so_lit} L</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};
