
const { ipcRenderer } = require('electron');

// GLOBAL STATE
let currentUser = null;
let vehicleCache = [];
let driverCache = [];
let fuelTypesCache = [];
let missionsCache = [];
let departmentsCache = [];

// --- NAVIGATION ---
window.switchTab = (tabId) => {
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    document.getElementById(tabId).classList.remove('d-none');

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const activeNav = Array.from(document.querySelectorAll('.nav-link')).find(el => el.getAttribute('onclick').includes(tabId));
    if (activeNav) activeNav.classList.add('active');

    if (tabId === 'tab-tongquan') {
        loadDashboard();
        initReportFilter();
    }
    if (tabId === 'tab-capphat') setupCapPhatForm();
    if (tabId === 'tab-hoso-xe') renderVehicles();
    if (tabId === 'tab-hoso-taixe') renderDrivers();
    if (tabId === 'tab-danhmuc') renderMasterData();
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

        loadAllData().then(() => {
            loadDashboard();
            initReportFilter();
        });
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
    missionsCache = await ipcRenderer.invoke('nhiemvu:layDanhSach');
    departmentsCache = await ipcRenderer.invoke('coquan:layDanhSach');
}

// --- DASHBOARD & REPORT (V5.0) ---
function initReportFilter() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    if (!document.getElementById('filter-start').value) {
        document.getElementById('filter-start').value = startOfMonth.toISOString().slice(0, 10);
        document.getElementById('filter-end').value = today.toISOString().slice(0, 10);
    }

    const filterXe = document.getElementById('filter-xe');
    if (filterXe.options.length === 0) {
        filterXe.innerHTML = '<option value="all">-- Tất cả xe --</option>' +
            vehicleCache.map(v => `<option value="${v.id}">${v.bien_so}</option>`).join('');
    }
    loadReportData();
}

window.loadReportData = async () => {
    const filter = {
        startDate: document.getElementById('filter-start').value,
        endDate: document.getElementById('filter-end').value,
        vehicleId: document.getElementById('filter-xe').value,
        keyword: document.getElementById('filter-keyword').value
    };

    const logs = await ipcRenderer.invoke('nghiepvu:layBaoCao', filter);

    const tbody = document.getElementById('table-logs');
    tbody.innerHTML = logs.map(log => {
        // Display split logic
        let qtyDisplay = '';
        if (log.so_lit_cap > 0) qtyDisplay += `<div class="text-success"><span class="fw-bold">${log.so_lit_cap}</span> (Kho)</div>`;
        if (log.so_lit_mua > 0) qtyDisplay += `<div class="text-warning text-dark"><span class="fw-bold">${log.so_lit_mua}</span> (Mua)</div>`;
        if (!qtyDisplay) qtyDisplay = `<div class="fw-bold">${log.so_luong}</div>`;

        return `
        <tr>
            <td>
                <div>${log.ngay_gio.slice(0, 10)}</div>
                <small class="text-muted">${log.ngay_gio.slice(11, 16)}</small>
            </td>
            <td>
                <div class="fw-bold text-danger">${log.so_phieu || '--'}</div>
                <div class="small fst-italic">Lệnh: ${log.so_lenh || '--'}</div>
            </td>
            <td>
                <div class="fw-bold">${log.bien_so}</div>
                <div class="small">${log.loai_phuong_tien}</div>
            </td>
            <td>
                <div>${log.ten_co_quan || '-'}</div>
            </td>
            <td>
                <div class="text-truncate" style="max-width: 150px;">${log.diem_den || ''}</div>
                <div class="small text-muted text-truncate" style="max-width: 150px;">${log.noi_dung || ''}</div>
            </td>
            <td>${qtyDisplay}</td>
            <td class="fw-bold text-dark">${new Intl.NumberFormat('vi-VN').format(log.thanh_tien)}</td>
        </tr>
    `}).join('');
};

