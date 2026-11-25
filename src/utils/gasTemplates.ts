export interface GasFileTemplate {
  filename: string;
  gasType: string;
  description: string;
  content: string;
}

export const GAS_CODE_GS = `/**
 * ============================================================================
 * APLIKASI ABSENSI SECURITY AL-MUHAJIRIN (BACKEND - GOOGLE APPS SCRIPT)
 * Database: Google Spreadsheet (Otomatis membuat sheet USERS, ANGGOTA, ABSENSI, PENGATURAN)
 * ============================================================================
 */

var SHEET_USERS = 'USERS';
var SHEET_ANGGOTA = 'ANGGOTA';
var SHEET_ABSENSI = 'ABSENSI';
var SHEET_PENGATURAN = 'PENGATURAN';
var DEFAULT_SPREADSHEET_ID = '1Mq02iNPyZcvIY3cfhAVfWOe-CPDVxu3qNtGfJBJ1Y1k';
var CACHE_TTL = 180; // 3 menit

function doGet() {
  ensureDatabaseInitialized_();
  var template = HtmlService.createTemplateFromFile('Index');
  return template
    .evaluate()
    .setTitle('Absensi Security Al-Muhajirin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================================
 * 1. INISIALISASI DATABASE GOOGLE SPREADSHEET OTOMATIS
 * ============================================================================ */
function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var props = PropertiesService.getScriptProperties();
    var savedId = props.getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
    if (savedId) {
      ss = SpreadsheetApp.openById(savedId);
    } else {
      ss = SpreadsheetApp.create('Database Absensi Security Al-Muhajirin');
      props.setProperty('SPREADSHEET_ID', ss.getId());
    }
  }
  return ss;
}

function ensureDatabaseInitialized_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getSpreadsheet_();
    var now = new Date().toISOString();

    // 1. Sheet USERS
    var usersSheet = ss.getSheetByName(SHEET_USERS);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(SHEET_USERS);
      usersSheet.appendRow(['id_user', 'username', 'password_hash', 'role', 'nama_lengkap', 'updated_at']);
      usersSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#0B2B52').setFontColor('#FFFFFF');
      usersSheet.setFrozenRows(1);
    }

    // 2. Sheet ANGGOTA + 5 Anggota Awal
    var anggotaSheet = ss.getSheetByName(SHEET_ANGGOTA);
    if (!anggotaSheet) {
      anggotaSheet = ss.insertSheet(SHEET_ANGGOTA);
      anggotaSheet.appendRow(['id_anggota', 'nama', 'status_aktif', 'created_at', 'updated_at']);
      anggotaSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0B2B52').setFontColor('#FFFFFF');
      anggotaSheet.setFrozenRows(1);

      var initialMembers = ['Sutrio', 'Fathur', 'Fikri', 'Idris', 'Rizki'];
      for (var i = 0; i < initialMembers.length; i++) {
        anggotaSheet.appendRow([
          'ANG-' + ('00' + (i + 1)).slice(-3),
          initialMembers[i],
          true,
          now,
          now
        ]);
      }
    }

    // 3. Sheet ABSENSI
    var absensiSheet = ss.getSheetByName(SHEET_ABSENSI);
    if (!absensiSheet) {
      absensiSheet = ss.insertSheet(SHEET_ABSENSI);
      absensiSheet.appendRow([
        'id_absensi', 'tanggal', 'id_anggota', 'nama_anggota',
        'status_h', 'status_b', 'status_i', 'status_s', 'status_a', 'status_l',
        'waktu_input', 'waktu_perubahan'
      ]);
      absensiSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#0B2B52').setFontColor('#FFFFFF');
      absensiSheet.setFrozenRows(1);
    }

    // 4. Sheet PENGATURAN
    var setSheet = ss.getSheetByName(SHEET_PENGATURAN);
    if (!setSheet) {
      setSheet = ss.insertSheet(SHEET_PENGATURAN);
      setSheet.appendRow(['kunci', 'nilai', 'updated_at']);
      setSheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#0B2B52').setFontColor('#FFFFFF');
      setSheet.setFrozenRows(1);

      var defaults = [
        ['namaInstansi', 'Pondok Pesantren Al-Muhajirin', now],
        ['namaUnit', 'Divisi Keamanan / Security Al-Muhajirin', now],
        ['namaPetugas', 'Koordinator Security', now],
        ['jabatanPetugas', 'Petugas / Koordinator Security', now],
        ['namaPimpinan', 'Pimpinan Pondok Pesantren', now],
        ['jabatanPimpinan', 'Pimpinan Al-Muhajirin', now]
      ];
      setSheet.getRange(2, 1, defaults.length, 3).setValues(defaults);
    }

    // Hapus Sheet1 bawaan jika masih kosong
    var defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
      ss.deleteSheet(defaultSheet);
    }
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================================
 * 2. KEAMANAN & AUTENTIKASI ADMIN (HASH SHA-256 + SALT + TOKEN CACHE)
 * ============================================================================ */
function hashWithSalt_(password, salt) {
  var raw = salt + ':' + password;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = digest.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  return salt + ':' + hex;
}

function verifyPassword_(password, storedHash) {
  var parts = String(storedHash || '').split(':');
  if (parts.length !== 2) return false;
  return hashWithSalt_(password, parts[0]) === storedHash;
}

function getAuthStatus() {
  ensureDatabaseInitialized_();
  var ss = getSpreadsheet_();
  var usersSheet = ss.getSheetByName(SHEET_USERS);
  var setupRequired = usersSheet.getLastRow() <= 1;
  return { setupRequired: setupRequired };
}

function setupFirstAdmin(username, password, namaLengkap) {
  ensureDatabaseInitialized_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_USERS);
    if (sheet.getLastRow() > 1) {
      throw new Error('Akun admin sudah terdaftar.');
    }
    username = String(username || '').trim().toLowerCase();
    if (username.length < 3) throw new Error('Username minimal 3 karakter.');
    if (String(password || '').length < 6) throw new Error('Password minimal 6 karakter.');

    var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    var hash = hashWithSalt_(password, salt);
    var idUser = 'USR-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    var now = new Date().toISOString();
    var fullName = String(namaLengkap || 'Admin Security Al-Muhajirin').trim();

    sheet.appendRow([idUser, username, hash, 'ADMIN', fullName, now]);
    return issueToken_(idUser, username, fullName);
  } finally {
    lock.releaseLock();
  }
}

function loginAdmin(username, password) {
  ensureDatabaseInitialized_();
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_USERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('Belum ada akun admin. Silakan lakukan aktivasi awal.');

  var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var cleanUser = String(username || '').trim().toLowerCase();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === cleanUser) {
      if (verifyPassword_(String(password || ''), String(rows[i][2]))) {
        return issueToken_(rows[i][0], rows[i][1], rows[i][4]);
      }
      break;
    }
  }
  throw new Error('Username atau password tidak sesuai.');
}

function issueToken_(idUser, username, namaLengkap) {
  var token = Utilities.getUuid() + '-' + Utilities.getUuid();
  var sessionObj = { idUser: idUser, username: username, namaLengkap: namaLengkap };
  CacheService.getScriptCache().put('SES_' + token, JSON.stringify(sessionObj), 21600); // 6 jam
  return { token: token, username: username, namaLengkap: namaLengkap };
}

function requireSession_(token) {
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  var raw = CacheService.getScriptCache().get('SES_' + token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}

function logoutAdmin(token) {
  if (token) CacheService.getScriptCache().remove('SES_' + token);
  return { success: true };
}

function changeAdminPassword(token, currentPassword, newPassword) {
  var session = requireSession_(token);
  if (String(newPassword || '').length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_USERS);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === session.idUser) {
      if (!verifyPassword_(currentPassword, rows[i][2])) {
        throw new Error('Password saat ini tidak sesuai.');
      }
      var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
      var newHash = hashWithSalt_(newPassword, salt);
      sheet.getRange(i + 2, 3).setValue(newHash);
      sheet.getRange(i + 2, 6).setValue(new Date().toISOString());
      return { success: true };
    }
  }
  throw new Error('Akun tidak ditemukan.');
}

/* ============================================================================
 * 3. UTILITAS PERIODE (26 S.D. 25 BULAN BERIKUTNYA)
 * ============================================================================ */
function getTodayDateStr_() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

function getPeriodKeyFromDate_(dateStr) {
  var parts = dateStr.split('-');
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);
  if (d >= 26) {
    var nm = m === 12 ? 1 : m + 1;
    var ny = m === 12 ? y + 1 : y;
    return ny + '-' + ('0' + nm).slice(-2);
  }
  return y + '-' + ('0' + m).slice(-2);
}

function buildPeriodInfo_(periodKey) {
  var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  var parts = periodKey.split('-');
  var endYear = Number(parts[0]);
  var endMonth = Number(parts[1]);
  var startMonth = endMonth === 1 ? 12 : endMonth - 1;
  var startYear = endMonth === 1 ? endYear - 1 : endYear;

  var startDate = startYear + '-' + ('0' + startMonth).slice(-2) + '-26';
  var endDate = endYear + '-' + ('0' + endMonth).slice(-2) + '-25';
  var label = '26 ' + BULAN[startMonth - 1] + ' ' + startYear + ' – 25 ' + BULAN[endMonth - 1] + ' ' + endYear;

  var dates = [];
  var cursor = Date.UTC(startYear, startMonth - 1, 26);
  var endMs = Date.UTC(endYear, endMonth - 1, 25);
  while (cursor <= endMs) {
    var dt = new Date(cursor);
    var yr = dt.getUTCFullYear();
    var mo = dt.getUTCMonth() + 1;
    var dy = dt.getUTCDate();
    dates.push({
      date: yr + '-' + ('0' + mo).slice(-2) + '-' + ('0' + dy).slice(-2),
      day: dy,
      dayName: HARI[dt.getUTCDay()]
    });
    cursor += 86400000;
  }

  return { periodKey: periodKey, startDate: startDate, endDate: endDate, label: label, dates: dates };
}

/* ============================================================================
 * 4. MANAJEMEN ANGGOTA, ABSENSI, REKAP, & RIWAYAT
 * ============================================================================ */
function getAnggotaList_(useCache) {
  var cache = CacheService.getScriptCache();
  if (useCache) {
    var cached = cache.get('ANGGOTA_LIST');
    if (cached) return JSON.parse(cached);
  }
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_ANGGOTA);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var list = rows.map(function(r) {
    return {
      idAnggota: String(r[0]),
      nama: String(r[1]),
      statusAktif: r[2] === true || r[2] === 'TRUE',
      createdAt: String(r[3]),
      updatedAt: String(r[4])
    };
  });
  cache.put('ANGGOTA_LIST', JSON.stringify(list), CACHE_TTL);
  return list;
}

function getAllAbsensi_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_ABSENSI);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  return rows.map(function(r) {
    var tgl = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Jakarta', 'yyyy-MM-dd') : String(r[1]);
    return {
      idAbsensi: String(r[0]),
      tanggal: tgl,
      idAnggota: String(r[2]),
      namaAnggota: String(r[3]),
      statusH: r[4] === true || r[4] === 1 || r[4] === 'TRUE',
      statusB: r[5] === true || r[5] === 1 || r[5] === 'TRUE',
      statusI: r[6] === true || r[6] === 1 || r[6] === 'TRUE',
      statusS: r[7] === true || r[7] === 1 || r[7] === 'TRUE',
      statusA: r[8] === true || r[8] === 1 || r[8] === 'TRUE',
      statusL: r[9] === true || r[9] === 1 || r[9] === 'TRUE',
      waktuInput: String(r[10]),
      waktuPerubahan: String(r[11])
    };
  });
}

function getAnggota(token) {
  requireSession_(token);
  return { anggota: getAnggotaList_(true) };
}

function createAnggota(token, nama) {
  requireSession_(token);
  nama = String(nama || '').trim();
  if (nama.length < 2) throw new Error('Nama anggota minimal 2 karakter.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var list = getAnggotaList_(false);
    for (var i = 0; i < list.length; i++) {
      if (list[i].nama.toLowerCase() === nama.toLowerCase()) {
        throw new Error('Nama anggota sudah terdaftar.');
      }
    }
    var now = new Date().toISOString();
    var id = 'ANG-' + Utilities.getUuid().slice(0, 8).toUpperCase();
    getSpreadsheet_().getSheetByName(SHEET_ANGGOTA).appendRow([id, nama, true, now, now]);
    CacheService.getScriptCache().remove('ANGGOTA_LIST');
    return { idAnggota: id, nama: nama, statusAktif: true };
  } finally {
    lock.releaseLock();
  }
}

function updateAnggotaNama(token, idAnggota, nama) {
  requireSession_(token);
  nama = String(nama || '').trim();
  if (nama.length < 2) throw new Error('Nama anggota minimal 2 karakter.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_ANGGOTA);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === idAnggota) {
        sheet.getRange(i + 2, 2).setValue(nama);
        sheet.getRange(i + 2, 5).setValue(new Date().toISOString());
        CacheService.getScriptCache().remove('ANGGOTA_LIST');
        return { success: true };
      }
    }
    throw new Error('Anggota tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function setAnggotaStatus(token, idAnggota, statusAktif) {
  requireSession_(token);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(SHEET_ANGGOTA);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === idAnggota) {
        sheet.getRange(i + 2, 3).setValue(Boolean(statusAktif));
        sheet.getRange(i + 2, 5).setValue(new Date().toISOString());
        CacheService.getScriptCache().remove('ANGGOTA_LIST');
        return { success: true };
      }
    }
    throw new Error('Anggota tidak ditemukan.');
  } finally {
    lock.releaseLock();
  }
}

function getAbsensiByDate(token, tanggal) {
  requireSession_(token);
  var tgl = tanggal || getTodayDateStr_();
  var anggota = getAnggotaList_(true).filter(function(a) { return a.statusAktif; });
  var records = getAllAbsensi_().filter(function(r) { return r.tanggal === tgl; });
  var period = buildPeriodInfo_(getPeriodKeyFromDate_(tgl));
  return { tanggal: tgl, period: period, activeMembers: anggota, records: records };
}

function saveAbsensiBatch(token, tanggal, entries) {
  requireSession_(token);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(tanggal || ''))) {
    throw new Error('Format tanggal tidak valid.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_ABSENSI);
    var anggotaList = getAnggotaList_(false);
    var memberMap = {};
    anggotaList.forEach(function(m) { memberMap[m.idAnggota] = m; });

    var lastRow = sheet.getLastRow();
    var existingMap = {};
    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
      for (var r = 0; r < data.length; r++) {
        var rowTgl = data[r][1] instanceof Date ? Utilities.formatDate(data[r][1], 'Asia/Jakarta', 'yyyy-MM-dd') : String(data[r][1]);
        if (rowTgl === tanggal) {
          existingMap[String(data[r][2])] = r + 2;
        }
      }
    }

    var now = new Date().toISOString();
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var m = memberMap[e.idAnggota];
      if (!m) continue;

      var h = Boolean(e.statusH);
      var b = Boolean(e.statusB);
      var iz = !h && !b && Boolean(e.statusI);
      var sk = !h && !b && !iz && Boolean(e.statusS);
      var al = !h && !b && !iz && !sk && Boolean(e.statusA);
      var lb = !h && !b && !iz && !sk && !al && Boolean(e.statusL);

      if (!h && !b && !iz && !sk && !al && !lb) continue;

      var rowNum = existingMap[m.idAnggota];
      if (rowNum) {
        sheet.getRange(rowNum, 4, 1, 9).setValues([[m.nama, h, b, iz, sk, al, lb, sheet.getRange(rowNum, 11).getValue(), now]]);
      } else {
        var idAbs = 'ABS-' + Utilities.getUuid().slice(0, 8).toUpperCase();
        sheet.appendRow([idAbs, tanggal, m.idAnggota, m.nama, h, b, iz, sk, al, lb, now, now]);
      }
    }
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function getRecapData(token, periodKey) {
  requireSession_(token);
  var key = periodKey || getPeriodKeyFromDate_(getTodayDateStr_());
  var period = buildPeriodInfo_(key);
  var allMembers = getAnggotaList_(true);
  var allAbs = getAllAbsensi_().filter(function(r) {
    return r.tanggal >= period.startDate && r.tanggal <= period.endDate;
  });

  var map = {};
  var hasRecord = {};
  allAbs.forEach(function(r) {
    map[r.idAnggota + '__' + r.tanggal] = r;
    hasRecord[r.idAnggota] = true;
  });

  var relevant = allMembers.filter(function(m) { return m.statusAktif || hasRecord[m.idAnggota]; });
  var summary = { totalH: 0, totalB: 0, totalI: 0, totalS: 0, totalA: 0, totalL: 0, totalKehadiran: 0 };

  var rows = relevant.map(function(m) {
    var daily = {};
    var tH = 0, tB = 0, tI = 0, tS = 0, tA = 0, tL = 0;
    period.dates.forEach(function(d) {
      var rec = map[m.idAnggota + '__' + d.date] || null;
      var code = '-';
      if (rec) {
        if (rec.statusH && rec.statusB) code = 'H+B';
        else if (rec.statusH) code = 'H';
        else if (rec.statusB) code = 'B';
        else if (rec.statusI) code = 'I';
        else if (rec.statusS) code = 'S';
        else if (rec.statusA) code = 'A';
        else if (rec.statusL) code = 'L';
        if (rec.statusH) tH++;
        if (rec.statusB) tB++;
        if (rec.statusI) tI++;
        if (rec.statusS) tS++;
        if (rec.statusA) tA++;
        if (rec.statusL) tL++;
      }
      daily[d.date] = { code: code };
    });
    var total = tH + tB;
    summary.totalH += tH; summary.totalB += tB; summary.totalI += tI;
    summary.totalS += tS; summary.totalA += tA; summary.totalL += tL;
    summary.totalKehadiran += total;
    return {
      idAnggota: m.idAnggota, nama: m.nama, statusAktif: m.statusAktif,
      daily: daily, totalH: tH, totalB: tB, totalI: tI, totalS: tS, totalA: tA, totalL: tL, totalKehadiran: total
    };
  });

  return { period: period, rows: rows, summary: summary };
}

function getDashboardData(token) {
  requireSession_(token);
  var today = getTodayDateStr_();
  var anggota = getAnggotaList_(true);
  var activeMembers = anggota.filter(function(a) { return a.statusAktif; });
  var todayRecs = getAllAbsensi_().filter(function(r) { return r.tanggal === today; });
  var h = 0, b = 0, i = 0, s = 0, a = 0, l = 0;
  todayRecs.forEach(function(r) {
    if (r.statusH) h++;
    if (r.statusB) b++;
    if (r.statusI) i++;
    if (r.statusS) s++;
    if (r.statusA) a++;
    if (r.statusL) l++;
  });
  var recap = getRecapData(token, getPeriodKeyFromDate_(today));
  return {
    today: today,
    totalAnggotaAktif: activeMembers.length,
    hadirHariIni: h, badalHariIni: b, izinHariIni: i, sakitHariIni: s, alpaHariIni: a, liburHariIni: l,
    recap: recap
  };
}

function getPengaturan(token) {
  requireSession_(token);
  var sheet = getSpreadsheet_().getSheetByName(SHEET_PENGATURAN);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  var obj = {};
  rows.forEach(function(r) { obj[String(r[0])] = String(r[1]); });
  return obj;
}

function savePengaturan(token, data) {
  requireSession_(token);
  var sheet = getSpreadsheet_().getSheetByName(SHEET_PENGATURAN);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  var now = new Date().toISOString();
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0]);
    if (data[key] !== undefined) {
      sheet.getRange(i + 2, 2).setValue(String(data[key]).trim());
      sheet.getRange(i + 2, 3).setValue(now);
    }
  }
  return getPengaturan(token);
}

/* ============================================================================
 * 5. EKSPOR LAPORAN EXCEL (.xlsx) & PDF (.pdf) NATIVE DARI GOOGLE SPREADSHEET
 * ============================================================================ */
function exportLaporanBase64(token, periodKey, formatType) {
  requireSession_(token);
  var recap = getRecapData(token, periodKey);
  var cfg = getPengaturan(token);
  var tempSs = SpreadsheetApp.create('TMP_REKAP_' + recap.period.periodKey);
  try {
    var sh = tempSs.getSheets()[0];
    sh.setName('Rekap Absensi');
    var dateCount = recap.period.dates.length;
    var totalCols = 2 + dateCount + 7;
    var printDate = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy');

    sh.getRange(1, 1, 1, totalCols).merge().setValue('REKAP ABSENSI SECURITY AL-MUHAJIRIN')
      .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setFontColor('#0B2B52');
    sh.getRange(2, 1, 1, totalCols).merge().setValue((cfg.namaInstansi || '') + ' — ' + (cfg.namaUnit || ''))
      .setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(3, 1, 1, totalCols).merge().setValue('Periode: ' + recap.period.label + ' | Tanggal Pembuatan: ' + printDate)
      .setFontSize(9).setFontStyle('italic').setHorizontalAlignment('center');

    var headers = ['No', 'Nama Anggota'];
    recap.period.dates.forEach(function(d) { headers.push(d.day); });
    headers = headers.concat(['H', 'B', 'I', 'S', 'A', 'L', 'Total']);

    sh.getRange(5, 1, 1, totalCols).setValues([headers])
      .setBackground('#0B2B52').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');

    var matrix = [];
    recap.rows.forEach(function(m, idx) {
      var row = [idx + 1, m.statusAktif ? m.nama : m.nama + ' (Nonaktif)'];
      recap.period.dates.forEach(function(d) { row.push(m.daily[d.date].code); });
      row.push(m.totalH, m.totalB, m.totalI, m.totalS, m.totalA, m.totalL, m.totalKehadiran);
      matrix.push(row);
    });
    if (matrix.length > 0) {
      sh.getRange(6, 1, matrix.length, totalCols).setValues(matrix).setHorizontalAlignment('center');
      sh.getRange(6, 2, matrix.length, 1).setHorizontalAlignment('left').setFontWeight('bold');
      sh.getRange(5, 1, matrix.length + 1, totalCols).setBorder(true, true, true, true, true, true, '#94A3B8', SpreadsheetApp.BorderStyle.SOLID);
    }

    var sigRow = 7 + matrix.length;
    sh.getRange(sigRow, 2, 1, 6).merge().setValue('Mengetahui,\\n' + (cfg.jabatanPimpinan || 'Pimpinan')).setHorizontalAlignment('center');
    sh.getRange(sigRow + 4, 2, 1, 6).merge().setValue('( ' + (cfg.namaPimpinan || 'Pimpinan') + ' )').setHorizontalAlignment('center').setFontWeight('bold');
    sh.getRange(sigRow, totalCols - 6, 1, 7).merge().setValue('Dibuat pada ' + printDate + '\\n' + (cfg.jabatanPetugas || 'Petugas')).setHorizontalAlignment('center');
    sh.getRange(sigRow + 4, totalCols - 6, 1, 7).merge().setValue('( ' + (cfg.namaPetugas || 'Petugas') + ' )').setHorizontalAlignment('center').setFontWeight('bold');

    sh.setColumnWidth(1, 32);
    sh.setColumnWidth(2, 150);
    for (var c = 3; c <= totalCols; c++) sh.setColumnWidth(c, 34);
    SpreadsheetApp.flush();

    var url = formatType === 'xlsx'
      ? 'https://docs.google.com/spreadsheets/d/' + tempSs.getId() + '/export?format=xlsx'
      : 'https://docs.google.com/spreadsheets/d/' + tempSs.getId() + '/export?format=pdf&size=a4&portrait=false&fitw=true&gridlines=false';

    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    var blob = resp.getBlob();
    return {
      filename: 'Rekap_Absensi_Security_AlMuhajirin_' + recap.period.periodKey + '.' + formatType,
      mimeType: formatType === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } finally {
    DriveApp.getFileById(tempSs.getId()).setTrashed(true);
  }
}
`;

