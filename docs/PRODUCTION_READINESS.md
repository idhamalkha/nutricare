# 🚀 NutriCare - Production Readiness Checklist

**Target:** Masuk production mode, unlock semua fitur yang di-lock karena demo

**Tanggal:** 1 November 2026, 03:30 UTC
**Deadline Demo:** Senin, 2 November 2026

---

## 📊 Status Saat Ini

### ✅ **Yang Sudah Selesai (Demo Ready)**
1. ✅ Login page (loading, validation, error handling)
2. ✅ Admin panel CRUD user
3. ✅ Backend auth middleware (token + demo mode)
4. ✅ Database pool error handling
5. ✅ Pengaturan page (loading, notifications)
6. ✅ Server auto-run port 3017
7. ✅ Loading & notification system (ui-utils.js, api-wrapper.js)
8. ✅ Dokumentasi lengkap

---

## 🔒 **Fitur Yang Di-Lock untuk Demo Mode**

### 1. **Notifikasi/Push Notifications**
**Status:** Belum ada UI untuk menampilkan notifikasi
**File terkait:**
- `js/push-notifications.js` - Sudah ada tapi hanya setup
- Backend: `/api/push/*` - Sudah ada endpoint

**Yang perlu dibuat:**
- [ ] Notification bell/icon di topbar
- [ ] Dropdown notification list
- [ ] Badge counter untuk unread
- [ ] Mark as read functionality
- [ ] Clear all notifications

**Lokasi:** Semua dashboard pages (topbar)

---

### 2. **Edit Profil & Ganti Password**
**Status:** Form disabled di pengaturan
**File:** `pages/pengaturan.html`, `js/pengaturan.js`

**Yang perlu dienable:**
- [ ] Form edit profil (nama, email, telepon)
- [ ] Form ganti password (validate old password)
- [ ] Submit handler dengan API call
- [ ] Success/error feedback

**API Endpoints (sudah ada):**
- `PATCH /api/me` - Update profile
- `PATCH /api/me/password` - Change password

---

### 3. **Preferensi Notifikasi**
**Status:** Toggle disabled di pengaturan
**File:** `pages/pengaturan.html`, `js/pengaturan.js`

**Yang perlu dienable:**
- [ ] Enable checkbox toggles
- [ ] Save preferensi ke API saat change
- [ ] Toast feedback saat save

**API Endpoints (sudah ada):**
- `GET /api/me/preferensi` - Load preferences
- `PUT /api/me/preferensi` - Save preferences

---

### 4. **Dashboard Pages - Apply Loading & Error Handling**
**Status:** Masih pakai fetch biasa, belum pakai NutriCareAPI

**Pages yang perlu update:**
- [ ] `pages/ahli-gizi.html` + `js/ahli-gizi.js`
- [ ] `pages/perawat.html` + `js/perawat.js`
- [ ] `pages/waiter.html` + `js/waiter.js`
- [ ] `pages/logistik.html` + `js/logistik.js`

**Yang perlu diupdate per page:**
1. Include CSS loading & notifications di HTML
2. Include ui-utils.js & api-wrapper.js di HTML
3. Update fetch calls ke NutriCareAPI
4. Add loading states (skeleton, progress)
5. Add confirmation dialogs untuk delete
6. Add success toasts untuk save/update
7. Add form validation

---

### 5. **Reset Demo Data**
**Status:** Button disabled di pengaturan
**File:** `pages/pengaturan.html`, `js/pengaturan.js`

**Yang perlu dibuat:**
- [ ] Endpoint `/api/admin/reset-demo` di backend
- [ ] Konfirmasi modal sebelum reset
- [ ] Reset logic (truncate tables + re-seed)
- [ ] Progress indicator saat reset
- [ ] Success message setelah reset

**Catatan:** Ini optional, bisa skip jika tidak perlu

---

### 6. **Web Push Notifications**
**Status:** Button disabled di pengaturan, service worker belum register
**File:** `js/push-notifications.js`

**Yang perlu diselesaikan:**
- [ ] Service worker registration
- [ ] Request notification permission
- [ ] Subscribe to push notifications
- [ ] Display push notifications
- [ ] Handle notification click
- [ ] Unsubscribe functionality

**Backend:** Sudah ada `/api/push/*` endpoints

---

### 7. **Auth Mode Configuration**
**Status:** Saat ini mode demo
**File:** `server/.env`, `server/src/config.ts`

**Yang perlu diubah untuk production:**
```env
# .env
AUTH_MODE=strict  # Ubah dari 'demo' ke 'strict'
```

**Impact:**
- X-NC-Role header tidak akan diterima lagi
- Semua request HARUS pakai Bearer token
- Demo 4 tombol di login page tidak akan berfungsi

---

