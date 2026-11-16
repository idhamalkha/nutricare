/**
 * 🔔 NutriCare Notification Center
 * Kotak masuk notifikasi: daftar ringkas + popup rincian.
 *
 * Setiap notifikasi menyimpan `detail` (kind, ringkas, fields, items) supaya
 * perawat dan logistik bisa membaca isi pesannya tanpa berpindah halaman.
 * Notifikasi lama tanpa `detail` tetap tampil dengan teks biasa.
 */

const NotificationCenter = {
    initialized: false,
    setButtonBusy(button, label) {
        if (!button || button.dataset.busy === 'true') return null;
        const state = { html: button.innerHTML, disabled: button.disabled };
        button.dataset.busy = 'true';
        button.setAttribute('aria-busy', 'true');
        button.disabled = true;
        button.textContent = label;
        return state;
    },
    restoreButton(button, state) {
        if (!button || !state) return;
        button.innerHTML = state.html;
        button.disabled = state.disabled;
        button.removeAttribute('aria-busy');
        delete button.dataset.busy;
    },
    waitForPaint() {
        return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    },
    notifications: [],
    unreadCount: 0,
    bellButton: null,
    dropdown: null,
    badge: null,
    listElement: null,
    countElement: null,
    detailElement: null,

    init() {
        if (this.initialized) return;

        this.bellButton = document.getElementById('notification-bell');
        this.dropdown = document.getElementById('notification-dropdown');
        this.badge = document.getElementById('notification-badge');
        this.listElement = document.getElementById('notification-list');
        this.countElement = document.getElementById('notification-count');

        if (!this.bellButton || !this.dropdown) {
            console.warn('[NotificationCenter] Elements not found');
            return;
        }

        this.bellButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Tutup dropdown saat klik di luar, kecuali saat popup rincian terbuka.
        document.addEventListener('click', (e) => {
            if (this.detailElement && this.detailElement.open) return;
            if (!this.dropdown.contains(e.target) && !this.bellButton.contains(e.target)) {
                this.close();
            }
        });

        const markAllBtn = document.getElementById('mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllAsRead());
        }

        const clearAllBtn = document.getElementById('clear-all-notifications');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAll());
        }

        // Satu listener untuk seluruh daftar (item dibuat ulang setiap render).
        if (this.listElement) {
            this.listElement.addEventListener('click', (event) => {
                const item = event.target.closest('[data-notif-id]');
                if (!item) return;
                event.preventDefault();
                this.openDetailById(item.getAttribute('data-notif-id'));
            });
        }

        this.ensureDetailDialog();
        this.initialized = true;

        // Notifikasi real-time belum tersedia di rilis ini: tanpa token tidak ada
        // yang bisa dimuat, jadi jangan polling agar tidak memicu permintaan
        // berulang. Dropdown tetap menampilkan keadaan kosong.
        if (!sessionStorage.getItem('nutricare-token')) {
            this.renderList();
            return;
        }

        this.load();

        // Auto-refresh setiap 30 detik
        setInterval(() => this.load(), 30000);
    },

    async load() {
        try {
            const token = sessionStorage.getItem('nutricare-token');
            if (!token) return;

            const response = await fetch('/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Notifikasi gagal dimuat (HTTP ' + response.status + ').');
            const data = await response.json();
            this.notifications = Array.isArray(data.notifications) ? data.notifications : [];
            this.updateUI();
            this.updateLastLoad(Date.now());
        } catch (error) {
            console.error('[NotificationCenter] Load error:', error);
            if (this.listElement && !this.notifications.length) {
                this.listElement.innerHTML = '<div class="notif-empty"><p class="notif-empty-text">Notifikasi belum dapat dimuat. Coba lagi sebentar.</p></div>';
            }
        }
    },

    updateLastLoad(timestamp) {
        this.lastLoadAt = timestamp;
    },

    updateUI() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;

        if (this.badge) {
            if (this.unreadCount > 0) {
                this.badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
                this.badge.style.display = 'flex';
                this.bellButton.classList.add('has-unread');
            } else {
                this.badge.style.display = 'none';
                this.bellButton.classList.remove('has-unread');
            }
        }

        if (this.countElement) {
            if (this.unreadCount > 0) {
                this.countElement.textContent = this.unreadCount + ' baru';
                this.countElement.hidden = false;
            } else {
                this.countElement.hidden = true;
            }
        }

        this.renderList();

        const markAllBtn = document.getElementById('mark-all-read');
        if (markAllBtn) {
            markAllBtn.disabled = this.unreadCount === 0;
        }
    },

    renderList() {
        if (!this.listElement) return;

        if (this.notifications.length === 0) {
            this.listElement.innerHTML = `
                <div class="notif-empty">
                    <span class="notif-empty-mark" aria-hidden="true">${this.markSvg('info')}</span>
                    <p class="notif-empty-text">Belum ada notifikasi</p>
                    <p class="notif-empty-hint">Pasien baru, rekomendasi menu, dan kesiapan dapur akan muncul di sini.</p>
                </div>
            `;
            return;
        }

        this.listElement.innerHTML = this.notifications.map(notif => {
            const unread = !notif.read;
            const hasDetail = notif.detail && typeof notif.detail === 'object';
            return `
                <button type="button"
                        class="notif-item${unread ? ' is-unread' : ''}"
                        data-notif-id="${this.escapeHtml(notif.id)}">
                    <span class="notif-mark is-${this.escapeHtml(notif.type || 'info')}" aria-hidden="true">${this.markSvg(notif.type)}</span>
                    <span class="notif-item-body">
                        <span class="notif-item-title">${this.escapeHtml(notif.title)}</span>
                        <span class="notif-item-text">${this.escapeHtml(notif.body)}</span>
                        <span class="notif-item-meta">
                            <span class="notif-item-time">${this.getTimeAgo(notif.created_at)}</span>
                            ${hasDetail ? '<span class="notif-item-tag">Ada rincian</span>' : ''}
                        </span>
                    </span>
                    <span class="notif-item-cue" aria-hidden="true">${this.chevronSvg()}</span>
                </button>
            `;
        }).join('');
    },

    markSvg(type) {
        const paths = {
            info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path>',
            success: '<circle cx="12" cy="12" r="9"></circle><path d="M8.5 12.5l2.5 2.5 4.5-5"></path>',
            warning: '<path d="M12 4.5l8 14H4l8-14z"></path><path d="M12 10v4"></path><path d="M12 16.5h.01"></path>',
            error: '<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5l5 5"></path><path d="M14.5 9.5l-5 5"></path>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[type] || paths.info}</svg>`;
    },

    chevronSvg() {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>';
    },

    typeLabel(type) {
        const labels = { info: 'Informasi', success: 'Selesai', warning: 'Perlu perhatian', error: 'Gagal' };
        return labels[type] || labels.info;
    },

    kindLabel(kind) {
        const labels = {
            pasien: 'Data pasien',
            rekomendasi: 'Rekomendasi menu',
            distribusi: 'Distribusi makan',
            dapur: 'Kesiapan dapur',
            umum: 'Rincian notifikasi'
        };
        return labels[kind] || labels.umum;
    },

    getTimeAgo(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '';
        const diffMs = Date.now() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Baru saja';
        if (diffMins < 60) return `${diffMins} menit yang lalu`;
        if (diffHours < 24) return `${diffHours} jam yang lalu`;
        if (diffDays < 7) return `${diffDays} hari yang lalu`;

        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    },

    fullTime(dateString) {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '';
        const text = date.toLocaleString('id-ID', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        return text + ' WIB';
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text === null || text === undefined ? '' : String(text);
        return div.innerHTML;
    },

    toggle() {
        if (this.dropdown.classList.contains('show')) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        this.dropdown.classList.add('show');
        this.bellButton.setAttribute('aria-expanded', 'true');
        this.load();
    },

    close() {
        this.dropdown.classList.remove('show');
        this.bellButton.setAttribute('aria-expanded', 'false');
    },

    // Popup rincian: dibuat sekali, dipakai ulang untuk semua notifikasi.
    ensureDetailDialog() {
        let dialog = document.getElementById('notif-detail');
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'notif-detail';
            dialog.className = 'notif-dialog';
            dialog.setAttribute('aria-labelledby', 'notif-detail-title');
            dialog.innerHTML = `
                <div class="notif-dialog-inner">
                    <header class="notif-dialog-head">
                        <span class="notif-mark is-info" id="notif-detail-mark" aria-hidden="true"></span>
                        <div class="notif-dialog-titles">
                            <p class="notif-dialog-kicker" id="notif-detail-kicker">Notifikasi</p>
                            <h2 class="notif-dialog-title" id="notif-detail-title"></h2>
                            <p class="notif-dialog-time" id="notif-detail-time"></p>
                        </div>
                        <form method="dialog">
                            <button type="submit" class="notif-dialog-close" aria-label="Tutup rincian"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg></button>
                        </form>
                    </header>
                    <div class="notif-dialog-body" id="notif-detail-body"></div>
                    <footer class="notif-dialog-foot" id="notif-detail-foot"></footer>
                </div>
            `;
            document.body.appendChild(dialog);

            // Jaring pengaman: bila ada mesin yang tetap memakai kelas body lama.
            dialog.addEventListener('close', () => {
                document.body.classList.remove('notif-dialog-open');
            });
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) dialog.close();
            });
        }
        this.detailElement = dialog;
        return dialog;
    },

    openDetailById(id) {
        const notif = this.notifications.find(n => String(n.id) === String(id));
        if (!notif) return;

        if (!notif.read) this.markAsRead(notif.id);
        this.renderDetail(notif);

        const dialog = this.detailElement || this.ensureDetailDialog();
        if (typeof dialog.showModal === 'function') {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
        document.body.classList.remove('notif-dialog-open');
    },

    renderDetail(notif) {
        const dialog = this.detailElement || this.ensureDetailDialog();
        const detail = notif.detail && typeof notif.detail === 'object' ? notif.detail : null;
        const type = notif.type || 'info';

        const mark = dialog.querySelector('#notif-detail-mark');
        mark.className = 'notif-mark is-' + type;
        mark.innerHTML = this.markSvg(type);

        dialog.querySelector('#notif-detail-kicker').textContent = detail
            ? this.kindLabel(detail.kind) + ' · ' + this.typeLabel(type)
            : this.typeLabel(type);
        dialog.querySelector('#notif-detail-title').textContent = notif.title || 'Notifikasi';
        dialog.querySelector('#notif-detail-time').textContent = this.fullTime(notif.created_at) || this.getTimeAgo(notif.created_at);

        const body = dialog.querySelector('#notif-detail-body');
        const parts = [];

        const ringkas = detail && detail.ringkas ? detail.ringkas : notif.body;
        if (ringkas) parts.push(`<p class="notif-dialog-ringkas">${this.escapeHtml(ringkas)}</p>`);

        const fields = detail && Array.isArray(detail.fields) ? detail.fields : [];
        if (fields.length) {
            parts.push(`<dl class="notif-fields">${fields.map(field => `
                <div class="notif-field">
                    <dt>${this.escapeHtml(field.label)}</dt>
                    <dd>${this.escapeHtml(field.value)}</dd>
                </div>
            `).join('')}</dl>`);
        }

        const items = detail && Array.isArray(detail.items) ? detail.items : [];
        if (items.length) {
            const label = detail.kind === 'dapur' ? 'Menu siap diantar' : 'Rincian';
            parts.push(`<div class="notif-items">
                <p class="notif-items-label">${label}</p>
                <ul class="notif-items-list">${items.map(item => `
                    <li class="notif-item-row">
                        <span class="notif-item-row-title">${this.escapeHtml(item.judul)}</span>
                        ${item.meta ? `<span class="notif-item-row-meta">${this.escapeHtml(item.meta)}</span>` : ''}
                        ${item.nilai ? `<span class="notif-item-row-value">${this.escapeHtml(item.nilai)}</span>` : ''}
                    </li>
                `).join('')}</ul>
            </div>`);
        }

        if (!detail) {
            parts.push('<p class="notif-dialog-note">Notifikasi ini dikirim sebelum rincian tersedia, jadi hanya pesan singkat yang bisa ditampilkan.</p>');
        }

        body.innerHTML = parts.join('');

        const foot = dialog.querySelector('#notif-detail-foot');
        const action = this.actionFor(notif, detail);
        foot.innerHTML = `
            <div class="notif-dialog-actions">
                ${action ? `<a class="notif-dialog-link" href="${this.escapeHtml(action.href)}" data-notif-action>
                    <span>${this.escapeHtml(action.label)}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"></path><path d="M12.5 5.5L19 12l-6.5 6.5"></path></svg>
                </a>` : '<span class="notif-dialog-hint">Rincian ini tidak menaut ke halaman lain.</span>'}
            </div>
            <form method="dialog"><button type="submit" class="notif-dialog-done">Tutup</button></form>
        `;

        // Membuka halaman tujuan berarti notifikasi sudah terbaca.
        const actionLink = foot.querySelector('[data-notif-action]');
        if (actionLink) {
            actionLink.addEventListener('click', () => {
                if (!notif.read) this.markAsRead(notif.id);
                dialog.close();
            });
        }
    },

    // Tombol aksi popup mengikuti tujuan tautan; jenis notifikasi dipakai bila
    // notifikasi lama tidak menyimpan tautan. Notifikasi tanpa rincian memakai
    // label netral supaya tombol tidak menjanjikan isi yang tidak ada.
    actionFor(notif, detail) {
        const link = notif.link && String(notif.link).startsWith('/') ? String(notif.link) : '';
        const kind = detail && detail.kind ? String(detail.kind) : '';
        if (link) return { href: link, label: detail ? this.actionLabel(link, kind) : 'Buka halaman terkait' };

        const anchor = { pasien: '#pasien', rekomendasi: '#rekomendasi', distribusi: '#distribusi', dapur: '#dapur' }[kind];
        if (!anchor) return null;
        const page = location.pathname.indexOf('/pages/') !== -1 ? location.pathname : '/pages/perawat.html';
        return { href: page + anchor, label: this.actionLabel(anchor, kind) };
    },

    actionLabel(target, kind) {
        const label = String(target || '');
        if (label.indexOf('#pasien') !== -1) return 'Buka data pasien';
        if (label.indexOf('#rekomendasi') !== -1) return 'Buka rekomendasi menu';
        if (label.indexOf('#distribusi') !== -1) return 'Buka jadwal distribusi';
        if (label.indexOf('#dapur') !== -1) return 'Buka persiapan dapur';
        if (label.indexOf('#jadwal') !== -1) return 'Buka jadwal makan';
        switch (kind) {
            case 'pasien': return 'Buka data pasien';
            case 'rekomendasi': return 'Buka rekomendasi menu';
            case 'distribusi': return 'Buka jadwal distribusi';
            case 'dapur': return 'Buka persiapan dapur';
            default: return 'Buka halaman terkait';
        }
    },

    // Kompatibilitas: pemanggil lama memakai handleClick(id).
    handleClick(id) {
        this.openDetailById(id);
    },

    async markAsRead(id) {
        const notif = this.notifications.find(n => String(n.id) === String(id));
        if (!notif || notif.read) return;

        const button = this.listElement
            ? Array.from(this.listElement.querySelectorAll('[data-notif-id]'))
                .find(item => item.getAttribute('data-notif-id') === String(id))
            : null;
        const busyState = this.setButtonBusy(button, 'Menyimpan...');
        if (button && !busyState) return;

        try {
            await this.waitForPaint();
            const token = sessionStorage.getItem('nutricare-token');
            if (token) {
                // Tanpa header Content-Type: permintaan ini tidak membawa body, dan
                // server menolak JSON kosong dengan galat 500.
                const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` },
                    credentials: 'same-origin'
                });
                if (response.status !== 404 && !response.ok) throw new Error('HTTP ' + response.status);
            }

            notif.read = true;
            notif.read_at = notif.read_at || new Date().toISOString();
            this.restoreButton(button, busyState);
            this.updateUI();
            this.notifySuccess('Notifikasi ditandai sudah dibaca');
        } catch (error) {
            console.error('[NotificationCenter] Mark as read error:', error);
            this.notifyFailure('Gagal menandai notifikasi sudah dibaca.');
        } finally {
            this.restoreButton(button, busyState);
            this.updateUI();
        }
    },

    async markAllAsRead() {
        const unread = this.notifications.filter(n => !n.read);
        if (!unread.length) return;

        const button = document.getElementById('mark-all-read');
        const busyState = this.setButtonBusy(button, 'Menyimpan...');
        if (!busyState) return;
        const token = sessionStorage.getItem('nutricare-token');

        try {
            await this.waitForPaint();
            if (token) {
                // Tanpa Content-Type: tanpa body, server menolak JSON kosong.
                const response = await fetch('/api/notifications/read-all', {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` },
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
            }

            const now = new Date().toISOString();
            unread.forEach(notif => {
                notif.read = true;
                notif.read_at = notif.read_at || now;
            });
            this.restoreButton(button, busyState);
            this.updateUI();
            this.notifySuccess('Semua notifikasi ditandai sudah dibaca');
        } catch (error) {
            console.error('[NotificationCenter] Mark all as read error:', error);
            this.notifyFailure('Gagal menandai semua notifikasi. Coba lagi.');
        } finally {
            this.restoreButton(button, busyState);
            this.updateUI();
        }
    },

    notifySuccess(message) {
        if (window.NutriCareUI) NutriCareUI.success(message);
    },

    notifyFailure(message) {
        if (window.NutriCareUI) NutriCareUI.error(message);
        else console.warn('[NotificationCenter]', message);
    },

    async clearAll() {
        const confirmed = window.NutriCareUI
            ? await NutriCareUI.confirm('Hapus semua notifikasi?', 'Semua notifikasi akan dihapus permanen.')
            : confirm('Hapus semua notifikasi?');

        if (!confirmed) return;

        const button = document.getElementById('clear-all-notifications');
        const busyState = this.setButtonBusy(button, 'Menghapus...');
        if (!busyState) return;

        try {
            await this.waitForPaint();
            const token = sessionStorage.getItem('nutricare-token');
            if (token) {
                const response = await fetch('/api/notifications', {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                    credentials: 'same-origin'
                });
                if (!response.ok) throw new Error('HTTP ' + response.status);
            }

            this.notifications = [];
            this.restoreButton(button, busyState);
            this.updateUI();
            this.notifySuccess('Semua notifikasi berhasil dihapus');
        } catch (error) {
            console.error('[NotificationCenter] Clear all error:', error);
            this.notifyFailure('Notifikasi gagal dihapus. Coba lagi.');
        } finally {
            this.restoreButton(button, busyState);
            this.updateUI();
        }
    },

    addNotification(notification) {
        this.notifications.unshift(notification);
        this.updateUI();

        if (window.NutriCareUI) {
            NutriCareUI.info(notification.body, notification.title);
        }
    }
};

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => NotificationCenter.init());
} else {
    NotificationCenter.init();
}
