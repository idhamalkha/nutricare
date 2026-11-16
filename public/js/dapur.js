'use strict';

/* Controller Dapur NutriCare
   Fitur:
   1. Dashboard persiapan masak & antrian hari ini
   2. Persiapan hari ini per waktu makan (Sarapan, Siang, Snack, Malam)
   3. Menu Makanan: Pengelolaan Resep Hidangan & Menu Paket Diet
   4. Bahan Makanan: Monitoring stok gudang, kebutuhan dinamis sesuai makanan yang dimasak, dan potong stok pemakaian
   5. Jadwal masak harian
   6. Laporan & grafik produksi makanan dapur
*/

const headers = {
  'Authorization': 'Bearer ' + sessionStorage.getItem('nutricare-token'),
  'X-NC-Role': 'dapur'
};

async function get(path) {
  const r = await fetch(path, { headers });
  if (!r.ok) {
    const err = await r.json().catch(function () { return {}; });
    throw new Error(err.message || r.statusText || String(r.status));
  }
  return r.json();
}

async function post(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(function () { return {}; });
    throw new Error(err.message || r.statusText || String(r.status));
  }
  return r.json();
}

async function put(path, body) {
  const r = await fetch(path, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(function () { return {}; });
    throw new Error(err.message || r.statusText || String(r.status));
  }
  return r.json();
}

async function patchReq(path, body) {
  const r = await fetch(path, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(function () { return {}; });
    throw new Error(err.message || r.statusText || String(r.status));
  }
  return r.json();
}

async function deleteReq(path) {
  const r = await fetch(path, { method: 'DELETE', headers });
  if (!r.ok) {
    const err = await r.json().catch(function () { return {}; });
    throw new Error(err.message || r.statusText || String(r.status));
  }
  return r.json();
}

const STATUS_LABEL = { Menunggu: 'Belum', Diproses: 'Proses', Selesai: 'Selesai' };
const STATUS_CLASS = { Menunggu: 'warning', Diproses: 'info', Selesai: 'good' };
const SLOT_JAM = { 'Sarapan': '06:00', 'Makan siang': '11:00', 'Snack': '14:00', 'Makan malam': '17:00' };
const SLOTS = ['Sarapan', 'Makan siang', 'Snack', 'Makan malam'];

let state = {
  persiapan: [],
  rekomendasi: [],
  bahan: [],
  resep: [],
  menuPaket: [],
  laporan: null,
  tanggal: todayIso(),
  filterBahanCari: '',
  filterBahanKategori: '',
  filterBahanStatus: ''
};

