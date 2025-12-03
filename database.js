const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// Khởi tạo DB
const db = new Database('fleet_v2.db');

// --- TIỆN ÍCH ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// --- KHỞI TẠO CẤU TRÚC BẢNG ---
function initDB() {
    // 1. Bảng Người dùng (Users)
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      role TEXT DEFAULT 'user'
    )
  `);

    // Tạo Admin mặc định nếu chưa có
    const userCount = db.prepare('SELECT count(*) as count FROM users').get();
    if (userCount.count === 0) {
        const insert = db.prepare('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)');
        insert.run('admin', hashPassword('123456'), 'Quản Trị Viên Hệ Thống', 'admin');
    }

    // 2. Bảng Hồ Sơ Xe (Vehicles) - Cập nhật trường dữ liệu mới
    db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bien_so TEXT UNIQUE NOT NULL,
      nhan_hieu TEXT,
      loai_nhien_lieu TEXT, -- 'Xăng' hoặc 'Dầu'
      dinh_muc REAL DEFAULT 0, -- Lít/100km
      odo_hien_tai INTEGER DEFAULT 0,
      trang_thai TEXT DEFAULT 'Sẵn sàng' -- 'Sẵn sàng', 'Đang đi', 'Bảo dưỡng'
    )
  `);

    // 3. Bảng Hồ Sơ Tài Xế (Drivers) - Đặc thù Quân sự
    db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ho_ten TEXT NOT NULL,
      ngay_sinh TEXT,
      que_quan TEXT,
      tru_quan TEXT,
      cap_bac TEXT,
      chuc_vu TEXT,
      so_hieu_quan_nhan TEXT,
      don_vi TEXT,
      anh_dai_dien TEXT
    )
  `);

    // 4. Bảng Nhật Ký Cấp Phát (Fuel Logs)
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ngay_gio TEXT NOT NULL,
      xe_id INTEGER NOT NULL,
      tai_xe_id INTEGER NOT NULL,
      odo_cu INTEGER DEFAULT 0,
      odo_moi INTEGER NOT NULL,
      quang_duong INTEGER DEFAULT 0,
      so_lit REAL NOT NULL,
      don_gia REAL NOT NULL,
      thanh_tien REAL NOT NULL,
      nguoi_tao TEXT,
      FOREIGN KEY(xe_id) REFERENCES vehicles(id),
      FOREIGN KEY(tai_xe_id) REFERENCES drivers(id)
    )
  `);
}

// --- API XỬ LÝ DỮ LIỆU ---

// 1. Xác thực (Auth)
exports.dangNhap = (username, password) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    if (user && user.password === hashPassword(password)) {
        return { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
    }
    return null;
};

exports.doiMatKhau = (id, newPassword) => {
    const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    return stmt.run(hashPassword(newPassword), id);
};

// 2. Quản lý Xe
exports.layDanhSachXe = () => db.prepare('SELECT * FROM vehicles ORDER BY bien_so').all();

exports.themXe = (xe) => {
    const stmt = db.prepare(`
    INSERT INTO vehicles (bien_so, nhan_hieu, loai_nhien_lieu, dinh_muc, odo_hien_tai, trang_thai)
    VALUES (@bien_so, @nhan_hieu, @loai_nhien_lieu, @dinh_muc, @odo_hien_tai, @trang_thai)
  `);
    return stmt.run(xe);
};

exports.suaXe = (xe) => {
    const stmt = db.prepare(`
    UPDATE vehicles 
    SET bien_so=@bien_so, nhan_hieu=@nhan_hieu, loai_nhien_lieu=@loai_nhien_lieu, 
        dinh_muc=@dinh_muc, odo_hien_tai=@odo_hien_tai, trang_thai=@trang_thai
    WHERE id=@id
  `);
    return stmt.run(xe);
};

exports.xoaXe = (id) => db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);

// 3. Quản lý Tài Xế
exports.layDanhSachTaiXe = () => db.prepare('SELECT * FROM drivers ORDER BY ho_ten').all();

