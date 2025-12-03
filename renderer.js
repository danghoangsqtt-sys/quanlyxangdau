
const { ipcRenderer } = require('electron');

// GLOBAL STATE
let currentUser = null;
let vehicleCache = [];
let driverCache = [];
let fuelTypesCache = [];

// --- NAVIGATION ---
window.switchTab = (tabId) => {
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    document.getElementById(tabId).classList.remove('d-none');

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    // Highlight current nav
    const activeNav = Array.from(document.querySelectorAll('.nav-link')).find(el => el.getAttribute('onclick').includes(tabId));
    if (activeNav) activeNav.classList.add('active');

    if (tabId === 'tab-tongquan') loadDashboard();
    if (tabId === 'tab-capphat') setupCapPhatForm();
    if (tabId === 'tab-hoso-xe') renderVehicles();
    if (tabId === 'tab-hoso-taixe') renderDrivers();
    if (tabId === 'tab-danhmuc') renderFuelTypes();
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
    fuelTypesCache = await ipcRenderer.invoke('nhienlieu:layDanhSach');
}

// --- MODULE: DASHBOARD ---
async function loadDashboard() {
    const data = await ipcRenderer.invoke('nghiepvu:layDashboard');
    const { thongKe, nhatKy } = data;

    document.getElementById('tk-lit').innerText = thongKe.tongLuong;
    document.getElementById('tk-tien').innerText = new Intl.NumberFormat('vi-VN').format(thongKe.tongTien);
    document.getElementById('tk-xe').innerText = thongKe.xeHoatDong;
    document.getElementById('tk-km').innerText = new Intl.NumberFormat('vi-VN').format(thongKe.tongKm);

    const tbody = document.getElementById('table-logs');
    tbody.innerHTML = nhatKy.map(log => `
        <tr>
            <td>${log.ngay_gio.replace('T', ' ').slice(0, 16)}</td>
            <td>
                ${log.nguon_cap === 'KHO' ? '<span class="badge bg-success">KHO</span>' : '<span class="badge bg-danger">MUA NGOÀI</span>'}
            </td>
            <td class="fw-bold">${log.bien_so}</td>
            <td>
                <div class="small fw-bold">${log.cap_bac}</div>
                <div class="small text-muted">${log.ten_tai_xe}</div>
            </td>
            <td>
                <div class="small">${log.ten_loai || '-'}</div>
                <div class="small text-muted fst-italic">${log.muc_dich === 'MAY_PHAT' ? 'Chạy máy phát' : 'Vận tải'}</div>
            </td>
            <td class="text-primary fw-bold">${log.so_luong} ${log.don_vi}</td>
            <td class="fw-bold text-dark">${new Intl.NumberFormat('vi-VN').format(log.thanh_tien)}</td>
        </tr>
    `).join('');
}

