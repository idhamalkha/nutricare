/**
 * Penjaga sesi halaman dashboard.
 *
 * Di mode produksi (AUTH_MODE=strict) setiap halaman wajib punya token. Tanpa
 * token, halaman disembunyikan lalu diarahkan ke login supaya isi dashboard
 * (termasuk baris contoh) tidak sempat tampil. Di mode demo, pemeriksaan ini
 * tidak mengubah apa pun.
 */
(function () {
    'use strict';

    if (sessionStorage.getItem('nutricare-token')) return;

    // Sembunyikan isi halaman sejak awal agar tidak ada kedipan data.
    var style = document.createElement('style');
    style.id = 'nc-auth-guard-style';
    style.textContent = 'html.nc-auth-checking body{visibility:hidden !important}';
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add('nc-auth-checking');

    function release() {
        document.documentElement.classList.remove('nc-auth-checking');
        var el = document.getElementById('nc-auth-guard-style');
        if (el) el.remove();
    }

    fetch('/api/health', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (health) {
            if (health && health.mode === 'strict') {
                window.location.replace('/index.html');
                return;
            }
            release();
        })
        .catch(release);
})();
