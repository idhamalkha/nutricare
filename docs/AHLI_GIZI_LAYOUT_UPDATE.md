# Layout Update - Dashboard Ahli Gizi

**Tanggal:** 1 November 2026
**File yang Diubah:** 2 files

---

## 📋 **Perubahan yang Diterapkan:**

### ✅ **1. Sidebar Disederhanakan**
**Yang Dihapus:**
- ❌ Label grup "PREFERENSI"
- ❌ Menu "Pengaturan" di bawah PREFERENSI
- ❌ Kartu profil pengguna (avatar + nama + role) di footer sidebar
- ❌ Tombol "Keluar dari akun" di footer sidebar

**Yang Tersisa:**
- ✅ Logo NutriCare + label "Ahli Gizi"
- ✅ **Tanggal dinamis** (dipindahkan dari topbar ke sini)
- ✅ Label grup "MENU AHLI GIZI"
- ✅ 9 menu items (Dashboard, Data pasien, Pantangan, Rekomendasi, Jadwal, Perawat, Bahan, Riwayat, Laporan)

---

### ✅ **2. Tanggal Dipindahkan**
**Sebelum:** Pojok kanan atas topbar (`<div class="today"></div>`)
**Sekarang:** Sidebar kiri, di atas label "MENU AHLI GIZI" (`<div class="sidebar-date today"></div>`)

**Perilaku:**
- ✅ Tetap dinamis (diupdate oleh `NC.today()` dari `nutricare.js`)
- ✅ Format Indonesia: "Minggu, 01 November 2026"
- ✅ Menggunakan class `today` yang sudah ada

---

### ✅ **3. Profile Dropdown di Topbar**
**Posisi:** Pojok kanan atas topbar (menggantikan posisi tanggal lama)

**Struktur Trigger:**
```html
<button id="profile-trigger" aria-haspopup="menu" aria-expanded="false">
    <div class="avatar">G</div>
    <div class="profile-info">
        <div class="profile-name" data-user-name>ahli gizi</div>
        <div class="profile-role">Ahli Gizi</div>
    </div>
    <svg class="chevron">...</svg> <!-- Chevron down icon -->
</button>
```

**Dropdown Menu (3 items):**
1. 👤 **Profil** → `href="#profil"` (placeholder)
2. ⚙️ **Pengaturan** → `href="pengaturan.html?role=ahli-gizi"`
3. 🚪 **Keluar** (merah, dengan divider) → Logout handler

**Fitur:**
- ✅ Toggle buka/tutup dengan klik trigger
- ✅ Close otomatis jika klik di luar dropdown
- ✅ Close dengan tombol Esc
- ✅ Animasi fade + slide halus
- ✅ Posisi dropdown rata kanan (tidak keluar layar)
- ✅ Chevron icon berotasi 180° saat dropdown terbuka
- ✅ Logout handler: `sessionStorage.clear()` + redirect ke `index.html`

**Responsif:**
- Desktop: Tampil semua (avatar + nama + role + chevron)
- Mobile (≤768px): Hanya avatar + chevron (nama & role disembunyikan)

**Aksesibilitas:**
- ✅ `aria-haspopup="menu"`
- ✅ `aria-expanded` dinamis (true/false)
- ✅ Dropdown `role="menu"`
- ✅ Items `role="menuitem"`
- ✅ Keyboard support (Esc key)

---

## 📁 **File yang Dimodifikasi:**

### 1. **`pages/ahli-gizi.html`**
**Perubahan:**
- ✅ Sidebar: Hapus section PREFERENSI dan footer (profil + logout button)
- ✅ Sidebar: Tambah `<div class="sidebar-date today"></div>` setelah brand
- ✅ Topbar: Hapus `<div class="today"></div>`
- ✅ Topbar: Tambah profile dropdown (trigger + menu)
- ✅ Include CSS: `<link href="../css/profile-dropdown.css">`
- ✅ JavaScript: Tambah profile dropdown handler (toggle, close, logout)

**Baris yang Diubah:**
- Lines 20-60: Sidebar structure simplified
- Lines 67-120: Topbar with profile dropdown
- Line 14: Added CSS include
- Lines 845-900: Added JavaScript handler

