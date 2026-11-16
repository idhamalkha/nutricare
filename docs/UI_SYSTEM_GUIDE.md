# NutriCare UI System - Loading & Notifications

## 📚 Dokumentasi Lengkap

Sistem loading dan notification yang minimalis dan modern untuk NutriCare frontend.

---

## 🎨 Komponen yang Tersedia

### 1. Loading Indicators
- Full-screen overlay loading
- Button loading state
- Progress bar
- Skeleton loading
- Inline spinner

### 2. Notifications
- Toast notifications (success, error, warning, info)
- Inline alerts
- Field validation errors
- Modal alerts
- Confirmation dialogs

### 3. API Wrapper
- Automatic loading states
- Error handling
- Token management
- Upload support

---

## 📦 Instalasi

### Include CSS Files
```html
<link rel="stylesheet" href="css/loading.css">
<link rel="stylesheet" href="css/notifications.css">
```

### Include JavaScript Files
```html
<script src="js/ui-utils.js"></script>
<script src="js/api-wrapper.js"></script>
```

---

## 🚀 Penggunaan

### Loading Indicators

#### 1. Full-Screen Loading
```javascript
// Show loading
NutriCareUI.showLoading('Memuat data...');

// Hide loading
NutriCareUI.hideLoading();
```

#### 2. Button Loading
```javascript
const button = document.getElementById('submit-btn');

// Show loading state
NutriCareUI.buttonLoading(button);

// Hide loading state
NutriCareUI.buttonReady(button);
```

**HTML:**
```html
<button type="submit" data-loading-text="Menyimpan...">
    Simpan Data
</button>
```

#### 3. Progress Bar
```javascript
// Show progress
NutriCareUI.showProgress(0);   // 0%
NutriCareUI.showProgress(50);  // 50%
NutriCareUI.showProgress(100); // 100%

// Hide progress
NutriCareUI.hideProgress();
```

#### 4. Skeleton Loading
```javascript
const container = document.getElementById('data-container');

// Show skeleton
NutriCareUI.showSkeleton(container);

// Hide skeleton
NutriCareUI.hideSkeleton(container);
```

**HTML:**
```html
<div id="data-container">
    <!-- Your content here -->
</div>
```

---

### Toast Notifications

#### Basic Usage
```javascript
// Success
NutriCareUI.success('Data berhasil disimpan');

// Error
NutriCareUI.error('Gagal menyimpan data');

// Warning
NutriCareUI.warning('Perhatian: Data akan dihapus');

// Info
NutriCareUI.info('Sistem akan maintenance besok');
```

#### Advanced Toast
```javascript
NutriCareUI.toast({
    type: 'success',           // success, error, warning, info
    title: 'Berhasil',
    message: 'Data telah disimpan',
    duration: 5000,            // milliseconds (0 = no auto-dismiss)
    closeable: true            // show close button
});
```

#### Custom Duration
```javascript
// 10 seconds
NutriCareUI.success('Proses selesai', 'Berhasil', { duration: 10000 });

// No auto-dismiss
NutriCareUI.error('Error kritis', 'Error', { duration: 0 });
```

---

### Form Validation

#### Field Errors
```javascript
const emailInput = document.getElementById('email');

// Show error
NutriCareUI.showFieldError(emailInput, 'Email tidak valid');

// Hide error
NutriCareUI.hideFieldError(emailInput);
```

#### Automatic Form Validation
```javascript
const form = document.getElementById('my-form');

// Validate all required fields
const isValid = NutriCareUI.validateForm(form);

if (isValid) {
    // Submit form
}
```

**HTML:**
```html
<form id="my-form">
    <input type="email" name="email" required minlength="5">
    <input type="password" name="password" required minlength="8">
    <button type="submit">Submit</button>
</form>
```

#### Clear Errors on Input
```javascript
const input = document.getElementById('username');

input.addEventListener('input', () => {
    NutriCareUI.hideFieldError(input);
});
```

