# 🎯 Implementasi Loading & Error Handling - NutriCare

## ✅ Yang Sudah Dibuat

### 1. **CSS Files** (Minimalis & Modern)
- ✅ `css/loading.css` - Loading indicators (spinner, skeleton, progress bar)
- ✅ `css/notifications.css` - Toast, alerts, modal, field errors

### 2. **JavaScript Utilities**
- ✅ `js/ui-utils.js` - Core UI functions (NutriCareUI)
- ✅ `js/api-wrapper.js` - Enhanced fetch API (NutriCareAPI, NutriCareForm)

### 3. **Implementasi Login**
- ✅ `index.html` - Include CSS & JS
- ✅ `js/login.js` - Login form dengan loading & validation

### 4. **Dokumentasi**
- ✅ `docs/UI_SYSTEM_GUIDE.md` - Dokumentasi lengkap

---

## 🚀 Cara Apply ke Halaman Lain

### Langkah 1: Include Files di HTML

Tambahkan di `<head>`:
```html
<link rel="stylesheet" href="../css/loading.css">
<link rel="stylesheet" href="../css/notifications.css">
```

Tambahkan sebelum `</body>`:
```html
<script src="../js/ui-utils.js"></script>
<script src="../js/api-wrapper.js"></script>
<script src="../js/your-page.js"></script>
```

### Langkah 2: Update JavaScript untuk Fetch API

**Sebelum:**
```javascript
const response = await fetch('/api/pasien');
const data = await response.json();
```

**Sesudah:**
```javascript
const data = await NutriCareAPI.get('/pasien');
// Loading & error otomatis ter-handle!
```

### Langkah 3: Update Form Handling

**Sebelum:**
```javascript
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    button.disabled = true;
    
    const response = await fetch('/api/pasien', {
        method: 'POST',
        body: JSON.stringify({ nama: '...' })
    });
    
    button.disabled = false;
});
```

**Sesudah:**
```javascript
NutriCareForm.handleSubmit(form, async () => {
    const data = NutriCareForm.getData(form);
    await NutriCareAPI.post('/pasien', data, {
        showSuccess: true,
        successMessage: 'Data berhasil disimpan'
    });
    // Loading, validation, error sudah otomatis!
});
```

---

## 📋 TODO: Apply ke Halaman Berikut

### Priority 1 (Halaman Utama)
- [ ] `pages/ahli-gizi.html` + `js/ahli-gizi.js`
- [ ] `pages/perawat.html` + `js/perawat.js`
- [ ] `pages/waiter.html` + `js/waiter.js`
- [ ] `pages/logistik.html` + `js/logistik.js`

### Priority 2 (Halaman Tambahan)
- [ ] `pages/pengaturan.html`
- [ ] Admin panel (jika ada halaman terpisah)

### Contoh Update untuk `ahli-gizi.js`:

```javascript
// 1. Update load data
async function loadPasien() {
    const table = document.getElementById('patient-table');
    NutriCareUI.showSkeleton(table);
    
    try {
        const data = await NutriCareAPI.get('/pasien');
        renderTable(data);
    } finally {
        NutriCareUI.hideSkeleton(table);
    }
}

// 2. Update save data
async function savePasien() {
    const form = document.getElementById('patient-form');
    
    if (!NutriCareUI.validateForm(form)) {
        return;
    }
    
    const data = NutriCareForm.getData(form);
    await NutriCareAPI.post('/pasien', data, {
        showSuccess: true,
        successMessage: 'Pasien berhasil disimpan'
    });
    
    await loadPasien();
}

// 3. Update delete
async function deletePasien(id) {
    const confirmed = await NutriCareUI.confirm(
        'Hapus Pasien?',
        'Data akan dihapus permanen.'
    );
    
    if (!confirmed) return;
    
    await NutriCareAPI.delete(`/pasien/${id}`, {
        showSuccess: true,
        successMessage: 'Pasien berhasil dihapus'
    });
    
    await loadPasien();
}
```

---

