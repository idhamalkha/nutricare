/* Laci navigasi ponsel: satu tombol, satu lapisan gelap, satu jalan keluar.
   Dipakai semua halaman ber-<body class="clinic">; tanpa skrip ini sidebar tetap
   tampil biasa di atas konten, jadi tidak ada menu yang hilang. */
(function () {
    'use strict';

    var MOBILE = window.matchMedia('(max-width: 900px)');
    var body = document.body;

    /* Tanggal hari ini di sidebar. Halaman memang memanggil NC.today(), tetapi
       bila skrip halaman berhenti lebih awal (mis. satu permintaan data ditolak
       server) tanggal ikut hilang. Diisi di sini sebagai jaring pengaman. */
    var longDate;
    try {
        longDate = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
    } catch (error) {
        longDate = new Date().toDateString();
    }
    Array.prototype.forEach.call(document.querySelectorAll('.sidebar-date'), function (node) {
        if (!node.textContent.trim()) node.textContent = longDate;
    });
    var sidebar = document.querySelector('.app > .sidebar') || document.querySelector('.sidebar');
    var topbar = document.querySelector('.topbar');

    if (!sidebar || !topbar) return;

    if (!sidebar.id) sidebar.id = 'app-sidebar';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Buka menu navigasi');
    toggle.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path>' +
        '</svg><span>Menu</span>';
    topbar.insertBefore(toggle, topbar.firstChild);

    var scrim = document.createElement('div');
    scrim.className = 'sidebar-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    body.appendChild(scrim);

    var lastFocus = null;

    function isMobile() {
        return MOBILE.matches;
    }

    function focusables() {
        var nodes = sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        return Array.prototype.filter.call(nodes, function (el) {
            return el.offsetWidth > 0 || el.offsetHeight > 0;
        });
    }

    function isOpen() {
        return body.classList.contains('nav-open');
    }

    function open() {
        if (!isMobile() || isOpen()) return;
        lastFocus = document.activeElement;
        body.classList.add('nav-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Tutup menu navigasi');
        sidebar.removeAttribute('inert');
        var first = focusables()[0];
        if (first) first.focus();
    }

    function close(restoreFocus) {
        if (!isOpen()) return;
        body.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Buka menu navigasi');
        if (isMobile()) sidebar.setAttribute('inert', '');
        if (restoreFocus !== false) {
            var target = (lastFocus && lastFocus !== document.body) ? lastFocus : toggle;
            if (target && typeof target.focus === 'function') target.focus();
        }
    }

    function syncMode() {
        body.classList.add('nav-ready');
        if (isMobile()) {
            if (!isOpen()) sidebar.setAttribute('inert', '');
        } else {
            body.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            sidebar.removeAttribute('inert');
        }
    }

    toggle.addEventListener('click', function () {
        if (isOpen()) close(); else open();
    });

    scrim.addEventListener('click', function () {
        close();
    });

    sidebar.addEventListener('click', function (event) {
        var link = event.target.closest ? event.target.closest('a') : null;
        if (link && isMobile()) close(false);
    });

    document.addEventListener('keydown', function (event) {
        if (!isOpen()) return;
        if (event.key === 'Escape') {
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        var items = focusables();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    if (MOBILE.addEventListener) MOBILE.addEventListener('change', syncMode);
    else if (MOBILE.addListener) MOBILE.addListener(syncMode);

    syncMode();

    /* Saat sidebar terlipat hanya ikon yang tampil, jadi tautan diberi tooltip
       berisi label aslinya. Tooltip dilepas lagi ketika sidebar terbuka. */
    var app = document.querySelector('.app');
    var navLinks = sidebar.querySelectorAll('.nav-link');

    function syncTooltips() {
        if (!app) return;
        var collapsed = app.classList.contains('is-collapsed') && !isMobile();
        Array.prototype.forEach.call(navLinks, function (link) {
            if (collapsed) {
                var label = (link.textContent || '').replace(/\s+/g, ' ').trim();
                if (label && !link.hasAttribute('data-nc-tooltip')) {
                    link.setAttribute('title', label);
                    link.setAttribute('data-nc-tooltip', 'auto');
                }
            } else if (link.getAttribute('data-nc-tooltip') === 'auto') {
                link.removeAttribute('title');
                link.removeAttribute('data-nc-tooltip');
            }
        });
    }

    if (app && window.MutationObserver) {
        new MutationObserver(syncTooltips).observe(app, { attributes: true, attributeFilter: ['class'] });
    }
    MOBILE.addEventListener && MOBILE.addEventListener('change', syncTooltips);
    syncTooltips();
})();
