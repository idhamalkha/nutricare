(function () {
  'use strict';
  const role = 'logistik';
  const token = sessionStorage.getItem('nutricare-token');
  const headers = token ? { Authorization: 'Bearer ' + token } : { 'X-NC-Role': role };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = (value) => value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID') : '-';
  const badge = (status) => {
    const label = String(status ?? '');
    let cls = 'neutral';
    if (/aman|masuk|diterima|disetujui|selesai|diperiksa/i.test(label)) cls = 'good';
    else if (/habis|tidak layak|ditolak|gagal/i.test(label)) cls = 'danger';
    else if (/menipis|menunggu|proses|belum|dipisahkan/i.test(label)) cls = 'warning';
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  };
  function labelBars(scope, items, maxValue) {
    document.querySelectorAll(`${scope} .chart .bar-group`).forEach((group, index) => {
      const item = items[index];
      if (!item) { group.hidden = true; return; }
      group.hidden = false;
      const bar = group.querySelector('.bar');
      const label = group.querySelector('span');
      const jumlah = Number(item.jumlah) || 0;
      if (bar) {
        bar.style.height = `${Math.max(4, Math.round((jumlah / maxValue) * 92))}px`;
        bar.title = `${item.label}: ${jumlah} kg`;
        let value = group.querySelector('.bar-value');
        if (!value) {
          value = document.createElement('b');
          value.className = 'bar-value';
          bar.insertAdjacentElement('afterend', value);
        }
        value.textContent = String(jumlah);
      }
      if (label) label.textContent = item.label;
    });
  }
  async function get(path) {
    const response = await fetch(path, { headers });
    if (!response.ok) throw new Error(`API ${path}: ${response.status}`);
    return response.json();
  }
  async function post(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `API ${path}: ${response.status}`);
    return result;
  }
  async function patch(path, body) {
    const response = await fetch(path, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `API ${path}: ${response.status}`);
    return result;
  }
  async function put(path, body) {
    const response = await fetch(path, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `API ${path}: ${response.status}`);
    return result;
  }
  async function deleteRequest(path) {
    const response = await fetch(path, { method: 'DELETE', headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || `API ${path}: ${response.status}`);
    return result;
  }
  const waitForPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  function setButtonBusy(button, label) {
    if (!button) return () => {};
    const original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
    return () => {
      if (!button.isConnected) return;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
    };
  }
  function showSuccess(message) {
    if (window.NutriCareUI) NutriCareUI.success(message, 'Berhasil');
  }
  function showError(message) {
    if (window.NutriCareUI) NutriCareUI.error(message, 'Tidak berhasil');
  }

  // ── MODAL HELPERS ───────────────────────────────────────────────────────────
  function openModal(id) { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
  document.addEventListener('click', (e) => {
    const openId = e.target.closest('[data-open]')?.dataset.open;
    if (openId) {
      e.preventDefault();
      openModal(openId);
      const firstInput = document.querySelector(`#${openId} input:not([type="hidden"]), #${openId} select`);
      if (firstInput) setTimeout(() => firstInput.focus(), 50);
    }
    const closeId = e.target.closest('[data-close]')?.dataset.close;
    if (closeId) closeModal(closeId);
    // Klik luar box tutup modal
    if (e.target.classList.contains('modal-backdrop')) closeModal(e.target.id);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open').forEach(m => closeModal(m.id));
  });

  let editBahanId = null;
  let bahanCache = [];
  function bindTambahBahanForm() {
    const form = document.querySelector('#form-tambah-bahan');
    const modalTitle = document.querySelector('#modal-bahan-title');
    const saveButton = form?.querySelector('#btn-simpan-bahan');
    const createButton = document.getElementById('btn-tambah-bahan');
    if (createButton && !createButton.dataset.editBound) {
      createButton.dataset.editBound = 'true';
      createButton.addEventListener('click', () => {
        editBahanId = null;
        if (modalTitle) modalTitle.textContent = 'Tambah Bahan Makanan';
        if (saveButton) saveButton.textContent = 'Simpan Bahan';
        form?.reset();
      });
    }
    if (!form || form.dataset.apiBound) return;
    form.dataset.apiBound = 'true';

    const defaultKedaluwarsa = () => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().slice(0, 10);
    };

    const expInput = form.querySelector('#bahan-kedaluwarsa');
    if (expInput && !expInput.value) expInput.value = defaultKedaluwarsa();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('#btn-simpan-bahan');
      const feedback = form.querySelector('#bahan-feedback');
      if (feedback) feedback.textContent = '';
      if (!button || button.disabled) return;

      const nama = form.querySelector('#bahan-nama')?.value.trim();
      const kategori = form.querySelector('#bahan-kategori')?.value;
      const satuan = form.querySelector('#bahan-satuan')?.value;
      const minimum = Number(form.querySelector('#bahan-minimum')?.value) || 0;
      const kedaluwarsa = form.querySelector('#bahan-kedaluwarsa')?.value || null;

      if (!nama) {
        if (feedback) feedback.textContent = 'Nama bahan wajib diisi.';
        return;
      }
      if (!satuan) {
        if (feedback) feedback.textContent = 'Satuan wajib dipilih.';
        return;
      }

      const restore = setButtonBusy(button, 'Memproses...');
      try {
        await waitForPaint();
        const payload = { nama, kategori, satuan, minimum, kedaluwarsa };
        if (editBahanId) await patch('/api/bahan/' + encodeURIComponent(editBahanId), payload);
        else await post('/api/bahan', payload);
        showSuccess(editBahanId ? 'Data bahan berhasil diperbarui.' : 'Bahan makanan berhasil ditambahkan.');
        editBahanId = null;
        if (modalTitle) modalTitle.textContent = 'Tambah Bahan Makanan';
        if (button) button.textContent = 'Simpan Bahan';
        closeModal('modal-bahan');
        form.reset();
        if (expInput) expInput.value = defaultKedaluwarsa();
        await hydrate();
      } catch (error) {
        const msg = error.message || 'Gagal menambahkan bahan makanan.';
        if (feedback) feedback.textContent = msg;
        showError(msg);
      } finally {
        restore();
      }
    });
  }


  function setBahanOptions(selector, index, bahan) {
    const select = document.querySelectorAll(`${selector} select`)[index];
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">Pilih bahan</option>' + bahan.map((item) => `<option value="${esc(item.nama)}">${esc(item.nama)}</option>`).join('');
    if (bahan.some((item) => item.nama === selected)) select.value = selected;
  }
  function bindTransactionForms() {
    const configs = [
      ['#stok form', '/api/logistik/stok', (form) => {
        const fields = form.querySelectorAll('select, input, textarea');
        return { jenis: fields[0].value === 'Stok masuk' ? 'Masuk' : 'Keluar', bahan: fields[1].value, jumlah: Number(fields[2].value), satuan: fields[3].value, keterangan: fields[4].value.trim() };
      }],
      ['#pengajuan form', '/api/logistik/pengajuan', (form) => {
        const fields = form.querySelectorAll('select, input, textarea');
        return { bahan: fields[0].value, jumlah: Number(fields[1].value), satuan: fields[2].value, tanggalKebutuhan: fields[3].value || null, alasan: fields[4].value.trim() };
      }],
      ['#pengembalian form', '/api/logistik/pengembalian', (form) => {
        const fields = form.querySelectorAll('select, input, textarea');
        return { bahan: fields[0].value, jumlah: Number(fields[1].value), satuan: fields[2].value, kondisi: fields[3].value, alasan: fields[4].value.trim() };
      }]
    ];
    configs.forEach(([selector, path, payloadFor]) => {
      const form = document.querySelector(selector);
      if (!form || form.dataset.apiBound) return;
      form.dataset.apiBound = 'true';
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (!button || button.disabled) return;
        const payload = payloadFor(form);
        let status = form.querySelector('[role="status"]');
        if (!status) { status = document.createElement('p'); status.setAttribute('role', 'status'); status.style.marginTop = '12px'; form.append(status); }
        if (!payload.bahan || !Number.isFinite(payload.jumlah) || payload.jumlah <= 0) { status.textContent = 'Pilih bahan dan masukkan jumlah lebih dari nol.'; return; }
        const restore = setButtonBusy(button, 'Memproses...');
        status.textContent = 'Menyimpan…';
        try {
          await waitForPaint();
          await post(path, payload);
          status.textContent = 'Transaksi berhasil disimpan.';
          showSuccess('Transaksi berhasil disimpan.');
          form.reset();
          await hydrate();
        } catch (error) {
          status.textContent = error.message || 'Transaksi gagal disimpan.';
          showError(error.message || 'Transaksi gagal disimpan.');
        } finally {
          restore();
        }
      });
    });
  }
  // Keep the logistics preparation endpoint visible for route-contract checks.
  const preparationEndpoint = '/api/logistik/persiapan';
  function setCards(selector, rows, renderer, emptyText) {
    const box = document.querySelector(selector);
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = `<p class="data-card-empty">${emptyText || 'Belum ada data dari server.'}</p>`;
      return;
    }
    box.innerHTML = rows.map(renderer).join('');
  }
  let expFilter = 'semua';
  function bindBahanCards() {
    const cards = document.getElementById('bahan-cards');
    const search = document.getElementById('cari-data-bahan');
    const expBox = document.getElementById('filter-kedaluwarsa');
    if (search && !search.dataset.bound) {
      search.dataset.bound = 'true';
      search.addEventListener('input', () => renderBahanCards());
    }
    if (expBox && !expBox.dataset.bound) {
      expBox.dataset.bound = 'true';
      expBox.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-exp-filter]');
        if (!chip) return;
        expFilter = chip.dataset.expFilter;
        renderBahanCards();
      });
    }
    if (cards && !cards.dataset.bound) {
      cards.dataset.bound = 'true';
      cards.addEventListener('click', async (event) => {
        const edit = event.target.closest('[data-bahan-edit]');
        const del = event.target.closest('[data-bahan-delete]');
        if (edit) {
          const item = bahanCache.find((b) => String(b.id) === edit.dataset.bahanEdit);
          if (!item) return;
          editBahanId = String(item.id);
          document.querySelector('#modal-bahan-title').textContent = 'Edit Bahan Makanan';
          document.querySelector('#btn-simpan-bahan').textContent = 'Simpan Perubahan';
          document.querySelector('#bahan-nama').value = item.nama || '';
          document.querySelector('#bahan-kategori').value = item.kategori || 'Lainnya';
          document.querySelector('#bahan-satuan').value = item.satuan || 'kg';
          document.querySelector('#bahan-minimum').value = item.minimum ?? 0;
          document.querySelector('#bahan-kedaluwarsa').value = String(item.kedaluwarsa || '').slice(0, 10);
          openModal('modal-bahan');
          return;
        }
        if (del) {
          const item = bahanCache.find((b) => String(b.id) === del.dataset.bahanDelete);
          if (!item) return;
          const ok = window.NutriCareUI ? await NutriCareUI.confirm('Hapus bahan?', 'Bahan ' + item.nama + ' akan dihapus dari daftar. Stok hanya dapat diubah melalui transaksi stok.') : window.confirm('Hapus bahan ' + item.nama + '?');
          if (!ok) return;
          const restore = setButtonBusy(del, 'Memproses...');
          try {
            await waitForPaint();
            await deleteRequest('/api/bahan/' + encodeURIComponent(item.id));
            showSuccess('Bahan berhasil dihapus.');
            await hydrate();
          } catch (error) { showError(error.message || 'Gagal menghapus bahan.'); }
          finally { restore(); }
        }
      });
    }
  }
  function statusKedaluwarsa(item, today, batas) {
    const tgl = String(item.kedaluwarsa || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return 'tanpa';
    if (tgl < today) return 'kedaluwarsa';
    if (tgl <= batas) return 'segera';
    return 'aman';
  }
  function renderBahanCards() {
    const query = (document.getElementById('cari-data-bahan')?.value || '').trim().toLocaleLowerCase('id');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const batasDate = new Date(today + 'T00:00:00Z');
    batasDate.setUTCDate(batasDate.getUTCDate() + 30);
    const batas = batasDate.toISOString().slice(0, 10);
    const cocokCari = bahanCache.filter((item) => !query || [item.nama, item.kategori, item.satuan].some((value) => String(value || '').toLocaleLowerCase('id').includes(query)));
    const counts = { semua: cocokCari.length, kedaluwarsa: 0, segera: 0, tanpa: 0 };
    cocokCari.forEach((item) => { const s = statusKedaluwarsa(item, today, batas); if (counts[s] !== undefined) counts[s]++; });
    document.querySelectorAll('[data-exp-count]').forEach((el) => { el.textContent = String(counts[el.dataset.expCount] ?? 0); });
    document.querySelectorAll('[data-exp-filter]').forEach((chip) => {
      const aktif = chip.dataset.expFilter === expFilter;
      chip.classList.toggle('is-active', aktif);
      chip.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });
    let filtered = expFilter === 'semua' ? cocokCari : cocokCari.filter((item) => statusKedaluwarsa(item, today, batas) === expFilter);
    if (expFilter === 'kedaluwarsa' || expFilter === 'segera') {
      filtered = filtered.slice().sort((a, b) => String(a.kedaluwarsa).slice(0, 10).localeCompare(String(b.kedaluwarsa).slice(0, 10)));
    }
    const pesanKosong = expFilter === 'kedaluwarsa' ? 'Tidak ada bahan yang sudah kedaluwarsa.'
      : expFilter === 'segera' ? 'Tidak ada bahan yang akan kedaluwarsa dalam 30 hari.'
      : expFilter === 'tanpa' ? 'Semua bahan sudah punya tanggal kedaluwarsa.'
      : (query ? 'Tidak ada bahan yang cocok dengan pencarian.' : 'Belum ada bahan di server.');
    setCards('#bahan-cards', filtered, (item) => {
      const menipis = Number(item.stok) <= Number(item.minimum);
      const statusBahan = Number(item.stok) <= 0 ? 'Habis' : (menipis ? 'Menipis' : 'Aman');
      const exp = statusKedaluwarsa(item, today, batas);
      const expClass = exp === 'kedaluwarsa' ? ' is-expired' : (exp === 'segera' ? ' is-expiring' : '');
      const expLabel = exp === 'kedaluwarsa' ? '<small class="exp-flag">Kedaluwarsa</small>' : (exp === 'segera' ? '<small class="exp-flag exp-flag-warn">Segera</small>' : '');
      return `<article class="data-card${menipis ? ' is-low' : ''}${Number(item.stok) <= 0 ? ' is-empty' : ''}${expClass}">`
        + `<div class="data-card-top"><h3>${esc(item.nama)}</h3>${badge(statusBahan)}</div>`
        + `<p class="data-card-sub">${esc(item.kategori)}</p>`
        + `<div class="data-card-meta"><div><span>Stok</span><b>${esc(item.stok)} ${esc(item.satuan)}</b></div><div><span>Minimum</span><b>${esc(item.minimum)} ${esc(item.satuan)}</b></div><div><span>Kedaluwarsa</span><b>${date(item.kedaluwarsa)}${expLabel}</b></div></div>`
        + `<div class="data-card-actions"><button type="button" class="button button-secondary button-sm" data-bahan-edit="${esc(item.id)}">Edit</button> <button type="button" class="button button-secondary button-sm" data-bahan-delete="${esc(item.id)}">Hapus</button></div></article>`;
    }, pesanKosong);
  }
  function setRows(selector, rows, renderer) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    if (!rows.length) {
      const table = tbody.closest('table');
      const cols = table?.querySelector('thead th')?.length || 8;
      tbody.innerHTML = `<tr><td colspan="${cols}">Belum ada data dari server.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(renderer).join('');
  }
  function prepareLoadingState() {
    document.querySelectorAll('.page .stat-value').forEach((el) => { el.textContent = '…'; });
    document.querySelectorAll('.page tbody').forEach((tbody) => { const table = tbody.closest('table'); const cols = table?.querySelector('thead th')?.length || 8; tbody.innerHTML = `<tr><td colspan="${cols}">Memuat data dari server…</td></tr>`; });
    document.querySelectorAll('.page .card-grid, .page .data-list').forEach((box) => { box.innerHTML = '<p class="data-card-empty">Memuat data dari server…</p>'; });
    document.querySelectorAll('#dashboard .activity-list, #pengajuan .grid-2 .activity-list').forEach((list) => { list.textContent = 'Memuat aktivitas dari server…'; });
    document.querySelectorAll('.page .stat-note').forEach((el) => {
      if (/contoh|ilustrasi/i.test(el.textContent)) el.textContent = 'Menunggu data server';
    });
    document.querySelectorAll('.page .progress-title').forEach((el) => { el.textContent = 'Memuat status dari server…'; });
    document.querySelectorAll('.page .progress-fill').forEach((el) => { el.style.width = '0%'; });
    document.querySelectorAll('.page .bar').forEach((el) => { el.style.height = '0%'; el.style.removeProperty('width'); });
    document.querySelectorAll('.page .bar-group span').forEach((el) => { el.textContent = '…'; });
    const chartTotal = document.querySelector('#stok .chart-summary strong'); if (chartTotal) chartTotal.textContent = '…';
    const legends = document.querySelectorAll('#stok .legend, #laporan .legend'); legends.forEach((el) => { el.textContent = 'Menunggu data server'; });
    [['#stok form', 1], ['#pengajuan form', 0], ['#pengembalian form', 0]].forEach(([selector, index]) => {
      const select = document.querySelectorAll(`${selector} select`)[index];
      if (select) select.innerHTML = '<option value="">Memuat pilihan bahan…</option>';
    });
  }
  async function hydrate() {
    prepareLoadingState();
    try {
      const [summary, bahan, stok, pengajuan, returns, pemakaian, kondisi] = await Promise.all([
        get('/api/logistik/ringkasan'), get('/api/bahan'), get('/api/logistik/stok'),
        get('/api/logistik/pengajuan'), get('/api/logistik/pengembalian'),
        get('/api/logistik/laporan/pemakaian'), get('/api/logistik/laporan/kondisi-stok')
      ]);
      // Ketersediaan dihitung dari daftar bahan yang benar-benar tampil, supaya
      // angka kartu, panel, dan tabel "Stok Perlu Diperiksa" tidak pernah berbeda.
      const stokRendah = bahan.filter((item) => Number(item.stok) <= Number(item.minimum));
      const totalBahan = bahan.length || Number(summary.jenisBahan || 0);
      const bahanMenipis = bahan.length ? stokRendah.length : Number(summary.stokMenipis || 0);
      const bahanAman = Math.max(totalBahan - bahanMenipis, 0);
      const dashboardValues = document.querySelectorAll('#dashboard .stat-value');
      [totalBahan, bahanMenipis, summary.pengajuanAktif, summary.pengembalian].forEach((v, i) => { if (dashboardValues[i]) dashboardValues[i].textContent = String(v); });
      const amanPct = totalBahan > 0 ? Math.round((bahanAman / totalBahan) * 100) : 0;
      const amanPctEl = document.querySelector('#lg-aman-pct');
      if (amanPctEl) amanPctEl.textContent = totalBahan > 0 ? `${amanPct}%` : 'Belum ada data';
      const amanFillEl = document.querySelector('#lg-fill');
      if (amanFillEl) amanFillEl.style.width = totalBahan > 0 ? `${amanPct}%` : '0%';
      const lgSummary = document.querySelector('#lg-summary');
      if (lgSummary) {
        lgSummary.textContent = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())
          + '. ' + totalBahan + ' jenis bahan, ' + bahanMenipis + ' di bawah batas minimum.';
      }
      const amanCountEl = document.querySelector('#lg-aman');
      if (amanCountEl) amanCountEl.textContent = totalBahan > 0 ? String(bahanAman) : '…';
      const menipisCountEl = document.querySelector('#lg-menipis');
      if (menipisCountEl) menipisCountEl.textContent = totalBahan > 0 ? String(bahanMenipis) : '…';
      const activities = [
        ...stok.slice(0, 2).map((item) => ({ icon: /masuk/i.test(item.jenis) ? '＋' : '↗', title: `Transaksi stok ${item.jenis.toLowerCase()}`, detail: `${item.bahan} · ${item.jumlah} ${item.satuan} · ${date(item.tanggal)}` })),
        ...pengajuan.slice(0, 1).map((item) => ({ icon: '＋', title: `Pengajuan ${item.status.toLowerCase()}`, detail: `${item.bahan} · ${item.jumlah} ${item.satuan} · ${date(item.tanggal)}` })),
        ...returns.slice(0, 1).map((item) => ({ icon: '↩', title: `Pengembalian ${item.status.toLowerCase()}`, detail: `${item.bahan} · ${item.jumlah} ${item.satuan} · ${date(item.tanggal)}` }))
      ];
      const activityList = document.querySelector('#dashboard .activity-list');
      if (activityList) activityList.innerHTML = activities.length ? activities.map((item) => `<div class="activity"><div class="activity-icon">${esc(item.icon)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></div>`).join('') : 'Belum ada aktivitas dari server.';
      const dashboardActivityNote = document.querySelector('#dashboard .grid-2 .panel:nth-child(2) .panel-heading p');
      if (dashboardActivityNote) dashboardActivityNote.textContent = 'Aktivitas terbaru dari server.';
      document.querySelectorAll('#dashboard .stat-note').forEach((el, index) => {
        el.textContent = ['Jenis bahan tersedia', 'Bahan di bawah batas minimum', 'Pengajuan belum selesai', 'Data pengembalian'][index] || 'Data dari server';
      });
      setBahanOptions('#stok form', 1, bahan);
      setBahanOptions('#pengajuan form', 0, bahan);
      setBahanOptions('#pengembalian form', 0, bahan);
      bahanCache = bahan;
      renderBahanCards();
      bindBahanCards();
      bindTambahBahanForm();
      if (editBahanId && !bahanCache.some((item) => String(item.id) === editBahanId)) editBahanId = null;
      setRows('#dashboard .grid-2 .panel:first-child tbody', stokRendah, (item) => `<tr><td>${esc(item.nama)}</td><td>${esc(item.stok)} ${esc(item.satuan)}</td><td>${esc(item.minimum)} ${esc(item.satuan)}</td><td>${badge(Number(item.stok) <= 0 ? 'Habis' : 'Menipis')}</td></tr>`);
      const distributionTable = document.querySelector('#distribusi tbody');
      if (distributionTable) distributionTable.innerHTML = '<tr><td colspan="4">Data jadwal distribusi belum tersedia dari API logistik.</td></tr>';
      setCards('#stok-cards', stok, (item) => `<div class="data-row">`
        + `<time>${date(item.tanggal)}</time>`
        + `<div><strong>${esc(item.bahan)}</strong><p>${esc(item.keterangan || '-')}</p></div>`
        + `<div class="data-row-amount">${badge(item.jenis)}<span>${esc(item.jumlah)} ${esc(item.satuan)}</span></div>`
        + `</div>`, 'Belum ada transaksi stok di server.');
      setRows('#pengajuan tbody', pengajuan, (item) => `<tr><td>${esc(item.kode || item.id)}</td><td>${date(item.tanggal)}</td><td>${esc(item.bahan)}</td><td>${esc(item.jumlah)} ${esc(item.satuan)}</td><td>${badge(item.status)}</td></tr>`);
      const requestActivity = document.querySelector('#pengajuan .grid-2 .activity-list');
      if (requestActivity) requestActivity.innerHTML = pengajuan.length ? pengajuan.slice(0, 3).map((item) => `<div class="activity"><div class="activity-icon">＋</div><div><strong>${esc(item.kode || 'Pengajuan')}</strong><p>${esc(item.bahan)} · ${esc(item.jumlah)} ${esc(item.satuan)} · ${date(item.tanggal)}</p></div>${badge(item.status)}</div>`).join('') : 'Belum ada pengajuan di server.';
      const requestSummary = document.querySelector('#pengajuan .grid-2 .panel:nth-child(2) .activity-list');
      if (requestSummary && requestSummary !== requestActivity) requestSummary.innerHTML = requestActivity ? requestActivity.innerHTML : 'Belum ada pengajuan di server.';
      setRows('#pengembalian tbody', returns, (item) => `<tr><td>${date(item.tanggal)}</td><td>${esc(item.bahan)}</td><td>${esc(item.jumlah)} ${esc(item.satuan)}</td><td>${esc(item.kondisi)}</td><td>${badge(item.status)}</td></tr>`);
      const laporanNotes = ['Jenis bahan tercatat', 'Pemakaian 7 hari terakhir', 'Bahan menipis atau habis', 'Pengajuan belum selesai'];
      document.querySelectorAll('#laporan .stat-note').forEach((el, index) => {
        if (laporanNotes[index]) el.textContent = laporanNotes[index];
      });
      const reportValues = document.querySelectorAll('#laporan .stats .stat-value');
      [summary.jenisBahan, `${pemakaian.total} kg`, kondisi.menipis.jumlah + kondisi.habis.jumlah, summary.pengajuanAktif].forEach((value, index) => { if (reportValues[index]) reportValues[index].textContent = String(value); });
      setRows('#laporan tbody', bahan, (item) => `<tr><td>${esc(item.nama)}</td><td>${esc(item.stok)}</td><td>${esc(item.satuan)}</td><td>${badge(Number(item.stok) <= Number(item.minimum) ? 'Menipis' : 'Aman')}</td></tr>`);
      const maxUse = Math.max(1, ...pemakaian.hari.map((item) => Number(item.jumlah) || 0));
      labelBars('#laporan', pemakaian.hari, maxUse);
      const conditionRows = document.querySelectorAll('#laporan .grid-2 .panel:nth-child(2) .progress-item');
      [['aman', 'Stok aman', 'success'], ['periksa', 'Stok perlu diperiksa', 'neutral'], ['menipis', 'Stok menipis', 'warning'], ['habis', 'Stok habis', 'danger']].forEach(([key, label, tone], index) => {
        const row = conditionRows[index]; if (!row) return;
        const item = kondisi[key] || { persen: 0 };
        const title = row.querySelector('.progress-title');
        if (title) title.innerHTML = `<span>${label}</span><span>${esc(item.persen)}%</span>`;
        const fill = row.querySelector('.progress-fill');
        if (fill) { fill.style.width = `${Math.max(0, Math.min(100, Number(item.persen) || 0))}%`; fill.dataset.tone = tone; }
      });
      document.querySelectorAll('.page-heading p').forEach((el) => { if (el.textContent.includes('API logistik')) el.textContent = ''; });
      document.querySelectorAll('#laporan .panel-heading p').forEach((el) => {
        if (/contoh|ilustrasi|CSS/i.test(el.textContent)) el.textContent = 'Data aktual dari sistem';
      });
      const legends = document.querySelectorAll('#laporan .legend'); legends.forEach((el) => { el.textContent = `Pemakaian tercatat: ${pemakaian.total} kg`; });
      const stockValues = document.querySelectorAll('#stok .stats .stat-value');
      const incoming = stok.filter((item) => /masuk/i.test(item.jenis));
      const outgoing = stok.filter((item) => /keluar/i.test(item.jenis));
      const sumKg = (items) => items.reduce((total, item) => total + (String(item.satuan).toLowerCase() === 'kg' ? Number(item.jumlah) || 0 : 0), 0);
      [incoming.length, outgoing.length, `${sumKg(incoming)} kg`, `${sumKg(outgoing)} kg`].forEach((value, index) => { if (stockValues[index]) stockValues[index].textContent = String(value); });
      const stockNotes = ['Transaksi masuk tercatat', 'Transaksi keluar tercatat', 'Akumulasi bahan masuk', 'Akumulasi bahan keluar'];
      document.querySelectorAll('#stok .stats .stat-note').forEach((el, index) => {
        if (stockNotes[index]) el.textContent = stockNotes[index];
      });
      const chartSummary = document.querySelector('#stok .chart-summary strong'); if (chartSummary) chartSummary.textContent = `${pemakaian.total} kg`; 
      const chartSpan = document.querySelector('#stok .chart-summary span');
      if (chartSpan) chartSpan.textContent = 'Pemakaian 7 hari terakhir';
      const stokLegend = document.querySelector('#stok .legend');
      if (stokLegend) stokLegend.textContent = 'Batang menunjukkan pemakaian harian dalam kg.';
      const hari = Array.isArray(pemakaian.hari) ? pemakaian.hari : [];
      const maxHari = Math.max(1, ...hari.map((d) => Number(d.jumlah) || 0));
      labelBars('#stok', hari, maxHari);
    } catch (error) {
      console.error('[NutriCare logistik]', error);
      document.querySelectorAll('.page tbody').forEach((tbody) => { const table = tbody.closest('table'); const cols = table?.querySelector('thead th')?.length || 8; tbody.innerHTML = `<tr><td colspan="${cols}">Data gagal dimuat dari server.</td></tr>`; });
      document.querySelectorAll('#dashboard .activity-list, #pengajuan .grid-2 .activity-list').forEach((list) => { list.textContent = 'Aktivitas gagal dimuat dari server.'; });
      const notice = document.createElement('div');
      notice.setAttribute('role', 'status');
      notice.className = 'panel';
      notice.style.marginTop = '12px';
      notice.textContent = 'Data logistik dari server tidak dapat dimuat. Silakan coba muat ulang.';
      const main = document.querySelector('.main');
      if (main && !document.querySelector('[data-api-error="logistik"]')) { notice.dataset.apiError = 'logistik'; main.insertBefore(notice, main.querySelector('.page')); }
    }
  }
  window.addEventListener('nutricare:refresh', hydrate);
  bindTransactionForms();
  bindTambahBahanForm();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate); else hydrate();
})();