window.exportReportData = async () => {
    const filter = {
        startDate: document.getElementById('filter-start').value,
        endDate: document.getElementById('filter-end').value,
        vehicleId: document.getElementById('filter-xe').value,
        keyword: document.getElementById('filter-keyword').value
    };

    const res = await ipcRenderer.invoke('hethong:xuatBaoCao', filter);
    if (res.success) alert("Xuất báo cáo thành công!");
    else alert("Lỗi xuất báo cáo: " + res.error);
};

async function loadDashboard() {
    const data = await ipcRenderer.invoke('nghiepvu:layDashboard');
    document.getElementById('tk-lit').innerText = data.tongLuong;
    document.getElementById('tk-tien').innerText = new Intl.NumberFormat('vi-VN').format(data.tongTien);
    document.getElementById('tk-xe').innerText = data.xeHoatDong;
    document.getElementById('tk-km').innerText = new Intl.NumberFormat('vi-VN').format(data.tongKm);
}

// --- DANH MỤC (V5.0: 3 Columns) ---
function renderMasterData() {
    // 1. Render Fuel
    ipcRenderer.invoke('nhienlieu:layDanhSach').then(list => {
        fuelTypesCache = list;
        document.getElementById('table-nhienlieu').innerHTML = list.map(f => `
            <tr>
                <td class="fw-bold text-military">${f.ten_loai}</td>
                <td><button class="btn btn-sm btn-outline-danger py-0 border-0" onclick="xoaNhienLieu(${f.id})"><i class="fas fa-times"></i></button></td>
            </tr>
        `).join('');
    });

    // 2. Render Mission
    ipcRenderer.invoke('nhiemvu:layDanhSach').then(list => {
        missionsCache = list;
        document.getElementById('table-nhiemvu').innerHTML = list.map(m => `
            <tr>
                <td>${m.ten_nhiem_vu}</td>
                <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 border-0" onclick="xoaNhiemVu(${m.id})"><i class="fas fa-times"></i></button></td>
            </tr>
        `).join('');
    });

    // 3. Render Department
    ipcRenderer.invoke('coquan:layDanhSach').then(list => {
        departmentsCache = list;
        document.getElementById('table-coquan').innerHTML = list.map(m => `
            <tr>
                <td>${m.ten_co_quan}</td>
                <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 border-0" onclick="xoaCoQuan(${m.id})"><i class="fas fa-times"></i></button></td>
            </tr>
        `).join('');
    });
}

document.getElementById('form-nhienlieu').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ipcRenderer.invoke('nhienlieu:them', {
        ten_loai: document.getElementById('nl-ten').value,
        don_vi: document.getElementById('nl-donvi').value,
        nhom_nl: document.getElementById('nl-nhom').value,
        ghi_chu: ''
    });
    document.getElementById('nl-ten').value = '';
    renderMasterData();
});

document.getElementById('form-nhiemvu').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ipcRenderer.invoke('nhiemvu:them', document.getElementById('nv-ten').value);
    document.getElementById('nv-ten').value = '';
    renderMasterData();
});

document.getElementById('form-coquan').addEventListener('submit', async (e) => {
    e.preventDefault();
    await ipcRenderer.invoke('coquan:them', document.getElementById('cq-ten').value);
    document.getElementById('cq-ten').value = '';
    renderMasterData();
});

window.xoaNhienLieu = async (id) => { if (confirm('Xóa?')) { await ipcRenderer.invoke('nhienlieu:xoa', id); renderMasterData(); } };
window.xoaNhiemVu = async (id) => { if (confirm('Xóa?')) { await ipcRenderer.invoke('nhiemvu:xoa', id); renderMasterData(); } };
window.xoaCoQuan = async (id) => { if (confirm('Xóa?')) { await ipcRenderer.invoke('coquan:xoa', id); renderMasterData(); } };

