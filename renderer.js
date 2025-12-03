const { ipcRenderer } = require('electron');

// --- TRẠNG THÁI TOÀN CỤC ---
let currentUser = null;
let vehiclesCache = [];
let driversCache = [];

// --- ĐIỀU HƯỚNG TAB ---
window.switchTab = (tabId) => {
    // Ẩn tất cả tab content
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    // Hiện tab được chọn
    document.getElementById(tabId).classList.remove('d-none');

    // Cập nhật active class cho menu
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Load dữ liệu tương ứng nếu cần
    if (tabId === 'tab-tongquan') loadDashboard();
    if (tabId === 'tab-capphat') prepareFormCapPhat();
    if (tabId === 'tab-hoso-xe') renderVehicles();
    if (tabId === 'tab-hoso-taixe') renderDrivers();
};

// --- AUTH ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    const res = await ipcRenderer.invoke('hethong:dangNhap', u, p);
    if (res.success) {
        currentUser = res.user;
        document.getElementById('login-section').classList.add('d-none');
        document.getElementById('dashboard-section').classList.remove('d-none');
        document.getElementById('current-user-name').textContent = currentUser.fullname;

        // Khởi động
        loadDataCache();
        loadDashboard();
    } else {
        document.getElementById('login-error').classList.remove('d-none');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    location.reload();
});

// --- LOAD DỮ LIỆU CHUNG ---
async function loadDataCache() {
    vehiclesCache = await ipcRenderer.invoke('xe:layDanhSach');
    driversCache = await ipcRenderer.invoke('taixe:layDanhSach');
}

// --- TAB 1: DASHBOARD ---
async function loadDashboard() {
    const res = await ipcRenderer.invoke('nghiepvu:layDashboard');

    // Fill Stats
    document.getElementById('tk-lit').innerText = res.thongKe.tongLit;
    document.getElementById('tk-tien').innerText = new Intl.NumberFormat('vi-VN').format(res.thongKe.tongTien);
    document.getElementById('tk-xe').innerText = res.thongKe.xeHoatDong;

    // Fill Table
    const tbody = document.getElementById('table-logs');
    tbody.innerHTML = res.nhatKy.map(log => `
        <tr>
            <td>${log.ngay_gio.replace('T', ' ')}</td>
            <td><span class="badge bg-danger">${log.bien_so}</span></td>
            <td>${log.ten_tai_xe}</td>
            <td>${log.odo_cu}</td>
            <td class="fw-bold">${log.odo_moi}</td>
            <td class="text-primary">+${log.quang_duong}</td>
            <td>${log.so_lit}</td>
            <td class="fw-bold text-success">${new Intl.NumberFormat('vi-VN').format(log.thanh_tien)}</td>
        </tr>
    `).join('');
}

// --- TAB 2: CẤP PHÁT (LOGIC NGHIỆP VỤ) ---
async function prepareFormCapPhat() {
    await loadDataCache(); // Refresh data mới nhất

    // Set ngày giờ hiện tại
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('cp-ngay').value = now.toISOString().slice(0, 16);

    // Render Dropdowns
    const xeSelect = document.getElementById('cp-xe');
    xeSelect.innerHTML = '<option value="">-- Chọn Phương Tiện --</option>' +
        vehiclesCache.map(v => `<option value="${v.id}" data-odo="${v.odo_hien_tai}" data-nl="${v.loai_nhien_lieu}">${v.bien_so} - ${v.nhan_hieu}</option>`).join('');

    const txSelect = document.getElementById('cp-taixe');
    txSelect.innerHTML = '<option value="">-- Chọn Người Lái --</option>' +
        driversCache.map(d => `<option value="${d.id}">${d.ho_ten} (${d.cap_bac})</option>`).join('');
}

// Sự kiện khi chọn Xe -> Auto fill ODO cũ & Loại nhiên liệu
document.getElementById('cp-xe').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt.value) {
        const odo = opt.getAttribute('data-odo');
        const nl = opt.getAttribute('data-nl');

        document.getElementById('cp-odo-cu').value = odo;
        document.getElementById('cp-loai-nl').innerText = nl;
        document.getElementById('cp-info-xe').innerText = `Xe chạy ${nl}, ODO hiện tại: ${odo} km`;
    } else {
        document.getElementById('cp-odo-cu').value = '';
        document.getElementById('cp-loai-nl').innerText = 'NL';
        document.getElementById('cp-info-xe').innerText = '';
    }
});