let _resepEditNama = null;
let _menuEditId = null;
let _filterResepHidangan = '';
let _filterMenuPaket = '';
let chartStatus = null;
let chartTren = null;

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dash(value) {
  const s = String(value == null ? '' : value).trim();
  return s ? esc(s) : '-';
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const date = (value) => value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID') : '—';
const badge = (status) => {
  const cls = /aman|masuk|diterima|disetujui|selesai/i.test(status) ? 'good' : /menipis|keluar|tidak layak|dipisahkan/i.test(status) ? 'danger' : 'warning';
  return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
};

function convertUnit(amount, fromUnit, toUnit) {
  const f = String(fromUnit || '').trim().toLowerCase();
  const t = String(toUnit || '').trim().toLowerCase();
  if (!f || !t || f === t) return amount;

  if (f === 'gram' && t === 'kg') return amount / 1000;
  if (f === 'kg' && t === 'gram') return amount * 1000;
  if (f === 'gr' && t === 'kg') return amount / 1000;
  if (f === 'kg' && t === 'gr') return amount * 1000;
  if (f === 'ons' && t === 'kg') return amount / 10;
  if (f === 'kg' && t === 'ons') return amount * 10;
  if (f === 'ons' && (t === 'gram' || t === 'gr')) return amount * 100;
  if ((f === 'gram' || f === 'gr') && t === 'ons') return amount / 100;

  if (f === 'ml' && (t === 'liter' || t === 'l')) return amount / 1000;
  if ((f === 'liter' || f === 'l') && t === 'ml') return amount * 1000;

  if (f === 'sdm' && (t === 'kg' || t === 'liter' || t === 'l')) return amount * 0.015;
  if (f === 'sdm' && (t === 'gram' || t === 'gr' || t === 'ml')) return amount * 15;
  if (f === 'sdt' && (t === 'kg' || t === 'liter' || t === 'l')) return amount * 0.005;
  if (f === 'sdt' && (t === 'gram' || t === 'gr' || t === 'ml')) return amount * 5;

  return amount;
}

function labelStatus(status) {
  return STATUS_LABEL[status] || status || 'Belum';
}

function classStatus(status) {
  return STATUS_CLASS[status] || 'warning';
}

function jamUntuk(waktu) {
  return SLOT_JAM[waktu] || '-';
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = String(value);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function rekomendasiUntukTanggal() {
  if (!state.tanggal) return state.rekomendasi;
  return state.rekomendasi.filter(function (r) { return String(r.tanggal) === state.tanggal; });
}

function rekomendasiUntukSlot(waktu) {
  return state.rekomendasi.filter(function (r) {
    return String(r.waktu) === String(waktu) && (!state.tanggal || String(r.tanggal) === state.tanggal);
  });
}

function porsiUntukSlot(waktu) {
  const slot = state.persiapan.find(function (p) { return String(p.waktu) === String(waktu); });
  if (slot && num(slot.porsi) > 0) return num(slot.porsi);
  return rekomendasiUntukSlot(waktu).length;
}

function menuRingkas(waktu) {
  const menus = {};
  rekomendasiUntukSlot(waktu).forEach(function (r) {
    const key = String(r.menu || '').trim();
    if (key) menus[key] = (menus[key] || 0) + 1;
  });
  const keys = Object.keys(menus);
  if (!keys.length) return '-';
  return keys.slice(0, 3).join(', ') + (keys.length > 3 ? ' +' + (keys.length - 3) + ' menu lain' : '');
}

/* Hitung kebutuhan bahan dinamis sesuai porsi masakan dan resep hari ini */
function hitungKebutuhanBahan() {
  const kebutuhan = {}; // { [namaBahanLower]: { nama, jumlah, satuan } }
  const rekomHariIni = rekomendasiUntukTanggal();
  const resepCount = {};

  rekomHariIni.forEach(function (r) {
    const menuNama = String(r.menu || '').trim();
    if (!menuNama) return;
    const paket = state.menuPaket.find(function (m) {
      return String(m.nama || '').trim().toLowerCase() === menuNama.toLowerCase();
    });
    if (paket && Array.isArray(paket.resepList) && paket.resepList.length) {
      paket.resepList.forEach(function (item) {
        const rName = typeof item === 'string' ? item : item.resep;
        if (rName) resepCount[rName] = (resepCount[rName] || 0) + 1;
      });
    } else {
      resepCount[menuNama] = (resepCount[menuNama] || 0) + 1;
    }
  });

  // Jika belum ada rekomendasi pasien tetapi ada porsi pada slot persiapan
  if (!Object.keys(resepCount).length && state.persiapan.length) {
    const totalPorsi = state.persiapan.reduce(function (s, p) { return s + num(p.porsi); }, 0);
    if (totalPorsi > 0 && state.resep.length) {
      const uniqueMenus = Array.from(new Set(state.resep.map(function (r) { return r.menu; })));
      const porsiPerMenu = Math.max(1, Math.round(totalPorsi / (uniqueMenus.length || 1)));
      uniqueMenus.forEach(function (m) {
        resepCount[m] = porsiPerMenu;
      });
    }
  }

  // Kalikan takaran resep dengan jumlah porsi
  state.resep.forEach(function (r) {
    const porsi = resepCount[r.menu] || 0;
    if (porsi > 0) {
      const bNama = String(r.bahan || '').trim().toLowerCase();
      const rawBahan = state.bahan.find(function (b) {
        return b.id === r.bahanId || String(b.nama || '').trim().toLowerCase() === bNama;
      });
      const warehouseSatuan = rawBahan ? rawBahan.satuan : r.satuan;
      const convertedJml = convertUnit(num(r.jumlahPerPorsi) * porsi, r.satuan, warehouseSatuan);

      if (!kebutuhan[bNama]) {
        kebutuhan[bNama] = {
          nama: r.bahan,
          jumlah: 0,
          satuan: warehouseSatuan || r.satuan || ''
        };
      }
      kebutuhan[bNama].jumlah += convertedJml;
    }
  });

  return kebutuhan;
}

/* Hydrate: memuat data persiapan, rekomendasi, bahan, resep, menu paket, dan laporan */
async function hydrate() {
  const tanggal = state.tanggal;
  const urlPersiapan = '/api/logistik/persiapan' + (tanggal ? '?tanggal=' + encodeURIComponent(tanggal) : '');
  
  const hasil = await Promise.all([
    get(urlPersiapan).catch(function () { return []; }),
    get('/api/rekomendasi').catch(function () { return []; }),
    get('/api/bahan').catch(function () { return []; }),
    get('/api/logistik/resep').catch(function () { return []; }),
    get('/api/logistik/menu').catch(function () { return []; }),
    get('/api/logistik/laporan/pemakaian').catch(function () { return null; })
  ]);

  state.persiapan = Array.isArray(hasil[0]) ? hasil[0] : [];
  state.rekomendasi = Array.isArray(hasil[1]) ? hasil[1] : [];
  state.bahan = Array.isArray(hasil[2]) ? hasil[2] : [];
  state.resep = Array.isArray(hasil[3]) ? hasil[3] : [];
  state.menuPaket = Array.isArray(hasil[4]) ? hasil[4] : [];
  state.laporan = hasil[5];

  renderDashboard(state.persiapan, state.rekomendasi);
  renderPersiapan(state.persiapan);
  renderResepTable();
  bindResepModal(state.bahan);
  renderMenuPaketTable();
  bindMenuPaketModal();
  renderBahanSection();
  renderJadwalMasak(state.persiapan);
  renderLaporan(state.persiapan, state.laporan);
}

function renderDashboard(persiapan, rekomendasi) {
  const total = persiapan.length;
  const selesai = persiapan.filter(function (p) { return String(p.status) === 'Selesai'; }).length;
  const proses = persiapan.filter(function (p) { return String(p.status) === 'Diproses'; }).length;
  const belum = total - selesai - proses;

  setText('#dash-total', total);
  setText('#dash-selesai', selesai);
  setText('#dash-proses', proses);
  setText('#dash-belum', belum < 0 ? 0 : belum);

  const antrian = persiapan
    .filter(function (p) { return String(p.status) !== 'Selesai'; })
    .sort(function (a, b) { return SLOTS.indexOf(a.waktu) - SLOTS.indexOf(b.waktu); });

  const boxAntrian = document.getElementById('dash-antrian');
  if (boxAntrian) {
    if (!antrian.length) {
      boxAntrian.innerHTML = '<p class="data-card-empty">Tidak ada antrian masak tersisa.</p>';
    } else {
      boxAntrian.innerHTML = antrian.map(function (p) {
        const porsi = porsiUntukSlot(p.waktu);
        return '' +
          '<article class="prep-card">' +
          '<div class="prep-card-header">' +
          '<div class="prep-card-title">' + dash(p.waktu) + ' &middot; ' + dash(jamUntuk(p.waktu)) + '</div>' +
          '<span class="badge ' + classStatus(p.status) + '">' + esc(labelStatus(p.status)) + '</span>' +
          '</div>' +
          '<div class="prep-card-meta">' + dash(menuRingkas(p.waktu)) + '</div>' +
          '<div class="prep-card-meta">' + (porsi > 0 ? porsi + ' porsi' : 'Porsi belum tercatat') + '</div>' +
          '</article>';
      }).join('');
    }
  }

  const boxNotif = document.getElementById('dash-notif');
  if (boxNotif) {
    const terkirim = rekomendasi.filter(function (r) {
      return String(r.status) === 'Dikirim' && (!state.tanggal || String(r.tanggal) === state.tanggal);
    }).slice(0, 6);

    if (!terkirim.length) {
      boxNotif.innerHTML = '<p class="data-card-empty">Belum ada menu baru dari ahli gizi.</p>';
    } else {
      boxNotif.innerHTML = terkirim.map(function (r) {
        return '' +
          '<div class="activity">' +
          '<div class="activity-icon" aria-hidden="true">&#9679;</div>' +
          '<div>' +
          '<strong>' + dash(r.menu) + '</strong>' +
          '<p>' + dash(r.pasien) + ' &middot; ' + dash(r.ruangan) + ' &middot; ' + dash(r.waktu) + '</p>' +
          '<p>' + (num(r.kalori) > 0 ? num(r.kalori) + ' kkal' : 'Kalori belum diisi') + '</p>' +
          '</div>' +
          '</div>';
      }).join('');
    }
  }
}

let activePrintOrders = [];
function orderNumber(item) {
  const datePart = String(item.tanggal || '').replace(/-/g, '');
  const idPart = String(item.id || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return 'NC-' + datePart + '-' + (idPart || 'PESANAN');
}

function printOrderMarkup(item, kind) {
  const fields = [
    ['Nomor pesanan', orderNumber(item)],
    ['Tanggal', date(item.tanggal)],
    ['Nama pasien', item.pasien || '-'],
    ['Ruangan', item.ruangan || '-'],
    ['Waktu makan', item.waktu || '-'],
    ['Menu', item.menu || '-'],
    ['Diet', item.diet || '-'],
    ['Tekstur', item.tekstur || '-'],
    ['Kalori', item.kalori ? item.kalori + ' kkal' : '-']
  ];
  if (kind === 'detail') {
    fields.push(['Komposisi', item.komposisi || '-'], ['Catatan dapur', item.catatan || '-']);
  }
  return '<article class="print-order ' + (kind === 'label' ? 'print-order-label' : 'print-order-detail') + '">' +
    '<header><strong>NutriCare &middot; ' + (kind === 'label' ? 'Label Ompreng' : 'Detail Makanan') + '</strong><b>' + esc(orderNumber(item)) + '</b></header>' +
    '<dl>' + fields.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
    '</article>';
}

function openPrintDialog(orders) {
  activePrintOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (!activePrintOrders.length) {
    if (window.NutriCareUI) NutriCareUI.error('Data pesanan untuk dicetak tidak ditemukan.');
    else alert('Data pesanan untuk dicetak tidak ditemukan.');
    return;
  }

  // Verifikasi seluruh pesanan yang akan dicetak sudah ditandai siap
  const unready = activePrintOrders.filter(function (item) {
    const prep = prepStatusCache.get(item.waktu);
    return !(prep && /selesai/i.test(prep.status));
  });
  if (unready.length) {
    const msg = 'Label pesanan hanya dapat dicetak setelah persiapan ditandai siap.';
    if (window.NutriCareUI) NutriCareUI.error(msg, 'Belum Siap');
    else alert(msg);
    return;
  }

  const list = document.querySelector('#print-order-list');
  const modal = document.querySelector('#modal-cetak-pesanan');
  if (!list || !modal) return;
  list.innerHTML = activePrintOrders.map(function (item) {
    return '<div class="print-order-summary">' +
      '<strong>' + esc(item.menu) + '</strong>' +
      '<span>' + esc(item.pasien) + ' &middot; ' + esc(item.ruangan || 'Ruangan belum tercatat') + ' &middot; ' + esc(item.waktu) + '</span>' +
      '<small>No. ' + esc(orderNumber(item)) + ' &middot; ' + date(item.tanggal) + '</small>' +
      '</div>';
  }).join('');
  modal.hidden = false;
  const closeButton = modal.querySelector('[data-print-close]');
  if (closeButton) closeButton.focus();
}

function printOrders(kind) {
  if (!activePrintOrders.length) return;
  const sheet = document.querySelector('#print-sheet');
  const modal = document.querySelector('#modal-cetak-pesanan');
  if (!sheet) return;
  sheet.innerHTML = activePrintOrders.map(function (item) { return printOrderMarkup(item, kind); }).join('');
  sheet.dataset.printKind = kind;
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  if (modal) modal.hidden = true;
  window.setTimeout(function () { window.print(); }, 50);
}

function bindPrintActions() {
  const modal = document.querySelector('#modal-cetak-pesanan');
  if (!modal || modal.dataset.printBound) return;
  modal.dataset.printBound = 'true';
  modal.addEventListener('click', function (event) {
    if (event.target === modal || event.target.closest('[data-print-close]')) modal.hidden = true;
    const label = event.target.closest('[data-print-label]');
    const detail = event.target.closest('[data-print-detail]');
    if (label) printOrders('label');
    if (detail) printOrders('detail');
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') modal.hidden = true;
  });
}

window.addEventListener('afterprint', function () {
  const sheet = document.querySelector('#print-sheet');
  if (sheet) {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = '';
  }
});

let pesananCache = [];
let prepStatusCache = new Map();

function openPesananModal(id) {
  const item = pesananCache.find(function (r) { return String(r.id) === String(id); });
  if (!item) return;
  const body = document.querySelector('#modal-pesanan-body');
  const footer = document.querySelector('#modal-pesanan-footer');
  if (!body || !footer) return;
  const rows = [
    ['Tanggal', date(item.tanggal)],
    ['Pasien', esc(item.pasien)],
    ['Ruangan', esc(item.ruangan || '-')],
    ['Waktu', esc(item.waktu)],
    ['Menu', '<strong>' + esc(item.menu) + '</strong>']
  ];
  const prep = prepStatusCache.get(item.waktu);
  const isDone = prep && /selesai/i.test(prep.status);
  const displayStatus = isDone ? 'Sudah siap' : 'Dalam proses';
  if (item.tekstur) rows.push(['Tekstur', esc(item.tekstur)]);
  if (item.kalori) rows.push(['Kalori', esc(item.kalori) + ' kkal']);
  if (item.diet) rows.push(['Diet', esc(item.diet)]);
  if (item.komposisi) rows.push(['Komposisi', '<div class="detail-composition">' + esc(item.komposisi) + '</div>']);
  if (item.catatan) rows.push(['Catatan', esc(item.catatan)]);
  rows.push(['Status', badge(displayStatus)]);
  body.innerHTML = rows.map(function (row) {
    return '<div class="detail-row"><span class="detail-label">' + row[0] + '</span><span class="detail-value">' + row[1] + '</span></div>';
  }).join('');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  footer.innerHTML = item.tanggal !== today
    ? '<span class="detail-value">Pesanan ini bukan untuk tanggal hari ini; perubahan status dapur dinonaktifkan.</span>'
    : isDone
      ? '<span class="detail-value" style="color:var(--green)">Pesanan sudah ditandai siap didistribusikan.</span>'
      : '<button type="button" class="button" data-waktu="' + esc(item.waktu) + '" data-tanggal="' + esc(item.tanggal) + '" data-prep-status="Selesai">Tandai siap</button>';
  const modal = document.querySelector('#modal-pesanan');
  if (modal) modal.hidden = false;
}

function closePesananModal() {
  const modal = document.querySelector('#modal-pesanan');
  if (modal) modal.hidden = true;
}

function bindModalActions() {
  const modal = document.querySelector('#modal-pesanan');
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = 'true';
  modal.addEventListener('click', function (event) {
    if (event.target === modal || event.target.closest('[data-modal-close]')) closePesananModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closePesananModal();
  });

  const footer = document.querySelector('#modal-pesanan-footer');
  if (footer && !footer.dataset.bound) {
    footer.dataset.bound = 'true';
    footer.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-prep-status]');
      if (!button || button.disabled) return;
      button.disabled = true;
      button.textContent = 'Memproses...';
      const waktu = button.dataset.waktu;
      const tanggal = button.dataset.tanggal;
      const ordersToPrint = pesananCache.filter(function (item) { return item.waktu === waktu && (!tanggal || item.tanggal === tanggal); });
      try {
        await patchReq('/api/logistik/persiapan/' + encodeURIComponent(waktu), {
          status: button.dataset.prepStatus,
          tanggal: tanggal || todayIso()
        });
        if (window.NutriCareUI) NutriCareUI.success('Status persiapan berhasil diperbarui', 'Berhasil');
        closePesananModal();
        await hydrate();
        openPrintDialog(ordersToPrint);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Tandai siap';
        if (window.NutriCareUI) NutriCareUI.error(error.message || 'Status persiapan gagal diperbarui', 'Terjadi Kesalahan');
        else alert(error.message || 'Status persiapan gagal diperbarui.');
      }
    });
  }
}

