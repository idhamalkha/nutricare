# Admin Panel - Manajemen Akun NutriCare

## 📋 Deskripsi

Admin Panel adalah aplikasi web terpisah untuk mengelola akun pengguna sistem NutriCare. Panel ini dirancang sebagai jalan integrasi dengan sistem eksternal (HR, Active Directory, atau sistem manajemen user lainnya) meskipun saat ini digunakan standalone.

## 🎯 Fitur Utama

### 1. **Dashboard Statistik**
- Total pengguna terdaftar
- Jumlah user per role (Ahli Gizi, Perawat, Waiter, Logistik)
- Update real-time

### 2. **CRUD Pengguna**
- ✅ **Create**: Tambah user baru dengan email, password, nama, role, dan telepon
- 📖 **Read**: Lihat daftar semua pengguna dengan filter dan pencarian
- ✏️ **Update**: Edit informasi user termasuk ganti password
- 🗑️ **Delete**: Hapus user dari sistem (Auth + Database)

### 3. **Seed Default Users**
- Endpoint khusus untuk membuat 8 user demo sekaligus
- Sesuai dengan kredensial di `KREDENSIAL_LOGIN.txt`

### 4. **Real-time Status**
- Indikator koneksi ke server NutriCare
- Auto-check setiap 30 detik

## 🚀 Cara Menggunakan

### Langkah 1: Pastikan Server Berjalan
```bash
cd server
npm run dev
# Server harus berjalan di http://localhost:3017
```

### Langkah 2: Buka Admin Panel
```
Buka file: admin-panel.html
URL: file:///path/to/nutricare/admin-panel.html
```
Atau jalankan dengan server lokal:
```bash
# Dari root nutricare
python -m http.server 8080
# Akses: http://localhost:8080/admin-panel.html
```

### Langkah 3: Seed User Default (Opsional)
Gunakan endpoint seed untuk membuat 8 user demo:
```bash
curl -X POST http://localhost:3017/api/admin/users/seed
```

Atau klik tombol "Seed Users" di panel (jika ditambahkan).

## 📡 API Endpoints

### Base URL
```
http://localhost:3017/api/admin
```

### 1. Get All Users
```http
GET /api/admin/users
```
**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "ahligizi1@nutricare.com",
      "nama": "Dr. Sarah Nutritionist",
      "role": "gizi",
      "telepon": "081234567890",
      "aktif": true
    }
  ]
}
```

### 2. Create User
```http
POST /api/admin/users
Content-Type: application/json

{
  "email": "newuser@nutricare.com",
  "password": "Password123!",
  "nama": "User Baru",
  "role": "gizi",
  "telepon": "081234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pengguna berhasil dibuat",
  "user": {
    "id": "uuid",
    "email": "newuser@nutricare.com",
    "nama": "User Baru",
    "role": "gizi",
    "telepon": "081234567890"
  }
}
```

### 3. Update User
```http
PUT /api/admin/users/:id
Content-Type: application/json

{
  "email": "updated@nutricare.com",
  "nama": "Nama Updated",
  "role": "perawat",
  "telepon": "082345678901",
  "password": "NewPass123!" // opsional
}
```

### 4. Delete User
```http
DELETE /api/admin/users/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Pengguna berhasil dihapus"
}
```

### 5. Seed Default Users
```http
POST /api/admin/users/seed
```

**Response:**
```json
{
  "success": true,
  "message": "Seeded 8 users",
  "results": [
    { "email": "ahligizi1@nutricare.com", "status": "success" }
  ],
  "errors": []
}
```

## 🔐 Keamanan

### Status Saat Ini (Development)
- ⚠️ **Endpoint admin saat ini PUBLIK** untuk kemudahan development
- Tidak memerlukan autentikasi
- Cocok untuk lingkungan development/testing

### Untuk Production (Harus Diimplementasi)
```typescript
// Tambahkan di app.ts
const adminPaths = ['/api/admin/'];
if (request.url.startsWith('/api/admin/')) {
  // Cek admin token atau IP whitelist
  const adminToken = request.headers['x-admin-token'];
  if (adminToken !== config.adminToken) {
    return reply.status(403).send({ error: 'Forbidden' });
  }
}
```

### Rekomendasi Production:
1. **API Key Authentication**: Header `X-Admin-Token`
2. **IP Whitelist**: Hanya izinkan dari IP tertentu
3. **Rate Limiting**: Batasi request per IP
4. **Audit Log**: Catat semua operasi CRUD
5. **HTTPS Only**: Wajib menggunakan HTTPS
6. **CORS Strict**: Batasi origin yang diizinkan

## 🏗️ Arsitektur

```
┌─────────────────┐
│  Admin Panel    │ (HTML/JS - Standalone)
│  (Frontend)     │
└────────┬────────┘
         │ HTTP API
         ▼
