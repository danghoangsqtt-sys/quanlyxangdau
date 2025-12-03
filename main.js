const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const db = require('./database');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        title: "HỆ THỐNG QUẢN LÝ XĂNG DẦU & ĐỘI XE - BỘ TƯ LỆNH",
        icon: path.join(__dirname, 'icon.png'), // Nếu có
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenuBarVisibility(false); // Ẩn menu mặc định cho gọn
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS (Xử lý lệnh từ Renderer) ---

// 1. Hệ thống & Auth
ipcMain.handle('hethong:dangNhap', (e, u, p) => {
    try {
        const user = db.dangNhap(u, p);
        return { success: !!user, user };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('hethong:doiMatKhau', (e, { id, newPass }) => {
    try {
        db.doiMatKhau(id, newPass);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});

// 2. Nghiệp vụ Xe
ipcMain.handle('xe:layDanhSach', () => db.layDanhSachXe());
ipcMain.handle('xe:them', (e, data) => {
    try {
        db.themXe(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('xe:sua', (e, data) => {
    try {
        db.suaXe(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('xe:xoa', (e, id) => {
    try {
        db.xoaXe(id);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});

// 3. Nghiệp vụ Tài xế
ipcMain.handle('taixe:layDanhSach', () => db.layDanhSachTaiXe());
ipcMain.handle('taixe:them', (e, data) => {
    try {
        db.themTaiXe(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:sua', (e, data) => {
    try {
        db.suaTaiXe(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:xoa', (e, id) => {
    try {
        db.xoaTaiXe(id);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('taixe:chonAnh', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    if (!canceled && filePaths.length > 0) {
        return filePaths[0]; // Trả về đường dẫn ảnh
    }
    return null;
});
ipcMain.handle('taixe:lichSu', (e, id) => db.layLichSuTaiXe(id));


// 4. Cấp phát & Báo cáo
ipcMain.handle('nghiepvu:layDashboard', () => {
    return {
        thongKe: db.layThongKeDashboard(),
        nhatKy: db.layNhatKyCapPhat()
    };
});

ipcMain.handle('nghiepvu:capPhat', (e, data) => {
    try {
        db.capPhatNhienLieu(data);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('nghiepvu:xuatCSV', async () => {
    // Logic xuất CSV giữ nguyên hoặc nâng cấp tùy ý (đã có ở bản trước)
    return { success: false, message: "Tính năng đang bảo trì trong bản 2.0" };
});