function bindKitchenActions() {
  const body = document.querySelector('#dapur-rekomendasi');
  if (!body || body.dataset.actionsBound) return;
  body.dataset.actionsBound = 'true';
  body.addEventListener('click', function (event) {
    const printButton = event.target.closest('[data-print-order]');
    if (printButton) {
      const item = pesananCache.find(function (row) { return String(row.id) === String(printButton.dataset.printOrder); });
      if (item) openPrintDialog([item]);
      return;
    }
    const detailButton = event.target.closest('[data-pesanan-detail]');
    if (detailButton) {
      openPesananModal(detailButton.dataset.pesananDetail);
      return;
    }
  });
}

function renderPersiapan(persiapan) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const sentRecommendations = state.rekomendasi.filter(function (item) {
    return item.status === 'Dikirim' && (!item.tanggal || item.tanggal >= today);
  });
  pesananCache = sentRecommendations;
  prepStatusCache = new Map(persiapan.map(function (p) { return [p.waktu, p]; }));

  // 1. Stat cards persiapan
  const prepDone = persiapan.filter(function (item) { return /selesai/i.test(item.status); }).length;
  const prepActive = persiapan.filter(function (item) { return /proses/i.test(item.status); }).length;
  const prepValues = document.querySelectorAll('#persiapan .stats .stat-value');
  [persiapan.length, prepDone, prepActive, Math.max(0, persiapan.length - prepDone - prepActive)].forEach(function (val, idx) {
    if (prepValues[idx]) prepValues[idx].textContent = String(val).padStart(2, '0');
  });

  // 2. Table rekomendasi
  const rekomTbody = document.querySelector('#dapur-rekomendasi');
  if (rekomTbody) {
    if (!sentRecommendations.length) {
      rekomTbody.innerHTML = '<tr><td colspan="6">Belum ada rekomendasi yang dikirim ke dapur.</td></tr>';
    } else {
      rekomTbody.innerHTML = sentRecommendations.map(function (item) {
        const prep = prepStatusCache.get(item.waktu);
        const isReady = prep && /selesai/i.test(prep.status);
        const printBtn = isReady
          ? '<button type="button" class="button button-secondary button-sm" data-print-order="' + esc(item.id) + '">Cetak label</button>'
          : '<button type="button" class="button button-secondary button-sm" disabled title="Tandai siap di detail pesanan terlebih dahulu sebelum cetak label" style="opacity:.45;cursor:not-allowed">Cetak label</button>';

        return '<tr>' +
          '<td>' + date(item.tanggal) + '</td>' +
          '<td>' + esc(item.pasien) + '</td>' +
          '<td>' + esc(item.waktu) + '</td>' +
          '<td><strong>' + esc(item.menu) + '</strong></td>' +
          '<td>' + (isReady ? badge('Sudah siap') : badge('Dalam proses')) + '</td>' +
          '<td><div style="display:flex;gap:6px">' +
          printBtn +
          '<button type="button" class="button button-secondary button-sm" data-pesanan-detail="' + esc(item.id) + '">Detail</button>' +
          '</div></td>' +
          '</tr>';
      }).join('');
    }
  }

  // 3. Progress bars
  document.querySelectorAll('#persiapan .progress-item').forEach(function (row, index) {
    const item = persiapan[index];
    if (!item) return;
    const title = row.querySelector('.progress-title');
    if (title) title.innerHTML = '<span>' + esc(item.waktu) + '</span><span>' + esc(item.progres || 0) + '% &middot; ' + esc(item.status) + '</span>';
    const fill = row.querySelector('.progress-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, Number(item.progres) || 0)) + '%';
  });

  // 4. Daftar persiapan table
  const prepTbody = document.querySelector('#dapur-persiapan');
  if (prepTbody) {
    if (!persiapan.length) {
      prepTbody.innerHTML = '<tr><td colspan="5">Belum ada data persiapan.</td></tr>';
    } else {
      prepTbody.innerHTML = persiapan.map(function (item) {
        const hasOrders = sentRecommendations.some(function (r) { return r.waktu === item.waktu; });
        const aksi = item.status === 'Selesai'
          ? '<span style="color:var(--green)">Siap didistribusikan</span>'
          : hasOrders ? 'Lihat detail pesanan' : 'Belum ada pesanan';
        return '<tr>' +
          '<td>' + esc(item.waktu) + '</td>' +
          '<td>' + esc(item.porsi) + ' porsi</td>' +
          '<td>' + badge(item.status) + '</td>' +
          '<td>' + esc(item.catatan || '—') + '</td>' +
          '<td>' + aksi + '</td>' +
          '</tr>';
      }).join('');
    }
  }

  bindKitchenActions();
  bindModalActions();
  bindPrintActions();
}