// --- MODULE: DANH MỤC (V3.0) ---
function renderFuelTypes() {
    ipcRenderer.invoke('nhienlieu:layDanhSach').then(list => {
        fuelTypesCache = list;
        document.getElementById('table-nhienlieu').innerHTML = list.map(f => `
            <tr>
                <td class="fw-bold text-military">${f.ten_loai}</td>
                <td><span class="badge bg-light text-dark border">${f.don_vi}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="xoaNhienLieu(${f.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    });
}

document.getElementById('form-nhienlieu').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        ten_loai: document.getElementById('nl-ten').value,
        don_vi: document.getElementById('nl-donvi').value,
        ghi_chu: ''
    };
    await ipcRenderer.invoke('nhienlieu:them', data);
    document.getElementById('nl-ten').value = '';
    renderFuelTypes();
});

window.xoaNhienLieu = async (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa danh mục này?')) {
        await ipcRenderer.invoke('nhienlieu:xoa', id);
        renderFuelTypes();
    }
};

// --- MODULE: CẤP PHÁT (FORM LOGIC V3) ---
async function setupCapPhatForm() {
    await loadAllData();

    // Default Time
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('cp-ngay').value = now.toISOString().slice(0, 16);

    // Populate Vehicles
    const xeSelect = document.getElementById('cp-xe');
    xeSelect.innerHTML = `<option value="">-- Chọn Phương Tiện / Máy Móc --</option>` +
        vehicleCache.map(v => `<option value="${v.id}" data-type="${v.loai_phuong_tien}" data-odo="${v.odo_hien_tai}" data-nl="${v.loai_nhien_lieu_mac_dinh}" data-dm="${v.dinh_muc}">
            [${v.loai_phuong_tien === 'MAY_PHAT' ? 'MÁY' : 'XE'}] ${v.bien_so} - ${v.nhan_hieu}
        </option>`).join('');

    // Populate Drivers
    const txSelect = document.getElementById('cp-taixe');
    txSelect.innerHTML = `<option value="">-- Chọn Người Nhận --</option>` +
        driverCache.map(d => `<option value="${d.id}">${d.cap_bac} ${d.ho_ten}</option>`).join('');

    // Populate Fuel List
    updateFuelDropdown('cp-loainl');
}

function updateFuelDropdown(elementId) {
    const select = document.getElementById(elementId);
    select.innerHTML = `<option value="">-- Chọn Loại Nhiên Liệu --</option>` +
        fuelTypesCache.map(f => `<option value="${f.id}" data-unit="${f.don_vi}">${f.ten_loai}</option>`).join('');
}

// Logic: Chọn Xe -> Tự điền NL mặc định -> Ẩn/Hiện ODO
document.getElementById('cp-xe').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const infoDiv = document.getElementById('cp-info-xe');
    const odoSection = document.getElementById('section-odo');

    if (opt.value) {
        const type = opt.getAttribute('data-type');
        const odo = opt.getAttribute('data-odo');
        const defNL = opt.getAttribute('data-nl');

        // 1. Fill ODO
        document.getElementById('cp-odo-cu').value = odo;

        // 2. Hide/Show Logic
        if (type === 'MAY_PHAT') {
            odoSection.classList.add('d-none');
            document.getElementById('pur_mayphat').checked = true;
            infoDiv.innerHTML = `<span class="badge bg-dark">MÁY PHÁT ĐIỆN</span>`;
        } else {
            odoSection.classList.remove('d-none');
            document.getElementById('pur_congtac').checked = true;
            infoDiv.innerHTML = `<span class="badge bg-primary">XE Ô TÔ</span> Định mức: <b>${opt.getAttribute('data-dm')}</b>`;
        }

        // 3. Auto-select Fuel
        if (defNL) {
            const fuelType = fuelTypesCache.find(f => f.ten_loai === defNL);
            if (fuelType) document.getElementById('cp-loainl').value = fuelType.id;
            updateUnitDisplay();
        }
    } else {
        document.getElementById('cp-odo-cu').value = '';
        infoDiv.innerHTML = '';
        odoSection.classList.remove('d-none');
    }
    updateCalc();
});

document.getElementById('cp-loainl').addEventListener('change', updateUnitDisplay);

function updateUnitDisplay() {
    const opt = document.getElementById('cp-loainl').selectedOptions[0];
    const txt = opt && opt.value ? opt.getAttribute('data-unit') : '---';
    document.getElementById('cp-info-unit').innerText = txt;
}

function updateCalc() {
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;
    const odoMoi = parseInt(document.getElementById('cp-odo-moi').value) || 0;
    const soLuong = parseFloat(document.getElementById('cp-lit').value) || 0;
    const gia = parseFloat(document.getElementById('cp-gia').value) || 0;

    const isOdoVisible = !document.getElementById('section-odo').classList.contains('d-none');

    if (isOdoVisible) {
        const km = odoMoi - odoCu;
        const kmText = document.getElementById('cp-km-text');
        if (km > 0) {
            kmText.innerText = `${km} Km`;
            kmText.className = "h4 text-success fw-bold mb-0";
        } else {
            kmText.innerText = km < 0 ? "Lỗi ODO!" : "0 Km";
            kmText.className = km < 0 ? "h4 text-danger fw-bold mb-0" : "h4 text-muted fw-bold mb-0";
        }
    }

    const tien = soLuong * gia;
    document.getElementById('cp-thanhtien').value = new Intl.NumberFormat('vi-VN').format(tien) + ' VNĐ';
}

['cp-odo-moi', 'cp-lit', 'cp-gia'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCalc);
});

document.getElementById('form-capphat').addEventListener('submit', async (e) => {
    e.preventDefault();

    const isOdoVisible = !document.getElementById('section-odo').classList.contains('d-none');
    const odoMoi = parseInt(document.getElementById('cp-odo-moi').value) || 0;
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;

    if (isOdoVisible && odoMoi < odoCu) {
        alert("Lỗi: ODO Mới không được nhỏ hơn ODO Cũ!");
        return;
    }

    const data = {
        xe_id: document.getElementById('cp-xe').value,
        tai_xe_id: document.getElementById('cp-taixe').value,
        loai_nhien_lieu_id: document.getElementById('cp-loainl').value,
        nguon_cap: document.querySelector('input[name="cp_nguon"]:checked').value,
        muc_dich: document.querySelector('input[name="cp_mucdich"]:checked').value,
        ngay_gio: document.getElementById('cp-ngay').value,
        odo_moi: isOdoVisible ? odoMoi : 0,
        so_luong: parseFloat(document.getElementById('cp-lit').value),
        don_gia: parseFloat(document.getElementById('cp-gia').value),
        nguoi_tao: currentUser.username
    };

    const res = await ipcRenderer.invoke('nghiepvu:capPhat', data);
    if (res.success) {
        alert("Đã lưu lệnh cấp phát thành công!");
        document.getElementById('form-capphat').reset();
        document.getElementById('cp-odo-cu').value = "";
        document.getElementById('cp-km-text').innerText = "0 Km";
        document.getElementById('cp-thanhtien').value = "";
        setupCapPhatForm();
    } else {
        alert(res.error);
    }
});

// --- MODULE: XE ---
function renderVehicles() {
    loadAllData().then(() => {
        const tbody = document.getElementById('table-xe');
        tbody.innerHTML = vehicleCache.map(v => `
            <tr>
                <td class="fw-bold text-danger">${v.bien_so}</td>
                <td><span class="badge ${v.loai_phuong_tien === 'MAY_PHAT' ? 'bg-dark' : 'bg-primary'}">${v.loai_phuong_tien}</span></td>
                <td>${v.nhan_hieu}</td>
                <td>${v.loai_nhien_lieu_mac_dinh || '-'}</td>
                <td>${v.dinh_muc}</td>
                <td><span class="badge ${v.trang_thai === 'Sẵn sàng' ? 'bg-success' : 'bg-secondary'}">${v.trang_thai}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewHistoryXe(${v.id})" title="Lịch sử"><i class="fas fa-history"></i></button>
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

    // Load Fuel Types to Xe Modal
    const select = document.getElementById('xe-loainl');
    select.innerHTML = `<option value="">-- Chọn NL Mặc Định --</option>` +
        fuelTypesCache.map(f => `<option value="${f.ten_loai}">${f.ten_loai}</option>`).join('');

    toggleXeFields();
    new bootstrap.Modal(document.getElementById('modalXe')).show();
};

window.toggleXeFields = () => {
    const type = document.querySelector('input[name="xe_type"]:checked').value;
    const lblOdo = document.getElementById('lbl-odo');
    if (type === 'MAY_PHAT') {
        lblOdo.innerText = 'Số Giờ Vận Hành Ban Đầu';
    } else {
        lblOdo.innerText = 'ODO Khởi Điểm (Km)';
    }
};

window.editXe = (id) => {
    const v = vehicleCache.find(x => x.id === id);
    if (!v) return;

    const select = document.getElementById('xe-loainl');
    select.innerHTML = `<option value="">-- Chọn NL Mặc Định --</option>` +
        fuelTypesCache.map(f => `<option value="${f.ten_loai}">${f.ten_loai}</option>`).join('');

    document.getElementById('xe-id').value = v.id;
    if (v.loai_phuong_tien === 'MAY_PHAT') document.getElementById('type_may').checked = true;
    else document.getElementById('type_xe').checked = true;
    toggleXeFields();

    document.getElementById('xe-bienso').value = v.bien_so;
    document.getElementById('xe-hieu').value = v.nhan_hieu;
    document.getElementById('xe-loainl').value = v.loai_nhien_lieu_mac_dinh;
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
        loai_phuong_tien: document.querySelector('input[name="xe_type"]:checked').value,
        bien_so: document.getElementById('xe-bienso').value,
        nhan_hieu: document.getElementById('xe-hieu').value,
        loai_nhien_lieu_mac_dinh: document.getElementById('xe-loainl').value,
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
    }
});

window.xoaXe = async () => {
    if (confirm('Xóa xe này sẽ xóa toàn bộ lịch sử cấp phát liên quan. Tiếp tục?')) {
        await ipcRenderer.invoke('xe:xoa', document.getElementById('xe-id').value);
        bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
        renderVehicles();
    }
};

window.viewHistoryXe = async (id) => {
    const logs = await ipcRenderer.invoke('xe:lichSu', id);
    const tbody = document.getElementById('table-history-content');
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td><span class="badge ${l.nguon_cap === 'KHO' ? 'bg-success' : 'bg-danger'}">${l.nguon_cap}</span></td>
            <td>${l.muc_dich === 'CONG_TAC' ? 'Xe chạy: ' + l.quang_duong + ' Km' : 'Chạy máy phát'}</td>
            <td>${l.so_luong}</td>
            <td>${l.ten_nl || ''}</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};

// --- MODULE: TÀI XẾ (CARD RENDER) ---
function renderDrivers() {
    loadAllData().then(() => {
        const container = document.getElementById('grid-taixe');
        container.innerHTML = driverCache.map(d => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 driver-card border-0 shadow-sm">
                    <div class="row g-0 h-100">
                        <div class="col-4 border-end">
                             <img src="${d.anh_dai_dien || 'assets/avatar-placeholder.png'}" class="img-fluid h-100" style="object-fit: cover; min-height: 160px;">
                        </div>
                        <div class="col-8">
                            <div class="card-body p-3 d-flex flex-column h-100">
                                <div>
                                    <span class="rank-badge mb-1 d-inline-block">${d.cap_bac}</span>
                                    <h6 class="card-title fw-bold text-uppercase mb-1 text-military">${d.ho_ten}</h6>
                                    <div class="small text-muted fw-bold mb-1"><i class="fas fa-id-badge me-1"></i>${d.so_hieu_quan_nhan || '---'}</div>
                                    <div class="small text-muted fst-italic"><i class="fas fa-briefcase me-1"></i>${d.chuc_vu}</div>
                                </div>
                                <div class="mt-auto pt-2 border-top d-flex justify-content-end gap-2">
                                    <button class="btn btn-sm btn-outline-secondary" onclick="viewHistoryTaiXe(${d.id})"><i class="fas fa-history"></i></button>
                                    <button class="btn btn-sm btn-outline-success" onclick="editTaiXe(${d.id})"><i class="fas fa-file-alt"></i></button>
                                </div>
                            </div>
                        </div>
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
    document.getElementById('tx-id').value = d.id;
    document.getElementById('tx-ten').value = d.ho_ten;
    document.getElementById('tx-ngaysinh').value = d.ngay_sinh;
    document.getElementById('tx-quequan').value = d.que_quan;
    document.getElementById('tx-truquan').value = d.tru_quan;
    document.getElementById('tx-capbac').value = d.cap_bac;
    document.getElementById('tx-chucvu').value = d.chuc_vu;
    document.getElementById('tx-sohieu').value = d.so_hieu_quan_nhan;
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
        cap_bac: document.getElementById('tx-capbac').value,
        chuc_vu: document.getElementById('tx-chucvu').value,
        so_hieu_quan_nhan: document.getElementById('tx-sohieu').value,
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
    if (confirm('Bạn có chắc chắn muốn xóa hồ sơ quân nhân này?')) {
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
            <td><span class="badge ${l.nguon_cap === 'KHO' ? 'bg-success' : 'bg-danger'}">${l.nguon_cap}</span></td>
            <td>Lái xe: ${l.quang_duong} km</td>
            <td>${l.so_luong}</td>
            <td>--</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};
