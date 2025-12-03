

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: "HỆ THỐNG QUẢN LÝ XĂNG - DẦU SQTT",
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// 1. Hệ thống
ipcMain.handle('hethong:dangNhap', (e, u, p) => {
    try {
        const user = db.dangNhap(u, p);
        return { success: !!user, user };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('hethong:doiMatKhau', (e, id, oldPass, newPass) => {
    try {
        db.doiMatKhau(id, oldPass, newPass);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 2. Xe
ipcMain.handle('xe:layDanhSach', () => db.layDanhSachXe());
ipcMain.handle('xe:them', (e, data) => {
    try { db.themXe(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('xe:sua', (e, data) => {
    try { db.suaXe(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('xe:xoa', (e, id) => {
    try { db.xoaXe(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('xe:lichSu', (e, id) => db.layLichSuXe(id));

// 3. Tài xế
ipcMain.handle('taixe:layDanhSach', () => db.layDanhSachTaiXe());
ipcMain.handle('taixe:them', (e, data) => {
    try { db.themTaiXe(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:sua', (e, data) => {
    try { db.suaTaiXe(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:xoa', (e, id) => {
    try { db.xoaTaiXe(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:lichSu', (e, id) => db.layLichSuTaiXe(id));
ipcMain.handle('taixe:chonAnh', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Hình ảnh', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    if (!canceled && filePaths.length > 0) {
        return filePaths[0];
    }
    return null;
});

// 4. Danh Mục (Nhiên liệu, Nhiệm vụ, Cơ quan) - V5.0
// Nhiên liệu
ipcMain.handle('nhienlieu:layDanhSach', () => db.layDanhSachNhienLieu());
ipcMain.handle('nhienlieu:them', (e, data) => {
    try { db.themNhienLieu(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('nhienlieu:xoa', (e, id) => {
    try { db.xoaNhienLieu(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});

// Nhiệm vụ
ipcMain.handle('nhiemvu:layDanhSach', () => db.layDanhSachNhiemVu());
ipcMain.handle('nhiemvu:them', (e, name) => {
    try { db.themNhiemVu(name); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('nhiemvu:xoa', (e, id) => {
    try { db.xoaNhiemVu(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});

// Cơ quan
ipcMain.handle('coquan:layDanhSach', () => db.layDanhSachCoQuan());
ipcMain.handle('coquan:them', (e, name) => {
    try { db.themCoQuan(name); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('coquan:xoa', (e, id) => {
    try { db.xoaCoQuan(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});


// 5. Cấp phát & Báo cáo
ipcMain.handle('nghiepvu:layDashboard', () => db.layThongKeDashboard());
ipcMain.handle('nghiepvu:layBaoCao', (e, filter) => db.layBaoCaoTuyChinh(filter));
ipcMain.handle('hethong:xuatBaoCao', async (e, filter) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Xuất Báo Cáo CSV',
            defaultPath: `BaoCao_XangDau_${new Date().toISOString().slice(0, 10)}.csv`,
            filters: [{ name: 'CSV File', extensions: ['csv'] }]
        });

        if (canceled || !filePath) return { success: false };

        const data = db.layBaoCaoTuyChinh(filter);

        let csvContent = "\uFEFF";
        csvContent += "Thời Gian,Số Phiếu,Số Lệnh,Biển Số,Cơ Quan,Nhiệm Vụ,Điểm Đến,Số Lượng,Thành Tiền,ODO Cũ,ODO Mới,Quãng Đường\n";

        data.forEach(row => {
            csvContent += `"${row.ngay_gio}","${row.so_phieu || ''}","${row.so_lenh || ''}","${row.bien_so}","${row.ten_co_quan || ''}","${row.ten_nhiem_vu || ''}","${row.diem_den || ''}","${row.so_luong}","${row.thanh_tien}","${row.odo_cu}","${row.odo_moi}","${row.quang_duong}"\n`;
        });

        fs.writeFileSync(filePath, csvContent, 'utf-8');
        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('nghiepvu:capPhat', (e, data) => {
    try {
        db.capPhatNhienLieu(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('nghiepvu:xoaLog', (e, id) => {
    try {
        db.xoaNhatKy(id);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Thêm vào main.js, bên dưới phần ipcMain.handle('nghiepvu:xoaLog'...)
ipcMain.handle('nghiepvu:suaLog', (e, data) => {
    try {
        db.suaNhatKy(data);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});