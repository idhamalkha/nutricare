(function () {
    'use strict';

    var NC = window.NC;
    var patients = NC.store('pasien');
    var reports = NC.store('perawat');
    var schedules = NC.store('jadwal');
    var restrictions = NC.store('pantangan');
    var recommendations = NC.store('rekomendasi');
    var readyDistribution = window.NutriCareApi.request('GET', '/jadwal/distribusi-siap');
    window.addEventListener('nutricare:refresh', function () {
        try {
            readyDistribution = window.NutriCareApi.request('GET', '/jadwal/distribusi-siap');
            render();
        } catch (error) {
            var mount = document.getElementById('p-jadwal-siap');
            if (mount) mount.innerHTML = '<div class="empty"><strong>Gagal memperbarui antrean dapur</strong><p>' + NC.esc(error.message) + '</p></div>';
        }
    });

    function patientNames() {
        return patients.all().map(function (patient) { return patient.nama; });
    }

    function recommendationRows() {
        return recommendations.all().filter(function (row) { return row.status === 'Dikirim'; });
    }

    function readyRows() {
        return readyDistribution;
    }

    function room(name) {
        var patient = patients.all().filter(function (row) { return row.nama === name; })[0];
        return patient ? patient.ruangan : '-';
    }

    // Pasien lama (sudah pulang) dimuat hanya saat dibutuhkan, supaya
    // formulir pasien baru tidak menambah permintaan di setiap muat halaman.
    var discharged = null;
    var readmitId = null;
    var readmitMode = 'baru';
    var readmitSaved = false;

    function loadDischarged() {
        if (discharged) return discharged;
        try {
            var rows = window.NutriCareApi.request('GET', '/pasien/pulang');
            discharged = Array.isArray(rows) ? rows : [];
        } catch (error) {
            discharged = [];
        }
        return discharged;
    }

    function formatPulang(value) {
        if (!value) return '';
        var date = new Date(value);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function patientFormIntro() {
        return '<div class="form-intro">' +
            '<div class="mode-switch" role="group" aria-label="Jenis pasien">' +
            '<button type="button" data-mode="baru" aria-pressed="true">Pasien baru</button>' +
            '<button type="button" data-mode="lama" aria-pressed="false">Pasien lama</button>' +
            '</div>' +
            '<div class="pasien-lama" data-pasien-lama hidden>' +
            '<label class="sr-only" for="pasien-lama-cari">Cari pasien lama</label>' +
            '<div class="pasien-lama-search"><input type="search" id="pasien-lama-cari" data-pasien-cari ' +
            'placeholder="Cari nama atau nomor rekam medis pasien lama"></div>' +
            '<div class="pasien-lama-list" data-pasien-list></div>' +
            '<p class="pasien-lama-note">Pilih pasien lama untuk memakai identitas yang sama. Catatan alergi dan pantangan sebelumnya dipakai kembali.</p>' +
            '</div></div>';
    }

    function estimateDailyCalories(ageYears, weightKg, heightCm, sex, activity) {
        var age = Number(ageYears);
        var weight = Number(weightKg);
        var height = Number(heightCm);
        var activityFactor = Number(activity);
        if (!Number.isFinite(age) || !Number.isFinite(weight) || !Number.isFinite(height) ||
            !Number.isFinite(activityFactor) || age < 18 || weight <= 0 || height <= 0 ||
            (sex !== 'Laki-laki' && sex !== 'Perempuan') || activityFactor <= 0) return null;
        // Mifflin-St Jeor: estimasi BMR, lalu dikalikan faktor aktivitas untuk TDEE.
        var bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'Laki-laki' ? 5 : -161);
        return Math.round(bmr * activityFactor);
    }

    function bindPatientForm(form) {
        readmitId = null;
        readmitMode = 'baru';
        var calorieInput = form.elements.kalori;
        var ageInput = form.elements.usia;
        var weightInput = form.elements.bb;
        var heightInput = form.elements.tb;
        var sexInput = form.elements.jenisKelamin;
        var activityInput = form.elements.aktivitas;
        var calorieNote = null;
        if (calorieInput) {
            calorieNote = document.createElement('small');
            calorieNote.className = 'form-hint';
            calorieNote.setAttribute('data-calorie-note', '');
            calorieInput.closest('.field').appendChild(calorieNote);
        }
        function updateCalorieEstimate() {
            if (!calorieInput || readmitId) return;
            calorieInput.readOnly = true;
            if (Number(ageInput.value) < 18 && ageInput.value !== '') {
                calorieInput.value = '';
                calorieInput.required = false;
                calorieInput.placeholder = 'Perlu ditetapkan ahli gizi';
                if (calorieNote) calorieNote.textContent = 'Usia di bawah 18 tahun: kebutuhan kalori harus ditetapkan ahli gizi.';
                return;
            }
            calorieInput.required = true;
            calorieInput.placeholder = 'Dihitung otomatis';
            var result = estimateDailyCalories(ageInput.value, weightInput.value, heightInput.value, sexInput.value, activityInput.value);
            calorieInput.value = result == null ? '' : String(result);
            if (calorieNote) calorieNote.textContent = result == null
                ? 'Isi usia, berat, tinggi, jenis kelamin, dan aktivitas untuk menghitung estimasi TDEE.'
                : 'Estimasi TDEE ' + result + ' kkal/hari menggunakan rumus Mifflin-St Jeor.';
        }
        [ageInput, weightInput, heightInput, sexInput, activityInput].forEach(function (input) {
            if (input) input.addEventListener('input', updateCalorieEstimate);
            if (input) input.addEventListener('change', updateCalorieEstimate);
        });
        updateCalorieEstimate();
        var intro = form.querySelector('.form-intro');
        if (!intro) return;
        var modeButtons = intro.querySelectorAll('[data-mode]');
        var panel = intro.querySelector('[data-pasien-lama]');
        var search = intro.querySelector('[data-pasien-cari]');
        var list = intro.querySelector('[data-pasien-list]');
        var identityFields = ['nama', 'rm'];

        function setIdentityLocked(locked) {
            identityFields.forEach(function (key) {
                var control = form.elements[key];
                if (control) control.readOnly = locked;
            });
        }

        // Alergi/pantangan pasien lama dipulihkan otomatis oleh server,
        // jadi field intake disembunyikan agar tidak diisi dua kali.
        function setAllergyFieldsVisible(visible) {
            ['alergi', 'pantangan', 'catatanPantangan'].forEach(function (key) {
                var control = form.elements[key];
                if (!control) return;
                control.required = visible;
                var wrap = control.closest('.field');
                if (wrap) wrap.hidden = !visible;
            });
        }

        function clearSelection() {
            readmitId = null;
            setIdentityLocked(false);
            setAllergyFieldsVisible(true);
            Array.prototype.forEach.call(list.querySelectorAll('[data-pasien-id]'), function (button) {
                button.setAttribute('aria-pressed', 'false');
            });
        }

        function pick(row) {
            readmitId = row.id;
            setIdentityLocked(true);
            setAllergyFieldsVisible(false);
            ['nama', 'rm', 'ruangan', 'diagnosis', 'usia', 'bb', 'tb', 'kalori', 'jenisKelamin', 'aktivitas', 'tekstur'].forEach(function (key) {
                var control = form.elements[key];
                if (control && row[key] != null) {
                    control.value = row[key];
                    control.dataset.autofilled = '1';
                }
            });
            Array.prototype.forEach.call(list.querySelectorAll('[data-pasien-id]'), function (button) {
                button.setAttribute('aria-pressed', String(button.getAttribute('data-pasien-id') === row.id));
            });
        }

        function renderList(keyword) {
            var term = String(keyword || '').trim().toLowerCase();
            var rows = loadDischarged().filter(function (row) {
                return !term || String(row.nama).toLowerCase().indexOf(term) !== -1 ||
                    String(row.rm).toLowerCase().indexOf(term) !== -1;
            });
            if (!rows.length) {
                list.innerHTML = '<div class="pasien-lama-empty">' +
                    (loadDischarged().length ? 'Tidak ada pasien lama yang cocok.' : 'Belum ada riwayat pasien pulang.') +
                    '</div>';
                return;
            }
            list.innerHTML = rows.slice(0, 40).map(function (row) {
                var pulang = formatPulang(row.pulang_pada);
                return '<button type="button" class="pasien-lama-item" data-pasien-id="' + NC.esc(row.id) + '" aria-pressed="false">' +
                    '<span><strong>' + NC.esc(row.nama) + '</strong> · ' + NC.esc(row.rm) + '</span>' +
                    '<small>' + NC.esc(row.ruangan) + ' · ' + NC.esc(row.diagnosis) +
                    (pulang ? ' · pulang ' + NC.esc(pulang) : '') + '</small></button>';
            }).join('');
            Array.prototype.forEach.call(list.querySelectorAll('[data-pasien-id]'), function (button) {
                button.addEventListener('click', function () {
                    var row = loadDischarged().filter(function (item) {
                        return item.id === button.getAttribute('data-pasien-id');
                    })[0];
                    if (row) pick(row);
                });
            });
        }

        function setMode(mode) {
            readmitMode = mode;
            Array.prototype.forEach.call(modeButtons, function (button) {
                button.setAttribute('aria-pressed', String(button.getAttribute('data-mode') === mode));
            });
            panel.hidden = mode !== 'lama';
            if (mode === 'lama') {
                renderList(search.value);
                search.focus();
            } else {
                clearSelection();
                ['nama', 'rm', 'ruangan', 'diagnosis', 'usia', 'bb', 'tb', 'kalori', 'jenisKelamin', 'aktivitas', 'tekstur'].forEach(function (key) {
                    var control = form.elements[key];
                    if (control && control.dataset.autofilled === '1') {
                        control.value = '';
                        delete control.dataset.autofilled;
                    }
                });
                if (form.elements.tekstur && !form.elements.tekstur.value) form.elements.tekstur.value = 'Biasa';
            }
        }

        Array.prototype.forEach.call(modeButtons, function (button) {
            button.addEventListener('click', function () { setMode(button.getAttribute('data-mode')); });
        });
        search.addEventListener('input', function () { renderList(search.value); });
    }

    function restrictionFor(name) {
        return restrictions.all().filter(function (row) { return row.pasien === name; })[0] || null;
    }

    // Penanda kecil di baris pasien supaya risiko alergi terlihat tanpa
    // membuka detail satu per satu.
    function allergyFlag(row) {
        var note = restrictionFor(row.nama);
        if (!note) return '';
        var alergi = String(note.alergi || '').trim();
        if (alergi && !/^tidak ada$/i.test(alergi)) {
            return '<span class="row-flag" title="Alergi: ' + NC.esc(alergi) + '">Alergi</span>';
        }
        var pantangan = String(note.pantangan || '').trim();
        if (pantangan && !/^tidak ada$/i.test(pantangan)) {
            return '<span class="row-flag is-soft" title="Pantangan: ' + NC.esc(pantangan) + '">Pantangan</span>';
        }
        return '';
    }

    function showPatient(row) {
        var note = restrictionFor(row.nama) || {};
        var bmi = (row.bb / Math.pow(row.tb / 100, 2)).toFixed(1);
        NC.detail(row.nama, [
            ['Nomor rekam medis', row.rm], ['Ruangan', row.ruangan], ['Diagnosis', row.diagnosis],
            ['Usia', row.usia + ' tahun'], ['Berat badan', row.bb + ' kg'], ['Tinggi badan', row.tb + ' cm'],
            ['Indeks massa tubuh', bmi], ['Kebutuhan kalori', row.kalori + ' kkal'],
            ['Tekstur diet', row.tekstur || '-'], ['Alergi', note.alergi || 'Belum dicatat'],
            ['Pantangan', note.pantangan || 'Belum dicatat'], ['Catatan gizi', note.catatan || '-']
        ], 'Gunakan informasi ini untuk mendukung pemantauan dan koordinasi perawatan.');
    }

    NC.crud({
        mount: '#crud-pasien-perawat',
        store: patients,
        noun: 'pasien',
        dense: true,
        rowBadge: allergyFlag,
        onRowClick: showPatient,
        chips: {
            key: 'ruangan',
            label: 'Ruangan',
            options: function () {
                var seen = {};
                patients.all().forEach(function (row) {
                    var key = String(row.ruangan || '').trim();
                    if (key) seen[key] = true;
                });
                return Object.keys(seen).sort();
            }
        },
        label: function (row) { return 'pasien ' + row.nama; },
        addLabel: 'Tambah pasien',
        formHint: 'Pasien otomatis berstatus aktif setelah disimpan.',
        searchPlaceholder: 'Cari nama, nomor RM, atau ruangan',
        search: ['nama', 'rm', 'ruangan', 'diagnosis'],
        sort: function (a, b) { return a.nama.localeCompare(b.nama); },
        empty: { title: 'Belum ada pasien', hint: 'Data pasien akan tampil setelah ditambahkan oleh ahli gizi.' },
        columns: [
            { label: 'Pasien', render: function (row) { return '<strong>' + NC.esc(row.nama) + '</strong><small>' + NC.esc(row.rm) + '</small>'; } },
            { label: 'Ruangan', render: function (row) { return NC.esc(row.ruangan); } },
            { label: 'Diagnosis', render: function (row) { return NC.esc(row.diagnosis); } },
            { label: 'Diet tekstur', render: function (row) { return NC.esc(row.tekstur); } },
            { label: 'Status', render: function (row) { return NC.badge(row.status); } }
        ],
        create: async function (values) {
            readmitSaved = false;
            if (readmitId) {
                var saved = await patients.readmit(readmitId, values);
                readmitId = null;
                readmitSaved = true;
                return saved;
            }
            return patients.addIntake(values);
        },
        successMessage: function (saved, old) {
            if (old) return 'Data pasien berhasil diperbarui.';
            if (readmitSaved) { readmitSaved = false; return 'Pasien lama berhasil didaftarkan kembali.'; }
            return 'Pasien baru berhasil ditambahkan.';
        },
        saved: function (saved, old) {
            if (old) return;
            // Daftar pasien lama berubah setelah pendaftaran ulang; muat lagi
            // saat formulir dibuka berikutnya.
            discharged = null;
            // Catatan alergi pasien lama dipulihkan server; muat ulang daftarnya.
            try { restrictions.refresh(); } catch (error) { /* biarkan auto-refresh berikutnya */ }
        },
        deleteLabel: 'Pasien pulang',
        deleteTitle: 'Tandai pasien pulang?',
        deleteMessage: function (row) { return 'Pasien ' + row.nama + ' akan ditandai pulang dan keluar dari daftar pasien aktif.'; },
        deleteNote: 'Riwayat pasien tetap tersimpan dan bisa dipakai lagi lewat pilihan “Pasien lama” saat pasien masuk kembali.',
        deleteConfirmLabel: 'Ya, tandai pulang',
        deleteSuccess: function (row) { return 'Pasien ' + row.nama + ' ditandai pulang.'; },
        formIntro: function (old) { return old ? '' : patientFormIntro(); },
        formReady: function (form, context) { if (!context.old) bindPatientForm(form); },
        validate: function (values) {
            if (readmitMode === 'lama' && !readmitId) {
                return 'Pilih pasien lama terlebih dahulu, atau kembali ke pilihan “Pasien baru”.';
            }
            if (readmitMode !== 'lama' && Number(values.usia) < 18) {
                return 'Pasien berusia di bawah 18 tahun tidak dihitung dengan rumus dewasa. Minta ahli gizi menetapkan kebutuhan kalori sebelum pasien didaftarkan.';
            }
            if (readmitMode !== 'lama' && (!values.jenisKelamin || !values.aktivitas)) {
                return 'Pilih jenis kelamin biologis dan tingkat aktivitas agar estimasi kalori dapat dihitung.';
            }
            return null;
        },
        fields: [
            { key: 'nama', label: 'Nama pasien', required: true },
            { key: 'rm', label: 'Nomor rekam medis', required: true },
            { key: 'ruangan', label: 'Nomor kamar/ruangan', required: true },
            { key: 'diagnosis', label: 'Penyakit/diagnosis', required: true },
            { key: 'usia', label: 'Usia (tahun)', type: 'number', required: true, min: 0, max: 120 },
            { key: 'bb', label: 'Berat badan (kg)', type: 'number', required: true, min: 1 },
            { key: 'tb', label: 'Tinggi badan (cm)', type: 'number', required: true, min: 30 },
            { key: 'jenisKelamin', label: 'Jenis kelamin biologis', type: 'select', required: true, options: ['Perempuan', 'Laki-laki'] },
            { key: 'aktivitas', label: 'Tingkat aktivitas fisik', type: 'select', required: true, options: [
                { value: '1.2', label: 'Sangat ringan (1,2)' },
                { value: '1.375', label: 'Ringan (1,375)' },
                { value: '1.55', label: 'Sedang (1,55)' },
                { value: '1.725', label: 'Berat (1,725)' },
                { value: '1.9', label: 'Sangat berat (1,9)' }
            ] },
            { key: 'kalori', label: 'Kebutuhan kalori (kkal)', type: 'number', required: true, readOnly: true, min: 500, max: 5000, placeholder: 'Dihitung otomatis' },
            // Tekstur hanya boleh salah satu dari empat nilai (aturan database),
            // jadi dipilih lewat daftar, bukan diketik bebas.
            { key: 'tekstur', label: 'Tekstur diet', type: 'select', required: true, options: ['Biasa', 'Lunak', 'Bubur', 'Cair'], default: 'Biasa' },
            { key: 'alergi', label: 'Alergi (isi “Tidak ada” jika nihil)', required: true, createOnly: true },
            { key: 'pantangan', label: 'Pantangan makanan (isi “Tidak ada” jika nihil)', required: true, createOnly: true },
            { key: 'catatanPantangan', label: 'Catatan alergi/pantangan', type: 'textarea', full: true, createOnly: true }
        ],
        empty: { title: 'Belum ada pasien', hint: 'Perawat dapat menginput pasien baru atau mendaftarkan kembali pasien lama.' },
        actions: [
            { label: 'Detail', run: showPatient }
        ]
    });

    function restrictionCategory(row) {
        var alergi = String(row.alergi || '').trim();
        if (alergi && !/^tidak ada$/i.test(alergi)) return 'Ada alergi';
        var pantangan = String(row.pantangan || '').trim();
        if (pantangan && !/^tidak ada$/i.test(pantangan)) return 'Ada pantangan';
        return 'Nihil';
    }

    function restrictionCard(row) {
        var alergi = String(row.alergi || '').trim();
        var pantangan = String(row.pantangan || '').trim();
        var alergiEmpty = !alergi || /^tidak ada$/i.test(alergi);
        var pantanganEmpty = !pantangan || /^tidak ada$/i.test(pantangan);
        return '<header class="restriction-head"><strong>' + NC.esc(row.pasien) + '</strong><small>' + NC.esc(room(row.pasien)) + '</small></header>' +
            '<div class="restriction-tags">' +
            '<span class="restriction-tag' + (alergiEmpty ? ' is-empty' : ' is-danger') + '"><small>Alergi</small><b>' +
            NC.esc(alergiEmpty ? 'Tidak ada' : alergi) + '</b></span>' +
            '<span class="restriction-tag' + (pantanganEmpty ? ' is-empty' : ' is-warn') + '"><small>Pantangan</small><b>' +
            NC.esc(pantanganEmpty ? 'Tidak ada' : pantangan) + '</b></span>' +
            '</div>' +
            (row.catatan ? '<p class="restriction-note">' + NC.esc(row.catatan) + '</p>' : '');
    }

    function showRestriction(row) {
        NC.detail(row.pasien, [
            ['Ruangan', room(row.pasien)],
            ['Alergi', row.alergi || 'Tidak ada'],
            ['Pantangan', row.pantangan || 'Tidak ada'],
            ['Catatan', row.catatan || '-']
        ], 'Catatan ini dipakai ahli gizi saat menyusun rekomendasi menu.');
    }

    NC.crud({
        mount: '#crud-pantangan-perawat',
        store: restrictions,
        noun: 'alergi/pantangan',
        label: function (row) { return 'catatan alergi/pantangan untuk ' + row.pasien; },
        addLabel: 'Tambah alergi atau pantangan',
        searchPlaceholder: 'Cari pasien, alergi, atau pantangan',
        search: ['pasien', 'alergi', 'pantangan'],
        sort: function (a, b) { return a.pasien.localeCompare(b.pasien); },
        empty: { title: 'Belum ada catatan alergi/pantangan', hint: 'Tambahkan informasi setelah pasien tersimpan.' },
        layout: 'cards',
        card: restrictionCard,
        onRowClick: showRestriction,
        chips: {
            label: 'Kategori',
            key: 'kategori',
            value: restrictionCategory,
            options: ['Ada alergi', 'Ada pantangan', 'Nihil']
        },
        fields: [
            { key: 'pasien', label: 'Nama pasien', type: 'select', required: true, options: patientNames },
            { key: 'alergi', label: 'Alergi', required: true, placeholder: 'Isi “Tidak ada” bila nihil' },
            { key: 'pantangan', label: 'Pantangan makanan', required: true, placeholder: 'Isi “Tidak ada” bila nihil' },
            { key: 'catatan', label: 'Catatan tambahan', type: 'textarea', full: true }
        ]
    });

    // ---- Rekomendasi menu: hanya yang sudah dikirim ke perawat ----
    // Pemeriksaan alergi di sini bersifat pengingat baca-saja: menyalin
    // catatan alergi pasien dan mencocokkannya dengan komposisi menu.
    function allergenHits(row) {
        var catatan = restrictionFor(row.pasien);
        if (!catatan) return [];
        var teks = String(row.menu || '') + ' ' + String(row.komposisi || '');
        teks = teks.toLowerCase();
        return String(catatan.alergi || '')
            .split(/[,;\/]|\sdan\s/i)
            .map(function (item) { return item.trim(); })
            .filter(function (item) {
                return item && !/^tidak ada$/i.test(item) && teks.indexOf(item.toLowerCase()) !== -1;
            });
    }

    function rekomendasiCard(row) {
        var hits = allergenHits(row);
        return '<header class="rekom-head"><div><strong>' + NC.esc(row.menu) + '</strong><small>' +
            NC.esc(row.pasien) + ' · ' + NC.esc(room(row.pasien)) + '</small></div><span class="rekom-kalori">' +
            NC.esc(row.kalori ? row.kalori + ' kkal' : '-') + '</span></header>' +
            '<div class="rekom-meta"><span class="rekom-pill">' + NC.esc(row.waktu) + '</span>' +
            '<span class="rekom-pill">Tekstur ' + NC.esc(row.tekstur || '-') + '</span>' +
            '<span class="rekom-pill is-diet">' + NC.esc(row.diet || '-') + '</span></div>' +
            (row.komposisi ? '<p class="rekom-komposisi">' + NC.esc(row.komposisi) + '</p>' : '') +
            (hits.length ? '<p class="rekom-alert">⚠ Mengandung ' + NC.esc(hits.join(', ').toLowerCase()) +
                ' — tercatat sebagai alergi pasien.</p>' : '');
    }

    function showRekomendasi(row) {
        var hits = allergenHits(row);
        NC.detail(row.menu, [
            ['Pasien', row.pasien + ' · ' + room(row.pasien)],
            ['Tanggal', NC.fmtDate ? NC.fmtDate(row.tanggal) : (row.tanggal || '-')],
            ['Waktu makan', row.waktu || '-'],
            ['Tekstur', row.tekstur || '-'],
            ['Target kalori', row.kalori ? row.kalori + ' kkal' : '-'],
            ['Diet', row.diet || '-'],
            ['Komposisi', row.komposisi || '-'],
            ['Catatan dapur', row.catatan || '-']
        ], hits.length
            ? 'Perhatian: komposisi memuat ' + hits.join(', ').toLowerCase() + ', sementara catatan alergi pasien menyebut hal yang sama. Konfirmasi ke ahli gizi sebelum disajikan.'
            : 'Menu sudah dikirim ahli gizi dan siap dicocokkan dengan kondisi pasien.');
    }

    NC.crud({
        mount: '#p-rekomendasi',
        store: recommendations,
        source: recommendationRows,
        readOnly: true,
        noun: 'rekomendasi',
        searchPlaceholder: 'Cari menu, pasien, atau komposisi',
        search: ['menu', 'pasien', 'komposisi', 'diet'],
        sort: function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); },
        empty: { title: 'Belum ada rekomendasi yang dikirim', hint: 'Menu ahli gizi akan tampil setelah dikirim untuk ditindaklanjuti.' },
        layout: 'cards',
        card: rekomendasiCard,
        onRowClick: showRekomendasi,
        chips: { label: 'Waktu makan', key: 'waktu', options: ['Sarapan', 'Makan siang', 'Makan malam', 'Snack'] }
    });

    // ---- Laporan kondisi: kartu ringkas dengan penanda waktu ----
    function shortDate(value) {
        if (!value) return '-';
        var date = new Date(String(value) + 'T00:00:00');
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    }

    function catatanCard(row) {
        var tanggal = shortDate(row.tanggal);
        return '<header class="catatan-head">' +
            '<span class="catatan-time"><b>' + NC.esc(String(row.waktu || '-').replace(':', '.')) + '</b><small>' +
            NC.esc(tanggal) + '</small></span>' +
            '<div class="catatan-who"><strong>' + NC.esc(row.pasien) + '</strong><small>' + NC.esc(room(row.pasien)) + '</small></div>' +
            NC.badge(row.status) + '</header>' +
            '<p class="catatan-info">' + NC.esc(row.info) + '</p>';
    }

    function showCatatan(row) {
        NC.detail('Laporan ' + row.pasien, [
            ['Pasien', row.pasien + ' · ' + room(row.pasien)],
            ['Tanggal', row.tanggal ? NC.fmtDate(row.tanggal) : '-'],
            ['Waktu', row.waktu || '-'],
            ['Status tindak lanjut', row.status || '-'],
            ['Laporan kondisi', row.info || '-']
        ], row.status === 'Evaluasi'
            ? 'Laporan ini berstatus evaluasi. Koordinasikan dengan ahli gizi atau tim medis sebelum mengubah rekomendasi menu.'
            : 'Laporan ini juga tampil pada dashboard ahli gizi sebagai dasar penyesuaian menu.');
    }

    NC.crud({
        mount: '#crud-catatan',
        store: reports,
        noun: 'laporan kondisi',
        addLabel: 'Tambah laporan',
        searchPlaceholder: 'Cari nama pasien atau kondisi',
        search: ['pasien', 'info', 'status'],
        sort: function (a, b) { return String(b.tanggal + b.waktu).localeCompare(String(a.tanggal + a.waktu)); },
        label: function (row) { return 'laporan ' + row.pasien; },
        empty: { title: 'Belum ada laporan', hint: 'Tambahkan laporan kondisi pasien untuk berkoordinasi dengan ahli gizi.' },
        layout: 'cards',
        card: catatanCard,
        onRowClick: showCatatan,
        chips: { label: 'Status', key: 'status', options: ['Baru', 'Evaluasi', 'Ditinjau'] },
        actionsFirst: true,
        actions: [
            {
                label: 'Tandai ditinjau',
                show: function (row) { return row.status !== 'Ditinjau'; },
                mutates: true,
                loadingText: 'Menyimpan...',
                successMessage: function (row) { return 'Laporan ' + row.pasien + ' ditandai ditinjau.'; },
                run: async function (row) {
                    return await reports.update(row.id, { status: 'Ditinjau' });
                }
            }
        ],
        fields: [
            { key: 'pasien', label: 'Nama pasien', type: 'select', required: true, options: patientNames },
            { key: 'info', label: 'Laporan kondisi', type: 'textarea', required: true, full: true, placeholder: 'Contoh: Nafsu makan menurun sejak pagi' },
            { key: 'tanggal', label: 'Tanggal laporan', type: 'date', required: true, default: function () { return NC.day(0); } },
            { key: 'waktu', label: 'Waktu laporan', type: 'time', required: true, default: function () { return new Date().toTimeString().slice(0, 5); } },
            { key: 'status', label: 'Status tindak lanjut', type: 'select', required: true, options: ['Baru', 'Evaluasi', 'Ditinjau'], default: 'Baru' }
        ]
    });

    // ---- Jadwal makan: kartu per jam ----
    function jadwalCard(row) {
        return '<header class="jadwal-head">' +
            '<span class="jadwal-jam"><b>' + NC.esc(String(row.jam || '-').replace(':', '.')) + '</b><small>' +
            NC.esc(row.waktu || '-') + '</small></span>' +
            '<div class="jadwal-who"><strong>' + NC.esc(row.pasien) + '</strong><small>' +
            NC.esc(room(row.pasien)) + ' · ' + NC.esc(row.menu) + '</small></div>' +
            NC.badge(row.status) + '</header>';
    }

    function showJadwal(row) {
        var catatan = row.status === 'Terkirim'
            ? 'Menu sudah diterima pasien. Catat bila ada keluhan setelah makan pada halaman Laporan kondisi.'
            : (row.status === 'Menunggu'
                ? 'Menu masih menunggu persiapan dapur. Perawat hanya meneruskan informasi kamar kepada waiter.'
                : 'Jadwal sudah dibuat ahli gizi dan belum masuk antrean dapur.');
        NC.detail(row.pasien, [
            ['Ruangan', room(row.pasien)],
            ['Waktu makan', row.waktu || '-'],
            ['Jam antar', row.jam || '-'],
            ['Menu', row.menu || '-'],
            ['Status', row.status || '-']
        ], catatan);
    }

    NC.crud({
        mount: '#crud-jadwal-perawat',
        store: schedules,
        noun: 'jadwal makan',
        readOnly: true,
        searchPlaceholder: 'Cari pasien atau menu',
        search: ['pasien', 'menu', 'waktu'],
        sort: function (a, b) { return String(a.jam).localeCompare(String(b.jam)); },
        empty: { title: 'Belum ada jadwal', hint: 'Jadwal makan akan tampil setelah dibuat oleh ahli gizi.' },
        layout: 'cards',
        card: jadwalCard,
        onRowClick: showJadwal,
        chips: { label: 'Status', key: 'status', options: ['Terjadwal', 'Menunggu', 'Terkirim'] }
    });

    function render() {
        var patientRows = patients.all();
        var reportRows = reports.all();
        var scheduleRows = schedules.all();
        // Yang paling perlu ditangani lebih dulu: evaluasi, lalu laporan terbaru.
        var openReports = reportRows.filter(function (row) { return row.status !== 'Ditinjau'; })
            .sort(function (a, b) {
                var rank = function (row) { return row.status === 'Evaluasi' ? 0 : 1; };
                return rank(a) - rank(b) || String(b.waktu).localeCompare(String(a.waktu));
            });
        var activeRows = patientRows.filter(function (row) { return row.status !== 'Pulang'; });
        var alertRows = restrictions.all().filter(function (row) {
            return row.alergi && !/^tidak ada$/i.test(String(row.alergi).trim());
        });
        var delivered = scheduleRows.filter(function (row) { return row.status === 'Terkirim'; }).length;
        var waiting = scheduleRows.length - delivered;
        var percent = scheduleRows.length ? Math.round((delivered / scheduleRows.length) * 100) : 0;

        NC.set('p-total', activeRows.length);
        NC.set('p-laporan', reportRows.length);
        NC.set('p-evaluasi', openReports.length);
        NC.set('p-jadwal', scheduleRows.length);

        var hour = new Date().getHours();
        var shift = hour < 14 ? 'Shift pagi, 07.00-14.00' : (hour < 21 ? 'Shift siang, 14.00-21.00' : 'Shift malam, 21.00-07.00');
        var tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
        NC.set('p-summary', tanggal + '. ' + shift + '. ' + activeRows.length + ' pasien aktif, ' +
            alertRows.length + ' catatan alergi, ' + waiting + ' jadwal belum terkirim.');
        NC.set('p-distribusi', delivered + ' / ' + scheduleRows.length);

        var fill = document.getElementById('p-distribusi-fill');
        if (fill) fill.style.width = percent + '%';

        var chipMount = document.getElementById('p-distribusi-chips');
        if (chipMount) {
            chipMount.innerHTML = [
                ['Terkirim', delivered],
                ['Belum terkirim', waiting],
                ['Total jadwal', scheduleRows.length]
            ].map(function (item) {
                return '<span class="dash-chip"><b>' + item[1] + '</b> ' + item[0] + '</span>';
            }).join('');
        }

        var belumMount = document.getElementById('p-distribusi-belum');
        if (belumMount) {
            var belumRows = scheduleRows.filter(function (row) { return row.status !== 'Terkirim'; }).slice(0, 4);
            belumMount.innerHTML = '<div class="clinic-sublist"><p class="clinic-sublist-title">Belum terkirim</p>' +
                (belumRows.length
                    ? '<ul>' + belumRows.map(function (row) {
                        return '<li><span>' + NC.esc(row.pasien) + ', ' + NC.esc(room(row.pasien)) + '</span><time>' +
                            NC.esc(String(row.jam || row.waktu || '-')) + '</time></li>';
                    }).join('') + '</ul>'
                    : '<p class="clinic-sublist-empty">Semua jadwal hari ini sudah terkirim.</p>') + '</div>';
        }

        var restrictionRows = restrictions.all();
        var alergiAktif = restrictionRows.filter(function (row) {
            var value = String(row.alergi || '').trim();
            return value && !/^tidak ada$/i.test(value);
        }).length;
        var pantanganAktif = restrictionRows.filter(function (row) {
            var value = String(row.pantangan || '').trim();
            return value && !/^tidak ada$/i.test(value);
        }).length;
        NC.set('p-pantangan-ringkas', restrictionRows.length + ' pasien tercatat · ' + alergiAktif + ' alergi · ' + pantanganAktif + ' pantangan');

        var laporanBaru = reportRows.filter(function (row) { return row.status === 'Baru'; }).length;
        var laporanEvaluasi = reportRows.filter(function (row) { return row.status === 'Evaluasi'; }).length;
        NC.set('p-catatan-ringkas', reportRows.length
            ? reportRows.length + ' laporan · ' + laporanBaru + ' baru · ' + laporanEvaluasi + ' evaluasi'
            : 'Data ini juga tampil pada dashboard ahli gizi.');

        var timelineMount = document.getElementById('p-timeline');
        if (timelineMount) {
            var timeline = reportRows.slice().sort(function (a, b) {
                return String(b.tanggal + b.waktu).localeCompare(String(a.tanggal + a.waktu));
            }).slice(0, 6);
            timelineMount.innerHTML = timeline.length
                ? timeline.map(function (row) {
                    return '<li><time>' + NC.esc(String(row.waktu).replace(':', '.')) + '</time><div><strong>' +
                        NC.esc(row.pasien) + ', ' + NC.esc(room(row.pasien)) + '</strong><p>' + NC.esc(row.info) +
                        '</p></div>' + NC.badge(row.status) + '</li>';
                }).join('')
                : '<li class="dash-empty">Belum ada aktivitas hari ini.</li>';
        }

        var tindakanMount = document.getElementById('p-tindakan');
        if (tindakanMount) {
            tindakanMount.innerHTML = openReports.length
                ? '<ul class="queue">' + openReports.slice(0, 5).map(function (row) {
                    var tone = row.status === 'Evaluasi' ? 'critical' : 'warning';
                    return '<li class="queue-row" data-tone="' + tone + '">' +
                        '<div class="queue-body"><p class="queue-title">' + NC.esc(row.pasien) + ', ' + NC.esc(room(row.pasien)) +
                        '</p><p class="queue-note">' + NC.esc(row.info) + '</p></div>' +
                        '<span class="queue-meta">' + NC.esc(String(row.waktu).replace(':', '.')) + '</span>' +
                        NC.badge(row.status) +
                        '<a class="queue-action" href="#catatan">Buka laporan</a></li>';
                }).join('') + '</ul>'
                : '<p class="queue-empty">Tidak ada yang perlu ditangani saat ini.</p>';
        }

        document.getElementById('p-ringkas').innerHTML = patientRows.length
            ? '<div class="table-wrap"><table><thead><tr><th>Pasien</th><th>Ruangan</th><th>Diagnosis</th><th>Status</th></tr></thead><tbody>' +
                patientRows.slice(0, 5).map(function (row) {
                    return '<tr><td><strong>' + NC.esc(row.nama) + '</strong></td><td>' + NC.esc(row.ruangan) + '</td><td>' +
                        (row.diagnosis ? NC.esc(row.diagnosis) : '<span class="cell-empty">-</span>') + '</td><td>' +
                        NC.badge(row.status) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
            : '<div class="empty"><strong>Belum ada pasien</strong><p>Data pasien akan tampil setelah ditambahkan oleh ahli gizi.</p></div>';

        var sentRows = recommendationRows();
        var pasienTerkirim = sentRows.reduce(function (list, row) {
            if (list.indexOf(row.pasien) === -1) list.push(row.pasien);
            return list;
        }, []).length;
        NC.set('p-rekomendasi-ringkas', sentRows.length
            ? sentRows.length + ' menu terkirim untuk ' + pasienTerkirim + ' pasien · klik kartu untuk melihat komposisi'
            : 'Belum ada menu yang dikirim ahli gizi.');

        var jadwalMenunggu = scheduleRows.filter(function (row) { return row.status === 'Menunggu'; }).length;
        var jadwalTerkirim = scheduleRows.filter(function (row) { return row.status === 'Terkirim'; }).length;
        NC.set('p-jadwal-panel', scheduleRows.length
            ? scheduleRows.length + ' jadwal · ' + jadwalMenunggu + ' menunggu · ' + jadwalTerkirim + ' terkirim'
            : 'Menu dan jadwal dibuat ahli gizi; perawat meneruskan informasi kamar kepada waiter.');

        document.getElementById('p-jadwal-siap').innerHTML = readyRows().length
            ? '<div class="handoff-list">' + readyRows().map(function (row) {
                return '<div class="handoff-row"><span class="handoff-jam">' + NC.esc(String(row.jam || '-').replace(':', '.')) +
                    '</span><div class="handoff-who"><strong>' + NC.esc(row.pasien) + '</strong><small>' +
                    NC.esc(row.ruangan || '-') + ' · ' + NC.esc(row.menu) + '</small></div>' +
                    '<span class="handoff-tag">Siap</span></div>';
            }).join('') + '</div>'
            : '<div class="empty"><strong>Belum ada menu siap antar</strong><p>Handoff muncul setelah dapur menyelesaikan persiapan.</p></div>';

        document.getElementById('p-jadwal-ringkas').innerHTML = scheduleRows.length
            ? '<div class="table-wrap"><table><thead><tr><th>Jam</th><th>Pasien</th><th>Menu</th><th>Status</th></tr></thead><tbody>' +
                scheduleRows.slice().sort(function (a, b) { return a.jam.localeCompare(b.jam); }).map(function (row) {
                    return '<tr><td>' + NC.esc(row.jam.replace(':', '.')) + '</td><td><strong>' + NC.esc(row.pasien) +
                        '</strong><small>' + NC.esc(room(row.pasien)) + '</small></td><td>' + NC.esc(row.menu) + '</td><td>' +
                        NC.badge(row.status) + '</td></tr>';
                }).join('') + '</tbody></table></div>'
            : '<div class="empty"><strong>Belum ada jadwal</strong><p>Jadwal makan akan tampil di sini.</p></div>';
    }

    NC.onRender(render);
    render();
    NC.settings('perawat', { nama: '', email: '', telepon: '' });
    NC.today();
    NC.router('Perawat');
})();
