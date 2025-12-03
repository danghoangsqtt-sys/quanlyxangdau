const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const db = require('./database');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "PRO FLEET MANAGER",
        backgroundColor: '#f4f6f9',
        webPreferences: {
            nodeIntegration: true, // Simplified for this requirement
            contextIsolation: false // Simplified to allow require in renderer
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// Auth
ipcMain.handle('auth:login', (event, username, password) => {
    try {
        const user = db.login(username, password);
        return { success: !!user, user };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('user:create', (event, { username, password, fullname, role }) => {
    try {
        db.createUser(username, password, fullname, role);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('user:changePass', (event, { id, newPass }) => {
    try {
        db.changePassword(id, newPass);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Data
ipcMain.handle('data:getDashboard', () => {
    return {
        stats: db.getDashboardStats(),
        recentLogs: db.getRecentLogs(),
        vehicles: db.getVehicles(),
        drivers: db.getDrivers()
    };
});

ipcMain.handle('data:addFuel', (event, data) => {
    try {
        db.addFuelLog(data);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// Export CSV
ipcMain.handle('data:exportCSV', async () => {
    try {
        const logs = db.getAllLogsForExport();
        if (!logs.length) return { success: false, message: "No data to export." };

        // Create CSV Header
        const header = "ID,Date Time,Vehicle Plate,Vehicle Model,Driver,Odometer,Liters,Price,Total Cost,Created By\n";

        // Create CSV Rows
        const rows = logs.map(log => {
            return [
                log.id,
                log.date_time,
                log.plate_number,
                log.model,
                log.driver_name,
                log.odometer,
                log.liters,
                log.price,
                log.total_cost,
                log.created_by
            ].map(field => `"${field}"`).join(','); // Wrap in quotes to handle commas
        }).join('\n');

        const csvContent = header + rows;

        // Show Save Dialog
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Fuel Logs',
            defaultPath: `fuel_report_${Date.now()}.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
            await fs.writeFile(filePath, csvContent, 'utf8');
            return { success: true, path: filePath };
        }
        return { success: false, message: "Cancelled" };

    } catch (e) {
        return { success: false, error: e.message };
    }
});
