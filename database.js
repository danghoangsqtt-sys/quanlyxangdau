const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');
// Khởi tạo DB phiên bản SQTT 2025 v5.0
// Lấy đường dẫn thư mục AppData của người dùng
// (Ví dụ: C:\Users\TenBan\AppData\Roaming\Quan Ly Xang Dau SQTT)
// Lưu ý: Vì database.js được require trong main process, ta cần cách lấy path an toàn
const userDataPath = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME));
const dbPath = path.join(userDataPath, 'sqtt_fuel_manager.db');

console.log("Database path:", dbPath); // Để debug xem file nằm ở đâu

const db = new Database(dbPath);

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
        insert.run('admin', hashPassword('123456'), 'Quản Trị Hệ Thống SQTT', 'admin');
    }

    // 2. Bảng Danh Mục Nhiên Liệu
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_loai TEXT UNIQUE NOT NULL,
      don_vi TEXT NOT NULL,
      nhom_nl TEXT DEFAULT 'XANG',
      ghi_chu TEXT
    )
  `);
    try { db.prepare("ALTER TABLE fuel_types ADD COLUMN nhom_nl TEXT DEFAULT 'XANG'").run(); } catch (e) { }

    // 3. Bảng Danh Mục Nhiệm Vụ (MỚI V5.0)
    db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_nhiem_vu TEXT UNIQUE NOT NULL
    )
  `);
    // Seed nhiệm vụ mẫu
    if (db.prepare('SELECT count(*) as count FROM missions').get().count === 0) {
        const insertM = db.prepare('INSERT INTO missions (ten_nhiem_vu) VALUES (?)');
        ['Sẵn sàng chiến đấu', 'Công tác thường xuyên', 'Huấn luyện dã ngoại', 'Đột xuất', 'Phòng chống thiên tai'].forEach(n => insertM.run(n));
    }

    // 4. Bảng Danh Mục Cơ Quan (MỚI V5.0)
    db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_co_quan TEXT UNIQUE NOT NULL
    )
  `);
    // Seed cơ quan mẫu
    if (db.prepare('SELECT count(*) as count FROM departments').get().count === 0) {
        const insertD = db.prepare('INSERT INTO departments (ten_co_quan) VALUES (?)');
        ['Phòng Tham Mưu', 'Phòng Chính Trị', 'Phòng Hậu Cần', 'Phòng Kỹ Thuật', 'Ban Tài Chính'].forEach(n => insertD.run(n));
    }

    // 5. Bảng Hồ Sơ Phương Tiện
    db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bien_so TEXT UNIQUE NOT NULL,
      nhan_hieu TEXT,
      loai_phuong_tien TEXT DEFAULT 'XE',
      loai_dong_co TEXT DEFAULT 'MAY_XANG',
      dinh_muc REAL DEFAULT 0,            
      so_khung TEXT,
      so_may TEXT,
      nam_san_xuat INTEGER,
      odo_hien_tai INTEGER DEFAULT 0,
      trang_thai TEXT DEFAULT 'Sẵn sàng'
    )
  `);
    try { db.prepare("ALTER TABLE vehicles ADD COLUMN loai_dong_co TEXT DEFAULT 'MAY_XANG'").run(); } catch (e) { }

    // 6. Bảng Hồ Sơ Tài Xế
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

    // 7. Bảng Nhật Ký Cấp Phát (NÂNG CẤP LỚN V5.0 & V5.1 Split Fuel & V5.2 Machine Support)
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      -- Thông tin hệ thống cũ
      ngay_gio TEXT NOT NULL,
      xe_id INTEGER NOT NULL,
      tai_xe_id INTEGER NOT NULL,
      loai_nhien_lieu_id INTEGER,
      nguon_cap TEXT DEFAULT 'KHO', 
      muc_dich TEXT DEFAULT 'CONG_TAC',
      odo_cu INTEGER DEFAULT 0,
      odo_moi INTEGER DEFAULT 0,
      quang_duong INTEGER DEFAULT 0,
      
      -- Fuel Info V5.1 (Split)
      so_luong REAL DEFAULT 0, -- Tổng cộng (cấp + mua) để thống kê nhanh
      so_lit_cap REAL DEFAULT 0, -- Lấy tại kho
      don_gia REAL DEFAULT 0,    -- Giá kho
      so_lit_mua REAL DEFAULT 0, -- Mua ngoài
      don_gia_mua REAL DEFAULT 0, -- Giá mua ngoài

      thanh_tien REAL DEFAULT 0,
      nguoi_tao TEXT,
      ghi_chu TEXT,
      
      -- Thông tin V5.0 (Phiếu lệnh điều xe)
      nhom_c TEXT,
      so_phieu TEXT,
      ngay_phieu TEXT,
      so_lenh TEXT,
      ngay_lenh TEXT,
      co_quan_id INTEGER, 
      noi_dung TEXT,
      diem_den TEXT,
      nhiem_vu_id INTEGER,
      
      -- Thời gian chi tiết
      ngay_di TEXT,
      gio_di TEXT,
      ngay_ve TEXT,
      gio_ve TEXT,
      
      -- V5.2: Thông tin Máy nổ / Máy phát đi kèm
      may_id INTEGER,
      may_loai_nl_id INTEGER,
      may_lit_cap REAL DEFAULT 0,
      may_gia_cap REAL DEFAULT 0,
      may_lit_mua REAL DEFAULT 0,
      may_gia_mua REAL DEFAULT 0,

      FOREIGN KEY(xe_id) REFERENCES vehicles(id),
      FOREIGN KEY(may_id) REFERENCES vehicles(id),
      FOREIGN KEY(tai_xe_id) REFERENCES drivers(id),
      FOREIGN KEY(loai_nhien_lieu_id) REFERENCES fuel_types(id),
      FOREIGN KEY(may_loai_nl_id) REFERENCES fuel_types(id),
      FOREIGN KEY(nhiem_vu_id) REFERENCES missions(id),
      FOREIGN KEY(co_quan_id) REFERENCES departments(id)
    )
  `);

    // MIGRATION V5.0 & V5.1 & V5.2
    const columnsV5 = [
        { col: 'nhom_c', type: 'TEXT' },
        { col: 'so_phieu', type: 'TEXT' },
        { col: 'ngay_phieu', type: 'TEXT' },
        { col: 'so_lenh', type: 'TEXT' },
        { col: 'ngay_lenh', type: 'TEXT' },
        { col: 'co_quan_id', type: 'INTEGER' },
        { col: 'noi_dung', type: 'TEXT' },
        { col: 'diem_den', type: 'TEXT' },
        { col: 'nhiem_vu_id', type: 'INTEGER' },
        { col: 'ngay_di', type: 'TEXT' },
        { col: 'gio_di', type: 'TEXT' },
        { col: 'ngay_ve', type: 'TEXT' },
        { col: 'gio_ve', type: 'TEXT' },
        // V5.1 New Columns
        { col: 'so_lit_cap', type: 'REAL DEFAULT 0' },
        { col: 'so_lit_mua', type: 'REAL DEFAULT 0' },
        { col: 'don_gia_mua', type: 'REAL DEFAULT 0' },
        // V5.2 Machine Columns
        { col: 'may_id', type: 'INTEGER' },
        { col: 'may_loai_nl_id', type: 'INTEGER' },
        { col: 'may_lit_cap', type: 'REAL DEFAULT 0' },
        { col: 'may_gia_cap', type: 'REAL DEFAULT 0' },
        { col: 'may_lit_mua', type: 'REAL DEFAULT 0' },
        { col: 'may_gia_mua', type: 'REAL DEFAULT 0' }
    ];

    columnsV5.forEach(def => {
        try {
            db.prepare(`ALTER TABLE fuel_logs ADD COLUMN ${def.col} ${def.type}`).run();
        } catch (e) {
            // Column exists, ignore
        }
    });
}

// --- API ---

// A. HỆ THỐNG
exports.dangNhap = (username, password) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    if (user && user.password === hashPassword(password)) {
        return { id: user.id, username: user.username, fullname: user.fullname, role: user.role };
    }
    return null;
};

exports.doiMatKhau = (id, oldPass, newPass) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new Error('Người dùng không tồn tại');
    if (user.password !== hashPassword(oldPass)) throw new Error('Mật khẩu cũ không chính xác');

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPass), id);
    return true;
};

// B. QUẢN LÝ DANH MỤC (V5.0)
// Nhiên Liệu
exports.layDanhSachNhienLieu = () => db.prepare('SELECT * FROM fuel_types ORDER BY nhom_nl, ten_loai').all();
exports.themNhienLieu = (data) => db.prepare('INSERT INTO fuel_types (ten_loai, don_vi, nhom_nl, ghi_chu) VALUES (@ten_loai, @don_vi, @nhom_nl, @ghi_chu)').run(data);
exports.xoaNhienLieu = (id) => db.prepare('DELETE FROM fuel_types WHERE id = ?').run(id);

// Nhiệm Vụ
exports.layDanhSachNhiemVu = () => db.prepare('SELECT * FROM missions ORDER BY ten_nhiem_vu').all();
exports.themNhiemVu = (ten) => db.prepare('INSERT INTO missions (ten_nhiem_vu) VALUES (?)').run(ten);
exports.xoaNhiemVu = (id) => db.prepare('DELETE FROM missions WHERE id = ?').run(id);

// Cơ Quan
exports.layDanhSachCoQuan = () => db.prepare('SELECT * FROM departments ORDER BY ten_co_quan').all();
exports.themCoQuan = (ten) => db.prepare('INSERT INTO departments (ten_co_quan) VALUES (?)').run(ten);
exports.xoaCoQuan = (id) => db.prepare('DELETE FROM departments WHERE id = ?').run(id);


// C. QUẢN LÝ XE
exports.layDanhSachXe = () => db.prepare('SELECT * FROM vehicles ORDER BY bien_so').all();
exports.themXe = (xe) => {
    const stmt = db.prepare(`
    INSERT INTO vehicles (bien_so, nhan_hieu, loai_phuong_tien, loai_dong_co, dinh_muc, so_khung, so_may, nam_san_xuat, odo_hien_tai, trang_thai)
    VALUES (@bien_so, @nhan_hieu, @loai_phuong_tien, @loai_dong_co, @dinh_muc, @so_khung, @so_may, @nam_san_xuat, @odo_hien_tai, @trang_thai)
  `);
    return stmt.run(xe);
};
exports.suaXe = (xe) => {
    const stmt = db.prepare(`
    UPDATE vehicles 
    SET bien_so=@bien_so, nhan_hieu=@nhan_hieu, loai_phuong_tien=@loai_phuong_tien, loai_dong_co=@loai_dong_co,
        dinh_muc=@dinh_muc, so_khung=@so_khung, so_may=@so_may, 
        nam_san_xuat=@nam_san_xuat, odo_hien_tai=@odo_hien_tai, trang_thai=@trang_thai
    WHERE id=@id
  `);
    return stmt.run(xe);
};
exports.xoaXe = (id) => db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
exports.layLichSuXe = (id) => {
    return db.prepare(`
        SELECT f.ngay_gio, d.ho_ten as lai_xe, f.odo_cu, f.odo_moi, f.quang_duong, 
               f.so_lit_cap, f.so_lit_mua, f.so_luong,
               ft.ten_loai as ten_nl, f.muc_dich
        FROM fuel_logs f
        JOIN drivers d ON f.tai_xe_id = d.id
        LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
        WHERE f.xe_id = ?
        ORDER BY f.ngay_gio DESC
    `).all(id);
};

// D. TÀI XẾ
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
    SELECT f.ngay_gio, v.bien_so, f.quang_duong, f.so_luong, f.so_lit_cap, f.so_lit_mua
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    WHERE f.tai_xe_id = ?
    ORDER BY f.ngay_gio DESC
  `).all(id);
};

