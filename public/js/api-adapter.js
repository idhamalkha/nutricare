(function () {
    'use strict';
    var allRoutes = { pasien: '/pasien', pantangan: '/pantangan', rekomendasi: '/rekomendasi', jadwal: '/jadwal', perawat: '/perawat', bahan: '/bahan' };
    var allowed = {
        'ahli-gizi': ['pasien', 'pantangan', 'rekomendasi', 'jadwal', 'perawat', 'bahan'],
        perawat: ['pasien', 'pantangan', 'rekomendasi', 'jadwal', 'perawat'],
        waiter: ['jadwal'],
        logistik: ['rekomendasi']
    };
    // Peran halaman: utamakan parameter ?role=, lalu peran sesi hasil login,
    // lalu tebak dari nama berkas. Halaman pengaturan dan profil tidak memuat
    // nama peran di URL, sehingga tanpa peran sesi keduanya meminta data peran
    // lain (bahan) dan ditolak server sampai skrip halaman berhenti.
    var queryRole = null;
    try { queryRole = new URLSearchParams(location.search).get('role'); } catch (e) { queryRole = null; }
    var sessionRole = null;
    try {
        var storedUser = JSON.parse(sessionStorage.getItem('nutricare-user') || 'null');
        sessionRole = storedUser && storedUser.role ? String(storedUser.role) : null;
    } catch (e) { sessionRole = null; }
    var pageRole = (queryRole && allowed[queryRole]) ? queryRole :
        (sessionRole && allowed[sessionRole]) ? sessionRole :
        location.pathname.indexOf('logistik') !== -1 ? 'logistik' :
        location.pathname.indexOf('perawat') !== -1 ? 'perawat' :
        location.pathname.indexOf('waiter') !== -1 ? 'waiter' : 'ahli-gizi';
    var routes = Object.fromEntries(allowed[pageRole].map(function (key) {
        var path = key === 'jadwal' && pageRole === 'waiter' ? '/jadwal/distribusi-siap' : allRoutes[key];
        return [key, path];
    }));
    if (pageRole === 'waiter') {
        routes.terkirim = '/jadwal/terkirim';
        routes.pengambilan = '/pengambilan/antrean';
        routes.riwayatPengambilan = '/pengambilan/riwayat';
    }
    if (pageRole === 'ahli-gizi') routes.evaluasi = '/evaluasi';
    routes.me = '/me';
    routes.preferensi = '/me/preferensi';

    // path -> nama resource, supaya permintaan GET bisa dilayani dari snapshot.
    var pathToKey = {};
    Object.keys(routes).forEach(function (key) {
        if (allRoutes[key]) pathToKey[routes[key]] = key;
    });

    // Snapshot gabungan: satu permintaan untuk semua resource halaman.
    var SNAPSHOT_TTL = 15000;
    var snapshot = null;

    function authHeaders(xhr) {
        var token = sessionStorage.getItem('nutricare-token');
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        else xhr.setRequestHeader('X-NC-Role', pageRole);
    }

    function syncRequest(method, path, body) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, '/api' + path, false);
        authHeaders(xhr);
        if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body === undefined ? null : JSON.stringify(body));
        if (xhr.status < 200 || xhr.status >= 300) {
            var error = {};
            try { error = JSON.parse(xhr.responseText); } catch (_) {}
            throw new Error(error.message || 'API gagal (' + xhr.status + ').');
        }
        return xhr.status === 204 || !xhr.responseText ? null : JSON.parse(xhr.responseText);
    }

    function asyncRequest(method, path, body) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, '/api' + path, true);
            authHeaders(xhr);
            if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function () {
                if (xhr.status < 200 || xhr.status >= 300) {
                    var error = {};
                    try { error = JSON.parse(xhr.responseText); } catch (_) {}
                    reject(new Error(error.message || 'API gagal (' + xhr.status + ').'));
                    return;
                }
                try {
                    resolve(xhr.status === 204 || !xhr.responseText ? null : JSON.parse(xhr.responseText));
                } catch (error) { reject(new Error('Respons API tidak valid.')); }
            };
            xhr.onerror = function () { reject(new Error('Koneksi gagal. Periksa jaringan lalu coba lagi.')); };
            xhr.onabort = function () { reject(new Error('Permintaan dibatalkan.')); };
            xhr.send(body === undefined ? null : JSON.stringify(body));
        });
    }

    function loadSnapshot() {
        var keys = Object.keys(pathToKey).map(function (path) { return pathToKey[path]; });
        var data = syncRequest('GET', '/bootstrap?resources=' + encodeURIComponent(keys.join(',')));
        snapshot = { data: data || {}, at: Date.now() };
        return snapshot.data;
    }

    function snapshotData() {
        if (snapshot && (Date.now() - snapshot.at) < SNAPSHOT_TTL) return snapshot.data;
        return loadSnapshot();
    }

    window.NutriCareApi = {
        role: pageRole,
        resources: routes,
        request: function (method, path, body) {
            var key = method === 'GET' ? pathToKey[path] : null;

            if (key) {
                var data = snapshotData();
                if (!Object.prototype.hasOwnProperty.call(data, key)) {
                    throw new Error('Data ' + key + ' tidak tersedia untuk peran ini.');
                }
                return JSON.parse(JSON.stringify(data[key]));
            }

            var result = syncRequest(method, path, body);
            // Operasi tulis membuat snapshot lama tidak valid.
            if (method !== 'GET') snapshot = null;
            return result;
        },
        requestAsync: function (method, path, body) {
            return asyncRequest(method, path, body).then(function (result) {
                if (method !== 'GET') snapshot = null;
                return result;
            });
        },
        invalidate: function () { snapshot = null; }
    };
})();