// --- CẤP PHÁT (FORM LOGIC V5.0) ---
async function setupCapPhatForm() {
    await loadAllData();

    const todayStr = new Date().toISOString().slice(0, 10);
    document.getElementById('cp-ngay-phieu').value = todayStr;
    document.getElementById('cp-ngay-di').value = todayStr;
    document.getElementById('cp-ngay-ve').value = todayStr;

    // Default time: Di 07:00, Ve 17:00
    document.getElementById('cp-gio-di').value = "07:00";
    document.getElementById('cp-gio-ve').value = "17:00";

    // Populate Vehicles
    const xeSelect = document.getElementById('cp-xe');
    xeSelect.innerHTML = `<option value="">-- Chọn Phương Tiện --</option>` +
        vehicleCache.map(v => `<option value="${v.id}" 
            data-bienso="${v.bien_so}"
            data-type="${v.loai_phuong_tien}" 
            data-odo="${v.odo_hien_tai}" 
            data-dongco="${v.loai_dong_co}" 
            data-dm="${v.dinh_muc}">
            ${v.bien_so} - ${v.nhan_hieu}
        </option>`).join('');

    // Populate Drivers
    document.getElementById('cp-taixe').innerHTML = `<option value="">-- Chọn Người Lái --</option>` +
        driverCache.map(d => `<option value="${d.id}">${d.cap_bac} ${d.ho_ten}</option>`).join('');

    // Populate Missions
    document.getElementById('cp-nhiemvu').innerHTML = `<option value="">-- Chọn Nhiệm Vụ --</option>` +
        missionsCache.map(m => `<option value="${m.id}">${m.ten_nhiem_vu}</option>`).join('');

    // Populate Departments
    document.getElementById('cp-coquan').innerHTML = `<option value="">-- Chọn Cơ Quan --</option>` +
        departmentsCache.map(d => `<option value="${d.id}">${d.ten_co_quan}</option>`).join('');

    document.getElementById('cp-loainl').innerHTML = '<option value="">-- Chọn Xe Trước --</option>';
}

// Logic: Chọn Xe -> Hiển thị Info & Lọc nhiên liệu
document.getElementById('cp-xe').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const fuelSelect = document.getElementById('cp-loainl');

    if (opt.value) {
        // V5.0: Fill Readonly Fields
        document.getElementById('cp-view-bienso').value = opt.getAttribute('data-bienso');
        document.getElementById('cp-view-loaixe').value = opt.getAttribute('data-type') === 'MAY_PHAT' ? 'MÁY PHÁT' : 'Ô TÔ';
        document.getElementById('cp-view-dinhmuc').value = opt.getAttribute('data-dm');

        const odo = parseInt(opt.getAttribute('data-odo')) || 0;
        const dongCo = opt.getAttribute('data-dongco');

        document.getElementById('cp-odo-cu').value = odo;
        document.getElementById('cp-odo-moi').value = '';
        document.getElementById('cp-quangduong').value = '';

        // Filter Fuel Logic
        let allowedGroups = dongCo === 'MAY_XANG' ? ['XANG', 'NHOT'] : ['DAU', 'NHOT'];
        const filteredFuels = fuelTypesCache.filter(f => allowedGroups.includes(f.nhom_nl));

        fuelSelect.innerHTML = `<option value="">-- Chọn NL --</option>` +
            filteredFuels.map(f => `<option value="${f.id}" data-unit="${f.don_vi}">${f.ten_loai}</option>`).join('');

    } else {
        // Clear logic
        document.getElementById('cp-view-bienso').value = '';
        document.getElementById('cp-view-loaixe').value = '';
        document.getElementById('cp-view-dinhmuc').value = '0';
        document.getElementById('cp-odo-cu').value = '';
        fuelSelect.innerHTML = '<option value="">-- Chọn Xe Trước --</option>';
    }
    updateCalc();
});

// ODO Bi-directional
document.getElementById('cp-odo-moi').addEventListener('input', (e) => {
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;
    const odoMoi = parseInt(e.target.value) || 0;
    if (odoMoi >= odoCu) document.getElementById('cp-quangduong').value = odoMoi - odoCu;
});
document.getElementById('cp-quangduong').addEventListener('input', (e) => {
    const odoCu = parseInt(document.getElementById('cp-odo-cu').value) || 0;
    const km = parseInt(e.target.value) || 0;
    if (km >= 0) document.getElementById('cp-odo-moi').value = odoCu + km;
});