---

### Inline Alerts

```javascript
const container = document.getElementById('form-container');

// Show alert
NutriCareUI.showAlert(container, {
    type: 'error',
    message: 'Harap isi semua field yang wajib'
});

// Hide alert
NutriCareUI.hideAlert(container);
```

---

### Modal Dialogs

#### Confirmation Dialog
```javascript
const confirmed = await NutriCareUI.confirm(
    'Hapus Data?',
    'Data yang sudah dihapus tidak dapat dikembalikan.'
);

if (confirmed) {
    // User clicked "Ya"
    deleteData();
} else {
    // User clicked "Tidak" or closed modal
}
```

#### Custom Modal
```javascript
const result = await NutriCareUI.showModal({
    type: 'warning',
    title: 'Konfirmasi',
    message: 'Apakah Anda yakin ingin melanjutkan?',
    confirmText: 'Lanjutkan',
    cancelText: 'Batal',
    showCancel: true
});
```

---

## 🔌 API Wrapper

### Basic Usage

#### GET Request
```javascript
try {
    const data = await NutriCareAPI.get('/pasien');
    console.log(data);
} catch (error) {
    // Error already shown to user via toast
    console.error(error);
}
```

#### POST Request
```javascript
try {
    const result = await NutriCareAPI.post('/pasien', {
        nama: 'John Doe',
        umur: 30
    }, {
        showSuccess: true,
        successMessage: 'Pasien berhasil ditambahkan'
    });
} catch (error) {
    // Error handled automatically
}
```

#### PUT Request
```javascript
await NutriCareAPI.put('/pasien/123', {
    nama: 'Jane Doe'
}, {
    showSuccess: true,
    successMessage: 'Data berhasil diupdate'
});
```

#### DELETE Request
```javascript
const confirmed = await NutriCareUI.confirm(
    'Hapus Pasien?',
    'Data pasien akan dihapus permanen.'
);

if (confirmed) {
    await NutriCareAPI.delete('/pasien/123', {
        showSuccess: true,
        successMessage: 'Pasien berhasil dihapus'
    });
}
```

### Upload File
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

await NutriCareAPI.upload('/upload', formData, {
    showSuccess: true,
    successMessage: 'File berhasil diupload'
});
```

### Custom Options
```javascript
await NutriCareAPI.fetch('/custom-endpoint', {
    method: 'POST',
    body: { data: 'value' },
    showLoading: true,        // Show progress bar
    showSuccess: true,        // Show success toast
    successMessage: 'Sukses!',
    errorTitle: 'Custom Error Title',
    headers: {
        'X-Custom-Header': 'value'
    }
});
```

---

## 📝 Form Helpers

### Handle Form Submission
```javascript
const form = document.getElementById('add-patient-form');

NutriCareForm.handleSubmit(form, async (formData) => {
    // Get form data as object
    const data = NutriCareForm.getData(form);
    
    // Submit to API
    await NutriCareAPI.post('/pasien', data, {
        showSuccess: true,
        successMessage: 'Pasien berhasil ditambahkan'
    });
    
    // Form will be auto-reset on success
});
```

### Get/Set Form Data
```javascript
// Get form data as object
const data = NutriCareForm.getData(form);
console.log(data); // { nama: 'John', email: 'john@example.com', ... }