// Sự kiện tính toán quãng đường và thành tiền
const updateCalc = () => {
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;
    const odoMoi = parseInt(document.getElementById('cp-odo-moi').value) || 0;
    const lit = parseFloat(document.getElementById('cp-lit').value) || 0;
    const gia = parseFloat(document.getElementById('cp-gia').value) || 0;

    const km = odoMoi - odoCu;
    const tien = lit * gia;

    // Cập nhật giao diện
    const alertBox = document.getElementById('cp-km-alert');
    if (km > 0) {
        alertBox.innerHTML = `<i class="fas fa-check-circle text-success"></i> Quãng đường: <strong>${km} km</strong>`;
        alertBox.className = "alert alert-success py-2 mb-0";
    } else if (odoMoi > 0 && km <= 0) {
        alertBox.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Lỗi: ODO Mới phải > ODO Cũ`;
        alertBox.className = "alert alert-danger py-2 mb-0";
    } else {
        alertBox.innerHTML = `<i class="fas fa-calculator"></i> Nhập ODO để tính quãng đường`;
        alertBox.className = "alert alert-info py-2 mb-0";
    }

    document.getElementById('cp-thanhtien').value = new Intl.NumberFormat('vi-VN').format(tien);
};
document.getElementById('cp-odo-moi').addEventListener('input', updateCalc);
document.getElementById('cp-lit').addEventListener('input', updateCalc);
document.getElementById('cp-gia').addEventListener('input', updateCalc);

// Submit Cấp Phát
document.getElementById('form-capphat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        xe_id: document.getElementById('cp-xe').value,
        tai_xe_id: document.getElementById('cp-taixe').value,
        ngay_gio: document.getElementById('cp-ngay').value,
        odo_moi: parseInt(document.getElementById('cp-odo-moi').value),
        so_lit: parseFloat(document.getElementById('cp-lit').value),
        don_gia: parseFloat(document.getElementById('cp-gia').value),
        nguoi_tao: currentUser.username
    };

    const res = await ipcRenderer.invoke('nghiepvu:capPhat', payload);
    if (res.success) {
        alert("Đã lưu phiếu cấp phát thành công!");
        document.getElementById('form-capphat').reset();
        document.getElementById('cp-odo-cu').value = "";
        document.getElementById('cp-km-alert').className = "alert alert-info py-2 mb-0";
        document.getElementById('cp-km-alert').innerHTML = "Chờ nhập liệu...";
        // Reload data
        loadDataCache();
    } else {
        alert("Lỗi: " + res.error);
    }
});

// --- TAB 3: HỒ SƠ XE ---
function renderVehicles() {
    loadDataCache().then(() => {
        const tbody = document.getElementById('table-xe');
        tbody.innerHTML = vehiclesCache.map(v => `
            <tr>
                <td class="fw-bold text-danger">${v.bien_so}</td>
                <td>${v.nhan_hieu}</td>
                <td><span class="badge ${v.loai_nhien_lieu === 'Dầu' ? 'bg-dark' : 'bg-success'}">${v.loai_nhien_lieu}</span></td>
                <td>${v.dinh_muc} L/100km</td>
                <td>${v.odo_hien_tai.toLocaleString()} km</td>
                <td><span class="badge bg-secondary">${v.trang_thai}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editXe(${v.id})"><i class="fas fa-edit"></i></button>
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
    const v = vehiclesCache.find(x => x.id === id);
    if (!v) return;

    document.getElementById('xe-id').value = v.id;
    document.getElementById('xe-bienso').value = v.bien_so;
    document.getElementById('xe-hieu').value = v.nhan_hieu;
    document.getElementById('xe-loainl').value = v.loai_nhien_lieu;
    document.getElementById('xe-dinhmuc').value = v.dinh_muc;
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
        odo_hien_tai: parseInt(document.getElementById('xe-odo').value),
        trang_thai: document.getElementById('xe-trangthai').value
    };

    const action = id ? 'xe:sua' : 'xe:them';
    if (id) data.id = id;

    const res = await ipcRenderer.invoke(action, data);
    if (res.success) {
        bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
        renderVehicles();
    } else {
        alert(res.error);
    }
});