/* ── MODAL & TABEL RESEP HIDANGAN ─────────────────────────────────────── */

function renderResepTable() {
  const tbody = document.querySelector('#resep-daftar');
  if (!tbody) return;
  const query = _filterResepHidangan.toLocaleLowerCase('id');
  const menus = Array.from(new Set(state.resep.filter(function (r) {
    return !query || String(r.menu || '').toLocaleLowerCase('id').includes(query) || String(r.bahan || '').toLocaleLowerCase('id').includes(query);
  }).map(function (r) { return r.menu; })));
  if (!menus.length) {
    tbody.innerHTML = '<tr><td colspan="6">' + (state.resep.length ? 'Tidak ada resep yang cocok dengan pencarian.' : 'Belum ada resep hidangan.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = menus.map(function (menu) {
    const items = state.resep.filter(function (r) { return r.menu === menu; });
    const totalKal = items.reduce(function (s, r) { return s + num(r.kaloriPerPorsi); }, 0);
    return items.map(function (item, idx) {
      return '<tr>' +
        (idx === 0 ? '<td rowspan="' + items.length + '"><strong>' + esc(menu) + '</strong></td>' : '') +
        '<td>' + esc(item.bahan) + '</td>' +
        '<td>' + esc(item.jumlahPerPorsi) + '</td>' +
        '<td>' + esc(item.satuan) + '</td>' +
        (idx === 0 ? '<td rowspan="' + items.length + '">' + esc(totalKal) + ' kkal</td>' : '') +
        (idx === 0 ? '<td rowspan="' + items.length + '">' +
          '<button type="button" class="button button-secondary button-sm" data-recipe-edit="' + esc(menu) + '" style="margin-right:4px">Edit</button>' +
          '<button type="button" class="button button-secondary button-sm" data-recipe-delete="' + esc(menu) + '">Hapus</button>' +
          '</td>' : '') +
        '</tr>';
    }).join('');
  }).join('');
}