---

### 2. **`css/profile-dropdown.css`** ✨ **NEW FILE**
**Ukuran:** 3.6KB
**Isi:**
- Profile trigger button styles (avatar, info, chevron)
- Profile dropdown menu styles (shadow, border-radius, items)
- Hover & focus states
- Dropdown divider
- Danger item styling (red logout)
- Sidebar date styling
- Responsive rules (@media max-width: 768px)
- Dark mode support (@media prefers-color-scheme: dark)

---

## 🧪 **Cara Test:**

### **Desktop:**
1. Buka `http://localhost:3017/pages/ahli-gizi.html`
2. **Sidebar:**
   - ✅ Tanggal muncul di atas "MENU AHLI GIZI"
   - ✅ Tidak ada section PREFERENSI
   - ✅ Tidak ada profil card & logout button di bawah
3. **Topbar kanan atas:**
   - ✅ Avatar hijau "G" + nama "ahli gizi" + role "Ahli Gizi" + chevron ↓
4. **Klik profil:**
   - ✅ Dropdown muncul dengan 3 item
   - ✅ Chevron berotasi 180° (↑)
   - ✅ Animasi smooth
5. **Klik "Pengaturan":**
   - ✅ Redirect ke `pengaturan.html?role=ahli-gizi`
6. **Klik "Keluar":**
   - ✅ SessionStorage cleared
   - ✅ Redirect ke `index.html` (login page)
7. **Klik di luar dropdown:**
   - ✅ Dropdown tertutup otomatis
8. **Tekan Esc:**
   - ✅ Dropdown tertutup

### **Mobile (resize browser ≤768px):**
1. ✅ Profile trigger hanya tampil: Avatar + Chevron
2. ✅ Nama & role disembunyikan
3. ✅ Dropdown tetap berfungsi normal

---

## ⚠️ **Catatan Penting:**

### **Apakah Halaman Lain Terpengaruh?**
**TIDAK.** Perubahan ini **HANYA** diterapkan di `pages/ahli-gizi.html`.

**Halaman lain masih menggunakan layout lama:**
- `pages/logistik.html` → Layout lama (sidebar footer + tanggal di topbar)
- `pages/perawat.html` → Layout lama
- `pages/waiter.html` → Layout lama

**Alasan:**
- Setiap halaman punya struktur HTML sendiri (tidak pakai komponen shared)
- User hanya minta update halaman Ahli Gizi
- Jika ingin konsistensi, perlu update manual ke setiap halaman

**Rekomendasi untuk Konsistensi:**
Jika ingin semua halaman pakai layout baru yang sama:
1. Buat file `components/sidebar.html` & `components/topbar.html`
2. Include via JavaScript atau server-side
3. Apply style profile-dropdown.css ke semua halaman
4. Update JavaScript handler di setiap halaman

**Atau** biarkan setiap role punya layout berbeda sesuai kebutuhan.

---

## 🎨 **Visual yang TIDAK Diubah:**

✅ **Warna** → Tetap sama (hijau #4a9d6f untuk avatar, merah #e74c3c untuk logout)
✅ **Font** → Tetap sama (Manrope & Cormorant Garamond)
✅ **Spacing** → Tetap konsisten dengan design system
✅ **Border radius** → Tetap 8px/12px sesuai style guide
✅ **Shadow** → Tetap halus (`0 8px 24px rgba(0,0,0,0.12)`)

---

## ✅ **Summary:**

**Status:** ✅ **SELESAI & TESTED**

**Files Changed:**
1. `pages/ahli-gizi.html` - Layout updated
2. `css/profile-dropdown.css` - New styles (3.6KB)

**Features Added:**
- ✅ Simplified sidebar (menu only)
- ✅ Date moved to sidebar
- ✅ Profile dropdown in topbar
- ✅ Logout functionality preserved
- ✅ Responsive design
- ✅ Accessibility compliant

**Ready for Production:** ✅ YES

---

**🎊 Layout Dashboard Ahli Gizi berhasil diupdate sesuai spesifikasi!**
