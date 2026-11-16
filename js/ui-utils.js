// ============================================
// NUTRICARE UI UTILITIES
// Loading & Notification System
// ============================================

const NutriCareUI = {
  // ==========================================
  // LOADING INDICATORS
  // ==========================================

  /**
   * Show full-screen loading overlay
   * @param {string} message - Optional loading message
   */
  showLoading(message = 'Memuat...') {
    let overlay = document.getElementById('nc-loading-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nc-loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">${message}</div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-text').textContent = message;
    }
    
    // Force reflow for animation
    overlay.offsetHeight;
    overlay.classList.add('active');
  },

  /**
   * Hide full-screen loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('nc-loading-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  },

  /**
   * Show button loading state
   * @param {HTMLElement} button - Button element
   */
  buttonLoading(button) {
    if (button) {
      button.disabled = true;
      button.classList.add('btn-loading');
      
      // Save original HTML (to preserve inner elements like <span>)
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      
      // Set loading text
      const loadingText = button.dataset.loadingText || 'Memproses...';
      button.innerHTML = loadingText;
    }
  },

  /**
   * Hide button loading state
   * @param {HTMLElement} button - Button element
   */
  buttonReady(button) {
    if (button) {
      button.disabled = false;
      button.classList.remove('btn-loading');
      
      // Restore original HTML
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  },

  /**
   * Show progress bar
   * @param {number} percent - Progress percentage (0-100)
   */
  showProgress(percent = 0) {
    let bar = document.getElementById('nc-progress-bar');
    
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'nc-progress-bar';
      bar.className = 'progress-bar';
      bar.innerHTML = '<div class="progress-bar-fill"></div>';
      document.body.appendChild(bar);
    }
    
    const fill = bar.querySelector('.progress-bar-fill');
    bar.classList.add('active');
    fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  },

  /**
   * Hide progress bar
   */
  hideProgress() {
    const bar = document.getElementById('nc-progress-bar');
    if (bar) {
      bar.classList.remove('active');
      setTimeout(() => {
        const fill = bar.querySelector('.progress-bar-fill');
        fill.style.width = '0%';
      }, 200);
    }
  },

  /**
   * Show skeleton loading for element
   * @param {HTMLElement} element - Target element
   */
  showSkeleton(element) {
    if (element) {
      element.classList.add('loading-container', 'is-loading');
    }
  },

  /**
   * Hide skeleton loading
   * @param {HTMLElement} element - Target element
   */
  hideSkeleton(element) {
    if (element) {
      element.classList.remove('loading-container', 'is-loading');
    }
  },

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================

  /**
   * Show toast notification
   * @param {Object} options - Toast options
   */
  toast(options = {}) {
    const {
      type = 'info',
      title = '',
      message = '',
      duration = 5000,
      closeable = true
    } = options;
    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';

    let container = document.getElementById('nc-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nc-toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-relevant', 'additions');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-atomic', 'true');

    const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[safeType];

    const content = document.createElement('div');
    content.className = 'toast-content';
    if (title) {
      const heading = document.createElement('div');
      heading.className = 'toast-title';
      heading.textContent = String(title);
      content.appendChild(heading);
    }
    const body = document.createElement('div');
    body.className = 'toast-message';
    body.textContent = String(message);
    content.appendChild(body);

    toast.append(icon, content);
    let timeoutId;
    if (closeable) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Tutup notifikasi');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => {
        clearTimeout(timeoutId);
        this.dismissToast(toast);
      });
      toast.appendChild(closeBtn);
    }

    container.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add('show'));
    if (duration > 0) timeoutId = setTimeout(() => this.dismissToast(toast), duration);
    return toast;
  },

  /**
   * Dismiss toast
   * @param {HTMLElement} toast - Toast element
   */
  dismissToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  },

  /**
   * Success toast
   */
  success(message, title = 'Berhasil') {
    return this.toast({ type: 'success', title, message });
  },

  /**
   * Error toast
   */
  error(message, title = 'Error') {
    return this.toast({ type: 'error', title, message, duration: 7000 });
  },

  /**
   * Warning toast
   */
  warning(message, title = 'Peringatan') {
    return this.toast({ type: 'warning', title, message });
  },

  /**
   * Info toast
   */
  info(message, title = 'Informasi') {
    return this.toast({ type: 'info', title, message });
  },

  // ==========================================
  // INLINE ALERTS
  // ==========================================

  /**
   * Show inline alert in element
   * @param {HTMLElement} element - Target element
   * @param {Object} options - Alert options
   */
  showAlert(element, options) {
    if (!element) return;

    const { type = 'info', message = '' } = options;
    
    // Remove existing alerts
    const existing = element.querySelector('.alert');
    if (existing) existing.remove();

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `
      <span class="alert-icon">${icons[type]}</span>
      <div class="alert-content">${message}</div>
    `;

    element.insertAdjacentElement('afterbegin', alert);
    return alert;
  },

  /**
   * Remove alert from element
   * @param {HTMLElement} element - Container element
   */
  hideAlert(element) {
    if (!element) return;
    const alert = element.querySelector('.alert');
    if (alert) alert.remove();
  },

  // ==========================================
  // FORM VALIDATION
  // ==========================================

  /**
   * Show field error
   * @param {HTMLElement} input - Input element
   * @param {string} message - Error message
   */
  showFieldError(input, message) {
    if (!input) return;

    // Remove existing error
    this.hideFieldError(input);

    // Add error class
    input.classList.add('error');

    // Create error message
    const error = document.createElement('div');
    error.className = 'field-error';
    error.textContent = message;

    // Insert after input
    input.parentNode.insertBefore(error, input.nextSibling);
  },

  /**
   * Hide field error
   * @param {HTMLElement} input - Input element
   */
  hideFieldError(input) {
    if (!input) return;
    
    input.classList.remove('error');
    const error = input.parentNode.querySelector('.field-error');
    if (error) error.remove();
  },

  /**
   * Validate form and show errors
   * @param {HTMLFormElement} form - Form element
   * @returns {boolean} Is valid
   */
  validateForm(form) {
    if (!form) return false;

    let isValid = true;
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');

    inputs.forEach(input => {
      this.hideFieldError(input);

      if (!input.value.trim()) {
        this.showFieldError(input, 'Field ini wajib diisi');
        isValid = false;
      } else if (input.type === 'email' && !this.isValidEmail(input.value)) {
        this.showFieldError(input, 'Format email tidak valid');
        isValid = false;
      } else if (input.minLength && input.value.length < input.minLength) {
        this.showFieldError(input, `Minimal ${input.minLength} karakter`);
        isValid = false;
      }
    });

    return isValid;
  },

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // ==========================================
  // MODAL ALERT
  // ==========================================

  /**
   * Show modal alert
   * @param {Object} options - Modal options
   */
  async showModal(options) {
    const {
      type = 'info',
      title = '',
      message = '',
      confirmText = 'OK',
      cancelText = 'Batal',
      showCancel = false
    } = options;

    return new Promise((resolve) => {
      // Create modal
      const modal = document.createElement('div');
      modal.className = `modal-alert ${type}`;
      
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };

      modal.innerHTML = `
        <div class="modal-alert-content">
          <div class="modal-alert-icon">${icons[type]}</div>
          <h3 class="modal-alert-title">${title}</h3>
          <p class="modal-alert-message">${message}</p>
          <div class="modal-alert-actions">
            ${showCancel ? `<button class="btn-secondary" data-action="cancel">${cancelText}</button>` : ''}
            <button class="btn-primary" data-action="confirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      setTimeout(() => modal.classList.add('active'), 10);

      // Handle actions
      modal.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'confirm') {
          this.dismissModal(modal);
          resolve(true);
        } else if (e.target.dataset.action === 'cancel') {
          this.dismissModal(modal);
          resolve(false);
        } else if (e.target === modal) {
          this.dismissModal(modal);
          resolve(false);
        }
      });
    });
  },

  /**
   * Dismiss modal
   * @param {HTMLElement} modal - Modal element
   */
  dismissModal(modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 200);
  },

  /**
   * Confirm dialog
   */
  async confirm(title, message) {
    return this.showModal({
      type: 'warning',
      title,
      message,
      showCancel: true,
      confirmText: 'Ya',
      cancelText: 'Tidak'
    });
  }
};

// Make it globally available
window.NutriCareUI = NutriCareUI;