┌─────────────────┐
│  Admin Routes   │ /api/admin/*
│  (Backend)      │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌──────┐  ┌──────────┐
│ Auth │  │ Database │
│ (SB) │  │ (Profiles)│
└──────┘  └──────────┘
```

## 📝 Validasi

### Email
- Format: `user@domain.com`
- Unique: Tidak boleh duplikat

### Password
- Minimal: 8 karakter
- Harus ada saat create
- Opsional saat update (kosongkan jika tidak diubah)

### Role
- Pilihan: `admin`, `gizi`, `perawat`, `waiter`, `logistik`
- Wajib diisi

### Nama
- Wajib diisi
- String tidak kosong

### Telepon
- Opsional
- Format bebas

## 🎨 UI Features

### Responsive Design
- Desktop-first
- Mobile-friendly
- Grid layout adaptif

### Search & Filter
- Real-time search berdasarkan email dan nama
- Filter client-side (cepat)

### Status Indicators
- 🟢 Connected: Server aktif
- 🔴 Disconnected: Server mati atau error
- Auto-refresh status setiap 30 detik

### Alert System
- ✅ Success: Hijau
- ❌ Error: Merah
- ℹ️ Info: Biru
- Auto-dismiss setelah 5 detik

## 🔧 Troubleshooting

### Panel tidak bisa konek ke server
**Gejala:** Status badge merah "Terputus"

**Solusi:**
```bash
# 1. Cek server berjalan
curl http://localhost:3017/api/health

# 2. Cek port
netstat -ano | grep 3017

# 3. Restart server
cd server
npm run dev
```

### User tidak bisa login setelah dibuat
**Gejala:** Credential benar tapi login gagal

**Kemungkinan:**
1. Email belum terverifikasi di Supabase
2. Profile tidak ter-create di database
3. Role tidak match

**Solusi:**
```sql
-- Cek di Supabase SQL Editor
SELECT u.email, p.role, p.aktif 
FROM auth.users u 
LEFT JOIN profiles p ON p.id = u.id 
WHERE u.email = 'email@nutricare.com';
```

### Error "Email sudah terdaftar"
**Solusi:**
- Gunakan email berbeda, atau
- Hapus user lama dulu, atau
- Update user yang sudah ada

## 📦 File Structure

```
nutricare/
├── admin-panel.html          # Admin Panel (Frontend)
├── KREDENSIAL_LOGIN.txt      # Daftar kredensial demo
├── ADMIN_PANEL_DOCS.md       # Dokumentasi ini
└── server/
    └── src/
        ├── routes/
        │   └── admin.ts      # Admin API endpoints
        └── app.ts            # Registrasi routes
```

## 🔄 Integrasi dengan Sistem Lain

### Contoh: Integrasi dengan HR System
```javascript
// hr-sync.js
async function syncUsersFromHR() {
  const hrUsers = await fetchFromHRSystem();
  
  for (const hrUser of hrUsers) {
    const response = await fetch('http://localhost:3017/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: hrUser.email,
        password: generateRandomPassword(),
        nama: hrUser.fullName,
        role: mapHRRoleToNutriCare(hrUser.position),
        telepon: hrUser.phone
      })
    });
    
    console.log(`Synced: ${hrUser.email}`);
  }
}
```

### Contoh: Webhook dari Active Directory
```javascript
// webhook-listener.js
app.post('/webhook/ad-user-created', async (req, res) => {
  const adUser = req.body;
  
  await fetch('http://localhost:3017/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: adUser.userPrincipalName,
      password: generateTempPassword(),
      nama: adUser.displayName,
      role: mapADGroupToRole(adUser.memberOf)
    })
  });
  
  res.json({ success: true });
});
```

## 📊 Monitoring & Logging

### Recommended: Tambahkan Audit Log
```typescript
// Di admin.ts, setelah setiap operasi
await pool.query(
  `INSERT INTO audit_logs (action, user_id, details, ip_address)
   VALUES ($1, $2, $3, $4)`,
  ['USER_CREATED', userId, JSON.stringify(data), request.ip]
);
```

### Health Check
```bash
# Cek endpoint tersedia
curl http://localhost:3017/api/health

# Expected response:
{"status":"ok","mode":"demo"}
```

## 🎓 Tutorial: Membuat User Pertama Kali

1. **Pastikan server berjalan**
   ```bash
   cd server
   npm run dev
   ```

2. **Buka admin-panel.html di browser**

3. **Isi form "Tambah Pengguna Baru":**
   - Email: `dokter@nutricare.com`
   - Password: `Dokter2024!`
   - Nama: `Dr. Ahmad Gizi`
   - Role: Pilih `Ahli Gizi`
   - Telepon: `081234567890`

4. **Klik "Tambah Pengguna"**

5. **User berhasil dibuat!** Cek di tabel bawah

6. **Login ke NutriCare:**
   - Buka `http://localhost:3017/`
   - Email: `dokter@nutricare.com`
   - Password: `Dokter2024!`

## 📞 Support

Jika ada masalah:
1. Cek dokumentasi ini
2. Cek console browser (F12) untuk error JavaScript
3. Cek log server untuk error backend
4. Cek Supabase dashboard untuk masalah Auth

---

**Dibuat:** 1 November 2024  
**Untuk:** NutriCare Patient Nutrition Management System  
**Versi:** 1.0.0
