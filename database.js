
const Database = require('better-sqlite3');
const crypto = require('crypto');

// Khởi tạo DB phiên bản SQTT 2025 v4.0 Hybrid
const db = new Database('sqtt_fuel_manager.db');

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

    // 3. Bảng Danh Mục Nhiệm Vụ (MỚI v4.0)
    db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_nhiem_vu TEXT UNIQUE NOT NULL
    )
  `);
    // Seed nhiệm vụ mẫu
    if (db.prepare('SELECT count(*) as count FROM missions').get().count === 0) {
        const insertM = db.prepare('INSERT INTO missions (ten_nhiem_vu) VALUES (?)');
        ['Sẵn sàng chiến đấu', 'Hành quân dã ngoại', 'Công tác thường xuyên', 'Vận chuyển hàng hóa', 'Đưa đón cán bộ', 'Trực ban'].forEach(n => insertM.run(n));
    }

    // 4. Bảng Danh Mục Cơ Quan
    db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ten_co_quan TEXT UNIQUE NOT NULL
    )
  `);

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

    // 7. Bảng Nhật Ký Cấp Phát (NÂNG CẤP v4.0 HYBRID)
    db.exec(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      -- Thông tin chung
      ngay_gio TEXT NOT NULL,
      so_phieu TEXT,
      ngay_phieu TEXT,
      so_lenh TEXT,
      ngay_lenh TEXT,
      
      -- Đối tượng
      xe_id INTEGER NOT NULL,
      tai_xe_id INTEGER NOT NULL,
      nhiem_vu_id INTEGER,           -- Mới v4.0
      thiet_bi_id INTEGER,           -- Mới v4.0 (ID của máy phát đi kèm nếu có)
      co_quan_id INTEGER,
      
      -- Hành trình
      diem_den TEXT,
      noi_dung TEXT,
      ngay_di TEXT, gio_di TEXT,
      ngay_ve TEXT, gio_ve TEXT,
      
      -- ODO Xe
      odo_cu INTEGER DEFAULT 0,
      odo_moi INTEGER DEFAULT 0,
      quang_duong INTEGER DEFAULT 0,
      
      -- CHI TIẾT NHIÊN LIỆU (TÁCH BIỆT XE & MÁY)
      loai_nhien_lieu_id INTEGER,
      
      -- Phần cho XE
      lit_xe_cap REAL DEFAULT 0,
      lit_xe_mua REAL DEFAULT 0,
      gia_xe_mua REAL DEFAULT 0,
      
      -- Phần cho MÁY (Thiết bị đi kèm)
      lit_may_cap REAL DEFAULT 0,
      lit_may_mua REAL DEFAULT 0,
      gia_may_mua REAL DEFAULT 0,
      
      -- Đơn giá chung tại kho (áp dụng cho cả xe và máy khi cấp kho)
      don_gia_kho REAL DEFAULT 0,

      -- Tổng hợp
      tong_lit_cap REAL DEFAULT 0,   -- lit_xe_cap + lit_may_cap
      tong_lit_mua REAL DEFAULT 0,   -- lit_xe_mua + lit_may_mua
      so_luong REAL DEFAULT 0,       -- Tổng tất cả lit
      thanh_tien REAL DEFAULT 0,     -- Tổng tiền cuối cùng

      nguoi_tao TEXT,
      ghi_chu TEXT,

      FOREIGN KEY(xe_id) REFERENCES vehicles(id),
      FOREIGN KEY(tai_xe_id) REFERENCES drivers(id),
      FOREIGN KEY(loai_nhien_lieu_id) REFERENCES fuel_types(id),
      FOREIGN KEY(nhiem_vu_id) REFERENCES missions(id),
      FOREIGN KEY(co_quan_id) REFERENCES departments(id)
    )
  `);

    // MIGRATION v4.0: Thêm các cột mới nếu chưa có
    const columnsV4 = [
        { col: 'nhiem_vu_id', type: 'INTEGER' },
        { col: 'thiet_bi_id', type: 'INTEGER' },
        { col: 'lit_xe_cap', type: 'REAL DEFAULT 0' },
        { col: 'lit_xe_mua', type: 'REAL DEFAULT 0' },
        { col: 'gia_xe_mua', type: 'REAL DEFAULT 0' },
        { col: 'lit_may_cap', type: 'REAL DEFAULT 0' },
        { col: 'lit_may_mua', type: 'REAL DEFAULT 0' },
        { col: 'gia_may_mua', type: 'REAL DEFAULT 0' },
        { col: 'don_gia_kho', type: 'REAL DEFAULT 0' },
        { col: 'tong_lit_cap', type: 'REAL DEFAULT 0' },
        { col: 'tong_lit_mua', type: 'REAL DEFAULT 0' }
    ];

    columnsV4.forEach(def => {
        try {
            db.prepare(`ALTER TABLE fuel_logs ADD COLUMN ${def.col} ${def.type}`).run();
        } catch (e) { } // Column exists
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

// B. DANH MỤC
exports.layDanhSachNhienLieu = () => db.prepare('SELECT * FROM fuel_types ORDER BY nhom_nl, ten_loai').all();
exports.themNhienLieu = (data) => db.prepare('INSERT INTO fuel_types (ten_loai, don_vi, nhom_nl, ghi_chu) VALUES (@ten_loai, @don_vi, @nhom_nl, @ghi_chu)').run(data);
exports.xoaNhienLieu = (id) => db.prepare('DELETE FROM fuel_types WHERE id = ?').run(id);

exports.layDanhSachNhiemVu = () => db.prepare('SELECT * FROM missions ORDER BY ten_nhiem_vu').all();
exports.themNhiemVu = (ten) => db.prepare('INSERT INTO missions (ten_nhiem_vu) VALUES (?)').run(ten);
exports.xoaNhiemVu = (id) => db.prepare('DELETE FROM missions WHERE id = ?').run(id);

exports.layDanhSachCoQuan = () => db.prepare('SELECT * FROM departments ORDER BY ten_co_quan').all();
exports.themCoQuan = (ten) => db.prepare('INSERT INTO departments (ten_co_quan) VALUES (?)').run(ten);
exports.xoaCoQuan = (id) => db.prepare('DELETE FROM departments WHERE id = ?').run(id);

// C. XE & TÀI XẾ
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
               f.so_luong, f.thanh_tien,
               ft.ten_loai as ten_nl, m.ten_nhiem_vu
        FROM fuel_logs f
        JOIN drivers d ON f.tai_xe_id = d.id
        LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
        LEFT JOIN missions m ON f.nhiem_vu_id = m.id
        WHERE f.xe_id = ?
        ORDER BY f.ngay_gio DESC
    `).all(id);
};

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
    SELECT f.ngay_gio, v.bien_so, f.quang_duong, f.so_luong
    FROM fuel_logs f
    JOIN vehicles v ON f.xe_id = v.id
    WHERE f.tai_xe_id = ?
    ORDER BY f.ngay_gio DESC
  `).all(id);
};

// D. NGHIỆP VỤ & BÁO CÁO (V4.0)

exports.layThongKeDashboard = () => {
    const thangNay = new Date().toISOString().slice(0, 7);
    const tongLuong = db.prepare('SELECT SUM(so_luong) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const tongTien = db.prepare('SELECT SUM(thanh_tien) as total FROM fuel_logs WHERE ngay_gio LIKE ?').get(`${thangNay}%`).total || 0;
    const xeHoatDong = db.prepare("SELECT count(*) as count FROM vehicles WHERE trang_thai = 'Đang công tác'").get().count || 0;
    const tongKm = db.prepare("SELECT SUM(quang_duong) as total FROM fuel_logs WHERE ngay_gio LIKE ?").get(`${thangNay}%`).total || 0;

    return {
        tongLuong: tongLuong.toFixed(1),
        tongTien: tongTien.toFixed(0),
        xeHoatDong: xeHoatDong,
        tongKm: tongKm
    };
};

exports.layBaoCaoTuyChinh = (filter) => {
    let sql = `
        SELECT f.id, f.ngay_gio, v.bien_so, d.ho_ten as ten_tai_xe,
               f.so_phieu, f.so_lenh, m.ten_nhiem_vu,
               f.odo_cu, f.odo_moi, f.quang_duong, 
               
               -- Hiển thị chi tiết
               f.lit_xe_cap, f.lit_xe_mua,
               f.lit_may_cap, f.lit_may_mua,
               f.tong_lit_cap, f.tong_lit_mua, f.so_luong as tong_cong_lit,
               
               f.thanh_tien,
               ft.ten_loai as ten_nl, v_may.bien_so as ten_may
        FROM fuel_logs f
        JOIN vehicles v ON f.xe_id = v.id
        JOIN drivers d ON f.tai_xe_id = d.id
        LEFT JOIN fuel_types ft ON f.loai_nhien_lieu_id = ft.id
        LEFT JOIN missions m ON f.nhiem_vu_id = m.id
        LEFT JOIN vehicles v_may ON f.thiet_bi_id = v_may.id
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
    const xe = db.prepare('SELECT odo_hien_tai FROM vehicles WHERE id = ?').get(data.xe_id);

    // Tính ODO
    let odo_cu = xe.odo_hien_tai;
    let odo_moi = data.odo_moi;
    let quang_duong = odo_moi - odo_cu;
    if (quang_duong < 0) quang_duong = 0;

    // Tính tổng hợp
    const tong_lit_cap = (data.lit_xe_cap || 0) + (data.lit_may_cap || 0);
    const tong_lit_mua = (data.lit_xe_mua || 0) + (data.lit_may_mua || 0);
    const so_luong = tong_lit_cap + tong_lit_mua;

    // Tính thành tiền (Server re-calculation for security)
    // Xe Cost = (XeCap * GiaKho) + (XeMua * GiaXeMua)
    // May Cost = (MayCap * GiaKho) + (MayMua * GiaMayMua)
    const cost_xe = ((data.lit_xe_cap || 0) * (data.don_gia_kho || 0)) + ((data.lit_xe_mua || 0) * (data.gia_xe_mua || 0));
    const cost_may = ((data.lit_may_cap || 0) * (data.don_gia_kho || 0)) + ((data.lit_may_mua || 0) * (data.gia_may_mua || 0));
    const thanh_tien = cost_xe + cost_may;

    const insert = db.prepare(`
    INSERT INTO fuel_logs (
        xe_id, tai_xe_id, loai_nhien_lieu_id, nhiem_vu_id, thiet_bi_id, co_quan_id,
        ngay_gio, so_phieu, ngay_phieu, so_lenh, ngay_lenh,
        diem_den, noi_dung, ngay_di, gio_di, ngay_ve, gio_ve,
        odo_cu, odo_moi, quang_duong,
        
        lit_xe_cap, lit_xe_mua, gia_xe_mua,
        lit_may_cap, lit_may_mua, gia_may_mua,
        don_gia_kho,
        tong_lit_cap, tong_lit_mua, so_luong, thanh_tien,
        
        nguoi_tao
    )
    VALUES (
        @xe_id, @tai_xe_id, @loai_nhien_lieu_id, @nhiem_vu_id, @thiet_bi_id, @co_quan_id,
        @ngay_gio, @so_phieu, @ngay_phieu, @so_lenh, @ngay_lenh,
        @diem_den, @noi_dung, @ngay_di, @gio_di, @ngay_ve, @gio_ve,
        @odo_cu, @odo_moi, @quang_duong,
        
        @lit_xe_cap, @lit_xe_mua, @gia_xe_mua,
        @lit_may_cap, @lit_may_mua, @gia_may_mua,
        @don_gia_kho,
        @tong_lit_cap, @tong_lit_mua, @so_luong, @thanh_tien,
        
        @nguoi_tao
    )
  `);

    const updateXe = db.prepare(`UPDATE vehicles SET odo_hien_tai = ?, trang_thai = 'Sẵn sàng' WHERE id = ?`);

    const transaction = db.transaction(() => {
        insert.run({
            ...data,
            odo_cu: odo_cu,
            quang_duong: quang_duong,
            tong_lit_cap: tong_lit_cap,
            tong_lit_mua: tong_lit_mua,
            so_luong: so_luong,
            thanh_tien: thanh_tien
        });

        updateXe.run(odo_moi, data.xe_id);
    });

    return transaction();
};

initDB();
