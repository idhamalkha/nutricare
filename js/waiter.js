(function () {
    'use strict';

    var NC = window.NC;
    var api = window.NutriCareApi;
    var schedules = NC.store('jadwal');
    var delivered = NC.store('terkirim');
    var pendingRow = null;
    var dialog = document.getElementById('konfirmasi-terkirim');
    var submitButton = dialog.querySelector('[data-confirm-submit]');

    function markDelivered(row) {
        pendingRow = row;
        document.getElementById('konfirmasi-terkirim-detail').textContent =
            row.pasien + ' · Ruangan ' + row.ruangan + ' · ' + row.waktu + ' ' + row.jam + ' · ' + row.menu;
        dialog.showModal();
    }

    dialog.querySelector('[data-confirm-cancel]').addEventListener('click', function () {
        pendingRow = null;
        dialog.close();
    });
    submitButton.addEventListener('click', async function () {
        if (!pendingRow || submitButton.disabled) return;
        var row = pendingRow;
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
        submitButton.textContent = 'Memproses...';
        try {
            await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
            await api.requestAsync('PATCH', '/jadwal/' + encodeURIComponent(row.id) + '/terkirim', {});
            api.invalidate();
            schedules.refresh();
            delivered.refresh();
            pendingRow = null;
            dialog.close();
            NC.renderAll();
            NC.toast('Pengantaran dikonfirmasi. Pesanan dipindahkan ke “Sudah terkirim”.', 'success');
        } catch (error) {
            NC.toast('Konfirmasi pengantaran gagal: ' + (error.message || 'coba lagi.'), 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.removeAttribute('aria-busy');
            submitButton.textContent = 'Ya, sudah diantarkan';
        }
    });
    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) { pendingRow = null; dialog.close(); }
    });
    dialog.addEventListener('close', function () { pendingRow = null; });

    NC.crud({
        mount: '#crud-terkirim',
        store: delivered,
        noun: 'pesanan terkirim',
        readOnly: true,
        searchPlaceholder: 'Cari pasien, menu, atau ruangan',
        search: ['pasien', 'menu', 'ruangan', 'waktu'],
        sort: function (a, b) { return a.jam.localeCompare(b.jam); },
        empty: { title: 'Belum ada pesanan terkirim hari ini', hint: 'Pesanan yang sudah dikonfirmasi akan muncul di sini.' },
        columns: [
            { label: 'Pasien & ruangan', render: function (row) { return '<strong>' + NC.esc(row.pasien) + '</strong><small>Ruangan ' + NC.esc(row.ruangan) + '</small>'; } },
            { label: 'Waktu makan', render: function (row) { return NC.esc(row.waktu) + ' · ' + NC.esc(row.jam); } },
            { label: 'Menu', render: function (row) { return NC.esc(row.menu); } },
            { label: 'Status', render: function (row) { return NC.badge(row.status); } }
        ]
    });

    NC.crud({
        mount: '#crud-distribusi',
        store: schedules,
        noun: 'antrean siap antar',
        readOnly: true,
        searchPlaceholder: 'Cari pasien, menu, atau ruangan',
        search: ['pasien', 'menu', 'ruangan', 'waktu'],
        sort: function (a, b) { return a.jam.localeCompare(b.jam); },
        empty: { title: 'Belum ada makanan siap antar', hint: 'Antrean muncul setelah dapur menyelesaikan persiapan menu.' },
        columns: [
            { label: 'Pasien & ruangan', render: function (row) { return '<strong>' + NC.esc(row.pasien) + '</strong><small>Ruangan ' + NC.esc(row.ruangan) + '</small>'; } },
            { label: 'Waktu makan', render: function (row) { return NC.esc(row.waktu) + ' · ' + NC.esc(row.jam); } },
            { label: 'Menu', render: function (row) { return NC.esc(row.menu); } },
            { label: 'Status', render: function (row) { return NC.badge(row.status); } }
        ],
        actions: [
            { label: 'Konfirmasi terkirim', show: function (row) { return row.status !== 'Terkirim'; }, run: markDelivered }
        ]
    });

    // ---- Pengambilan ompreng ----
    var BATAS_MENIT = 30;
    var queue = NC.store('pengambilan');
    var history = NC.store('riwayatPengambilan');
    var ambilDialog = document.getElementById('dialog-ambil');
    var ambilMsg = document.getElementById('dialog-ambil-msg');
    var pendingAmbil = null;

    function menitBerlalu(row) {
        var t = Date.parse(row.terkirimAt || '');
        return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 60000);
    }
    function sisaMenit(row) { return Math.max(0, BATAS_MENIT - menitBerlalu(row)); }
    function siapDiambil(row) { return sisaMenit(row) === 0; }

    function bukaAmbil(row) {
        pendingAmbil = row;
        ambilMsg.textContent = '';
        document.getElementById('dialog-ambil-detail').textContent =
            row.pasien + ' · Ruangan ' + row.ruangan + ' · ' + row.waktu + ' · ' + row.menu +
            '. Apakah makanan pasien habis?';
        ambilDialog.showModal();
    }

    ambilDialog.querySelector('[data-ambil-cancel]').addEventListener('click', function () {
        pendingAmbil = null;
        ambilDialog.close();
    });
    ambilDialog.addEventListener('click', function (event) {
        if (event.target === ambilDialog) { pendingAmbil = null; ambilDialog.close(); }
    });
    ambilDialog.addEventListener('close', function () { pendingAmbil = null; });
    ambilDialog.querySelectorAll('[data-ambil-hasil]').forEach(function (button) {
        button.addEventListener('click', async function () {
            if (!pendingAmbil || button.disabled) return;
            var row = pendingAmbil;
            var hasil = button.getAttribute('data-ambil-hasil');
            var tombol = ambilDialog.querySelectorAll('[data-ambil-hasil]');
            var label = button.textContent;
            tombol.forEach(function (b) { b.disabled = true; });
            button.setAttribute('aria-busy', 'true');
            button.textContent = 'Menyimpan...';
            ambilMsg.textContent = '';
            try {
                await api.requestAsync('POST', '/pengambilan', { jadwalId: row.id, hasil: hasil });
                api.invalidate();
                queue.refresh();
                history.refresh();
                pendingAmbil = null;
                ambilDialog.close();
                NC.renderAll();
                NC.toast(hasil === 'Habis'
                    ? 'Ompreng diambil. Makanan pasien habis.'
                    : 'Ompreng diambil. Ahli gizi akan menindaklanjuti makanan yang tidak habis.', 'success');
            } catch (error) {
                ambilMsg.textContent = error.message || 'Pengambilan gagal dicatat. Coba lagi.';
            } finally {
                tombol.forEach(function (b) { b.disabled = false; });
                button.removeAttribute('aria-busy');
                button.textContent = label;
            }
        });
    });

    NC.crud({
        mount: '#crud-pengambilan',
        store: queue,
        noun: 'antrean pengambilan',
        readOnly: true,
        searchPlaceholder: 'Cari pasien, menu, atau ruangan',
        search: ['pasien', 'menu', 'ruangan', 'waktu'],
        sort: function (a, b) { return String(a.terkirimAt).localeCompare(String(b.terkirimAt)); },
        empty: { title: 'Tidak ada ompreng yang menunggu diambil', hint: 'Ompreng muncul di sini setelah makanan dikonfirmasi terkirim.' },
        columns: [
            { label: 'Pasien & ruangan', render: function (row) { return '<strong>' + NC.esc(row.pasien) + '</strong><small>Ruangan ' + NC.esc(row.ruangan) + '</small>'; } },
            { label: 'Waktu makan', render: function (row) { return NC.esc(row.waktu) + ' · terkirim ' + NC.esc(row.jamTerkirim); } },
            { label: 'Menu', render: function (row) { return NC.esc(row.menu); } },
            { label: 'Status', render: function (row) {
                return siapDiambil(row)
                    ? '<span class="badge good">Siap diambil</span>'
                    : '<span class="badge warning">Tunggu ' + sisaMenit(row) + ' menit</span>';
            } }
        ],
        actions: [
            { label: 'Ambil ompreng', show: siapDiambil, run: bukaAmbil }
        ]
    });

    NC.crud({
        mount: '#crud-riwayat-ambil',
        store: history,
        noun: 'riwayat pengambilan',
        readOnly: true,
        searchPlaceholder: 'Cari pasien, menu, atau ruangan',
        search: ['pasien', 'menu', 'ruangan', 'hasil'],
        filter: { label: 'Hasil', options: ['Habis', 'Tidak habis'], key: 'hasil' },
        empty: { title: 'Belum ada ompreng yang diambil hari ini', hint: 'Riwayat muncul setelah waiter mencatat pengambilan.' },
        columns: [
            { label: 'Pasien & ruangan', render: function (row) { return '<strong>' + NC.esc(row.pasien) + '</strong><small>Ruangan ' + NC.esc(row.ruangan) + '</small>'; } },
            { label: 'Waktu makan', render: function (row) { return NC.esc(row.waktu) + ' · diambil ' + NC.esc(row.jamDiambil); } },
            { label: 'Menu', render: function (row) { return NC.esc(row.menu); } },
            { label: 'Hasil', render: function (row) {
                return row.hasil === 'Habis'
                    ? '<span class="badge good">Habis</span>'
                    : '<span class="badge warning">Tidak habis</span>';
            } }
        ]
    });

    // Perbarui hitung mundur tiap 30 detik, kecuali pengguna sedang mengetik atau dialog terbuka.
    setInterval(function () {
        var active = document.activeElement;
        var typing = active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
        if (typing || ambilDialog.open || dialog.open) return;
        NC.renderAll();
    }, 30000);

    function renderTable(rows, emptyTitle, emptyHint) {
        if (!rows.length) return '<div class="empty"><strong>' + NC.esc(emptyTitle) + '</strong><p>' + NC.esc(emptyHint) + '</p></div>';
        return '<div class="table-wrap"><table><thead><tr><th>Jam</th><th>Pasien</th><th>Menu</th><th>Status</th></tr></thead><tbody>' +
            rows.map(function (row) {
                return '<tr><td>' + NC.esc(row.jam) + '</td><td><strong>' + NC.esc(row.pasien) +
                    '</strong><small>Ruangan ' + NC.esc(row.ruangan) + '</small></td><td>' + NC.esc(row.menu) +
                    '</td><td>' + NC.badge(row.status) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    function render() {
        var rows = schedules.all().sort(function (a, b) { return a.jam.localeCompare(b.jam); });
        var sent = delivered.all();
        NC.set('w-total', rows.length);
        NC.set('w-terkirim', sent.length);
        NC.set('w-jadwal', rows.length + sent.length);

        var hariIni = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
        document.getElementById('w-summary').textContent = hariIni + '. ' + rows.length +
            ' jadwal siap diantar, ' + sent.length + ' sudah sampai ke pasien.';
        document.getElementById('w-ringkas').innerHTML = renderTable(rows.slice(0, 5), 'Belum ada makanan siap antar', 'Tunggu konfirmasi kesiapan dari dapur.');
    }

    // ---- Laporan harian ----
    var _chartWaktu = null;
    var _chartStatus = null;

    function renderLaporan() {
        var elTotal    = document.getElementById('w-lap-total');
        var elTerkirim = document.getElementById('w-lap-terkirim');
        var elBelum    = document.getElementById('w-lap-belum');
        var elRata     = document.getElementById('w-lap-rata');
        var elTabel    = document.getElementById('lap-tabel-ruangan');

        if (!elTotal) return; // halaman belum di-mount

        var WARNA_HIJAU = 'rgba(182,217,154,0.8)';
        var WARNA_PINK  = 'rgba(233,176,173,0.85)';
        var GRID_COLOR  = 'rgba(255,255,255,0.08)';
        var TICK_COLOR  = '#a4aaa0';

        Promise.resolve().then(function () {
            // Gunakan sumber antrean waiter yang sama dengan bagian Distribusi dan Sudah terkirim.
            var rows = schedules.all().concat(delivered.all());

            // Hitung stat
            var total     = rows.length;
            var terkirim  = rows.filter(function (r) { return r.status === 'Terkirim'; }).length;
            var belum     = total - terkirim;

            // Rata-rata waktu antar (menit) dari selisih jam_selesai - jam
            var durasis = rows
                .filter(function (r) { return r.status === 'Terkirim' && r.jam_selesai && r.jam; })
                .map(function (r) {
                    var parse = function (s) {
                        var p = String(s).split(':');
                        return parseInt(p[0] || 0, 10) * 60 + parseInt(p[1] || 0, 10);
                    };
                    return parse(r.jam_selesai) - parse(r.jam);
                })
                .filter(function (d) { return d > 0; });
            var rataStr = durasis.length
                ? (Math.round(durasis.reduce(function (a, b) { return a + b; }, 0) / durasis.length)) + ' mnt'
                : '-';

            elTotal.textContent    = total;
            elTerkirim.textContent = terkirim;
            elBelum.textContent    = belum;
            elRata.textContent     = rataStr;

            // Waktu makan aggregasi
            var WAKTU_ORDER = ['Pagi', 'Siang', 'Sore', 'Malam'];
            var byWaktu = {};
            WAKTU_ORDER.forEach(function (w) { byWaktu[w] = 0; });
            rows.forEach(function (r) {
                var w = r.waktu_makan || r.waktu || '';
                // normalisasi ke kapitalisasi pertama
                var key = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                if (byWaktu.hasOwnProperty(key)) {
                    byWaktu[key]++;
                } else {
                    byWaktu[key] = (byWaktu[key] || 0) + 1;
                }
            });
            var labels = WAKTU_ORDER.filter(function (w) { return byWaktu[w] !== undefined; });
            var values = labels.map(function (w) { return byWaktu[w] || 0; });

            // Bar chart
            var canvasWaktu = document.getElementById('chart-waktu-makan');
            if (canvasWaktu) {
                if (_chartWaktu) { _chartWaktu.destroy(); _chartWaktu = null; }
                _chartWaktu = new Chart(canvasWaktu, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Jumlah porsi',
                            data: values,
                            backgroundColor: WARNA_HIJAU,
                            borderRadius: 6,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: {
                                grid: { color: GRID_COLOR },
                                ticks: { color: TICK_COLOR }
                            },
                            y: {
                                beginAtZero: true,
                                grid: { color: GRID_COLOR },
                                ticks: { color: TICK_COLOR, stepSize: 1 }
                            }
                        }
                    }
                });
            }

            // Doughnut chart
            var canvasStatus = document.getElementById('chart-status');
            if (canvasStatus) {
                if (_chartStatus) { _chartStatus.destroy(); _chartStatus = null; }
                _chartStatus = new Chart(canvasStatus, {
                    type: 'doughnut',
                    data: {
                        labels: ['Terkirim', 'Belum terkirim'],
                        datasets: [{
                            data: [terkirim, belum],
                            backgroundColor: [WARNA_HIJAU, WARNA_PINK],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '62%',
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: { color: TICK_COLOR, padding: 14, boxWidth: 14 }
                            }
                        }
                    }
                });
            }

            // Tabel per ruangan
            var byRuangan = {};
            rows.forEach(function (r) {
                var room = r.ruangan || '-';
                if (!byRuangan[room]) { byRuangan[room] = { total: 0, terkirim: 0 }; }
                byRuangan[room].total++;
                if (r.status === 'Terkirim') { byRuangan[room].terkirim++; }
            });
            var ruanganKeys = Object.keys(byRuangan).sort();
            if (!ruanganKeys.length) {
                elTabel.innerHTML = '<tr><td colspan="4">-</td></tr>';
            } else {
                elTabel.innerHTML = ruanganKeys.map(function (room) {
                    var d = byRuangan[room];
                    return '<tr><td>' + NC.esc(room) + '</td><td>' + d.total +
                        '</td><td>' + d.terkirim + '</td><td>' + (d.total - d.terkirim) + '</td></tr>';
                }).join('');
            }
        }).catch(function () {
            if (elTotal)    elTotal.textContent    = '…';
            if (elTerkirim) elTerkirim.textContent = '…';
            if (elBelum)    elBelum.textContent    = '…';
            if (elRata)     elRata.textContent     = '-';
            if (elTabel)    elTabel.innerHTML      = '<tr><td colspan="4">-</td></tr>';
        });
    }

    NC.onRender(render);
    NC.onRender(renderLaporan);
    render();
    renderLaporan();
    NC.settings('waiter', { nama: '', email: '', telepon: '' });
    NC.today();
    NC.router('Waiter');
})();
