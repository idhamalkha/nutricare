(function () {
    'use strict';
    var active = true;
    var timers = [];
    var api = window.NutriCareApi;
    var role = location.pathname.indexOf('logistik') !== -1 ? 'logistik' :
        location.pathname.indexOf('perawat') !== -1 ? 'perawat' :
        location.pathname.indexOf('waiter') !== -1 ? 'waiter' : 'ahli-gizi';

    // Jangan menyegarkan saat pengguna sedang bekerja: form terbuka, dialog
    // terbuka, atau kursor ada di kolom isian. Tanpa ini, ketikan bisa hilang
    // di tengah jalan karena tabel digambar ulang.
    function sedangMengisi() {
        // Dialog formulir CRUD selalu ada di DOM (tertutup), jadi periksa
        // status terbukanya, bukan keberadaan elemennya.
        if (document.querySelector('dialog[open]')) return true;
        var el = document.activeElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
        return false;
    }

    function refreshDashboard() {
        if (!active || document.hidden) return;
        if (sedangMengisi()) return;
        try {
            if (window.NC && typeof window.NC.refreshAll === 'function') window.NC.refreshAll();
            window.dispatchEvent(new Event('nutricare:refresh'));
        } catch (error) {
            console.error('[NutriCare auto-refresh]', error);
        }
    }

    function start() {
        if (timers.length) return;
        var interval = role === 'logistik' ? 60000 : 30000;
        timers.push(window.setInterval(refreshDashboard, interval));
        window.addEventListener('pageshow', function () { active = true; });
        window.addEventListener('pagehide', function () { active = false; });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) refreshDashboard();
        });
    }

    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'nutricare:refresh') refreshDashboard();
    });
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'nutricare:refresh') refreshDashboard();
    });
    if (api && api.resources) start();
    window.NutriCareAutoRefresh = { stop: function () { active = false; timers.forEach(window.clearInterval); timers = []; } };
})();
