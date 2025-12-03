
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

// Khởi tạo DB phiên bản Pro Fleet Manager 3.0 (Military Edition)
const db = new Database('fleet_manager_pro.db');

// --- TIỆN ÍCH ---
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// --- KHỞI TẠO CẤU TRÚC BẢNG (SCHEMA) ---
function initDB() {
    // 1. Bảng Người dùng
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      role TEXT DEFAULT 'user'
    )
  `);

    const userCount = db.prepare('SELECT count(*) as count FROM users').get();
    if (userCount.count === 0) {
        const insert = db.prepare('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)');
        insert.run('admin', hashPassword('123456'), 'Quản Trị Viên Hệ Thống', 'admin');
    }

    // 2. Bảng Danh Mục Nhiên Liệu & Vật Tư (Yêu cầu V3.0)
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_loai TEXT UNIQUE NOT NULL, -- VD: Xăng A95, Dầu DO 0.05S
      don_vi TEXT NOT NULL,          -- VD: Lít, Can, Kg
      ghi_chu TEXT
    )
  `);

    // Seed dữ liệu mặc định
    const fuelCount = db.prepare('SELECT count(*) as count FROM fuel_types').get();
    if (fuelCount.count === 0) {
        const insert = db.prepare('INSERT INTO fuel_types (ten_loai, don_vi) VALUES (?, ?)');
        insert.run('Xăng A95', 'Lít');
        insert.run('Xăng E5', 'Lít');
        insert.run('Dầu Diesel 0.05S', 'Lít');
        insert.run('Nhớt Động Cơ', 'Can');
    }

    // 3. Bảng Hồ Sơ Phương Tiện (Yêu cầu V3.0 + V2.0 Pro)
    db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bien_so TEXT UNIQUE NOT NULL,
      nhan_hieu TEXT,
      loai_phuong_tien TEXT DEFAULT 'XE', -- 'XE' hoặc 'MAY_PHAT'
      loai_nhien_lieu_mac_dinh TEXT,      -- Gợi ý khi cấp phát
      dinh_muc REAL DEFAULT 0,            -- Lít/100km hoặc Lít/Giờ
      so_khung TEXT,
      so_may TEXT,
      nam_san_xuat INTEGER,
      odo_hien_tai INTEGER DEFAULT 0,
      trang_thai TEXT DEFAULT 'Sẵn sàng'  -- Sẵn sàng, Đang công tác, Bảo dưỡng
    )
  `);

    // Migration column (phòng trường hợp DB cũ)
    try { db.prepare("ALTER TABLE vehicles ADD COLUMN loai_phuong_tien TEXT DEFAULT 'XE'").run(); } catch (e) { }

    // 4. Bảng Hồ Sơ Tài Xế (Yêu cầu V2.0 Pro - Đặc thù Quân sự)
    db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ho_ten TEXT NOT NULL,
      ngay_sinh TEXT,
      que_quan TEXT,
      tru_quan TEXT,
      cap_bac TEXT,          -- VD: Đại úy, Thiếu tá
      chuc_vu TEXT,          -- VD: Lái xe, Trưởng xe
      so_hieu_quan_nhan TEXT,-- Số hiệu/Mã NV
      don_vi TEXT,           -- Đơn vị công tác
      anh_dai_dien TEXT      -- Đường dẫn file ảnh
    )
  `);

    // 5. Bảng Nhật Ký Cấp Phát (Yêu cầu V3.0 - Quản lý nguồn & mục đích)
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ngay_gio TEXT NOT NULL,
      xe_id INTEGER NOT NULL,
      tai_xe_id INTEGER NOT NULL,
      loai_nhien_lieu_id INTEGER,       -- Link tới bảng fuel_types
      nguon_cap TEXT DEFAULT 'KHO',     -- 'KHO' hoặc 'MUA_NGOAI'
      muc_dich TEXT DEFAULT 'CONG_TAC', -- 'CONG_TAC' (Xe) hoặc 'MAY_PHAT' (Máy nổ)
      odo_cu INTEGER DEFAULT 0,
      odo_moi INTEGER DEFAULT 0,
      quang_duong INTEGER DEFAULT 0,
      so_luong REAL NOT NULL,           -- Số lượng cấp
      don_gia REAL DEFAULT 0,           -- Giá tại thời điểm cấp
      thanh_tien REAL DEFAULT 0,
      nguoi_tao TEXT,
      ghi_chu TEXT,
      FOREIGN KEY(xe_id) REFERENCES vehicles(id),
      FOREIGN KEY(tai_xe_id) REFERENCES drivers(id),
      FOREIGN KEY(loai_nhien_lieu_id) REFERENCES fuel_types(id)
    )
  `);
}

// --- CÁC HÀM XỬ LÝ DỮ LIỆU (API) ---

// A. HỆ THỐNG
exports.dangNhap = (username, password) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    if (user && user.password === hashPassword(password)) {
        return { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
    }
    return null;
};

// B. QUẢN LÝ DANH MỤC NHIÊN LIỆU (V3.0)
exports.layDanhSachNhienLieu = () => db.prepare('SELECT * FROM fuel_types ORDER BY ten_loai').all();
exports.themNhienLieu = (data) => db.prepare('INSERT INTO fuel_types (ten_loai, don_vi, ghi_chu) VALUES (@ten_loai, @don_vi, @ghi_chu)').run(data);
exports.xoaNhienLieu = (id) => db.prepare('DELETE FROM fuel_types WHERE id = ?').run(id);

// C. QUẢN LÝ XE
exports.layDanhSachXe = () => db.prepare('SELECT * FROM vehicles ORDER BY bien_so').all();

exports.themXe = (xe) => {
    const stmt = db.prepare(`
    INSERT INTO vehicles (bien_so, nhan_hieu, loai_phuong_tien, loai_nhien_lieu_mac_dinh, dinh_muc, so_khung, so_may, nam_san_xuat, odo_hien_tai, trang_thai)
    VALUES (@bien_so, @nhan_hieu, @loai_phuong_tien, @loai_nhien_lieu_mac_dinh, @dinh_muc, @so_khung, @so_may, @nam_san_xuat, @odo_hien_tai, @trang_thai)
  `);
    return stmt.run(xe);
};

exports.suaXe = (xe) => {
    const stmt = db.prepare(`
    UPDATE vehicles 
    SET bien_so=@bien_so, nhan_hieu=@nhan_hieu, loai_phuong_tien=@loai_phuong_tien, loai_nhien_lieu_mac_dinh=@loai_nhien_lieu_mac_dinh,
        dinh_muc=@dinh_muc, so_khung=@so_khung, so_may=@so_may, 
        nam_san_xuat=@nam_san_xuat, odo_hien_tai=@odo_hien_tai, trang_thai=@trang_thai
    WHERE id=@id
  `);
    return stmt.run(xe);
};

exports.xoaXe = (id) => db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);

exports.layLichSuXe = (id) => {
    return db.prepare(`
        SELECT f.ngay_gio, d.ho_ten as lai_xe, f.odo_cu, f.odo_moi, f.quang_duong, f.so_luong, ft.ten_loai as ten_nl, f.nguon_cap, f.muc_dich
        FROM fuel_logs f
        JOIN drivers d ON f.tai_xe_id = d.id
        LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
        WHERE f.xe_id = ?
        ORDER BY f.ngay_gio DESC
    `).all(id);
};

// D. QUẢN LÝ TÀI XẾ (V2.0 Pro)
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
        cap_bac=@cap_bac, chuc_vu=@chuc_vu, so_hieu_quan_nhan=@so_hieu_quan_nhan, 
        don_vi=@don_vi, anh_dai_dien=@anh_dai_dien
    WHERE id=@id
  `);
    return stmt.run(tx);
};

