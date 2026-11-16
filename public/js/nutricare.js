(function () {
    'use strict';

    var stores = {};
    var renderers = [];
    var crudInstances = [];
    var nextCrudId = 0;
    var toastTimer;
    var supportedThemes = ['dark', 'light', 'original'];

    function waitForPaint() {
        return new Promise(function (resolve) {
            var schedule = window.requestAnimationFrame || function (callback) { return window.setTimeout(callback, 16); };
            schedule(function () { schedule(resolve); });
        });
    }

    function setBusy(button, label) {
        if (!button) return function () {};
        var original = button.innerHTML;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = label;
        return function () {
            if (!button.isConnected) return;
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.innerHTML = original;
        };
    }

    function setTheme(theme) {
        var selected = supportedThemes.indexOf(theme) === -1 ? 'original' : theme;
        document.body.setAttribute('data-theme', selected);
        localStorage.setItem('nutricare-theme', selected);
        document.querySelectorAll('[data-theme-choice]').forEach(function (button) {
            button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-choice') === selected));
        });
        return selected;
    }

    function initializeTheme() {
        var selected = localStorage.getItem('nutricare-theme') || 'original';
        if (supportedThemes.indexOf(selected) === -1) selected = 'original';
        document.body.setAttribute('data-theme', selected);
    }

    initializeTheme();

    document.addEventListener('click', function (event) {
        var logout = event.target.closest && event.target.closest('a.logout');
        if (!logout) return;
        event.preventDefault();
        var token = sessionStorage.getItem('nutricare-token');
        var destination = logout.href;
        if (!token) {
            window.location.assign(destination);
            return;
        }
        fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
            .catch(function () {})
            .finally(function () {
                sessionStorage.removeItem('nutricare-token');
                window.location.assign(destination);
            });
    });

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function notify() {
        crudInstances.forEach(function (instance) { instance.render(); });
        renderers.forEach(function (render) { render(); });
    }

    function refreshAll() {
        var failures = [];
        // Buang snapshot klien agar data benar-benar diambil ulang (satu permintaan gabungan).
        if (window.NutriCareApi && typeof window.NutriCareApi.invalidate === 'function') {
            window.NutriCareApi.invalidate();
        }
        Object.keys(stores).forEach(function (name) {
            try { stores[name].refresh(); }
            catch (error) { failures.push(name + ': ' + error.message); }
        });
        notify();
        if (failures.length) throw new Error('Pembaruan data gagal untuk ' + failures.join('; '));
        return true;
    }

    function makeStore(name, defaults) {
        if (stores[name]) return stores[name];

        var api = window.NutriCareApi;
        var route = api && api.resources[name];
        var rows = route ? api.request('GET', route) : [];
        if (!Array.isArray(rows)) throw new Error('Respons API ' + name + ' tidak valid.');

        function request(method, path, body) {
            if (!api || !route) throw new Error('API route untuk ' + name + ' tidak tersedia; data server tidak dapat diubah.');
            return method === 'GET'
                ? api.request(method, path || route, body)
                : requestAsync(method, path || route, body);
        }
        function persist() { notify(); }
        function requireResult(result) {
            if (!result || typeof result.then !== 'function') throw new Error('Adapter API belum siap untuk mengonfirmasi aksi. Muat ulang halaman dan coba lagi.');
            return result;
        }
        function requestAsync(method, path, body) {
            if (!api || typeof api.requestAsync !== 'function') return Promise.reject(new Error('Adapter API async tidak tersedia. Muat ulang halaman dan coba lagi.'));
            return api.requestAsync(method, path, body);
        }

        stores[name] = {
            name: name,
            route: route,
            all: function () { return clone(rows); },
            refresh: function () {
                if (!route) return;
                var freshRows = request('GET', route);
                if (!Array.isArray(freshRows)) throw new Error('Respons API ' + name + ' tidak valid.');
                rows.splice.apply(rows, [0, rows.length].concat(freshRows));
            },
            add: function (row) {
                return requireResult(request('POST', route, row)).then(function (saved) {
                    rows.push(saved);
                    persist();
                    return clone(saved);
                });
            },
            addIntake: function (row) {
                if (name !== 'pasien' || !api) throw new Error('Intake atomik hanya tersedia untuk pasien.');
                return requireResult(requestAsync('POST', '/pasien/intake', row)).then(function (result) {
                    if (!result || !result.patient || !Array.isArray(result.restrictions)) throw new Error('Respons intake pasien tidak valid.');
                    rows.push(result.patient);
                    if (stores.pantangan) Array.prototype.push.apply(stores.pantangan._rows(), result.restrictions);
                    persist();
                    return clone(result.patient);
                });
            },
            // Pasien lama (sudah pulang) didaftarkan kembali memakai identitas yang sama.
            readmit: function (id, row) {
                if (name !== 'pasien' || !api) throw new Error('Pendaftaran ulang hanya tersedia untuk pasien.');
                return requireResult(requestAsync('POST', '/pasien/' + encodeURIComponent(id) + '/masuk-kembali', row)).then(function (saved) {
                    if (!saved || !saved.id) throw new Error('Respons pendaftaran ulang pasien tidak valid.');
                    rows.push(saved);
                    persist();
                    return clone(saved);
                });
            },
            _rows: function () { return rows; },
            update: function (id, values) {
                var index = rows.findIndex(function (row) { return row.id === id; });
                if (index < 0) throw new Error('Data ' + name + ' tidak ditemukan.');
                return requireResult(request('PATCH', route + '/' + encodeURIComponent(id), values)).then(function (updated) {
                    rows[index] = updated;
                    persist();
                    return clone(rows[index]);
                });
            },
            remove: function (id) {
                var index = rows.findIndex(function (row) { return row.id === id; });
                if (index < 0) throw new Error('Data ' + name + ' tidak ditemukan.');
                return requireResult(request('DELETE', route + '/' + encodeURIComponent(id))).then(function () {
                    rows.splice(index, 1);
                    persist();
                });
            },
            reset: function () {
                throw new Error('Reset data server tidak tersedia; data demo lokal tidak akan dipakai.');
            }
        };
        return stores[name];
    }

    function fieldOptions(field) {
        return typeof field.options === 'function' ? field.options() : (field.options || []);
    }

    function defaultValue(field) {
        return typeof field.default === 'function' ? field.default() : (field.default == null ? '' : field.default);
    }

    function fieldMarkup(field, current, id) {
        var value = current == null ? '' : current;
        var required = field.required ? ' required' : '';
        var readOnly = field.readOnly ? ' readonly' : '';
        var min = field.min == null ? '' : ' min="' + escapeHtml(field.min) + '"';

        // Input numerik/teks dapat dihitung otomatis dan tetap ikut terkirim.
        // `readonly` menjaga nilainya, berbeda dari `disabled` yang dikeluarkan dari form.
        var max = field.max == null ? '' : ' max="' + escapeHtml(field.max) + '"';
        var placeholder = field.placeholder ? ' placeholder="' + escapeHtml(field.placeholder) + '"' : '';
        var label = '<label for="' + id + '">' + escapeHtml(field.label) + (field.required ? ' <span aria-hidden="true">*</span>' : '') + '</label>';
        var control;

        if (field.type === 'select') {
            control = '<select id="' + id + '" name="' + escapeHtml(field.key) + '"' + required + '><option value="">Pilih opsi</option>' +
                fieldOptions(field).map(function (option) {
                    var optionValue = option && typeof option === 'object' ? option.value : option;
                    var optionLabel = option && typeof option === 'object' ? option.label : option;
                    var selected = String(value) === String(optionValue) ? ' selected' : '';
                    return '<option value="' + escapeHtml(optionValue) + '"' + selected + '>' + escapeHtml(optionLabel) + '</option>';
                }).join('') + '</select>';
        } else if (field.type === 'textarea') {
            control = '<textarea id="' + id + '" name="' + escapeHtml(field.key) + '"' + required + placeholder + '>' + escapeHtml(value) + '</textarea>';
        } else if (field.datalist) {
            // Kolom teks dengan saran: pengguna tetap bisa mengetik untuk
            // mencocokkan, dan daftar pilihan tampil seperti dropdown.
            var listId = id + '-list';
            var saran = typeof field.datalist === 'function' ? field.datalist() : field.datalist;
            control = '<input id="' + id + '" name="' + escapeHtml(field.key) + '" type="text" value="' +
                escapeHtml(value) + '"' + required + placeholder + ' list="' + escapeHtml(listId) + '" autocomplete="off">' +
                '<datalist id="' + escapeHtml(listId) + '">' + (saran || []).map(function (option) {
                    return '<option value="' + escapeHtml(option) + '"></option>';
                }).join('') + '</datalist>';
        } else {
            control = '<input id="' + id + '" name="' + escapeHtml(field.key) + '" type="' + escapeHtml(field.type || 'text') + '" value="' +
                escapeHtml(value) + '"' + required + readOnly + min + max + placeholder + '>';
        }
        return '<div class="field' + (field.full ? ' full' : '') + '">' + label + control + '</div>';
    }

    // Cermin matriks izin server (server/src/rbac.ts). Dipakai hanya untuk
    // menyembunyikan tombol yang pasti ditolak server, supaya pengguna tidak
    // menekan tombol lalu mendapat "Anda tidak memiliki izin untuk aksi ini.".
    // c=create, r=read, u=update, d=delete, a=action
    var IZIN_PERAN = {
        'ahli-gizi': { pasien: 'crud', pantangan: 'crud', rekomendasi: 'crud', jadwal: 'crud', perawat: 'crud', bahan: 'crud', logistik: 'r' },
        perawat: { pasien: 'crud', pantangan: 'crud', rekomendasi: 'r', jadwal: 'r', perawat: 'crud', bahan: '', logistik: '' },
        waiter: { pasien: '', pantangan: '', rekomendasi: '', jadwal: 'ra', perawat: '', bahan: '', logistik: '' },
        logistik: { pasien: '', pantangan: '', rekomendasi: 'r', jadwal: '', perawat: '', bahan: 'crud', logistik: 'crud' }
    };

    function izinAksi(resource, aksi) {
        var user = sessionUser();
        var role = user && user.role;
        // Mode demo atau peran tak dikenal: jangan sembunyikan apa pun.
        if (!role || !IZIN_PERAN[role]) return true;
        var daftar = IZIN_PERAN[role][resource];
        if (daftar == null) return true;
        var huruf = { create: 'c', read: 'r', update: 'u', delete: 'd', action: 'a' }[aksi];
        return daftar.indexOf(huruf) >= 0;
    }

    function crud(options) {
        var mount = document.querySelector(options.mount);
        if (!mount) throw new Error('Area CRUD tidak ditemukan: ' + options.mount);
        var crudId = nextCrudId++;

        var instance = {
            options: options,
            mount: mount,
            query: '',
            filterValue: '',
            // Tanggal yang dipilih pada filter tanggal (kosong = semua tanggal,
            // kecuali `hidePast` aktif).
            dateValue: '',
            formOpen: false,
            editingId: null,
            initialValues: null,
            // Isi form yang sedang diketik, disimpan sementara supaya pembaruan
            // data otomatis (tiap 30 detik) tidak menghapus ketikan pengguna.
            draft: null,
            render: render
        };
        crudInstances.push(instance);

        function getRows() {
            // `source` dipakai bila daftar yang ditampilkan bukan seluruh isi
            // store (mis. perawat hanya melihat rekomendasi berstatus Dikirim).
            var rows = typeof options.source === 'function' ? options.source() : options.store.all();
            var search = instance.query.trim().toLowerCase();
            if (search) {
                rows = rows.filter(function (row) {
                    return (options.search || []).some(function (key) {
                        return String(row[key] == null ? '' : row[key]).toLowerCase().indexOf(search) !== -1;
                    });
                });
            }
            if (instance.filterValue) {
                var filterCfg = options.filter || options.chips;
                if (filterCfg) {
                    rows = rows.filter(function (row) {
                        var value = filterCfg.value ? filterCfg.value(row) : row[filterCfg.key];
                        return String(value) === instance.filterValue;
                    });
                }
            }
            // Filter tanggal: bila pengguna memilih satu tanggal, hanya data
            // pada tanggal itu yang tampil (termasuk data lama). Bila belum
            // memilih, `hidePast` menyembunyikan data yang tanggalnya sudah lewat.
            if (options.dateFilter) {
                var dateKey = options.dateFilter.key || 'tanggal';
                if (instance.dateValue) {
                    rows = rows.filter(function (row) { return String(row[dateKey] || '') === instance.dateValue; });
                } else if (options.hidePast) {
                    var batasTanggal = day(0);
                    rows = rows.filter(function (row) { return String(row[dateKey] || '') >= batasTanggal; });
                }
            }
            if (options.sort) rows.sort(options.sort);
            return rows;
        }

        // Formulir tambah/ubah tampil sebagai dialog di atas tabel, bukan
        // mendorong tabel ke bawah. Satu dialog dipakai ulang per area CRUD.
        var formDialog = null;

        function ensureFormDialog() {
            if (formDialog && document.body.contains(formDialog)) return formDialog;
            formDialog = document.createElement('dialog');
            formDialog.className = 'crud-dialog';
            formDialog.innerHTML = '<form class="crud-form" novalidate>' +
                '<div class="crud-dialog-head">' +
                '<div><h3 class="crud-dialog-title"></h3><p class="crud-dialog-sub"></p></div>' +
                '<button type="button" class="crud-dialog-close" data-form-cancel aria-label="Tutup formulir">✕</button>' +
                '</div>' +
                '<div class="crud-dialog-body"></div>' +
                '<div class="form-msg" role="alert"></div>' +
                '<div class="form-actions"><button type="button" class="btn btn-ghost" data-form-cancel>Batal</button>' +
                '<button type="submit" class="btn">Simpan</button></div>' +
                '</form>';
            document.body.appendChild(formDialog);
            formDialog.querySelector('form').addEventListener('submit', saveForm);
            formDialog.querySelectorAll('[data-form-cancel]').forEach(function (button) {
                button.addEventListener('click', function () { formDialog.close('cancel'); });
            });
            // Klik di luar kartu menutup dialog, sama seperti tombol Batal.
            formDialog.addEventListener('click', function (event) {
                if (event.target === formDialog) formDialog.close('cancel');
            });
            formDialog.addEventListener('close', function () {
                instance.formOpen = false;
                instance.editingId = null;
                instance.initialValues = null;
                instance.draft = null;
            });
            return formDialog;
        }

        function openForm(id, values) {
            var old = id ? findRow(id) : null;
            instance.formOpen = true;
            instance.editingId = old ? old.id : null;
            instance.initialValues = values || null;
            instance.draft = null;

            var dialog = ensureFormDialog();
            var fields = (options.fields || []).filter(function (field) { return !old || !field.createOnly; });
            dialog.querySelector('.crud-dialog-title').textContent = old
                ? 'Ubah ' + (options.noun || 'data')
                : (options.addLabel || ('Tambah ' + (options.noun || 'data')));
            dialog.querySelector('.crud-dialog-sub').textContent = old
                ? 'Perbarui data lalu simpan perubahan.'
                : (options.formHint || 'Lengkapi data berikut, lalu simpan.');
            dialog.querySelector('.crud-dialog-body').innerHTML =
                (typeof options.formIntro === 'function' ? options.formIntro(old) : (options.formIntro || '')) +
                '<div class="form-grid">' + fields.map(function (field) {
                    var value = old ? old[field.key]
                        : (values && values[field.key] != null ? values[field.key] : defaultValue(field));
                    return fieldMarkup(field, value, 'crud-' + crudId + '-' + field.key);
                }).join('') + '</div>';
            var message = dialog.querySelector('.form-msg');
            message.textContent = '';
            if (typeof options.formReady === 'function') {
                options.formReady(dialog.querySelector('.crud-form'), { old: old, dialog: dialog, instance: instance });
            }
            if (!dialog.open) dialog.showModal();
            var first = dialog.querySelector('.crud-dialog-body input, .crud-dialog-body select, .crud-dialog-body textarea');
            if (first) first.focus();
        }

        function render() {
            var rows = getRows();
            var filter = options.filter;
            if (options.dense) mount.classList.add('crud-dense');
            var resource = (options.store && options.store.name) || options.resource || '';
            var bolehTambah = !options.readOnly && izinAksi(resource, 'create');
            var bolehUbah = !options.readOnly && izinAksi(resource, 'update');
            var bolehHapus = !options.readOnly && izinAksi(resource, 'delete');
            var toolBar = '<div class="crud-toolbar">' +
                '<label class="crud-search"><span class="sr-only">Cari</span><input type="search" data-search placeholder="' +
                escapeHtml(options.searchPlaceholder || 'Cari data') + '" value="' + escapeHtml(instance.query) + '"></label>' +
                (options.dateFilter ? '<label class="crud-filter crud-date"><span class="sr-only">' +
                    escapeHtml(options.dateFilter.label || 'Tanggal') + '</span><input type="date" data-date-filter value="' +
                    escapeHtml(instance.dateValue) + '"></label>' +
                    (instance.dateValue ? '<button type="button" class="btn btn-ghost btn-small" data-date-clear>Semua tanggal</button>' : '') : '') +
                (filter ? '<label class="crud-filter"><span class="sr-only">' + escapeHtml(filter.label) +
                    '</span><select data-filter><option value="">Semua ' + escapeHtml(filter.label.toLowerCase()) + '</option>' +
                    filter.options.map(function (value) {
                        return '<option value="' + escapeHtml(value) + '"' + (instance.filterValue === String(value) ? ' selected' : '') + '>' + escapeHtml(value) + '</option>';
                    }).join('') + '</select></label>' : '') +
                (bolehTambah ? '<button type="button" class="btn" data-action="add">＋ ' + escapeHtml(options.addLabel || 'Tambah data') + '</button>' : '') +
                '</div>';

            // Filter berbentuk chip: lebih cepat dipakai di layar lebar dan
            // tetap terbaca di ponsel tanpa membuka menu pilihan.
            if (options.chips) {
                var chipList = typeof options.chips.options === 'function' ? options.chips.options() : options.chips.options;
                toolBar = '<div class="crud-chips" role="group" aria-label="Filter ' + escapeHtml(options.chips.label || 'data') + '">' +
                    [''].concat(chipList || []).map(function (value) {
                        var active = String(instance.filterValue || '') === String(value);
                        return '<button type="button" class="crud-chip' + (active ? ' is-active' : '') + '" data-chip="' +
                            escapeHtml(value) + '" aria-pressed="' + active + '">' + escapeHtml(value || 'Semua') + '</button>';
                    }).join('') + '</div>' + toolBar;
            }

            var buttonsFor = function (row) {
                var baseButtons = [];
                if (bolehUbah) {
                    baseButtons.push('<button type="button" class="btn btn-ghost btn-small" data-action="edit" data-id="' + escapeHtml(row.id) + '">Ubah</button>');
                }
                if (bolehHapus) {
                    baseButtons.push('<button type="button" class="btn btn-danger btn-small" data-action="delete" data-id="' + escapeHtml(row.id) + '">' + escapeHtml(options.deleteLabel || 'Hapus') + '</button>');
                }
                var customButtons = [];
                (options.actions || []).forEach(function (action, index) {
                    if (!action.show || action.show(row)) {
                        customButtons.push('<button type="button" class="btn btn-ghost btn-small" data-action="custom" data-id="' +
                            escapeHtml(row.id) + '" data-custom="' + index + '">' + escapeHtml(action.label) + '</button>');
                    }
                });
                // `actionsFirst` menaruh aksi cepat (mis. "Tandai ditinjau") di
                // depan tombol Ubah/Hapus karena itulah aksi yang paling sering dipakai.
                return options.actionsFirst
                    ? customButtons.concat(baseButtons)
                    : baseButtons.concat(customButtons);
            };

            var body;
            if (!rows.length) {
                var emptyTitle = options.empty ? options.empty.title : 'Tidak ada data';
                var emptyHint = options.empty ? options.empty.hint : 'Belum ada data untuk ditampilkan.';
                if (instance.dateValue) {
                    emptyTitle = 'Tidak ada data pada tanggal ini';
                    emptyHint = 'Pilih tanggal lain, atau tekan "Semua tanggal" untuk menampilkan seluruh data.';
                }
                body = '<div class="empty"><strong>' + escapeHtml(emptyTitle) + '</strong><p>' +
                    escapeHtml(emptyHint) + '</p></div>';
            } else if (options.layout === 'cards' && typeof options.card === 'function') {
                // Tampilan kartu dipakai untuk data yang lebih enak dibaca
                // per-item (alergi/pantangan, rekomendasi menu) daripada tabel.
                body = '<div class="crud-cards">' + rows.map(function (row) {
                    var cardButtons = buttonsFor(row);
                    return '<article class="crud-card"' + (typeof options.onRowClick === 'function'
                        ? ' tabindex="0" data-row="' + escapeHtml(row.id) + '"'
                        : '') + '>' + options.card(row) + (cardButtons.length
                            ? '<footer class="crud-card-actions row-actions">' + cardButtons.join('') + '</footer>' : '') +
                        '</article>';
                }).join('') + '</div>';
            } else {
                body = '<div class="table-wrap"><table><thead><tr>' + options.columns.map(function (column) {
                    return '<th>' + escapeHtml(column.label) + '</th>';
                }).join('') + ((bolehUbah || bolehHapus || (options.actions && options.actions.length)) ? '<th>Aksi</th>' : '') +
                '</tr></thead><tbody>' + rows.map(function (row) {
                    var cells = options.columns.map(function (column, index) {
                        var badge = index === 0 && typeof options.rowBadge === 'function' ? options.rowBadge(row) : '';
                        return '<td>' + column.render(row) + badge + '</td>';
                    }).join('');
                    var actionButtons = buttonsFor(row);
                    return '<tr' + (typeof options.onRowClick === 'function'
                        ? ' class="is-clickable" tabindex="0" data-row="' + escapeHtml(row.id) + '"'
                        : '') + '>' + cells + (actionButtons.length ?
                        '<td><div class="row-actions">' + actionButtons.join('') + '</div></td>' : '') + '</tr>';
                }).join('') + '</tbody></table></div>';
            }

            mount.innerHTML = toolBar + body;
            var searchInput = mount.querySelector('[data-search]');
            if (searchInput) searchInput.addEventListener('input', function () {
                instance.query = searchInput.value;
                var start = searchInput.selectionStart;
                render();
                var updated = mount.querySelector('[data-search]');
                updated.focus();
                updated.setSelectionRange(start, start);
            });
            var filterSelect = mount.querySelector('[data-filter]');
            if (filterSelect) filterSelect.addEventListener('change', function () {
                instance.filterValue = filterSelect.value;
                render();
            });
            var dateFilterInput = mount.querySelector('[data-date-filter]');
            if (dateFilterInput) dateFilterInput.addEventListener('change', function () {
                instance.dateValue = dateFilterInput.value;
                render();
            });
            var dateClearButton = mount.querySelector('[data-date-clear]');
            if (dateClearButton) dateClearButton.addEventListener('click', function () {
                instance.dateValue = '';
                render();
            });
            mount.querySelectorAll('[data-action]').forEach(function (button) {
                button.addEventListener('click', handleAction);
            });
            mount.querySelectorAll('[data-chip]').forEach(function (chip) {
                chip.addEventListener('click', function () {
                    instance.filterValue = chip.getAttribute('data-chip') || '';
                    render();
                });
            });
            if (typeof options.onRowClick === 'function') {
                mount.querySelectorAll('[data-row]').forEach(function (rowNode) {
                    var rowId = rowNode.getAttribute('data-row');
                    var openRow = function (event) {
                        if (event.target.closest('button, a, input, select, textarea')) return;
                        var row = options.store.all().filter(function (item) { return String(item.id) === String(rowId); })[0];
                        if (row) options.onRowClick(row);
                    };
                    rowNode.addEventListener('click', openRow);
                    rowNode.addEventListener('keydown', function (event) {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        openRow(event);
                    });
                });
            }
        }

        function findRow(id) {
            // ID dari `data-id` selalu string, sedangkan ID dari server bisa
            // berupa angka. Bandingkan sebagai string agar tombol aksi pada
            // baris/kartu tidak kehilangan data yang dituju.
            return options.store.all().filter(function (row) { return String(row.id) === String(id); })[0];
        }

        function confirmDelete(name, config) {
            var cfg = config || {};
            return new Promise(function (resolve) {
                var existing = document.getElementById('nc-delete-confirm');
                if (existing) existing.remove();
                var dialog = document.createElement('dialog');
                dialog.id = 'nc-delete-confirm';
                dialog.className = 'nc-delete-confirm';
                dialog.innerHTML = '<div class="nc-delete-icon" aria-hidden="true">!</div>' +
                    '<h2 class="nc-delete-title"></h2>' +
                    '<p class="nc-delete-message"></p>' +
                    '<p class="nc-delete-note"></p>' +
                    '<div class="nc-delete-actions"><button type="button" class="btn btn-ghost" data-delete-cancel>Batal</button>' +
                    '<button type="button" class="btn btn-danger" data-delete-confirm></button></div>';
                dialog.querySelector('.nc-delete-title').textContent = cfg.title || 'Hapus data ini?';
                dialog.querySelector('.nc-delete-message').textContent =
                    cfg.message || ('Anda yakin ingin menghapus ' + name + '?');
                dialog.querySelector('.nc-delete-note').textContent =
                    cfg.note || 'Data akan disembunyikan dari daftar. Data tidak dimusnahkan dari database.';
                dialog.querySelector('[data-delete-confirm]').textContent = cfg.confirmLabel || 'Ya, hapus';
                document.body.appendChild(dialog);
                var cancelButton = dialog.querySelector('[data-delete-cancel]');
                var confirmButton = dialog.querySelector('[data-delete-confirm]');
                function finish(result) {
                    dialog.removeEventListener('close', onClose);
                    cancelButton.removeEventListener('click', onCancel);
                    confirmButton.removeEventListener('click', onConfirm);
                    dialog.remove();
                    resolve(result);
                }
                function onClose() { finish(dialog.returnValue === 'confirm'); }
                function onCancel() { dialog.close('cancel'); }
                function onConfirm() { dialog.close('confirm'); }
                cancelButton.addEventListener('click', onCancel);
                confirmButton.addEventListener('click', onConfirm);
                dialog.addEventListener('close', onClose);
                dialog.showModal();
                cancelButton.focus();
            });
        }

        async function handleAction(event) {
            var button = event.currentTarget;
            var action = button.getAttribute('data-action');
            var id = button.getAttribute('data-id');
            if (action === 'add') {
                openForm(null, null);
            } else if (action === 'edit') {
                openForm(id, null);
            } else if (action === 'delete') {
                var row = findRow(id);
                var name = options.label ? options.label(row) : (options.noun || 'data ini');
                var confirmed = await confirmDelete(name, {
                    title: options.deleteTitle,
                    message: options.deleteMessage ? options.deleteMessage(row) : null,
                    note: options.deleteNote,
                    confirmLabel: options.deleteConfirmLabel
                });
                if (!confirmed) return;
                var restoreDelete = setBusy(button, 'Menghapus...');
                try {
                    await waitForPaint();
                    await options.store.remove(id);
                    toast(options.deleteSuccess ? options.deleteSuccess(row) : (options.noun || 'Data') + ' berhasil dihapus.', 'success');
                } catch (error) {
                    toast('Gagal menghapus: ' + (error.message || 'coba lagi.'), 'error');
                } finally {
                    restoreDelete();
                }
            } else if (action === 'custom') {
                var custom = (options.actions || [])[Number(button.getAttribute('data-custom'))];
                if (!custom) return;
                var restoreCustom = custom.mutates ? setBusy(button, custom.loadingText || 'Memproses...') : function () {};
                try {
                    if (custom.mutates) await waitForPaint();
                    var customResult = await custom.run(findRow(id));
                    if (custom.mutates && custom.successMessage) toast(custom.successMessage(findRow(id), customResult), 'success');
                } catch (error) {
                    toast(error.message || 'Aksi gagal diproses.', 'error');
                } finally {
                    restoreCustom();
                }
            }
        }

        async function saveForm(event) {
            event.preventDefault();
            var form = event.currentTarget;
            var message = form.querySelector('.form-msg');
            if (!form.reportValidity()) return;
            var submitButton = form.querySelector('[type="submit"]');
            if (!submitButton || submitButton.disabled) return;

            var values = {};
            (options.fields || []).forEach(function (field) {
                var control = form.elements[field.key];
                if (!control) return;
                values[field.key] = field.type === 'number' && control.value !== '' ? Number(control.value) : control.value.trim();
            });
            var old = instance.editingId ? findRow(instance.editingId) : null;
            if (options.beforeSave) {
                var preparedValues = options.beforeSave(values, old);
                if (preparedValues) values = preparedValues;
            }
            var validation = options.validate ? options.validate(values, old) : null;
            if (validation) {
                message.textContent = validation;
                return;
            }

            var restoreSubmit = setBusy(submitButton, 'Menyimpan...');
            message.textContent = '';
            try {
                await waitForPaint();
                var saved;
                if (old) {
                    saved = await options.store.update(old.id, values);
                } else if (options.create) {
                    saved = await options.create(values);
                } else {
                    saved = await options.store.add(values);
                }
                if (options.saved) await options.saved(saved, old);
                if (formDialog && formDialog.open) formDialog.close('saved');
                instance.formOpen = false;
                instance.editingId = null;
                instance.initialValues = null;
                instance.draft = null;
                render();
                toast(options.successMessage
                    ? options.successMessage(saved, old)
                    : (options.noun || 'Data') + (old ? ' berhasil diperbarui.' : ' berhasil ditambahkan.'), 'success');
            } catch (error) {
                message.textContent = error.message || 'Data gagal disimpan.';
                toast('Gagal menyimpan ' + (options.noun || 'data').toLowerCase() + ': ' + (error.message || 'coba lagi.'), 'error');
            } finally {
                restoreSubmit();
            }
        }

        render();
        return {
            open: function (id, values) {
                openForm(id || null, values || null);
            },
            render: render
        };
    }

    function badge(value) {
        var text = String(value == null ? '' : value);
        var lower = text.toLowerCase();
        var kind = /habis|kedaluwarsa|evaluasi|pulang|tidak layak|gagal/.test(lower) ? 'danger' :
            /menipis|periksa|menunggu|baru|draf/.test(lower) ? 'warning' :
            /aman|aktif|terkirim|ditinjau|disetujui|diterima|dikirim/.test(lower) ? 'good' : 'neutral';
        return '<span class="badge ' + kind + '">' + escapeHtml(text) + '</span>';
    }

    function day(offset) {
        var date = new Date();
        date.setDate(date.getDate() + offset);
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function formatDate(value) {
        if (!value) return '-';
        var parts = String(value).split('-');
        return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
    }

    function toast(message, type) {
        var kind = type || 'success';
        if (window.NutriCareUI && typeof window.NutriCareUI.toast === 'function') {
            return window.NutriCareUI.toast({
                type: kind,
                title: kind === 'error' ? 'Tidak berhasil' : kind === 'warning' ? 'Perlu perhatian' : 'Berhasil',
                message: message,
                duration: kind === 'error' ? 7000 : 4200,
                closeable: true
            });
        }
        var region = document.getElementById('nc-toast-container');
        if (!region) {
            region = document.createElement('div');
            region.id = 'nc-toast-container';
            region.className = 'toast-container';
            region.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
            document.body.appendChild(region);
        }
        var node = document.createElement('div');
        node.className = 'toast ' + kind;
        node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        node.textContent = message;
        region.appendChild(node);
        window.requestAnimationFrame(function () { node.classList.add('show'); });
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () { node.remove(); }, kind === 'error' ? 7000 : 4200);
        return node;
    }

    function set(id, value) {
        var node = document.getElementById(id);
        if (node) node.textContent = value == null ? '' : value;
    }

    function meter(label, amount, percentage) {
        var safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
        return '<div class="meter"><div class="meter-title"><span>' + escapeHtml(label) + '</span><span>' +
            escapeHtml(amount) + '</span></div><div class="meter-track"><div class="meter-fill" style="width:' +
            safePercentage + '%"></div></div></div>';
    }

    function csv(filename, headers, rows) {
        var quote = function (value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; };
        var content = [headers].concat(rows).map(function (row) { return row.map(quote).join(','); }).join('\r\n');
        var url = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function detail(title, pairs, note) {
        var dialog = document.getElementById('nc-detail');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'nc-detail';
            document.body.appendChild(dialog);
        }
        dialog.innerHTML = '<h2>' + escapeHtml(title) + '</h2><div class="detail-list">' + pairs.map(function (pair) {
            return '<div class="detail-item"><small>' + escapeHtml(pair[0]) + '</small><strong>' + escapeHtml(pair[1]) + '</strong></div>';
        }).join('') + '</div>' + (note ? '<p class="notice">' + escapeHtml(note) + '</p>' : '') +
            '<button type="button" class="btn btn-ghost" data-close>Tutup</button>';
        dialog.querySelector('[data-close]').addEventListener('click', function () { dialog.close(); });
        dialog.showModal();
    }

    // Bahan hanya boleh dibaca sebagian peran. Bila permintaan gagal (mis.
    // peran tidak berhak atau jaringan putus), jangan biarkan seluruh NC mati:
    // tanggal sidebar, tema, dan navigasi halaman bergantung pada objek ini.
    var bahanStore = null;
    try {
        bahanStore = makeStore('bahan');
    } catch (error) {
        bahanStore = {
            name: 'bahan',
            all: function () { return []; },
            _rows: function () { return []; },
            refresh: function () {},
            add: function () { throw new Error('Data bahan belum dapat dimuat untuk peran ini.'); },
            update: function () { throw new Error('Data bahan belum dapat dimuat untuk peran ini.'); },
            remove: function () { throw new Error('Data bahan belum dapat dimuat untuk peran ini.'); },
            reset: function () { throw new Error('Reset data server tidak tersedia; data demo lokal tidak akan dipakai.'); }
        };
    }

    function bahanStatus(item) {
        var expiry = item.kedaluwarsa ? new Date(item.kedaluwarsa + 'T23:59:59') : null;
        var todayDate = new Date(day(0) + 'T00:00:00');
        if (expiry && expiry < todayDate) return 'Kedaluwarsa';
        if (Number(item.stok) <= 0) return 'Habis';
        if (expiry && expiry <= new Date(day(7) + 'T23:59:59')) return 'Periksa';
        if (Number(item.stok) <= Number(item.minimum || 0)) return 'Menipis';
        return 'Aman';
    }

    function settings(role, defaults) {
        var profile = Object.assign({}, defaults);
        var nameInput = document.getElementById('pf-nama');
        var emailInput = document.getElementById('pf-email');
        var phoneInput = document.getElementById('pf-telepon');
        var authToken = sessionStorage.getItem('nutricare-token');
        var accountApiEnabled = Boolean(authToken && window.NutriCareApi && window.NutriCareApi.resources && window.NutriCareApi.resources.me);
        var preferenceApiEnabled = Boolean(authToken && window.NutriCareApi && window.NutriCareApi.resources && window.NutriCareApi.resources.preferensi);
        var accountLoadFailed = false;
        var accountHeaders = authToken ? { Authorization: 'Bearer ' + authToken } : { 'X-NC-Role': role };
        var sessionUser = {};
        try { sessionUser = JSON.parse(sessionStorage.getItem('nutricare-user') || '{}'); } catch (e) { sessionUser = {}; }
        var roleLabels = { 'ahli-gizi': 'Ahli Gizi', perawat: 'Perawat', waiter: 'Waiter', logistik: 'Petugas Logistik' };
        // Nama dari sesi hanya dipakai bila perannya sama dengan halaman ini,
        // supaya nama antar peran tidak tertukar saat berpindah halaman.
        var sessionName = (sessionUser && sessionUser.role === role) ? sessionUser.nama : '';
        var fallbackName = sessionName || roleLabels[role] || '';
        var profileFormControl = document.getElementById('form-profil');
        var passwordFormControl = document.getElementById('form-sandi');
        if (accountApiEnabled && profileFormControl) profileFormControl.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        if (profileFormControl) profileFormControl.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        if (passwordFormControl) passwordFormControl.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (phoneInput) phoneInput.value = '';
        document.querySelectorAll('[data-user-name]').forEach(function (node) { node.textContent = fallbackName; });
        document.querySelectorAll('[data-pref]').forEach(function (input) { input.disabled = true; });
        var prefMessage = document.getElementById('pref-msg');
        if (prefMessage) prefMessage.textContent = 'Memuat preferensi dari server…';
        var profileMessage = profileFormControl && profileFormControl.querySelector('.form-msg');
        if (profileMessage) profileMessage.textContent = 'Memuat profil dari server…';
        var passwordMessage = passwordFormControl && passwordFormControl.querySelector('.form-msg');
        if (passwordMessage) passwordMessage.textContent = 'Perubahan sandi hanya tersedia setelah autentikasi dan endpoint akun diaktifkan.';
        if (accountApiEnabled) {
            fetch('/api' + window.NutriCareApi.resources.me, { headers: accountHeaders }).then(function (response) {
                if (!response.ok) throw new Error('Data akun belum tersedia dari server.');
                return response.json();
            }).then(function (user) {
                profile = { nama: user.nama || '', email: user.email || '', telepon: user.telepon || '' };
                if (nameInput) nameInput.value = profile.nama;
                if (emailInput) emailInput.value = profile.email;
                if (phoneInput) phoneInput.value = profile.telepon;
                document.querySelectorAll('[data-user-name]').forEach(function (node) { node.textContent = profile.nama; });
            }).catch(function () {
                accountLoadFailed = true;
                if (profileFormControl) profileFormControl.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
                var message = profileFormControl && profileFormControl.querySelector('.form-msg');
                if (message) message.textContent = 'Profil gagal dimuat dari server.';
                document.querySelectorAll('[data-user-name]').forEach(function (node) { node.textContent = fallbackName; });
            });
        }
        if (preferenceApiEnabled) {
            fetch('/api' + window.NutriCareApi.resources.preferensi, { headers: accountHeaders }).then(function (response) {
                if (!response.ok) throw new Error('Preferensi tidak tersedia dari server.');
                return response.json();
            }).then(function (prefs) {
                document.querySelectorAll('[data-pref]').forEach(function (input) {
                    input.checked = Boolean(prefs[input.getAttribute('data-pref')]);
                    input.disabled = true;
                });
            }).catch(function () {
                document.querySelectorAll('[data-pref]').forEach(function (input) { input.disabled = true; });
                var message = document.getElementById('pref-msg');
                if (message) message.textContent = 'Preferensi gagal dimuat dari server.';
            });
        } else {
            document.querySelectorAll('[data-pref]').forEach(function (input) { input.disabled = true; });
        }
        var displayName = profile.nama || fallbackName;
        if (displayName) {
            document.querySelectorAll('[data-user-name]').forEach(function (node) { node.textContent = displayName; });
            // Inisial avatar mengikuti nama; foto (jika ada) tidak diganggu.
            document.querySelectorAll('[data-role-avatar]').forEach(function (avatar) {
                if (!avatar.querySelector('img')) avatar.textContent = displayName.trim().charAt(0).toUpperCase();
            });
        }
        if (nameInput) nameInput.value = accountApiEnabled ? '' : (profile.nama || '');
        if (emailInput) emailInput.value = accountApiEnabled ? '' : (profile.email || '');
        if (phoneInput) phoneInput.value = accountApiEnabled ? '' : (profile.telepon || '');

        var profileForm = document.getElementById('form-profil');
        if (profileForm) profileForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var message = profileForm.querySelector('.form-msg');
            if (!nameInput.value.trim()) {
                message.textContent = 'Nama lengkap wajib diisi.';
                nameInput.focus();
                return;
            }
            if (emailInput.value && !emailInput.validity.valid) {
                message.textContent = 'Format email belum valid.';
                emailInput.focus();
                return;
            }
            message.textContent = accountLoadFailed ? 'Profil gagal dimuat dari server.' : 'Penyimpanan profil belum tersedia untuk sesi ini.';
        });

        var passwordForm = document.getElementById('form-sandi');
        if (passwordForm) passwordForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var message = passwordForm.querySelector('.form-msg');
            var oldPassword = passwordForm.elements.lama.value;
            var newPassword = passwordForm.elements.baru.value;
            var repeated = passwordForm.elements.ulang.value;
            if (!oldPassword || newPassword.length < 8 || newPassword !== repeated) {
                message.textContent = !oldPassword ? 'Kata sandi lama wajib diisi.' :
                    (newPassword.length < 8 ? 'Kata sandi baru minimal 8 karakter.' : 'Konfirmasi kata sandi tidak sama.');
                return;
            }
            message.textContent = 'Perubahan kata sandi belum tersedia untuk sesi ini.';
        });

        var reset = document.getElementById('reset-demo');
        if (reset) reset.disabled = true;
    }

    function today() {
        var node = document.querySelector('.today');
        if (node) node.textContent = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
    }

    function router(role) {
        var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
        var crumb = document.getElementById('crumb-page');
        function showPage() {
            var selected = window.location.hash.slice(1) || 'dashboard';
            var active = pages.filter(function (page) { return page.id === selected; })[0] || pages[0];
            pages.forEach(function (page) { page.classList.toggle('is-active', page === active); });
            if (crumb) crumb.textContent = active.getAttribute('data-title') || active.id;
            document.querySelectorAll('.nav-link[href^="#"]').forEach(function (link) {
                link.classList.toggle('active', link.getAttribute('href') === '#' + active.id);
            });
        }
        window.addEventListener('hashchange', showPage);
        showPage();
    }

    /* ---------- Foto profil (topbar & halaman profil) ---------- */
    // Menampilkan foto profil pada avatar; jika tidak ada atau gagal dimuat,
    // kembali ke avatar inisial lama.
    function avatarInitial(node) {
        if (!node.dataset.initial) {
            node.dataset.initial = (node.textContent || '').trim().slice(0, 1).toUpperCase() || '?';
        }
        return node.dataset.initial;
    }

    function applyProfilePhoto(url) {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('[data-role-avatar], [data-photo-avatar]').forEach(function (node) {
            var initial = avatarInitial(node);
            var img = node.querySelector('img');

            if (!url) {
                if (img) img.remove();
                if (!node.textContent.trim()) node.textContent = initial;
                return;
            }

            if (!img) {
                img = document.createElement('img');
                img.className = 'avatar-img';
                img.alt = 'Foto profil';
                // Avatar ada di topbar (selalu di atas layar). loading="lazy"
                // membuat Chrome menunda/menggagalkan muatannya sehingga foto
                // profil tidak pernah muncul, jadi paksa eager.
                img.loading = 'eager';
                img.decoding = 'async';
                node.textContent = '';
                node.appendChild(img);
            }

            // Ukuran eksplisit: sebagian halaman tidak memuat dashboard.css,
            // tanpa ini foto tampil seukuran aslinya dan menutupi topbar.
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = 'inherit';
            img.style.display = 'block';

            img.onerror = function () {
                img.remove();
                node.textContent = initial;
            };
            img.src = url;
        });
    }

    function sessionUser() {
        try {
            if (typeof sessionStorage === 'undefined') return {};
            return JSON.parse(sessionStorage.getItem('nutricare-user') || '{}') || {};
        } catch (e) { return {}; }
    }

    function hydrateProfilePhoto() {
        // Aman dijalankan di lingkungan tanpa DOM/storage (mis. unit test).
        if (typeof document === 'undefined' || typeof sessionStorage === 'undefined') return;

        var user = sessionUser();
        if (user && user.foto_profil) applyProfilePhoto(user.foto_profil);

        // Segarkan dari server supaya perubahan foto oleh admin langsung terlihat.
        if (typeof fetch !== 'function') return;
        var token = sessionStorage.getItem('nutricare-token');
        var headers = {};
        if (token) {
            headers.Authorization = 'Bearer ' + token;
        } else {
            // Mode demo (tanpa login): tetap ambil profil sesuai peran halaman.
            var api = window.NutriCareApi;
            headers['X-NC-Role'] = (api && api.role) || 'ahli-gizi';
        }

        fetch('/api/me', { headers: headers })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) {
                if (!data) return;
                var current = sessionUser();
                current.foto_profil = data.foto_profil || null;
                if (data.nama) current.nama = data.nama;
                if (data.role) current.role = data.role;
                try { sessionStorage.setItem('nutricare-user', JSON.stringify(current)); } catch (e) {}
                applyProfilePhoto(data.foto_profil || null);

                // Tampilkan nama dari server saat ini juga (tanpa menunggu halaman berikutnya).
                if (data.nama) {
                    document.querySelectorAll('[data-user-name]').forEach(function (node) {
                        node.textContent = data.nama;
                    });
                    document.querySelectorAll('[data-role-avatar]').forEach(function (avatar) {
                        if (!avatar.querySelector('img')) avatar.textContent = data.nama.trim().charAt(0).toUpperCase();
                    });
                }
            })
            .catch(function () {});
    }

    /* ---------- Sidebar: perkecil / perbesar ---------- */
    var SIDEBAR_KEY = 'nutricare-sidebar-collapsed';

    function applySidebarState(collapsed) {
        if (typeof document.querySelector !== 'function') return;
        var app = document.querySelector('.app');
        if (!app) return;
        app.classList.toggle('is-collapsed', collapsed);

        var button = document.getElementById('sidebar-toggle');
        if (button) {
            var label = collapsed ? 'Perbesar menu' : 'Perkecil menu';
            button.setAttribute('aria-expanded', String(!collapsed));
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        }

        document.querySelectorAll('.sidebar .nav-link').forEach(function (link) {
            if (collapsed) {
                link.setAttribute('title', link.getAttribute('data-label') || link.textContent.trim());
            } else {
                link.removeAttribute('title');
            }
        });
    }

    function initializeSidebar() {
        if (typeof document.querySelector !== 'function') return;
        var app = document.querySelector('.app');
        var sidebar = app && app.querySelector('.sidebar');
        if (!sidebar || !sidebar.querySelector('.nav-link')) return;

        sidebar.querySelectorAll('.nav-link').forEach(function (link) {
            if (link.getAttribute('data-label')) return;
            var clone = link.cloneNode(true);
            var icon = clone.querySelector('.nav-icon');
            if (icon) icon.parentNode.removeChild(icon);
            var label = (clone.textContent || '').replace(/\s+/g, ' ').trim();
            if (label) link.setAttribute('data-label', label);
        });

        if (!document.getElementById('sidebar-toggle')) {
            var button = document.createElement('button');
            button.type = 'button';
            button.id = 'sidebar-toggle';
            button.className = 'sidebar-toggle';
            button.setAttribute('aria-controls', 'sidebar-nav');
            button.innerHTML = '<span class="sidebar-toggle-icon" aria-hidden="true"></span>';
            button.addEventListener('click', function () {
                var next = !app.classList.contains('is-collapsed');
                try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch (error) {}
                applySidebarState(next);
            });
            (app || document.body).appendChild(button);
        }

        if (!sidebar.id) sidebar.id = 'sidebar-nav';
        var stored = null;
        try { stored = localStorage.getItem(SIDEBAR_KEY); } catch (error) {}
        applySidebarState(stored === '1');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSidebar);
    } else {
        initializeSidebar();
    }

    window.NC = {
        esc: escapeHtml,
        store: makeStore,
        bahan: bahanStore,
        bahanStatus: bahanStatus,
        crud: crud,
        badge: badge,
        day: day,
        fmtDate: formatDate,
        toast: toast,
        set: set,
        pad: function (value) { return String(value).padStart(2, '0'); },
        meter: meter,
        csv: csv,
        detail: detail,
        onRender: function (render) { renderers.push(render); },
        renderAll: notify,
        refreshAll: refreshAll,
        settings: settings,
        setTheme: setTheme,
        today: today,
        router: router,
        applyProfilePhoto: applyProfilePhoto,
        hydrateProfilePhoto: hydrateProfilePhoto
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateProfilePhoto);
    } else {
        hydrateProfilePhoto();
    }
})();