exports.themTaiXe = (tx) => {
    const stmt = db.prepare(`
    INSERT INTO drivers (ho_ten, ngay_sinh, que_quan, tru_quan, cap_bac, chuc_vu, so_hieu_quan_nhan, don_vi, anh_dai_dien)
    VALUES (@ho_ten, @ngay_sinh, @que_quan, @tru_quan, @cap_bac, @chuc_vu, @so_hieu_quan_nhan, @don_vi, @anh_dai_dien)
  `);
    return stmt.run(tx);
};

exports.suaTaiXe = (tx) => {
    const stmt = db.prepare(`
    UPDATE drivers 
    SET ho_ten=@ho_ten, ngay_sinh=@ngay_sinh, que_quan=@que_quan, tru_quan=@tru_quan, 
        cap_bac=@cap_bac, chuc_vu=@chuc_vu, so_hieu_quan_nhan=@so_hieu_quan_nhan, don_vi=@don_vi, anh_dai_dien=@anh_dai_dien
    WHERE id=@id
  `);
    return stmt.run(tx);
};

exports.xoaTaiXe = (id) => db.prepare('DELETE FROM drivers WHERE id = ?').run(id);

exports.layLichSuTaiXe = (id) => {
    return db.prepare(`
    SELECT f.ngay_gio, v.bien_so, f.quang_duong, f.so_lit 
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    WHERE f.tai_xe_id = ?
    ORDER BY f.ngay_gio DESC
  `).all(id);
}

// 4. Nghiệp vụ & Thống kê
exports.layThongKeDashboard = () => {
    const thangNay = new Date().toISOString().slice(0, 7); // YYYY-MM

    const tongLit = db.prepare('SELECT SUM(so_lit) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const tongTien = db.prepare('SELECT SUM(thanh_tien) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const xeHoatDong = db.prepare("SELECT count(*) as count FROM vehicles WHERE trang_thai = 'Đang đi'").get().count || 0;

    return {
        tongLit: tongLit.toFixed(2),
        tongTien: tongTien.toFixed(0),
        xeHoatDong: xeHoatDong
    };
};

exports.layNhatKyCapPhat = (limit = 20) => {
    return db.prepare(`
    SELECT f.id, f.ngay_gio, v.bien_so, d.ho_ten as ten_tai_xe, 
           f.odo_cu, f.odo_moi, f.quang_duong, f.so_lit, f.thanh_tien
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    JOIN drivers d ON f.tai_xe_id = d.id
    ORDER BY f.ngay_gio DESC
    LIMIT ?
  `).all(limit);
};

exports.capPhatNhienLieu = (data) => {
    // data: { xe_id, tai_xe_id, ngay_gio, odo_moi, so_lit, don_gia, nguoi_tao }

    // 1. Lấy thông tin xe hiện tại để check ODO
    const xe = db.prepare('SELECT odo_hien_tai, loai_nhien_lieu FROM vehicles WHERE id = ?').get(data.xe_id);
    if (!xe) throw new Error("Không tìm thấy xe");

    if (data.odo_moi < xe.odo_hien_tai) {
        throw new Error(`ODO mới (${data.odo_moi}) không được nhỏ hơn ODO cũ (${xe.odo_hien_tai})`);
    }

    const quang_duong = data.odo_moi - xe.odo_hien_tai;
    const thanh_tien = data.so_lit * data.don_gia;

    const insert = db.prepare(`
    INSERT INTO fuel_logs (xe_id, tai_xe_id, ngay_gio, odo_cu, odo_moi, quang_duong, so_lit, don_gia, thanh_tien, nguoi_tao)
    VALUES (@xe_id, @tai_xe_id, @ngay_gio, @odo_cu, @odo_moi, @quang_duong, @so_lit, @don_gia, @thanh_tien, @nguoi_tao)
  `);

    const updateXe = db.prepare(`
    UPDATE vehicles SET odo_hien_tai = ? WHERE id = ?
  `);

    const transaction = db.transaction(() => {
        insert.run({
            ...data,
            odo_cu: xe.odo_hien_tai,
            quang_duong: quang_duong,
            thanh_tien: thanh_tien
        });
        updateXe.run(data.odo_moi, data.xe_id);
    });

    return transaction();
};

initDB();