/**
 * University API Access Management System - Shared jQuery AJAX Client
 * Manages Session-scoped API Keys, Request Headers, Dynamic Error Toasts, and HTTP Handling
 */

const ApiClient = (function () {
  const STORAGE_KEY = 'uap_session_key';
  const STORAGE_ROLE = 'uap_session_role';
  const STORAGE_USER = 'uap_session_user';

  // Retrieve current active API key
  function getKey() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  // Retrieve stored user profile metadata
  function getUser() {
    try {
      const data = sessionStorage.getItem(STORAGE_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Retrieve stored role
  function getRole() {
    return sessionStorage.getItem(STORAGE_ROLE) || '';
  }

  // Save session credentials
  function setSession(key, role, user) {
    if (key) sessionStorage.setItem(STORAGE_KEY, key.trim());
    if (role) sessionStorage.setItem(STORAGE_ROLE, role);
    if (user) sessionStorage.setItem(STORAGE_USER, JSON.stringify(user));
  }

  // Clear session
  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_ROLE);
    sessionStorage.removeItem(STORAGE_USER);
  }

  /**
   * Reusable jQuery AJAX Wrapper
   * Automatically sets x-api-key header and handles status codes
   */
  function request(options) {
    const key = getKey();
    const headers = options.headers || {};

    if (key) {
      headers['x-api-key'] = key;
    }

    return $.ajax({
      url: options.url,
      method: options.method || 'GET',
      headers: headers,
      contentType: options.contentType !== undefined ? options.contentType : 'application/json; charset=utf-8',
      data: options.data && (options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT') 
        ? JSON.stringify(options.data) 
        : options.data,
      dataType: 'json'
    }).fail(function (xhr) {
      let errorMessage = 'An unexpected network error occurred.';
      let errorTitle = 'Request Failed';

      if (xhr.responseJSON && xhr.responseJSON.message) {
        errorMessage = xhr.responseJSON.message;
      } else if (xhr.statusText) {
        errorMessage = `${xhr.status}: ${xhr.statusText}`;
      }

      switch (xhr.status) {
        case 400:
          errorTitle = 'Invalid Request (400)';
          break;
        case 401:
          errorTitle = 'Authentication Required (401)';
          break;
        case 403:
          errorTitle = 'Access Forbidden (403)';
          break;
        case 404:
          errorTitle = 'Not Found (404)';
          break;
        case 429:
          errorTitle = 'Rate Limit Exceeded (429)';
          break;
        case 500:
          errorTitle = 'Server Error (500)';
          break;
      }

      // If silently handled, skip toast
      if (!options.silentError) {
        showToast(errorMessage, 'danger', errorTitle);
      }
    });
  }

  // Convenience methods
  function get(url, data, silentError = false) {
    return request({ url, method: 'GET', data, silentError });
  }

  function post(url, data, silentError = false) {
    return request({ url, method: 'POST', data, silentError });
  }

  function patch(url, data, silentError = false) {
    return request({ url, method: 'PATCH', data, silentError });
  }

  /**
   * Display modern Bootstrap 5 Toast notification
   * @param {string} message 
   * @param {'success'|'danger'|'warning'|'info'} type 
   * @param {string} title 
   */
  function showToast(message, type = 'info', title = '') {
    let container = document.getElementById('toastPlacementContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastPlacementContainer';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(container);
    }

    const toastId = 'toast_' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' :
                    type === 'danger' ? 'bg-danger text-white' :
                    type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white';

    const icon = type === 'success' ? 'bi-check-circle-fill' :
                 type === 'danger' ? 'bi-exclamation-triangle-fill' :
                 type === 'warning' ? 'bi-exclamation-diamond-fill' : 'bi-info-circle-fill';

    const defaultTitle = type === 'success' ? 'Success' :
                         type === 'danger' ? 'Error' :
                         type === 'warning' ? 'Warning' : 'Notification';

    const html = `
      <div id="${toastId}" class="toast align-items-center shadow-lg border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header ${bgClass}">
          <i class="bi ${icon} me-2"></i>
          <strong class="me-auto">${title || defaultTitle}</strong>
          <small class="text-white-50">Just now</small>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body bg-white text-dark">
          ${message}
        </div>
      </div>
    `;

    $(container).append(html);
    const toastEl = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastEl, { delay: 4500 });
    bsToast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  }

  /**
   * Copy text to clipboard with button feedback
   */
  function copyToClipboard(text, btnElement) {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Copied to clipboard!', 'success');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
      if (btnElement) {
        const originalHtml = $(btnElement).html();
        $(btnElement).html('<i class="bi bi-check2"></i> Copied!').addClass('btn-success').removeClass('btn-outline-primary btn-outline-secondary');
        setTimeout(() => {
          $(btnElement).html(originalHtml).removeClass('btn-success');
        }, 2000);
      }
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      showToast('Failed to copy to clipboard', 'danger');
    });
  }

  return {
    getKey,
    getUser,
    getRole,
    setSession,
    clearSession,
    request,
    get,
    post,
    patch,
    showToast,
    copyToClipboard
  };
})();

// Global mobile sidebar toggle handler
$(document).ready(function () {
  $('#sidebarToggleBtn').on('click', function () {
    $('.app-sidebar').toggleClass('show');
    $('.sidebar-backdrop').toggleClass('show');
  });

  $('.sidebar-backdrop').on('click', function () {
    $('.app-sidebar').removeClass('show');
    $(this).removeClass('show');
  });
});