export const GAS_INDEX_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Absensi Security Al-Muhajirin</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <?!= include('Styles'); ?>
</head>
<body class="ocean-canvas">
  <div id="app">
    <div id="auth-screen" class="auth-wrap">
      <div class="glass-card auth-card">
        <div class="brand-head">
          <div class="shield-box">AM</div>
          <h1>Absensi Security Al-Muhajirin</h1>
          <p>Pondok Pesantren Al-Muhajirin · Administrasi Kehadiran</p>
        </div>
        <div id="auth-alert" class="alert hidden"></div>
        <form id="auth-form">
          <label>Username Admin</label>
          <input type="text" id="auth-username" placeholder="admin" required />
          <label>Password</label>
          <input type="password" id="auth-password" placeholder="Minimal 6 karakter" required />
          <div id="auth-confirm-wrap" class="hidden">
            <label>Nama Lengkap Admin</label>
            <input type="text" id="auth-fullname" placeholder="Admin Security Al-Muhajirin" />
          </div>
          <button type="submit" id="auth-submit" class="btn-primary">Masuk</button>
        </form>
      </div>
    </div>

    <div id="main-shell" class="shell hidden">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="shield-box">AM</div>
          <div>
            <strong>Security Al-Muhajirin</strong>
            <small>Admin Panel</small>
          </div>
        </div>
        <nav class="nav-list">
          <button class="nav-btn active" data-page="dashboard">Dashboard</button>
          <button class="nav-btn" data-page="input">Input Absensi</button>
          <button class="nav-btn" data-page="rekap">Rekap Absensi</button>
          <button class="nav-btn" data-page="anggota">Data Anggota</button>
          <button class="nav-btn" data-page="pengaturan">Pengaturan</button>
        </nav>
        <button id="btn-logout" class="btn-logout">Keluar</button>
      </aside>
      <main class="content-area">
        <div id="page-container"></div>
      </main>
    </div>
  </div>
  <div id="loading-overlay" class="loading-overlay hidden">
    <div class="glass-card loading-box">Memproses data...</div>
  </div>
  <?!= include('Script'); ?>