window.xoaXeCurrent = async () => {
    if (!confirm("Bạn có chắc muốn xóa xe này? Dữ liệu không thể phục hồi.")) return;
    const id = document.getElementById('xe-id').value;
    await ipcRenderer.invoke('xe:xoa', id);
    bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
    renderVehicles();
};

// --- TAB 4: HỒ SƠ TÀI XẾ ---
function renderDrivers() {
    loadDataCache().then(() => {
        const container = document.getElementById('grid-taixe');
        container.innerHTML = driversCache.map(d => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 shadow-sm border-0">
                    <div class="card-body d-flex align-items-center">
                        <img src="${d.anh_dai_dien || 'https://via.placeholder.com/80'}" class="rounded-circle me-3 border" style="width: 80px; height: 80px; object-fit: cover;">
                        <div>
                            <h5 class="card-title fw-bold text-military mb-1">${d.ho_ten}</h5>
                            <div class="text-muted small mb-1">${d.cap_bac} - ${d.chuc_vu}</div>
                            <div class="badge bg-secondary">${d.don_vi || 'Chưa cập nhật'}</div>
                        </div>
                    </div>
                    <div class="card-footer bg-white border-top-0 text-end">
                        <button class="btn btn-sm btn-outline-info" onclick="viewHistory(${d.id})"><i class="fas fa-history"></i> Lịch sử</button>
                        <button class="btn btn-sm btn-outline-primary" onclick="editTaiXe(${d.id})"><i class="fas fa-edit"></i> Sửa</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

window.openModalTaiXe = () => {
    document.getElementById('form-taixe').reset();
    document.getElementById('tx-id').value = '';
    document.getElementById('tx-preview-img').src = 'https://via.placeholder.com/150';
    document.getElementById('btn-xoa-tx').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('modalTaiXe')).show();
};

window.editTaiXe = (id) => {
    const d = driversCache.find(x => x.id === id);
    if (!d) return;

    document.getElementById('tx-id').value = d.id;
    document.getElementById('tx-ten').value = d.ho_ten;
    document.getElementById('tx-sohieu').value = d.so_hieu_quan_nhan;
    document.getElementById('tx-capbac').value = d.cap_bac;
    document.getElementById('tx-chucvu').value = d.chuc_vu;
    document.getElementById('tx-donvi').value = d.don_vi;
    document.getElementById('tx-ngaysinh').value = d.ngay_sinh;
    document.getElementById('tx-quequan').value = d.que_quan;
    document.getElementById('tx-anh-path').value = d.anh_dai_dien || '';
    document.getElementById('tx-preview-img').src = d.anh_dai_dien || 'https://via.placeholder.com/150';

    document.getElementById('btn-xoa-tx').classList.remove('d-none');
    new bootstrap.Modal(document.getElementById('modalTaiXe')).show();
};

window.chonAnhTaiXe = async () => {
    const path = await ipcRenderer.invoke('taixe:chonAnh');
    if (path) {
        document.getElementById('tx-anh-path').value = path;
        document.getElementById('tx-preview-img').src = path;
    }
};

document.getElementById('form-taixe').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const data = {
        ho_ten: document.getElementById('tx-ten').value,
        so_hieu_quan_nhan: document.getElementById('tx-sohieu').value,
        cap_bac: document.getElementById('tx-capbac').value,
        chuc_vu: document.getElementById('tx-chucvu').value,
        don_vi: document.getElementById('tx-donvi').value,
        ngay_sinh: document.getElementById('tx-ngaysinh').value,
        que_quan: document.getElementById('tx-quequan').value,
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

window.xoaTaiXeCurrent = async () => {
    if (!confirm("Xóa hồ sơ này?")) return;
    const id = document.getElementById('tx-id').value;
    await ipcRenderer.invoke('taixe:xoa', id);
    bootstrap.Modal.getInstance(document.getElementById('modalTaiXe')).hide();
    renderDrivers();
};

window.viewHistory = async (id) => {
    const logs = await ipcRenderer.invoke('taixe:lichSu', id);
    const tbody = document.getElementById('table-lichsu-tx');
    tbody.innerHTML = logs.length ? logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td>${l.bien_so}</td>
            <td>${l.quang_duong} km</td>
            <td>${l.so_lit} L</td>
        </tr>
    `).join('') : '<tr><td colspan="4" class="text-center">Chưa có chuyến đi nào</td></tr>';

    new bootstrap.Modal(document.getElementById('modalLichSu')).show();
};