function buildBahanLine(bahanList, item) {
  const row = document.createElement('div');
  row.className = 'recipe-line';

  const commonUnits = ['gram', 'kg', 'ml', 'liter', 'sdm', 'sdt', 'butir', 'buah', 'potong', 'lembar', 'porsi', 'ikat', 'ons', 'bungkus'];

  row.innerHTML = '' +
    '<label class="recipe-field"><span>Bahan</span>' +
    '<select class="recipe-bahan-select" aria-label="Bahan resep">' +
    '<option value="">Pilih bahan</option>' +
    bahanList.map(function (b) {
      return '<option value="' + esc(b.id) + '">' + esc(b.nama) + ' (' + esc(b.satuan) + ')</option>';
    }).join('') +
    '</select>' +
    '</label>' +
    '<label class="recipe-field"><span>Jml/porsi</span>' +
    '<div class="recipe-amount"><input type="number" class="recipe-amount-input" min="0.0001" step="any" placeholder="0.00"></div>' +
    '</label>' +
    '<label class="recipe-field"><span>Satuan</span>' +
    '<select class="recipe-unit-select" aria-label="Satuan resep">' +
    commonUnits.map(function (u) {
      return '<option value="' + esc(u) + '">' + esc(u) + '</option>';
    }).join('') +
    '</select>' +
    '</label>' +
    '<label class="recipe-kal recipe-field"><span>Kalori (kkal)</span>' +
    '<input type="number" class="recipe-kal-input" min="0" step="any" placeholder="0">' +
    '</label>' +
    '<button type="button" class="button button-secondary button-sm recipe-remove" aria-label="Hapus bahan">Hapus</button>';

  const selBahan = row.querySelector('.recipe-bahan-select');
  const selSatuan = row.querySelector('.recipe-unit-select');
  const jmlInput = row.querySelector('.recipe-amount-input');
  const kalInput = row.querySelector('.recipe-kal-input');

  selBahan.addEventListener('change', function () {
    const b = bahanList.find(function (x) { return x.id === selBahan.value; });
    if (b && b.satuan) {
      let opt = Array.from(selSatuan.options).find(function (o) { return o.value.toLowerCase() === b.satuan.toLowerCase(); });
      if (!opt) {
        opt = document.createElement('option');
        opt.value = b.satuan;
        opt.textContent = b.satuan;
        selSatuan.appendChild(opt);
      }
      selSatuan.value = opt.value;
    }
  });

  row.querySelector('.recipe-remove').addEventListener('click', function () { row.remove(); });

  if (item) {
    selBahan.value = item.bahanId || '';
    if (item.satuan) {
      let opt = Array.from(selSatuan.options).find(function (o) { return o.value.toLowerCase() === item.satuan.toLowerCase(); });
      if (!opt) {
        opt = document.createElement('option');
        opt.value = item.satuan;
        opt.textContent = item.satuan;
        selSatuan.appendChild(opt);
      }
      selSatuan.value = item.satuan;
    }
    jmlInput.value = item.jumlahPerPorsi || '';
    kalInput.value = item.kaloriPerPorsi || 0;
  }
  return row;
}

function bindResepModal(bahanList) {
  const btnTambah = document.getElementById('btn-tambah-resep');
  if (btnTambah && !btnTambah.dataset.bound) {
    btnTambah.dataset.bound = 'true';
    btnTambah.addEventListener('click', function () {
      _resepEditNama = null;
      document.getElementById('modal-resep-title').textContent = 'Resep baru';
      document.getElementById('resep-nama-input').value = '';
      const list = document.getElementById('resep-bahan-list');
      list.innerHTML = '';
      document.getElementById('resep-feedback').textContent = '';
      list.appendChild(buildBahanLine(bahanList, null));
      openModal('modal-resep');
    });
  }

  const btnTambahBahan = document.getElementById('tambah-resep-bahan');
  if (btnTambahBahan && !btnTambahBahan.dataset.bound) {
    btnTambahBahan.dataset.bound = 'true';
    btnTambahBahan.addEventListener('click', function () {
      document.getElementById('resep-bahan-list').appendChild(buildBahanLine(bahanList, null));
    });
  }

  const searchResep = document.getElementById('cari-resep-hidangan');
  if (searchResep && !searchResep.dataset.bound) {
    searchResep.dataset.bound = 'true';
    searchResep.addEventListener('input', function () { _filterResepHidangan = searchResep.value.trim(); renderResepTable(); });
  }

  const tableResep = document.querySelector('#resep-daftar');
  if (tableResep && !tableResep.dataset.bound) {
    tableResep.dataset.bound = 'true';
    tableResep.addEventListener('click', async function (e) {
      const editBtn = e.target.closest('[data-recipe-edit]');
      const delBtn = e.target.closest('[data-recipe-delete]');
      if (editBtn) {
        const menu = editBtn.dataset.recipeEdit;
        _resepEditNama = menu;
        document.getElementById('modal-resep-title').textContent = 'Edit resep: ' + menu;
        document.getElementById('resep-nama-input').value = menu;
        const list = document.getElementById('resep-bahan-list');
        list.innerHTML = '';
        state.resep.filter(function (r) { return r.menu === menu; }).forEach(function (item) {
          list.appendChild(buildBahanLine(bahanList, item));
        });
        document.getElementById('resep-feedback').textContent = '';
        openModal('modal-resep');
      } else if (delBtn) {
        const menu = delBtn.dataset.recipeDelete;
        const confirmed = window.NutriCareUI ? await NutriCareUI.confirm('Hapus resep?', 'Resep "' + menu + '" akan dihapus dari daftar.') : window.confirm('Hapus resep "' + menu + '"?');
        if (!confirmed) return;
        delBtn.disabled = true;
        delBtn.textContent = 'Memproses...';
        try {
          await deleteReq('/api/logistik/resep/' + encodeURIComponent(menu));
          await hydrate();
        } catch (err) {
          if (window.NutriCareUI) NutriCareUI.error(err.message || 'Gagal menghapus resep.');
          else window.alert(err.message || 'Gagal menghapus resep.');
        } finally {
          delBtn.disabled = false;
          delBtn.textContent = 'Hapus';
        }
      }
    });
  }

  const simpanBtn = document.getElementById('simpan-resep-btn');
  if (simpanBtn && !simpanBtn.dataset.bound) {
    simpanBtn.dataset.bound = 'true';
    simpanBtn.addEventListener('click', async function () {
      const nama = document.getElementById('resep-nama-input').value.trim();
      const fb = document.getElementById('resep-feedback');
      if (!nama) { fb.textContent = 'Nama resep wajib diisi.'; return; }

      const lines = Array.from(document.querySelectorAll('#resep-bahan-list .recipe-line'));
      const items = [];
      for (const line of lines) {
        const bahanId = line.querySelector('.recipe-bahan-select').value;
        const jumlah = parseFloat(line.querySelector('.recipe-amount-input').value);
        const satuan = line.querySelector('.recipe-unit-select') ? line.querySelector('.recipe-unit-select').value.trim() : '';
        const kalori = parseFloat(line.querySelector('.recipe-kal-input').value) || 0;
        if (!bahanId || !(jumlah > 0)) { fb.textContent = 'Lengkapi bahan dan jumlah per porsi.'; return; }
        items.push({ bahanId: bahanId, jumlahPerPorsi: jumlah, satuan: satuan, kaloriPerPorsi: kalori });
      }
      if (!items.length) { fb.textContent = 'Tambahkan minimal satu bahan.'; return; }

      simpanBtn.disabled = true;
      simpanBtn.textContent = 'Memproses...';
      fb.textContent = '';
      try {
        await put('/api/logistik/resep', { menu: nama, items: items });
        closeModal('modal-resep');
        await hydrate();
      } catch (err) {
        fb.textContent = err.message || 'Gagal menyimpan resep.';
      } finally {
        simpanBtn.disabled = false;
        simpanBtn.textContent = 'Simpan resep';
      }
    });
  }
}