// E. CẤP PHÁT & BÁO CÁO (V5.0)

exports.layThongKeDashboard = () => {
    const thangNay = new Date().toISOString().slice(0, 7);
    // Tổng lượng = Tổng so_luong (đã tính gộp khi insert)
    const tongLuong = db.prepare('SELECT SUM(so_luong) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const tongTien = db.prepare('SELECT SUM(thanh_tien) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const xeHoatDong = db.prepare("SELECT count(*) as count FROM vehicles WHERE trang_thai = 'Đang công tác'").get().count || 0;
    const tongKm = db.prepare("SELECT SUM(quang_duong) as total FROM fuel_logs WHERE ngay_gio LIKE ? AND muc_dich = 'CONG_TAC'").get(`${thangNay}%`).total || 0;

    return {
        tongLuong: tongLuong.toFixed(1),
        tongTien: tongTien.toFixed(0),
        xeHoatDong: xeHoatDong,
        tongKm: tongKm
    };
};

exports.layBaoCaoTuyChinh = (filter) => {
    let sql = `
        SELECT f.*, 
               v.bien_so, v.loai_phuong_tien, d.ho_ten as ten_tai_xe, d.cap_bac,
               ft.ten_loai, ft.don_vi,
               dep.ten_co_quan, m.ten_nhiem_vu,
               vm.bien_so as may_bien_so
        FROM fuel_logs f
        JOIN vehicles v ON f.xe_id = v.id
        JOIN drivers d ON f.tai_xe_id = d.id
        LEFT JOIN vehicles vm ON f.may_id = vm.id
        LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
        LEFT JOIN missions m ON f.nhiem_vu_id = m.id
        LEFT JOIN departments dep ON f.co_quan_id = dep.id
        WHERE 1=1
    `;
    const params = [];

    if (filter.startDate) {
        sql += ` AND f.ngay_gio >= ?`;
        params.push(filter.startDate + ' 00:00:00');
    }
    if (filter.endDate) {
        sql += ` AND f.ngay_gio <= ?`;
        params.push(filter.endDate + ' 23:59:59');
    }
    if (filter.vehicleId && filter.vehicleId !== 'all') {
        sql += ` AND f.xe_id = ?`;
        params.push(filter.vehicleId);
    }
    if (filter.keyword) {
        sql += ` AND (v.bien_so LIKE ? OR d.ho_ten LIKE ? OR f.so_phieu LIKE ? OR f.so_lenh LIKE ?)`;
        params.push(`%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`);
    }

    sql += ` ORDER BY f.ngay_gio DESC`;

    return db.prepare(sql).all(...params);
};

exports.capPhatNhienLieu = (data) => {
    const xe = db.prepare('SELECT odo_hien_tai, loai_phuong_tien FROM vehicles WHERE id = ?').get(data.xe_id);

    let odo_cu = xe.odo_hien_tai;
    let quang_duong = 0;
    let odo_save = data.odo_moi;

    if (data.muc_dich === 'MAY_PHAT' || xe.loai_phuong_tien === 'MAY_PHAT') {
        odo_cu = 0;
        odo_save = 0;
        quang_duong = 0;
    } else {
        quang_duong = data.odo_moi - xe.odo_hien_tai;
        if (quang_duong < 0) quang_duong = 0;
    }

    // Calculate fields
    // so_luong = tong cong (xe: cap + mua) + (may: cap + mua)
    const tong_so_luong = (data.so_lit_cap || 0) + (data.so_lit_mua || 0) + (data.may_lit_cap || 0) + (data.may_lit_mua || 0);

    // Thanh tien = Xe + May
    const tien_xe = ((data.so_lit_cap || 0) * (data.don_gia || 0)) + ((data.so_lit_mua || 0) * (data.don_gia_mua || 0));
    const tien_may = ((data.may_lit_cap || 0) * (data.may_gia_cap || 0)) + ((data.may_lit_mua || 0) * (data.may_gia_mua || 0));
    const thanh_tien = tien_xe + tien_may;

    // Insert đầy đủ trường V5.2
    const insert = db.prepare(`
    INSERT INTO fuel_logs (
        xe_id, tai_xe_id, loai_nhien_lieu_id, muc_dich, ngay_gio, 
        odo_cu, odo_moi, quang_duong, 
        so_luong, so_lit_cap, so_lit_mua, don_gia, don_gia_mua, 
        thanh_tien, nguoi_tao,
        nhom_c, so_phieu, ngay_phieu, so_lenh, ngay_lenh, co_quan_id, noi_dung, diem_den, 
        nhiem_vu_id, ngay_di, gio_di, ngay_ve, gio_ve,
        may_id, may_loai_nl_id, may_lit_cap, may_gia_cap, may_lit_mua, may_gia_mua
    )
    VALUES (
        @xe_id, @tai_xe_id, @loai_nhien_lieu_id, @muc_dich, @ngay_gio, 
        @odo_cu, @odo_moi, @quang_duong, 
        @so_luong, @so_lit_cap, @so_lit_mua, @don_gia, @don_gia_mua, 
        @thanh_tien, @nguoi_tao,
        @nhom_c, @so_phieu, @ngay_phieu, @so_lenh, @ngay_lenh, @co_quan_id, @noi_dung, @diem_den, 
        @nhiem_vu_id, @ngay_di, @gio_di, @ngay_ve, @gio_ve,
        @may_id, @may_loai_nl_id, @may_lit_cap, @may_gia_cap, @may_lit_mua, @may_gia_mua
    )
  `);

    const updateXe = db.prepare(`UPDATE vehicles SET odo_hien_tai = ?, trang_thai = 'Sẵn sàng' WHERE id = ?`);

    const transaction = db.transaction(() => {
        insert.run({
            ...data,
            odo_cu: odo_cu,
            odo_moi: odo_save,
            quang_duong: quang_duong,
            so_luong: tong_so_luong,
            thanh_tien: thanh_tien
        });

        if (data.muc_dich === 'CONG_TAC' && xe.loai_phuong_tien !== 'MAY_PHAT') {
            updateXe.run(data.odo_moi, data.xe_id);
        }
    });

    return transaction();
};
// Thêm hàm này vào database.js
exports.xoaNhatKy = (id) => {
    // Lưu ý: Nghiệp vụ thực tế có thể cần hoàn lại ODO cho xe, 
    // nhưng để đơn giản ta chỉ xóa log.
    return db.prepare('DELETE FROM fuel_logs WHERE id = ?').run(id);
};

exports.suaNhatKy = (data) => {
    // Câu lệnh cập nhật toàn bộ thông tin phiếu
    const stmt = db.prepare(`
        UPDATE fuel_logs
        SET so_phieu = @so_phieu,
            ngay_phieu = @ngay_phieu,
            so_lenh = @so_lenh,
            ngay_lenh = @ngay_lenh,
            nhom_c = @nhom_c,
            co_quan_id = @co_quan_id,
            nhiem_vu_id = @nhiem_vu_id,
            diem_den = @diem_den,
            noi_dung = @noi_dung,
            ngay_di = @ngay_di, gio_di = @gio_di,
            ngay_ve = @ngay_ve, gio_ve = @gio_ve,
            odo_cu = @odo_cu, odo_moi = @odo_moi, quang_duong = @quang_duong,
            so_lit_cap = @so_lit_cap, don_gia = @don_gia,
            so_lit_mua = @so_lit_mua, don_gia_mua = @don_gia_mua,
            may_lit_cap = @may_lit_cap, may_gia_cap = @may_gia_cap,
            may_lit_mua = @may_lit_mua, may_gia_mua = @may_gia_mua,
            thanh_tien = @thanh_tien
        WHERE id = @id
    `);
    return stmt.run(data);
};
exports.saoLuuTuDong = async () => {
    try {
        // 1. Xác định đường dẫn file DB hiện tại
        // db.name là thuộc tính của better-sqlite3 chứa đường dẫn tuyệt đối đến file DB
        const dbPath = db.name;
        const dbDir = path.dirname(dbPath);

        // 2. Tạo thư mục 'Backups' nếu chưa có
        const backupDir = path.join(dbDir, 'Backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        // 3. Tạo tên file backup theo tháng (VD: SQTT_Backup_2025_12.db)
        const date = new Date();
        const monthStr = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        const backupFileName = `SQTT_Backup_${monthStr}.db`;
        const backupPath = path.join(backupDir, backupFileName);

        // 4. Kiểm tra: Nếu tháng này chưa backup thì mới làm
        if (!fs.existsSync(backupPath)) {
            console.log("Đang tiến hành sao lưu dữ liệu tháng " + monthStr + "...");

            // Sử dụng hàm backup() native của better-sqlite3 (An toàn, không lo lỗi khi DB đang mở)
            await db.backup(backupPath);

            console.log("Sao lưu thành công tại:", backupPath);
            return { success: true, path: backupPath };
        } else {
            return { success: false, message: "Đã có bản sao lưu tháng này." };
        }

    } catch (err) {
        console.error("Lỗi sao lưu:", err);
        return { success: false, error: err.message };
    }
};
initDB();