// Split Calc Logic
function updateCalc() {
    const litCap = parseFloat(document.getElementById('cp-lit-cap').value) || 0;
    const giaCap = parseFloat(document.getElementById('cp-gia-cap').value) || 0;

    const litMua = parseFloat(document.getElementById('cp-lit-mua').value) || 0;
    const giaMua = parseFloat(document.getElementById('cp-gia-mua').value) || 0;

    const total = (litCap * giaCap) + (litMua * giaMua);
    document.getElementById('cp-thanhtien').value = new Intl.NumberFormat('vi-VN').format(total);
}

['cp-lit-cap', 'cp-gia-cap', 'cp-lit-mua', 'cp-gia-mua'].forEach(id => document.getElementById(id).addEventListener('input', updateCalc));

document.getElementById('form-capphat').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gather massive V5.0 data
    const data = {
        // System / Old logic fields
        xe_id: document.getElementById('cp-xe').value,
        tai_xe_id: document.getElementById('cp-taixe').value,
        loai_nhien_lieu_id: document.getElementById('cp-loainl').value,
        nguon_cap: 'KHO', // Default
        muc_dich: 'CONG_TAC', // Default
        ngay_gio: document.getElementById('cp-ngay-di').value + 'T' + document.getElementById('cp-gio-di').value,

        odo_moi: parseInt(document.getElementById('cp-odo-moi').value) || 0,

        // Split Fuel
        so_lit_cap: parseFloat(document.getElementById('cp-lit-cap').value) || 0,
        don_gia: parseFloat(document.getElementById('cp-gia-cap').value) || 0,
        so_lit_mua: parseFloat(document.getElementById('cp-lit-mua').value) || 0,
        don_gia_mua: parseFloat(document.getElementById('cp-gia-mua').value) || 0,

        nguoi_tao: currentUser.username,

        // V5.0 NEW FIELDS
        nhom_c: document.getElementById('cp-nhom-c').value,
        so_phieu: document.getElementById('cp-so-phieu').value,
        ngay_phieu: document.getElementById('cp-ngay-phieu').value,
        so_lenh: document.getElementById('cp-so-lenh').value,
        ngay_lenh: document.getElementById('cp-ngay-lenh').value,
        co_quan_id: document.getElementById('cp-coquan').value,
        noi_dung: document.getElementById('cp-noidung').value,
        diem_den: document.getElementById('cp-diemden').value,
        nhiem_vu_id: document.getElementById('cp-nhiemvu').value,

        ngay_di: document.getElementById('cp-ngay-di').value,
        gio_di: document.getElementById('cp-gio-di').value,
        ngay_ve: document.getElementById('cp-ngay-ve').value,
        gio_ve: document.getElementById('cp-gio-ve').value
    };

    const res = await ipcRenderer.invoke('nghiepvu:capPhat', data);
    if (res.success) {
        alert("Đã lưu Phiếu Lệnh thành công!");
        document.getElementById('form-capphat').reset();
        setupCapPhatForm();
    } else {
        alert(res.error);
    }
});