## 🎨 Fitur Yang Tersedia

### Loading States
- ✅ Full-screen overlay (`NutriCareUI.showLoading()`)
- ✅ Progress bar (`NutriCareUI.showProgress(50)`)
- ✅ Button loading (`NutriCareUI.buttonLoading(btn)`)
- ✅ Skeleton loading (`NutriCareUI.showSkeleton(element)`)

### Notifications
- ✅ Success toast (`NutriCareUI.success('Berhasil!')`)
- ✅ Error toast (`NutriCareUI.error('Error!')`)
- ✅ Warning toast (`NutriCareUI.warning('Peringatan!')`)
- ✅ Info toast (`NutriCareUI.info('Informasi')`)
- ✅ Confirmation modal (`await NutriCareUI.confirm('Title', 'Message')`)

### Form Validation
- ✅ Field error (`NutriCareUI.showFieldError(input, 'Error')`)
- ✅ Auto validation (`NutriCareUI.validateForm(form)`)
- ✅ Inline alerts (`NutriCareUI.showAlert(container, {...})`)

### API Helpers
- ✅ GET request (`NutriCareAPI.get(url)`)
- ✅ POST request (`NutriCareAPI.post(url, data)`)
- ✅ PUT request (`NutriCareAPI.put(url, data)`)
- ✅ DELETE request (`NutriCareAPI.delete(url)`)
- ✅ Upload file (`NutriCareAPI.upload(url, formData)`)

---

## 🧪 Testing Checklist

### Login Page (✅ Sudah Diimplementasi)
- [x] Loading overlay saat submit
- [x] Progress bar animation
- [x] Field validation (required, minlength)
- [x] Error message jika login gagal
- [x] Success toast sebelum redirect
- [x] Button loading state
- [x] Demo card loading

### Dashboard Pages (Perlu Diimplementasi)
- [ ] Table skeleton saat load data
- [ ] Form validation untuk add/edit
- [ ] Success toast saat save
- [ ] Confirmation dialog saat delete
- [ ] Error handling untuk API failures
- [ ] 401 redirect ke login

---

## 📝 Notes

### Design Principles
1. **Minimalis** - Animasi subtle, tidak berlebihan
2. **Modern** - Menggunakan backdrop-filter, smooth transitions
3. **Consistent** - Warna dan spacing seragam
4. **Accessible** - ARIA labels, keyboard support
5. **Responsive** - Mobile-friendly

### Color Palette
- Success: `#4caf50` (Green)
- Error: `#f44336` (Red)
- Warning: `#ff9800` (Orange)
- Info: `#2196f3` (Blue)
- Loading: `#4caf50` (Primary Green)

### Animation Timing
- Toast appear: 0.3s cubic-bezier
- Button loading: 0.6s linear spin
- Progress bar: 0.3s ease
- Skeleton: 1.5s ease-in-out

---

## 🎓 Quick Reference

### Contoh Cepat

```javascript
// Loading overlay
NutriCareUI.showLoading('Memuat...');
await loadData();
NutriCareUI.hideLoading();

// Toast notification
NutriCareUI.success('Data tersimpan!');

// Form validation
if (!NutriCareUI.validateForm(form)) return;

// API call dengan auto-loading
const data = await NutriCareAPI.post('/api/data', body, {
    showSuccess: true,
    successMessage: 'Berhasil!'
});

// Confirmation
if (await NutriCareUI.confirm('Hapus?', 'Yakin?')) {
    await deleteData();
}
```

---

## 🚀 Next Steps

1. **Test Login Page** - Coba login dengan berbagai skenario
2. **Apply ke 1 Dashboard** - Mulai dari `ahli-gizi.html` sebagai pilot
3. **Test & Refine** - Pastikan UX smooth
4. **Roll Out** - Apply ke semua halaman
5. **Update PROGRESS.md** - Dokumentasikan progress

---

**Dibuat:** 1 November 2026, 02:59 UTC  
**Status:** ✅ Core system selesai, siap diimplementasi ke seluruh aplikasi
