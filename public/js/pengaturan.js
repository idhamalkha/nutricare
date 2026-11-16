(function () {
    'use strict';
    
    const roles = {
        'ahli-gizi': { label: 'Ahli Gizi', avatar: 'G', dashboard: 'ahli-gizi.html' },
        dapur: { label: 'Petugas Dapur', avatar: 'D', dashboard: 'dapur.html' },
        logistik: { label: 'Logistik & Bahan Makanan', avatar: 'L', dashboard: 'logistik.html' },
        perawat: { label: 'Perawat ruangan', avatar: 'P', dashboard: 'perawat.html' },
        waiter: { label: 'Petugas distribusi', avatar: 'W', dashboard: 'waiter.html' }
    };

    const params = new URLSearchParams(window.location.search);
    let roleKey = params.get('role');

    const authToken = sessionStorage.getItem('nutricare-token');

    let storedUser = {};
    try { storedUser = JSON.parse(sessionStorage.getItem('nutricare-user') || '{}'); } catch (e) { storedUser = {}; }

    if (!authToken && !roleKey && !storedUser.role) {
        if (window.NutriCareUI) NutriCareUI.warning('Silakan login terlebih dahulu', 'Akses Ditolak');
        setTimeout(() => { window.location.href = '../index.html'; }, 1500);
        return;
    }

    if (!roleKey || !roles[roleKey]) roleKey = storedUser.role && roles[storedUser.role] ? storedUser.role : 'ahli-gizi';
    const role = roles[roleKey];

    document.title = 'Pengaturan ' + role.label + ' | NutriCare';
    document.querySelectorAll('[data-role-label]').forEach(el => { el.textContent = role.label; });
    document.querySelectorAll('[data-back-link]').forEach(el => { el.href = role.dashboard; });

    // Identitas di topbar: pakai nama user yang login, bukan placeholder "pengguna"
    function applyIdentity(nama) {
        const name = (nama || '').trim() || role.label;
        document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = name; });
        document.querySelectorAll('[data-role-avatar]').forEach(el => {
            el.textContent = name.charAt(0).toUpperCase();
        });
    }
    applyIdentity(storedUser.nama);

    // Bila nama belum tersimpan di sesi, ambil dari server sekali
    if (!storedUser.nama && authToken && window.NutriCareAPI) {
        NutriCareAPI.get('/me', { showLoading: false }).then(data => {
            if (data && data.nama) {
                applyIdentity(data.nama);
                storedUser.nama = data.nama;
                storedUser.role = data.role || storedUser.role;
                sessionStorage.setItem('nutricare-user', JSON.stringify(storedUser));
            }
        }).catch(() => {});
    }

    window.NC.setTheme(localStorage.getItem('nutricare-theme') || 'original');
    window.NC.today();

    // State aktif menu sidebar mengikuti bagian yang sedang dilihat
    (function initSidebarNav() {
        const links = Array.prototype.slice.call(document.querySelectorAll('.nav-link[href^="#"]'));
        if (!links.length) return;

        const items = links
            .map(link => ({ link: link, section: document.getElementById(link.getAttribute('href').slice(1)) }))
            .filter(item => item.section);

        function activate(id) {
            links.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + id);
            });
        }

        function syncFromScroll() {
            if (!items.length) return;
            const line = window.innerHeight * 0.35;
            let current = items[0];
            items.forEach(item => {
                if (item.section.getBoundingClientRect().top <= line) current = item;
            });
            activate(current.section.id);
        }

        links.forEach(link => {
            link.addEventListener('click', () => activate(link.getAttribute('href').slice(1)));
        });

        window.addEventListener('hashchange', () => activate(window.location.hash.slice(1)));
        window.addEventListener('scroll', syncFromScroll, { passive: true });

        const initial = window.location.hash.slice(1);
        activate(initial && items.some(i => i.section.id === initial) ? initial : items[0].section.id);
        setTimeout(syncFromScroll, 120);
    })();

    document.querySelectorAll('[data-theme-choice]').forEach(button => {
        button.addEventListener('click', () => {
            const themeName = button.getAttribute('data-theme-choice');
            const theme = window.NC.setTheme(themeName);
            const themeLabels = { light: 'terang', dark: 'gelap', original: 'original' };
            if (window.NutriCareUI) {
                NutriCareUI.success('Tema ' + (themeLabels[theme] || theme) + ' diterapkan dan disimpan.', 'Tema Diubah');
            }
        });
    });

    async function loadAccount() {
        try {
            if (window.NutriCareUI) NutriCareUI.showProgress(30);
            const prefsData = await NutriCareAPI.get('/me/preferensi', { showLoading: false });
            if (window.NutriCareUI) NutriCareUI.showProgress(100);

            document.querySelectorAll('[data-pref]').forEach(input => {
                input.checked = Boolean(prefsData[input.getAttribute('data-pref')]);
            });
            
            const prefMsg = document.getElementById('pref-msg');
            if (prefMsg) prefMsg.textContent = 'Perubahan preferensi akan tersimpan otomatis.';

            if (window.NutriCareUI) NutriCareUI.hideProgress();
        } catch (error) {
            if (window.NutriCareUI) NutriCareUI.hideProgress();
            if (error.message !== 'Unauthorized') {
                if (window.NutriCareUI) {
                    NutriCareUI.error('Gagal memuat preferensi notifikasi.');
                }
            }
        }
    }

    const resetBtn = document.getElementById('reset-demo');
    if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.title = 'Reset demo dinonaktifkan untuk keamanan data server';
        resetBtn.addEventListener('click', () => {
            if (window.NutriCareUI) {
                NutriCareUI.warning('Reset data demo dinonaktifkan untuk melindungi data server.', 'Fitur Tidak Tersedia');
            }
        });
    }

    document.querySelectorAll('[data-pref]').forEach(input => {
        input.disabled = false;
        
        input.addEventListener('change', async () => {
            const prefs = {};
            const controls = Array.from(document.querySelectorAll('[data-pref]'));
            const oldValue = !input.checked;
            controls.forEach(i => {
                prefs[i.getAttribute('data-pref')] = i.checked;
                i.disabled = true;
            });

            try {
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                await NutriCareAPI.put('/me/preferensi', prefs, {
                    showLoading: false,
                    showSuccess: false
                });
                if (window.NutriCareUI) NutriCareUI.success('Preferensi tersimpan.', 'Berhasil');
            } catch (error) {
                input.checked = oldValue;
                if (window.NutriCareUI) NutriCareUI.error(error.message || 'Preferensi gagal disimpan.', 'Tidak berhasil');
            } finally {
                controls.forEach(i => { i.disabled = false; });
            }
        });
    });

    loadAccount();
})();