/* ── MODAL & TABEL MENU PAKET DIET ─────────────────────────────────────── */

function resepKaloriTotals() {
  const map = {};
  state.resep.forEach(function (row) {
    map[row.menu] = (map[row.menu] || 0) + num(row.kaloriPerPorsi);
  });
  return map;
}

function renderMenuPaketTable() {
  const tbody = document.querySelector('#menu-paket-daftar');
  if (!tbody) return;
  const query = _filterMenuPaket.toLocaleLowerCase('id');
  const filtered = state.menuPaket.filter(function (m) {
    const resepText = (m.resepList || []).map(function (r) { return typeof r === 'string' ? r : r.resep; }).join(' ');
    return !query || [m.nama, m.diet, m.tekstur, m.deskripsi, resepText].some(function (v) { return String(v || '').toLocaleLowerCase('id').includes(query); });
  });
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6">' + (state.menuPaket.length ? 'Tidak ada menu paket yang cocok dengan pencarian.' : 'Belum ada paket menu diet.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function (m) {
    const resepStr = (m.resepList || []).map(function (r) {
      return esc(typeof r === 'string' ? r : r.resep);
    }).join(', ') || '-';
    return '<tr>' +
      '<td><strong>' + esc(m.nama) + '</strong>' + (m.deskripsi ? '<br><small style="color:var(--muted)">' + esc(m.deskripsi) + '</small>' : '') + '</td>' +
      '<td style="font-size:11px">' + resepStr + '</td>' +
      '<td>' + esc(m.diet || '-') + '</td>' +
      '<td>' + esc(m.tekstur || '-') + '</td>' +
      '<td><strong>' + esc(Math.round(m.totalKalori || 0)) + '</strong> kkal</td>' +
      '<td>' +
      '<button type="button" class="button button-secondary button-sm" data-menu-edit="' + esc(m.id) + '" style="margin-right:4px">Edit</button>' +
      '<button type="button" class="button button-secondary button-sm" data-menu-delete="' + esc(m.id) + '">Hapus</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function populateResepPicker(selectedNames) {
  const list = document.getElementById('resep-picker-list');
  if (!list) return;
  const uniqueMenus = Array.from(new Set(state.resep.map(function (r) { return r.menu; })));
  const kalTotals = resepKaloriTotals();
  if (!uniqueMenus.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:12px">Belum ada resep. Buat resep terlebih dahulu.</p>';
    return;
  }
  list.innerHTML = uniqueMenus.map(function (menu) {
    const sel = selectedNames && selectedNames.includes(menu);
    return '' +
      '<div class="resep-pick-item' + (sel ? ' selected' : '') + '" data-resep-nama="' + esc(menu) + '">' +
      '<div><strong>' + esc(menu) + '</strong> <span style="color:var(--muted);font-size:11px">(' + (kalTotals[menu] || 0) + ' kkal)</span></div>' +
      '<div class="resep-pick-check" aria-hidden="true">&#10003;</div>' +
      '</div>';
  }).join('');

  list.querySelectorAll('.resep-pick-item').forEach(function (el) {
    el.addEventListener('click', function () {
      el.classList.toggle('selected');
      updateKaloriPreview();
    });
  });
  updateKaloriPreview();
}

function updateKaloriPreview() {
  const kalTotals = resepKaloriTotals();
  const selected = Array.from(document.querySelectorAll('#resep-picker-list .resep-pick-item.selected'));
  const total = selected.reduce(function (s, el) {
    return s + (kalTotals[el.dataset.resepNama] || 0);
  }, 0);
  const el = document.getElementById('kalori-preview-total');
  if (el) el.innerHTML = Math.round(total) + ' <span>kkal total</span>';
}