// Populate form with data
NutriCareForm.setData(form, {
    nama: 'Jane Doe',
    email: 'jane@example.com',
    aktif: true
});
```

---

## 💡 Contoh Lengkap

### Login Form
```javascript
const form = document.getElementById('login-form');
const submitBtn = form.querySelector('[type="submit"]');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate
    if (!NutriCareUI.validateForm(form)) {
        return;
    }
    
    // Show loading
    NutriCareUI.buttonLoading(submitBtn);
    NutriCareUI.showProgress(30);
    
    try {
        const data = NutriCareForm.getData(form);
        const result = await NutriCareAPI.post('/auth/login', data);
        
        NutriCareUI.showProgress(100);
        NutriCareUI.success('Login berhasil!');
        
        // Save token and redirect
        sessionStorage.setItem('token', result.token);
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 800);
        
    } catch (error) {
        NutriCareUI.showFieldError(
            form.querySelector('#username'),
            'Username atau password salah'
        );
    } finally {
        NutriCareUI.buttonReady(submitBtn);
        NutriCareUI.hideProgress();
    }
});
```

### Load Table Data
```javascript
async function loadPatients() {
    const tableBody = document.getElementById('patient-table-body');
    
    // Show skeleton
    NutriCareUI.showSkeleton(tableBody);
    
    try {
        const patients = await NutriCareAPI.get('/pasien');
        
        // Render table
        tableBody.innerHTML = patients.map(p => `
            <tr>
                <td>${p.nama}</td>
                <td>${p.umur}</td>
                <td>
                    <button onclick="editPatient(${p.id})">Edit</button>
                    <button onclick="deletePatient(${p.id})">Hapus</button>
                </td>
            </tr>
        `).join('');
        
    } finally {
        NutriCareUI.hideSkeleton(tableBody);
    }
}
```

### Delete with Confirmation
```javascript
async function deletePatient(id) {
    const confirmed = await NutriCareUI.confirm(
        'Hapus Pasien?',
        'Data pasien akan dihapus permanen dan tidak dapat dikembalikan.'
    );
    
    if (!confirmed) return;
    
    await NutriCareAPI.delete(`/pasien/${id}`, {
        showSuccess: true,
        successMessage: 'Pasien berhasil dihapus'
    });
    
    // Reload table
    await loadPatients();
}
```

### Add/Edit Modal
```javascript
async function showAddPatientModal() {
    const modal = document.getElementById('patient-modal');
    const form = modal.querySelector('form');
    
    // Reset form
    form.reset();
    
    // Show modal
    modal.classList.add('active');
    
    // Handle submit
    NutriCareForm.handleSubmit(form, async () => {
        const data = NutriCareForm.getData(form);
        
        await NutriCareAPI.post('/pasien', data, {
            showSuccess: true,
            successMessage: 'Pasien berhasil ditambahkan'
        });
        
        // Close modal
        modal.classList.remove('active');
        
        // Reload table
        await loadPatients();
    });
}
```

---

## 🎨 Customization

### Change Colors
Edit `css/loading.css` and `css/notifications.css`:

```css
/* Success color */
.toast.success .toast-icon {
    background: #your-color;
    color: #your-text-color;
}

/* Spinner color */
.spinner {
    border-top-color: #your-brand-color;
}
```

### Change Duration
```javascript
// Default 5 seconds
NutriCareUI.success('Message', 'Title'); 

// Custom duration
NutriCareUI.toast({
    type: 'success',
    message: 'Message',
    duration: 10000 // 10 seconds
});
```

---

## 📱 Mobile Responsive

Sistem ini sudah responsive untuk mobile:
- Toast menyesuaikan lebar layar
- Modal menyesuaikan ukuran
- Touch-friendly button sizes

---

## ♿ Accessibility

- ARIA labels untuk screen readers
- Keyboard navigation support
- Focus management
- High contrast support

---

## 🐛 Troubleshooting

### Toast tidak muncul
- Pastikan `css/notifications.css` sudah di-include
- Pastikan `js/ui-utils.js` sudah di-load
- Check console untuk error

### Loading tidak hilang
```javascript
// Force hide all loading states
NutriCareUI.hideLoading();
NutriCareUI.hideProgress();
```

### Button tetap disabled
```javascript
const btn = document.getElementById('my-button');
NutriCareUI.buttonReady(btn);
```

---

## 📄 License

© 2026 NutriCare - Internal Use Only

