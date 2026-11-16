// ============================================
// NUTRICARE API WRAPPER
// Enhanced fetch with loading & error handling
// ============================================

const NutriCareAPI = {
  baseURL: '/api',
  
  /**
   * Get auth token from session
   */
  getToken() {
    return sessionStorage.getItem('nutricare-token');
  },

  /**
   * Enhanced fetch with automatic loading & error handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<any>}
   */
  async fetch(endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      showLoading = true,
      showSuccess = false,
      successMessage = 'Operasi berhasil',
      errorTitle = 'Error',
      ...fetchOptions
    } = options;

    // Build URL
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    // Build headers
    const token = this.getToken();
    // Mode demo (tanpa login): kirim peran halaman agar endpoint tetap melayani.
    const demoRole = window.NutriCareApi && window.NutriCareApi.role;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : (demoRole ? { 'X-NC-Role': demoRole } : {})),
      ...headers
    };

    // Show loading
    if (showLoading) {
      NutriCareUI.showProgress(30);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        ...(body && { body: JSON.stringify(body) }),
        ...fetchOptions
      });

      if (showLoading) {
        NutriCareUI.showProgress(70);
      }

      // Handle 401 Unauthorized
      if (response.status === 401) {
        NutriCareUI.hideProgress();
        
        // 401 selalu berarti sesi tidak sah: tanpa token (belum login / mode
        // produksi) maupun token kedaluwarsa. Keduanya harus kembali ke login,
        // jangan biarkan halaman menampilkan data lama atau data contoh.
        const hasToken = this.getToken();
        sessionStorage.removeItem('nutricare-token');
        sessionStorage.removeItem('nutricare-user');
        if (hasToken) {
          NutriCareUI.error('Sesi Anda telah berakhir. Silakan login kembali.', 'Sesi Berakhir');
          setTimeout(() => { window.location.href = '/index.html'; }, 1200);
        } else {
          window.location.href = '/index.html';
        }

        throw new Error('Unauthorized');
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (showLoading) {
        NutriCareUI.showProgress(100);
        setTimeout(() => NutriCareUI.hideProgress(), 300);
      }

      // Handle error responses
      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Error ${response.status}`;
        throw new Error(errorMessage);
      }

      // Show success message if requested
      if (showSuccess) {
        NutriCareUI.success(successMessage);
      }

      return data;

    } catch (error) {
      if (showLoading) {
        NutriCareUI.hideProgress();
      }

      // Don't show toast for 401 (already handled above)
      if (error.message !== 'Unauthorized') {
        // Network errors
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          NutriCareUI.error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.', 'Koneksi Gagal');
        } else {
          NutriCareUI.error(error.message, errorTitle);
        }
      }

      throw error;
    }
  },

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'GET' });
  },

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'POST', body });
  },

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'PUT', body });
  },

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.fetch(endpoint, { ...options, method: 'DELETE' });
  },

  /**
   * Upload file
   */
  async upload(endpoint, formData, options = {}) {
    const token = this.getToken();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    if (options.showLoading !== false) {
      NutriCareUI.showProgress(30);
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      });

      NutriCareUI.showProgress(100);
      setTimeout(() => NutriCareUI.hideProgress(), 300);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Upload gagal');
      }

      const data = await response.json();
      
      if (options.showSuccess) {
        NutriCareUI.success(options.successMessage || 'Upload berhasil');
      }

      return data;

    } catch (error) {
      NutriCareUI.hideProgress();
      NutriCareUI.error(error.message, 'Upload Gagal');
      throw error;
    }
  }
};

// ============================================
// FORM HELPERS
// ============================================

const NutriCareForm = {
  /**
   * Handle form submission with loading & validation
   * @param {HTMLFormElement} form - Form element
   * @param {Function} onSubmit - Submit handler (async)
   */
  handleSubmit(form, onSubmit) {
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validate form
      if (!NutriCareUI.validateForm(form)) {
        return;
      }

      // Get submit button
      const submitBtn = form.querySelector('[type="submit"]');

      // Show loading
      NutriCareUI.buttonLoading(submitBtn);

      try {
        await onSubmit(new FormData(form));
        
        // Success - reset form
        form.reset();
        
      } catch (error) {
        // Error already handled by NutriCareAPI
        console.error('Form submission error:', error);
      } finally {
        NutriCareUI.buttonReady(submitBtn);
      }
    });
  },

  /**
   * Get form data as JSON object
   * @param {HTMLFormElement} form
   * @returns {Object}
   */
  getData(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      // Handle checkboxes
      if (form.elements[key]?.type === 'checkbox') {
        data[key] = form.elements[key].checked;
      } else {
        data[key] = value;
      }
    }
    
    return data;
  },

  /**
   * Populate form with data
   * @param {HTMLFormElement} form
   * @param {Object} data
   */
  setData(form, data) {
    if (!form || !data) return;

    Object.keys(data).forEach(key => {
      const element = form.elements[key];
      if (!element) return;

      if (element.type === 'checkbox') {
        element.checked = !!data[key];
      } else if (element.type === 'radio') {
        const radio = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
        if (radio) radio.checked = true;
      } else {
        element.value = data[key] || '';
      }
    });
  }
};

// Make globally available
window.NutriCareAPI = NutriCareAPI;
window.NutriCareForm = NutriCareForm;