function bindMenuPaketModal() {
  const btnTambah = document.getElementById('btn-tambah-menu');
  if (btnTambah && !btnTambah.dataset.bound) {
    btnTambah.dataset.bound = 'true';
    btnTambah.addEventListener('click', function () {
      _menuEditId = null;
      document.getElementById('modal-menu-title').textContent = 'Menu baru';
      document.getElementById('menu-nama-input').value = '';
      document.getElementById('menu-deskripsi-input').value = '';
      document.getElementById('menu-diet-input').value = 'Diet Normal';
      document.getElementById('menu-tekstur-input').value = 'Biasa';
      document.getElementById('menu-feedback').textContent = '';
      populateResepPicker([]);
      openModal('modal-menu');
    });
  }

  const searchMenu = document.getElementById('cari-menu-paket-diet');
  if (searchMenu && !searchMenu.dataset.bound) {
    searchMenu.dataset.bound = 'true';
    searchMenu.addEventListener('input', function () { _filterMenuPaket = searchMenu.value.trim(); renderMenuPaketTable(); });
  }

  const tableMenu = document.querySelector('#menu-paket-daftar');
  if (tableMenu && !tableMenu.dataset.bound) {
    tableMenu.dataset.bound = 'true';
    tableMenu.addEventListener('click', async function (e) {
      const editBtn = e.target.closest('[data-menu-edit]');
      const delBtn = e.target.closest('[data-menu-delete]');
      if (editBtn) {
        const id = editBtn.dataset.menuEdit;
        const paket = state.menuPaket.find(function (m) { return m.id === id; });
        if (!paket) return;
        _menuEditId = id;
        document.getElementById('modal-menu-title').textContent = 'Edit menu: ' + paket.nama;
        document.getElementById('menu-nama-input').value = paket.nama;
        document.getElementById('menu-deskripsi-input').value = paket.deskripsi || '';
        document.getElementById('menu-diet-input').value = paket.diet || 'Diet Normal';
        document.getElementById('menu-tekstur-input').value = paket.tekstur || 'Biasa';
        document.getElementById('menu-feedback').textContent = '';
        const names = (paket.resepList || []).map(function (r) {
          return typeof r === 'string' ? r : r.resep;
        });
        populateResepPicker(names);
        openModal('modal-menu');
      } else if (delBtn) {
        const id = delBtn.dataset.menuDelete;
        const paket = state.menuPaket.find(function (m) { return m.id === id; });
        const confirmed = window.NutriCareUI ? await NutriCareUI.confirm('Hapus menu paket?', 'Menu "' + (paket ? paket.nama : '') + '" akan dihapus dari daftar.') : window.confirm('Hapus menu "' + (paket ? paket.nama : '') + '"?');
        if (!confirmed) return;
        delBtn.disabled = true;
        delBtn.textContent = 'Memproses...';
        try {
          await deleteReq('/api/logistik/menu/' + id);
          await hydrate();
        } catch (err) {
          if (window.NutriCareUI) NutriCareUI.error(err.message || 'Gagal menghapus menu.');
          else window.alert(err.message || 'Gagal menghapus menu.');
        } finally {
          delBtn.disabled = false;
          delBtn.textContent = 'Hapus';
        }
      }
    });
  }

  const simpanBtn = document.getElementById('simpan-menu-btn');
  if (simpanBtn && !simpanBtn.dataset.bound) {
    simpanBtn.dataset.bound = 'true';
    simpanBtn.addEventListener('click', async function () {
      const nama = document.getElementById('menu-nama-input').value.trim();
      const deskripsi = document.getElementById('menu-deskripsi-input').value.trim();
      const diet = document.getElementById('menu-diet-input').value;
      const tekstur = document.getElementById('menu-tekstur-input').value;
      const fb = document.getElementById('menu-feedback');
      if (!nama) { fb.textContent = 'Nama menu wajib diisi.'; return; }

      const resepList = Array.from(document.querySelectorAll('#resep-picker-list .resep-pick-item.selected')).map(function (el) {
        return el.dataset.resepNama;
      });
      if (!resepList.length) { fb.textContent = 'Pilih minimal satu resep.'; return; }

      simpanBtn.disabled = true;
      simpanBtn.textContent = 'Memproses...';
      fb.textContent = '';
      try {
        if (_menuEditId) {
          await patchReq('/api/logistik/menu/' + _menuEditId, { nama, deskripsi, diet, tekstur, resepList });
        } else {
          await post('/api/logistik/menu', { nama, deskripsi, diet, tekstur, resepList });
        }
        closeModal('modal-menu');
        await hydrate();
      } catch (err) {
        fb.textContent = err.message || 'Gagal menyimpan menu.';
      } finally {
        simpanBtn.disabled = false;
        simpanBtn.textContent = 'Simpan menu';
      }
    });
  }
}

/* ── DATA BAHAN MAKANAN & MONITORING PEMAKAIAN ────────────────────────── */

function renderBahanSection() {
  const kebutuhanMap = hitungKebutuhanBahan();
  const bahanList = state.bahan || [];

  let totalBahan = bahanList.length;
  let totalDipakai = 0;
  let totalAman = 0;
  let totalKurang = 0;

  // Dropdown kategori
  const selKategori = document.getElementById('filter-bahan-kategori');
  if (selKategori && selKategori.options.length <= 1) {
    const kategoris = Array.from(new Set(bahanList.map(function (b) { return b.kategori; }).filter(Boolean))).sort();
    kategoris.forEach(function (k) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      selKategori.appendChild(opt);
    });
  }

  const rows = [];

  bahanList.forEach(function (b) {
    const bNamaLower = String(b.nama || '').trim().toLowerCase();
    const keb = kebutuhanMap[bNamaLower];
    const jumlahKebutuhan = keb ? keb.jumlah : 0;
    const stokGudang = num(b.stok);
    const sisa = stokGudang - jumlahKebutuhan;
    const minimum = num(b.minimum || 0);

    if (jumlahKebutuhan > 0) totalDipakai++;

    let status = 'cukup';
    let statusLabel = 'Aman';
    let statusBadgeClass = 'good';

    if (jumlahKebutuhan > stokGudang) {
      status = 'kurang';
      statusLabel = 'Kurang';
      statusBadgeClass = 'danger';
      totalKurang++;
    } else if (sisa <= minimum) {
      status = 'menipis';
      statusLabel = 'Menipis';
      statusBadgeClass = 'warning';
      totalKurang++;
    } else {
      totalAman++;
    }

    const matchCari = !state.filterBahanCari || b.nama.toLowerCase().includes(state.filterBahanCari.toLowerCase());
    const matchKat = !state.filterBahanKategori || b.kategori === state.filterBahanKategori;
    const matchStatus = !state.filterBahanStatus || status === state.filterBahanStatus;

    if (matchCari && matchKat && matchStatus) {
      rows.push({
        bahan: b,
        stokGudang: stokGudang,
        kebutuhan: jumlahKebutuhan,
        sisa: sisa,
        status: status,
        statusLabel: statusLabel,
        statusBadgeClass: statusBadgeClass
      });
    }
  });

  setText('#bahan-stat-total', totalBahan);
  setText('#bahan-stat-dipakai', totalDipakai);
  setText('#bahan-stat-aman', totalAman);
  setText('#bahan-stat-kurang', totalKurang);

  const tbody = document.getElementById('bahan-daftar');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6">Tidak ada data bahan yang sesuai filter.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function (r) {
    const b = r.bahan;
    const sisaClass = r.sisa < 0 ? 'stock-diff deficit' : 'stock-diff sufficient';
    const sisaFormatted = r.sisa < 0
      ? '<span class="' + sisaClass + '">Kurang ' + Math.abs(r.sisa).toFixed(2) + ' ' + esc(b.satuan) + '</span>'
      : '<span class="' + sisaClass + '">' + r.sisa.toFixed(2) + ' ' + esc(b.satuan) + '</span>';

    return '<tr>' +
      '<td><span style="font-size:11px;color:var(--muted)">' + esc(b.kategori || '-') + '</span></td>' +
      '<td><strong>' + esc(b.nama) + '</strong></td>' +
      '<td>' + r.stokGudang.toFixed(2) + ' ' + esc(b.satuan) + '</td>' +
      '<td>' + (r.kebutuhan > 0 ? '<b>' + r.kebutuhan.toFixed(2) + '</b> ' + esc(b.satuan) : '-') + '</td>' +
      '<td>' + sisaFormatted + '</td>' +
      '<td><span class="badge ' + r.statusBadgeClass + '">' + esc(r.statusLabel) + '</span></td>' +
      '</tr>';
  }).join('');
}

