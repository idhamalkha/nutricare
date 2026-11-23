(function () {
    'use strict';
    
    // Harus sama dengan NUTRICARE_ROLES di server/src/auth/index.ts.
    const ALLOWED_ROLES = ['ahli-gizi', 'waiter', 'logistik', 'dapur'];

    const form = document.getElementById('login-form');
    if (!form) return;

    const usernameInput = form.querySelector('#username');
    const passwordInput = form.querySelector('#password');
    const submitButton = form.querySelector('[type="submit"]');

    // Clear errors on input
    [usernameInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                NutriCareUI.hideFieldError(input);
            });
        }
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        // Clear previous errors
        NutriCareUI.hideFieldError(usernameInput);
        NutriCareUI.hideFieldError(passwordInput);

        // Validate inputs
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        let hasError = false;

        if (!username) {
            NutriCareUI.showFieldError(usernameInput, 'Username atau email wajib diisi');
            hasError = true;
        }

        if (!password) {
            NutriCareUI.showFieldError(passwordInput, 'Password wajib diisi');
            hasError = true;
        } else if (password.length < 6) {
            NutriCareUI.showFieldError(passwordInput, 'Password minimal 6 karakter');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        // Show loading state
        NutriCareUI.buttonLoading(submitButton);
        NutriCareUI.showProgress(30);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            NutriCareUI.showProgress(60);

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.token || !result.user) {
                throw new Error(result.message || 'Login gagal. Periksa informasi akun Anda.');
            }

            // Role di luar daftar ditolak sebelum sesi disimpan.
            if (ALLOWED_ROLES.indexOf(result.user.role) === -1) {
                throw new Error('Akun ini tidak dapat masuk ke NutriCare. Perawat dan Dokter silakan gunakan aplikasi Nadi.');
            }

            // Success
            NutriCareUI.showProgress(100);
            sessionStorage.setItem('nutricare-token', result.token);
            sessionStorage.setItem('nutricare-user', JSON.stringify(result.user));

            // Show success message
            NutriCareUI.success('Login berhasil! Mengarahkan ke dashboard...', 'Selamat Datang');

            // Redirect after short delay
            setTimeout(() => {
                window.location.assign('pages/' + result.user.role + '.html');
            }, 800);

        } catch (error) {
            // Hide loading
            NutriCareUI.buttonReady(submitButton);
            NutriCareUI.hideProgress();

            // Show error
            const errorMessage = error.message || 'Login gagal. Silakan coba lagi.';
            
            // Check for specific errors
            if (errorMessage.includes('tidak ditemukan') || errorMessage.includes('salah')) {
                NutriCareUI.error(errorMessage, 'Login Gagal');
                NutriCareUI.showFieldError(usernameInput, 'Username atau password tidak cocok');
                NutriCareUI.showFieldError(passwordInput, 'Username atau password tidak cocok');
            } else if (errorMessage.includes('jaringan') || errorMessage.includes('network')) {
                NutriCareUI.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 'Koneksi Gagal');
            } else {
                NutriCareUI.error(errorMessage, 'Login Gagal');
            }

            // Focus back to username
            usernameInput.focus();
        }
    });

    // Handle demo role cards click
    const demoCards = document.querySelectorAll('.role-card');
    demoCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const role = card.querySelector('span:nth-child(2)').textContent;
            NutriCareUI.showLoading(`Membuka dashboard ${role}...`);
            
            setTimeout(() => {
                window.location.href = card.href;
            }, 500);
        });
    });
})();
