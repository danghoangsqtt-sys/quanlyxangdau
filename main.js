
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 850,
        title: "PHẦN MỀM QUẢN LÝ VẬN TẢI CHIẾN LƯỢC - VER 3.0",
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

// 1. Hệ thống & Xác thực
ipcMain.handle('hethong:dangNhap', (e, u, p) => {
    try {
        const user = db.dangNhap(u, p);
        return { success: !!user, user };
    } catch (err) { return { success: false, error: err.message }; }
});

// 2. Nghiệp vụ Xe
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

// 3. Nghiệp vụ Tài xế (Quân sự)
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

// 4. Nghiệp vụ Nhiên Liệu (Master Data V3)
ipcMain.handle('nhienlieu:layDanhSach', () => db.layDanhSachNhienLieu());
ipcMain.handle('nhienlieu:them', (e, data) => {
    try { db.themNhienLieu(data); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});
ipcMain.handle('nhienlieu:xoa', (e, id) => {
    try { db.xoaNhienLieu(id); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
});

// 5. Cấp phát & Báo cáo
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