function bindBahanActions() {
  const cariInput = document.getElementById('filter-bahan-cari');
  const katSelect = document.getElementById('filter-bahan-kategori');
  const statusSelect = document.getElementById('filter-bahan-status');
  const refreshBtn = document.getElementById('btn-refresh-bahan');

  if (cariInput && !cariInput.dataset.bound) {
    cariInput.dataset.bound = 'true';
    cariInput.addEventListener('input', function () {
      state.filterBahanCari = cariInput.value.trim();
      renderBahanSection();
    });
  }

  if (katSelect && !katSelect.dataset.bound) {
    katSelect.dataset.bound = 'true';
    katSelect.addEventListener('change', function () {
      state.filterBahanKategori = katSelect.value;
      renderBahanSection();
    });
  }

  if (statusSelect && !statusSelect.dataset.bound) {
    statusSelect.dataset.bound = 'true';
    statusSelect.addEventListener('change', function () {
      state.filterBahanStatus = statusSelect.value;
      renderBahanSection();
    });
  }

  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', function () {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Memproses...';
      hydrate().finally(function () {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Muat Ulang';
      });
    });
  }
}

/* ── JADWAL & LAPORAN ─────────────────────────────────────────────────── */

function renderJadwalMasak(persiapan) {
  const tbody = document.getElementById('jadwal-tbody');
  if (!tbody) return;

  if (!persiapan.length) {
    tbody.innerHTML = '<tr><td colspan="4">Belum ada jadwal masak untuk tanggal ini.</td></tr>';
    return;
  }

  tbody.innerHTML = persiapan.map(function (p) {
    const porsi = porsiUntukSlot(p.waktu);
    return '<tr>' +
      '<td>' + dash(p.waktu) + ' <span style="color:var(--muted)">' + dash(jamUntuk(p.waktu)) + '</span></td>' +
      '<td>' + dash(menuRingkas(p.waktu)) + '</td>' +
      '<td>' + (porsi > 0 ? porsi : '-') + '</td>' +
      '<td><span class="badge ' + classStatus(p.status) + '">' + esc(labelStatus(p.status)) + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderLaporan(persiapan, laporan) {
  const totalPorsi = persiapan.reduce(function (sum, p) { return sum + porsiUntukSlot(p.waktu); }, 0);
  const totalKalori = rekomendasiUntukTanggal().reduce(function (sum, r) { return sum + num(r.kalori); }, 0);
  const selesai = persiapan.filter(function (p) { return String(p.status) === 'Selesai'; }).length;
  const pct = persiapan.length ? Math.round((selesai / persiapan.length) * 100) : 0;

  setText('#lap-total-porsi', totalPorsi);
  setText('#lap-total-kalori', totalKalori > 0 ? totalKalori + ' kkal' : '-');
  setText('#lap-pct-selesai', persiapan.length ? pct + '%' : '-');

  const tbody = document.getElementById('laporan-tbody');
  if (tbody) {
    if (!persiapan.length) {
      tbody.innerHTML = '<tr><td colspan="4">Belum ada data persiapan pada tanggal ini.</td></tr>';
    } else {
      tbody.innerHTML = persiapan.map(function (p) {
        const porsi = porsiUntukSlot(p.waktu);
        return '<tr>' +
          '<td>' + dash(p.waktu) + '</td>' +
          '<td>' + dash(menuRingkas(p.waktu)) + '</td>' +
          '<td>' + (porsi > 0 ? porsi : '-') + '</td>' +
          '<td><span class="badge ' + classStatus(p.status) + '">' + esc(labelStatus(p.status)) + '</span></td>' +
          '</tr>';
      }).join('');
    }
  }

  renderChart(persiapan, laporan);
}

function renderChart(persiapan, laporan) {
  if (typeof Chart === 'undefined') return;

  const selesai = persiapan.filter(function (p) { return String(p.status) === 'Selesai'; }).length;
  const proses = persiapan.filter(function (p) { return String(p.status) === 'Diproses'; }).length;
  const belum = persiapan.filter(function (p) { return String(p.status) === 'Menunggu'; }).length;

  const canvasStatus = document.getElementById('chart-status');
  if (canvasStatus) {
    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(canvasStatus, {
      type: 'bar',
      data: {
        labels: ['Selesai', 'Proses', 'Belum'],
        datasets: [{
          label: 'Jumlah slot',
          data: [selesai, proses, belum],
          backgroundColor: ['#b6d99a', '#e8d39a', '#6f7a6d'],
          borderRadius: 6,
          maxBarThickness: 56
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#202620', borderColor: 'rgba(255,255,255,.09)', borderWidth: 1 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#a4aaa0' } },
          y: {
            beginAtZero: true,
            ticks: { color: '#a4aaa0', precision: 0 },
            grid: { color: 'rgba(255,255,255,.06)' }
          }
        }
      }
    });
  }

  const canvasTren = document.getElementById('chart-tren');
  if (canvasTren) {
    const labels = persiapan.length ? persiapan.map(function (p) { return p.waktu; }) : SLOTS;
    const dataPorsi = labels.map(function (waktu) { return porsiUntukSlot(waktu); });

    if (chartTren) chartTren.destroy();
    chartTren = new Chart(canvasTren, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Porsi',
          data: dataPorsi,
          borderColor: '#b6d99a',
          backgroundColor: 'rgba(182,217,154,.12)',
          fill: true,
          tension: .3,
          pointRadius: 4,
          pointBackgroundColor: '#b6d99a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#202620',
            borderColor: 'rgba(255,255,255,.09)',
            borderWidth: 1,
            callbacks: {
              afterLabel: function () {
                const total = laporan && typeof laporan.total === 'number' ? laporan.total : null;
                return total === null ? '' : 'Pemakaian bahan 7 hari: ' + total;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#a4aaa0' } },
          y: {
            beginAtZero: true,
            ticks: { color: '#a4aaa0', precision: 0 },
            grid: { color: 'rgba(255,255,255,.06)' }
          }
        }
      }
    });
  }
}

function bindFilters() {
  const prepTanggal = document.getElementById('prep-tanggal');
  const jadwalTanggal = document.getElementById('jadwal-tanggal');
  const prepReload = document.getElementById('prep-reload');
  const jadwalReload = document.getElementById('jadwal-reload');

  if (prepTanggal) prepTanggal.value = state.tanggal;
  if (jadwalTanggal) jadwalTanggal.value = state.tanggal;

  function gantiTanggal(value) {
    state.tanggal = value || todayIso();
    if (prepTanggal) prepTanggal.value = state.tanggal;
    if (jadwalTanggal) jadwalTanggal.value = state.tanggal;
    hydrate();
  }

  if (prepTanggal) prepTanggal.addEventListener('change', function () { gantiTanggal(prepTanggal.value); });
  if (jadwalTanggal) jadwalTanggal.addEventListener('change', function () { gantiTanggal(jadwalTanggal.value); });

  [prepReload, jadwalReload].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
      hydrate().finally(function () {
        btn.disabled = false;
        btn.textContent = 'Muat ulang';
      });
    });
  });
}

function bindModalListeners() {
  document.addEventListener('click', function (e) {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
    }
  });

  document.querySelectorAll('.modal-backdrop').forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) {
        m.classList.remove('open');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  bindFilters();
  bindModalListeners();
  bindBahanActions();
  hydrate();
});