</body>
</html>`;

export const GAS_STYLES_HTML = `<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Plus Jakarta Sans', sans-serif;
    min-height: 100vh;
    color: #0f172a;
  }
  .ocean-canvas {
    background:
      radial-gradient(circle at 15% 10%, rgba(56,189,248,0.25), transparent 50%),
      linear-gradient(135deg, #041226 0%, #09274c 45%, #0e3d73 100%);
  }
  .glass-card {
    background: rgba(248, 250, 252, 0.9);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 16px;
    box-shadow: 0 12px 36px rgba(4, 18, 38, 0.24);
  }
  .hidden { display: none !important; }
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .auth-card { width: 100%; max-width: 420px; padding: 28px; }
  .brand-head { text-align: center; margin-bottom: 20px; }
  .brand-head h1 { font-size: 20px; margin-top: 10px; color: #0B2B52; }
  .brand-head p { font-size: 13px; color: #475569; margin-top: 4px; }
  .shield-box {
    width: 44px; height: 44px; border-radius: 12px; margin: 0 auto;
    background: linear-gradient(135deg, #0B2B52, #1565C0); color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 700;
  }
  label { display: block; font-size: 13px; font-weight: 600; color: #1e293b; margin: 12px 0 6px; }
  input, select {
    width: 100%; padding: 10px 12px; border-radius: 10px;
    border: 1px solid #cbd5e1; background: #fff; font-size: 14px;
  }
  .btn-primary {
    margin-top: 16px; width: 100%; padding: 11px 16px; border: none; border-radius: 10px;
    background: linear-gradient(135deg, #0B2B52, #1565C0); color: #fff; font-weight: 600; cursor: pointer;
  }
  .shell { display: flex; min-height: 100vh; }
  .sidebar {
    width: 240px; padding: 20px; color: #f8fafc;
    background: rgba(6, 24, 48, 0.78); backdrop-filter: blur(22px);
    border-right: 1px solid rgba(255,255,255,0.16);
    display: flex; flex-direction: column; gap: 16px;
  }
  .sidebar-brand { display: flex; align-items: center; gap: 10px; }
  .sidebar-brand .shield-box { margin: 0; width: 38px; height: 38px; }
  .sidebar-brand small { display: block; color: #94a3b8; font-size: 12px; }
  .nav-list { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .nav-btn {
    text-align: left; padding: 10px 14px; border-radius: 10px; border: none;
    background: transparent; color: #cbd5e1; font-weight: 500; cursor: pointer;
  }
  .nav-btn.active, .nav-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
  .btn-logout {
    padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2);
    background: transparent; color: #fca5a5; cursor: pointer; font-weight: 600;
  }
  .content-area { flex: 1; padding: 24px; overflow-x: auto; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .kpi-card { padding: 16px; }
  .kpi-card small { color: #475569; font-size: 12px; }
  .kpi-card strong { display: block; font-size: 26px; font-family: 'JetBrains Mono', monospace; color: #0B2B52; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
  th { background: #0B2B52; color: #fff; }
  .alert { padding: 10px 12px; border-radius: 10px; background: #fee2e2; color: #991b1b; font-size: 13px; margin-bottom: 10px; }
  .loading-overlay {
    position: fixed; inset: 0; background: rgba(4,18,38,0.55);
    display: flex; align-items: center; justify-content: center; z-index: 999;
  }
  .loading-box { padding: 18px 28px; font-weight: 600; color: #0B2B52; }
  @media (max-width: 768px) {
    .shell { flex-direction: column; }
    .sidebar { width: 100%; }
    .nav-list { flex-direction: row; overflow-x: auto; }
  }
</style>`;

export const GAS_SCRIPT_HTML = `<script>
  var state = { token: null, setupRequired: false, currentPage: 'dashboard', periodKey: '' };

  function setLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
  }
  function showAuthAlert(msg) {
    var el = document.getElementById('auth-alert');
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function runGas(fn, args, onSuccess) {
    setLoading(true);
    google.script.run
      .withSuccessHandler(function(res) { setLoading(false); onSuccess(res); })
      .withFailureHandler(function(err) {
        setLoading(false);
        if (!state.token) showAuthAlert(err.message);
        else alert(err.message);
      })[fn].apply(null, args);
  }

  document.addEventListener('DOMContentLoaded', function() {
    runGas('getAuthStatus', [], function(res) {
      state.setupRequired = res.setupRequired;
      document.getElementById('auth-confirm-wrap').classList.toggle('hidden', !res.setupRequired);
      document.getElementById('auth-submit').textContent = res.setupRequired ? 'Aktifkan Akun Admin' : 'Masuk';
    });

    document.getElementById('auth-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var u = document.getElementById('auth-username').value;
      var p = document.getElementById('auth-password').value;
      var fn = state.setupRequired ? 'setupFirstAdmin' : 'loginAdmin';
      var args = state.setupRequired ? [u, p, document.getElementById('auth-fullname').value] : [u, p];
      runGas(fn, args, function(ses) {
        state.token = ses.token;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-shell').classList.remove('hidden');
        loadPage('dashboard');
      });
    });

    document.querySelectorAll('.nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        loadPage(btn.getAttribute('data-page'));
      });
    });

    document.getElementById('btn-logout').addEventListener('click', function() {
      runGas('logoutAdmin', [state.token], function() {
        state.token = null;
        document.getElementById('main-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
      });
    });
  });

  function loadPage(page) {
    state.currentPage = page;
    var box = document.getElementById('page-container');
    if (page === 'dashboard') {
      runGas('getDashboardData', [state.token], function(d) {
        state.periodKey = d.recap.period.periodKey;
        box.innerHTML =
          '<div class="glass-card" style="padding:20px;margin-bottom:16px">' +
            '<h2>Dashboard Absensi Security Al-Muhajirin</h2>' +
            '<p style="color:#475569;margin-top:4px">Periode Aktif: ' + d.recap.period.label + '</p>' +
          '</div>' +
          '<div class="kpi-grid">' +
            '<div class="glass-card kpi-card"><small>Anggota Aktif</small><strong>' + d.totalAnggotaAktif + '</strong></div>' +
            '<div class="glass-card kpi-card"><small>Hadir Hari Ini</small><strong>' + d.hadirHariIni + '</strong></div>' +
            '<div class="glass-card kpi-card"><small>Badal Hari Ini</small><strong>' + d.badalHariIni + '</strong></div>' +
            '<div class="glass-card kpi-card"><small>Izin</small><strong>' + d.izinHariIni + '</strong></div>' +
            '<div class="glass-card kpi-card"><small>Sakit</small><strong>' + d.sakitHariIni + '</strong></div>' +
            '<div class="glass-card kpi-card"><small>Alpa</small><strong>' + d.alpaHariIni + '</strong></div>' +
          '</div>';
      });
    } else if (page === 'rekap') {
      runGas('getRecapData', [state.token, state.periodKey], function(r) {
        var html = '<div class="glass-card" style="padding:20px;overflow-x:auto">' +
          '<h2>Rekap Absensi (' + r.period.label + ')</h2>' +
          '<div style="margin:12px 0;display:flex;gap:8px">' +
            '<button onclick="downloadGasFile(\\'xlsx\\')" class="btn-primary" style="width:auto;margin:0">DOWNLOAD EXCEL (.xlsx)</button>' +
            '<button onclick="downloadGasFile(\\'pdf\\')" class="btn-primary" style="width:auto;margin:0">DOWNLOAD PDF (.pdf)</button>' +
          '</div><table><thead><tr><th>Nama</th>';
        r.period.dates.forEach(function(d) { html += '<th>' + d.day + '</th>'; });
        html += '<th>H</th><th>B</th><th>I</th><th>S</th><th>A</th><th>L</th><th>Total</th></tr></thead><tbody>';
        r.rows.forEach(function(row) {
          html += '<tr><td style="text-align:left;font-weight:600">' + row.nama + '</td>';
          r.period.dates.forEach(function(d) { html += '<td>' + row.daily[d.date].code + '</td>'; });
          html += '<td>' + row.totalH + '</td><td>' + row.totalB + '</td><td>' + row.totalI + '</td><td>' + row.totalS + '</td><td>' + row.totalA + '</td><td>' + row.totalL + '</td><td><b>' + row.totalKehadiran + '</b></td></tr>';
        });
        html += '</tbody></table></div>';
        box.innerHTML = html;
      });
    } else if (page === 'input') {
      var today = new Date().toISOString().slice(0, 10);
      runGas('getAbsensiByDate', [state.token, today], function(d) {
        var recMap = {};
        d.records.forEach(function(r) { recMap[r.idAnggota] = r; });
        var html = '<div class="glass-card" style="padding:20px"><h2>Input Absensi Harian</h2><p style="margin:6px 0 12px;color:#475569">Tanggal: ' + d.tanggal + ' (' + d.period.label + ')</p><div id="input-rows">';
        d.activeMembers.forEach(function(m) {
          var rec = recMap[m.idAnggota] || {};
          html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #e2e8f0">' +
            '<strong>' + m.nama + '</strong>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<label style="margin:0"><input type="checkbox" class="cb-h" data-id="' + m.idAnggota + '" ' + (rec.statusH ? 'checked' : '') + '> H</label>' +
              '<label style="margin:0"><input type="checkbox" class="cb-b" data-id="' + m.idAnggota + '" ' + (rec.statusB ? 'checked' : '') + '> B</label>' +
              '<select class="sel-other" data-id="' + m.idAnggota + '" style="width:auto;padding:4px 8px">' +
                '<option value="">-- Lainnya --</option>' +
                '<option value="I" ' + (rec.statusI ? 'selected' : '') + '>I (Izin)</option>' +
                '<option value="S" ' + (rec.statusS ? 'selected' : '') + '>S (Sakit)</option>' +
                '<option value="A" ' + (rec.statusA ? 'selected' : '') + '>A (Alpa)</option>' +
                '<option value="L" ' + (rec.statusL ? 'selected' : '') + '>L (Libur)</option>' +
              '</select>' +
            '</div></div>';
        });
        html += '</div><button class="btn-primary" onclick="saveGasAbsensi(\\'' + d.tanggal + '\\')">Simpan Absensi</button></div>';
        box.innerHTML = html;
      });
    } else if (page === 'anggota') {
      runGas('getAnggota', [state.token], function(res) {
        var html = '<div class="glass-card" style="padding:20px"><h2>Data Anggota</h2><div style="margin:12px 0;display:flex;gap:8px"><input id="new-member-name" placeholder="Nama anggota baru"/><button class="btn-primary" style="width:auto;margin:0" onclick="addGasMember()">Tambah</button></div><table><thead><tr><th>ID</th><th>Nama</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
        res.anggota.forEach(function(m) {
          html += '<tr><td>' + m.idAnggota + '</td><td>' + m.nama + '</td><td>' + (m.statusAktif ? 'Aktif' : 'Nonaktif') + '</td><td><button onclick="toggleGasMember(\\'' + m.idAnggota + '\\',' + (!m.statusAktif) + ')">' + (m.statusAktif ? 'Nonaktifkan' : 'Aktifkan') + '</button></td></tr>';
        });
        html += '</tbody></table></div>';
        box.innerHTML = html;
      });
    } else {
      box.innerHTML = '<div class="glass-card" style="padding:20px"><h2>Pengaturan Sistem</h2><p style="margin-top:8px;color:#475569">Database terhubung langsung dengan sheet USERS, ANGGOTA, ABSENSI, dan PENGATURAN pada Google Spreadsheet Anda.</p></div>';
    }
  }

  function saveGasAbsensi(tanggal) {
    if (!confirm('Konfirmasi simpan absensi tanggal ' + tanggal + '?')) return;
    var entries = [];
    document.querySelectorAll('.cb-h').forEach(function(cbH) {
      var id = cbH.getAttribute('data-id');
      var cbB = document.querySelector('.cb-b[data-id="' + id + '"]');
      var sel = document.querySelector('.sel-other[data-id="' + id + '"]');
      var other = sel ? sel.value : '';
      entries.push({
        idAnggota: id,
        statusH: cbH.checked,
        statusB: cbB.checked,
        statusI: other === 'I',
        statusS: other === 'S',
        statusA: other === 'A',
        statusL: other === 'L'
      });
    });
    runGas('saveAbsensiBatch', [state.token, tanggal, entries], function() {
      alert('Absensi berhasil disimpan ke Google Spreadsheet!');
      loadPage('dashboard');
    });
  }

  function addGasMember() {
    var name = document.getElementById('new-member-name').value;
    if (!name) return;
    runGas('createAnggota', [state.token, name], function() { loadPage('anggota'); });
  }

  function toggleGasMember(id, active) {
    runGas('setAnggotaStatus', [state.token, id, active], function() { loadPage('anggota'); });
  }

  function downloadGasFile(fmt) {
    runGas('exportLaporanBase64', [state.token, state.periodKey, fmt], function(file) {
      var link = document.createElement('a');
      link.href = 'data:' + file.mimeType + ';base64,' + file.base64;
      link.download = file.filename;
      link.click();
    });
  }
</script>`;

export const GAS_FILES: GasFileTemplate[] = [
  {
    filename: 'Code.gs',
    gasType: 'Script (.gs)',
    description: 'Backend Google Apps Script lengkap: auto-create 4 sheet database, hash password, cache, lock anti-duplikat, periode 26–25, dan ekspor Excel/PDF.',
    content: GAS_CODE_GS,
  },
  {
    filename: 'Index.html',
    gasType: 'HTML',
    description: 'Template utama antarmuka aplikasi web GAS dengan pemisahan file Styles dan Script.',
    content: GAS_INDEX_HTML,
  },
  {
    filename: 'Styles.html',
    gasType: 'HTML (CSS)',
    description: 'Stylesheet Morphglass Ocean Blue & Silver responsif untuk HP, tablet, dan komputer.',
    content: GAS_STYLES_HTML,
  },
  {
    filename: 'Script.html',
    gasType: 'HTML (JavaScript)',
    description: 'Logika frontend berbasis google.script.run untuk login, input H+B, rekap, dan unduhan laporan.',
    content: GAS_SCRIPT_HTML,
  },
];