### 8. **Form CRUD di Dashboard**
**Status:** Belum ada loading/validation sistematis

**Yang perlu ditambahkan:**
- [ ] Add/Edit modal forms untuk semua entities
- [ ] Form validation sebelum submit
- [ ] Loading state saat submit
- [ ] Success toast setelah save
- [ ] Error handling yang jelas
- [ ] Auto-refresh data setelah CRUD

**Entities:**
- Pasien
- Menu
- Bahan
- Request/Pengajuan
- Pengembalian
- Stock movements

---

## 🎯 **Prioritas Implementasi**

### **Phase 1: Critical (Harus selesai sebelum demo)**
1. ✅ Login system working
2. ✅ Backend auth working
3. ⚠️ Dashboard loading states (minimal: skeleton loading)
4. ⚠️ Basic CRUD dengan error handling

### **Phase 2: Important (Nice to have untuk demo)**
5. ⬜ Notification center UI
6. ⬜ Edit profil & ganti password
7. ⬜ Form validation di semua CRUD

### **Phase 3: Production Ready (Setelah demo)**
8. ⬜ Web push notifications
9. ⬜ Reset demo functionality
10. ⬜ Switch to AUTH_MODE=strict
11. ⬜ Complete error handling & edge cases

---

## 🔧 **Quick Wins (Bisa diselesaikan cepat)**

### 1. Enable Edit Profil (15 menit)
```javascript
// js/pengaturan.js - hapus disabled, tambah handler
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = NutriCareForm.getData(profileForm);
    await NutriCareAPI.patch('/me', data, {
        showSuccess: true,
        successMessage: 'Profil berhasil diperbarui'
    });
});
```

### 2. Enable Preferensi Notifikasi (10 menit)
```javascript
// js/pengaturan.js - enable checkboxes
document.querySelectorAll('[data-pref]').forEach(input => {
    input.disabled = false;
    input.addEventListener('change', async () => {
        const prefs = {};
        document.querySelectorAll('[data-pref]').forEach(i => {
            prefs[i.getAttribute('data-pref')] = i.checked;
        });
        await NutriCareAPI.put('/me/preferensi', prefs, {
            showSuccess: true,
            successMessage: 'Preferensi disimpan'
        });
    });
});
```

### 3. Add Notification Bell UI (30 menit)
```html
<!-- Tambah di topbar -->
<div class="notification-bell">
    <button id="notification-btn">
        <span class="icon">🔔</span>
        <span class="badge">3</span>
    </button>
    <div class="notification-dropdown">
        <!-- List notifications -->
    </div>
</div>
```

---

## 📝 **Rekomendasi Eksekusi**

### **Untuk Demo Besok (Senin):**
**Fokus:** Pastikan yang sudah ada berfungsi sempurna
1. ✅ Test login dengan akun real
2. ✅ Test navigasi antar halaman
3. ⚠️ Tambah loading skeleton di 1-2 halaman utama (ahli-gizi, logistik)
4. ⚠️ Test CRUD basic (add, edit, delete) dengan toast feedback

**Jangan:**
- Jangan ubah AUTH_MODE ke strict (biarkan demo mode)
- Jangan implement web push (kompleks, bisa skip)
- Jangan reset demo (tidak urgent)

### **Setelah Demo (Production):**
1. Enable edit profil & password
2. Enable preferensi notifikasi
3. Implement notification center UI
4. Apply loading system ke SEMUA halaman
5. Complete form validation
6. Switch AUTH_MODE=strict
7. Web push notifications (optional)

---

## 🚨 **Blocker/Issues yang Perlu Diselesaikan**

### ❌ **Critical Issues**
- None (semua critical sudah resolved)

### ⚠️ **Important Issues**
1. Dashboard pages belum pakai loading system → Impact: UX kurang smooth
2. Form CRUD belum ada validation → Impact: Bad data bisa masuk
3. No notification UI → Impact: User tidak tahu ada notifikasi baru

### ℹ️ **Nice to Have**
1. Web push notifications
2. Reset demo functionality
3. Advanced error recovery

---

## ✅ **Definition of Done**

### **Demo Ready:**
- [x] Login works dengan token
- [x] Backend auth support token + demo
- [ ] Minimal 2 halaman dashboard punya loading states
- [ ] CRUD basic works dengan feedback

### **Production Ready:**
- [ ] Semua form punya validation
- [ ] Semua CRUD punya loading + error handling
- [ ] Edit profil & password works
- [ ] Notification center UI exists
- [ ] AUTH_MODE=strict enabled
- [ ] All demo locks removed
- [ ] Full error handling & edge cases covered

---

**Next Actions:**
1. Review checklist dengan user
2. Prioritize tasks
3. Execute quick wins first
4. Test everything before demo
5. Plan production migration after demo