exports.xoaTaiXe = (id) => db.prepare('DELETE FROM drivers WHERE id = ?').run(id);

exports.layLichSuTaiXe = (id) => {
    return db.prepare(`
    SELECT f.ngay_gio, v.bien_so, f.quang_duong, f.so_luong, f.nguon_cap
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    WHERE f.tai_xe_id = ?
    ORDER BY f.ngay_gio DESC
  `).all(id);
};

// E. CẤP PHÁT & THỐNG KÊ (V3.0 Logic)
exports.layThongKeDashboard = () => {
    const thangNay = new Date().toISOString().slice(0, 7); // YYYY-MM

    const tongLuong = db.prepare('SELECT SUM(so_luong) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const tongTien = db.prepare('SELECT SUM(thanh_tien) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const xeHoatDong = db.prepare("SELECT count(*) as count FROM vehicles WHERE trang_thai = 'Đang công tác'").get().count || 0;
    // Chỉ tính KM cho xe đi công tác
    const tongKm = db.prepare("SELECT SUM(quang_duong) as total FROM fuel_logs WHERE ngay_gio LIKE ? AND muc_dich = 'CONG_TAC'").get(`${thangNay}%`).total || 0;

    return {
        tongLuong: tongLuong.toFixed(1),
        tongTien: tongTien.toFixed(0),
        xeHoatDong: xeHoatDong,
        tongKm: tongKm
    };
};

exports.layNhatKyCapPhat = (limit = 50) => {
    return db.prepare(`
    SELECT f.id, f.ngay_gio, v.bien_so, v.loai_phuong_tien, d.ho_ten as ten_tai_xe, d.cap_bac,
           f.odo_cu, f.odo_moi, f.quang_duong, f.so_luong, f.thanh_tien,
           f.nguon_cap, f.muc_dich, ft.ten_loai, ft.don_vi
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    JOIN drivers d ON f.tai_xe_id = d.id
    LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
    ORDER BY f.ngay_gio DESC
    LIMIT ?
  `).all(limit);
};

exports.capPhatNhienLieu = (data) => {
    // Logic V3: Xử lý Xe (tính ODO) và Máy phát (không tính ODO)
    const xe = db.prepare('SELECT odo_hien_tai, loai_phuong_tien FROM vehicles WHERE id = ?').get(data.xe_id);

    let odo_cu = xe.odo_hien_tai;
    let quang_duong = 0;
    let odo_save = data.odo_moi;

    if (data.muc_dich === 'MAY_PHAT' || xe.loai_phuong_tien === 'MAY_PHAT') {
        odo_cu = 0;
        odo_save = 0;
        quang_duong = 0;
    } else {
        if (data.odo_moi < xe.odo_hien_tai) {
            throw new Error(`LỖI NGHIỆP VỤ: ODO mới (${data.odo_moi}) nhỏ hơn ODO hiện tại (${xe.odo_hien_tai})!`);
        }
        quang_duong = data.odo_moi - xe.odo_hien_tai;
    }

    const thanh_tien = data.so_luong * data.don_gia;

    const insert = db.prepare(`
    INSERT INTO fuel_logs (xe_id, tai_xe_id, loai_nhien_lieu_id, nguon_cap, muc_dich, ngay_gio, odo_cu, odo_moi, quang_duong, so_luong, don_gia, thanh_tien, nguoi_tao)
    VALUES (@xe_id, @tai_xe_id, @loai_nhien_lieu_id, @nguon_cap, @muc_dich, @ngay_gio, @odo_cu, @odo_moi, @quang_duong, @so_luong, @don_gia, @thanh_tien, @nguoi_tao)
  `);

    const updateXe = db.prepare(`UPDATE vehicles SET odo_hien_tai = ?, trang_thai = 'Sẵn sàng' WHERE id = ?`);

    const transaction = db.transaction(() => {
        insert.run({
            ...data,
            odo_cu: odo_cu,
            odo_moi: odo_save,
            quang_duong: quang_duong,
            thanh_tien: thanh_tien
        });

        // Chỉ cập nhật ODO cho xe đi công tác
        if (data.muc_dich === 'CONG_TAC' && xe.loai_phuong_tien !== 'MAY_PHAT') {
            updateXe.run(data.odo_moi, data.xe_id);
        }
    });

    return transaction();
};

initDB();