// --- XE & TÀI XẾ (Giữ nguyên logic cũ) ---
function renderVehicles() {
    loadAllData().then(() => {
        const tbody = document.getElementById('table-xe');
        tbody.innerHTML = vehicleCache.map(v => `
            <tr>
                <td class="fw-bold text-danger">${v.bien_so}</td>
                <td><span class="badge ${v.loai_phuong_tien === 'MAY_PHAT' ? 'bg-dark' : 'bg-primary'}">${v.loai_phuong_tien}</span></td>
                <td>${v.nhan_hieu}</td>
                <td><span class="badge ${v.loai_dong_co === 'MAY_XANG' ? 'bg-success' : 'bg-warning text-dark'}">${v.loai_dong_co === 'MAY_XANG' ? 'XĂNG' : 'DẦU'}</span></td>
                <td>${v.dinh_muc}</td>
                <td><span class="badge ${v.trang_thai === 'Sẵn sàng' ? 'bg-success' : 'bg-secondary'}">${v.trang_thai}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="viewHistoryXe(${v.id})"><i class="fas fa-history"></i></button>
                    <button class="btn btn-sm btn-outline-primary" onclick="editXe(${v.id})"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `).join('');
    });
}
window.openModalXe = () => {
    document.getElementById('form-xe').reset();
    document.getElementById('xe-id').value = '';
    document.getElementById('btn-xoa-xe').classList.add('d-none');
    toggleXeFields();
    new bootstrap.Modal(document.getElementById('modalXe')).show();
};
window.toggleXeFields = () => {
    const type = document.querySelector('input[name="xe_type"]:checked').value;
    document.getElementById('lbl-odo').innerText = type === 'MAY_PHAT' ? 'Giờ Vận Hành' : 'ODO Khởi Điểm (Km)';
};
window.editXe = (id) => {
    const v = vehicleCache.find(x => x.id === id);
    if (!v) return;
    document.getElementById('xe-id').value = v.id;
    if (v.loai_phuong_tien === 'MAY_PHAT') document.getElementById('type_may').checked = true;
    else document.getElementById('type_xe').checked = true;
    toggleXeFields();
    document.getElementById('xe-bienso').value = v.bien_so;
    document.getElementById('xe-hieu').value = v.nhan_hieu;
    document.getElementById('xe-dongco').value = v.loai_dong_co;
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
        loai_dong_co: document.getElementById('xe-dongco').value,
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
    if (confirm('Xóa xe này?')) {
        await ipcRenderer.invoke('xe:xoa', document.getElementById('xe-id').value);
        bootstrap.Modal.getInstance(document.getElementById('modalXe')).hide();
        renderVehicles();
    }
};
window.viewHistoryXe = async (id) => {
    const logs = await ipcRenderer.invoke('xe:lichSu', id);
    document.getElementById('table-history-content').innerHTML = logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td>--</td>
            <td>${l.muc_dich === 'CONG_TAC' ? l.quang_duong + ' Km' : 'Máy phát'}</td>
            <td>
                ${l.so_lit_cap > 0 ? l.so_lit_cap + ' (Kho)<br>' : ''}
                ${l.so_lit_mua > 0 ? l.so_lit_mua + ' (Mua)' : ''}
                ${(l.so_lit_cap == 0 && l.so_lit_mua == 0) ? l.so_luong : ''}
            </td>
            <td>${l.ten_nl || ''}</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};
function renderDrivers() {
    loadAllData().then(() => {
        document.getElementById('grid-taixe').innerHTML = driverCache.map(d => `
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
                                    <div class="small text-muted fw-bold mb-1">${d.so_hieu_quan_nhan || '---'}</div>
                                    <div class="small text-muted fst-italic">${d.chuc_vu}</div>
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
    if (confirm('Xóa hồ sơ này?')) {
        await ipcRenderer.invoke('taixe:xoa', document.getElementById('tx-id').value);
        bootstrap.Modal.getInstance(document.getElementById('modalTaiXe')).hide();
        renderDrivers();
    }
};
window.viewHistoryTaiXe = async (id) => {
    const logs = await ipcRenderer.invoke('taixe:lichSu', id);
    document.getElementById('table-history-content').innerHTML = logs.map(l => `
        <tr>
            <td>${l.ngay_gio.slice(0, 10)}</td>
            <td>--</td>
            <td>Lái xe: ${l.quang_duong} km</td>
            <td>${(l.so_lit_cap || 0) + (l.so_lit_mua || 0)}</td>
            <td>--</td>
        </tr>
    `).join('');
    new bootstrap.Modal(document.getElementById('modalHistory')).show();
};
