/**
 * University API Access Management System - Admin Dashboard Controller
 * Powered by jQuery AJAX
 */

let keysChartInstance = null;
let studentsListCache = [];
let teachersListCache = [];

$(document).ready(function () {
  // Ensure Admin Authentication Key is present in session
  checkAdminAuthentication();

  // Navigation tab click handler
  $('.sidebar-nav .nav-link[data-tab]').on('click', function (e) {
    e.preventDefault();
    const tab = $(this).data('tab');
    navigateToTab(tab);
  });

  // Admin logout / disconnect
  $('#adminLogoutBtn').on('click', function () {
    if (confirm('Disconnect admin session and clear credentials from browser?')) {
      ApiClient.clearSession();
      window.location.href = '/settings';
    }
  });

  // Filters & Search Events
  $('#keySearchInput, #keyRoleFilter, #keyStatusFilter').on('input change', debounce(loadApiKeys, 300));
  $('#btnRefreshKeys').on('click', loadApiKeys);

  $('#logSearchInput, #logStatusFilter, #logMethodFilter').on('input change', debounce(loadAuditLogs, 300));
  $('#btnRefreshLogs').on('click', loadAuditLogs);

  $('#studentDirSearch').on('input', filterStudentsDirectory);
  $('#teacherDirSearch').on('input', filterTeachersDirectory);

  // Generate Key Modal Triggers
  $('#openGenerateKeyBtn, #btnOpenNewKeyModal').on('click', openGenerateKeyModal);
  $('#newKeyOwnerType').on('change', handleOwnerTypeChange);
  $('#generateKeyForm').on('submit', handleKeyGenerationSubmit);
  $('#copyRevealedKeyBtn').on('click', function () {
    const key = $('#revealedKeyText').text();
    ApiClient.copyToClipboard(key, this);
  });

  // Update Limit
  $('#btnSaveLimit').on('click', handleSaveLimit);

  // Revoke Key
  $('#btnConfirmRevoke').on('click', handleConfirmRevoke);

  // Initial Data Loads
  loadDashboardStats();
  loadApiKeys();
  loadAuditLogs();
  loadDirectoryCaches();
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Verify that an admin key is loaded in session
 * If missing, prompt or use default master admin key
 */
function checkAdminAuthentication() {
  const currentKey = ApiClient.getKey();
  const currentRole = ApiClient.getRole();

  if (!currentKey || currentRole !== 'admin') {
    // Check if user came from index or direct navigation: offer automatic admin key sign-in
    const defaultMasterAdminKey = 'uap_admin_secret_99887766554433221100aabbcc';
    ApiClient.setSession(defaultMasterAdminKey, 'admin', { full_name: 'System Administrator', role: 'admin' });
  }

  const user = ApiClient.getUser();
  if (user && user.full_name) {
    $('#sidebarAdminName').text(user.full_name);
  }
}

/**
 * Switch active view tab
 */
function navigateToTab(tabName) {
  $('.sidebar-nav .nav-link').removeClass('active');
  $(`.sidebar-nav .nav-link[data-tab="${tabName}"]`).addClass('active');

  $('.tab-pane-content').addClass('d-none');
  if (tabName === 'overview') $('#sectionOverview').removeClass('d-none');
  else if (tabName === 'keys') $('#sectionKeys').removeClass('d-none');
  else if (tabName === 'logs') $('#sectionLogs').removeClass('d-none');
  else if (tabName === 'directory') $('#sectionDirectory').removeClass('d-none');

  // Close mobile sidebar if open
  $('.app-sidebar').removeClass('show');
  $('.sidebar-backdrop').removeClass('show');
}

/**
 * Load Overview Stats & Recent Activity
 */
function loadDashboardStats() {
  ApiClient.get('/api/admin/stats').done(function (res) {
    if (res.success) {
      $('#statStudents').text(res.stats.totalStudents);
      $('#statTeachers').text(res.stats.totalTeachers);
      $('#statActiveKeys').text(res.stats.activeKeys);
      $('#statRevokedKeys').text(res.stats.revokedKeys);
      $('#statRequests').text(res.stats.totalRequests);
      $('#statLogsCount').text(res.stats.totalLogs);

      renderRecentActivity(res.recentLogs);
      renderKeysChart(res.stats.activeKeys, res.stats.revokedKeys);
    }
  }).fail(function (xhr) {
    console.error('Failed to load admin stats:', xhr);
  });
}

/**
 * Render 5 most recent requests in Overview tab
 */
function renderRecentActivity(logs) {
  const tbody = $('#recentActivityTable');
  tbody.empty();

  if (!logs || logs.length === 0) {
    tbody.html('<tr><td colspan="4" class="text-center py-3 text-muted">No requests recorded yet.</td></tr>');
    return;
  }

  logs.forEach(log => {
    const statusBadge = log.response_status < 300 
      ? `<span class="badge bg-success-subtle text-success">${log.response_status}</span>`
      : log.response_status === 429
      ? `<span class="badge bg-warning-subtle text-warning">429 Limit</span>`
      : `<span class="badge bg-danger-subtle text-danger">${log.response_status}</span>`;

    const methodBadge = `<span class="badge bg-light text-dark border">${log.http_method}</span>`;
    const timeFormatted = new Date(log.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    tbody.append(`
      <tr>
        <td>${methodBadge}</td>
        <td><code class="small text-truncate d-inline-block" style="max-width: 140px;">${escapeHtml(log.endpoint)}</code></td>
        <td>${statusBadge}</td>
        <td class="small text-muted">${timeFormatted}</td>
      </tr>
    `);
  });
}

/**
 * Render Distribution Chart using Chart.js
 */
function renderKeysChart(activeCount, revokedCount) {
  const ctx = document.getElementById('keysDistributionChart');
  if (!ctx) return;

  if (keysChartInstance) {
    keysChartInstance.destroy();
  }

  keysChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Active Keys', 'Revoked Keys'],
      datasets: [{
        data: [activeCount || 1, revokedCount || 0],
        backgroundColor: ['#4f46e5', '#ef4444'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 12 } }
        }
      },
      cutout: '70%'
    }
  });
}

/**
 * Load API Keys table with filters
 */
function loadApiKeys() {
  const search = $('#keySearchInput').val();
  const owner_type = $('#keyRoleFilter').val();
  const status = $('#keyStatusFilter').val();

  ApiClient.get('/api/admin/api-keys', { search, owner_type, status }).done(function (res) {
    const tbody = $('#apiKeysTableBody');
    tbody.empty();

    if (!res.keys || res.keys.length === 0) {
      tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">No API keys found matching filters.</td></tr>');
      return;
    }

    res.keys.forEach(k => {
      const statusBadge = k.status === 'active'
        ? `<span class="badge-status active"><span class="status-dot active"></span> Active</span>`
        : `<span class="badge-status revoked"><span class="status-dot revoked"></span> Revoked</span>`;

      const roleBadge = k.owner_type === 'student'
        ? `<span class="badge-status student"><i class="bi bi-mortarboard"></i> Student</span>`
        : k.owner_type === 'teacher'
        ? `<span class="badge-status teacher"><i class="bi bi-person-workspace"></i> Teacher</span>`
        : `<span class="badge-status admin"><i class="bi bi-shield"></i> Admin</span>`;

      const usagePercentage = Math.min(100, Math.round((k.request_count / k.request_limit) * 100));
      const progressColor = usagePercentage >= 90 ? 'bg-danger' : usagePercentage >= 70 ? 'bg-warning' : 'bg-primary';

      const createdDate = new Date(k.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const lastUsed = k.last_used_at 
        ? new Date(k.last_used_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : '<span class="text-muted small">Never</span>';

      const actions = k.status === 'active'
        ? `
          <div class="d-flex justify-content-end gap-1">
            <button class="btn btn-outline-secondary btn-sm" onclick="openUpdateLimitModal(${k.id}, '${escapeHtml(k.key_prefix)}', ${k.request_limit})" title="Edit Request Limit">
              <i class="bi bi-sliders"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="openRevokeModal(${k.id}, '${escapeHtml(k.key_name)}', '${escapeHtml(k.key_prefix)}')" title="Revoke Key">
              <i class="bi bi-x-octagon"></i>
            </button>
          </div>
        `
        : `<span class="text-muted small">Revoked</span>`;

      tbody.append(`
        <tr>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(k.key_name)}</div>
            <code class="key-code mt-1 d-inline-block">${escapeHtml(k.key_prefix)}</code>
          </td>
          <td>
            <div class="fw-medium">${escapeHtml(k.owner_name || 'System')}</div>
            <div class="text-muted small">${escapeHtml(k.owner_number || k.owner_email || '')}</div>
          </td>
          <td>${roleBadge}</td>
          <td style="min-width: 140px;">
            <div class="d-flex justify-content-between small mb-1">
              <span>${k.request_count} / ${k.request_limit}</span>
              <span class="text-muted">${usagePercentage}%</span>
            </div>
            <div class="progress" style="height: 5px;">
              <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${usagePercentage}%"></div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td class="small text-muted">${createdDate}</td>
          <td class="small text-muted">${lastUsed}</td>
          <td class="text-end">${actions}</td>
        </tr>
      `);
    });
  });
}

/**
 * Load Audit Logs table with filters
 */
function loadAuditLogs() {
  const search = $('#logSearchInput').val();
  const status = $('#logStatusFilter').val();
  const method = $('#logMethodFilter').val();

  ApiClient.get('/api/admin/logs', { search, status, method, limit: 50 }).done(function (res) {
    const tbody = $('#logsTableBody');
    tbody.empty();
    $('#totalLogsBadge').text(`${res.total || 0} Total Requests`);

    if (!res.logs || res.logs.length === 0) {
      tbody.html('<tr><td colspan="6" class="text-center py-4 text-muted">No request audit logs found.</td></tr>');
      return;
    }

    res.logs.forEach(l => {
      const statusBadge = l.response_status < 300 
        ? `<span class="badge bg-success-subtle text-success">${l.response_status} OK</span>`
        : l.response_status === 429
        ? `<span class="badge bg-warning-subtle text-warning">429 Rate Limit</span>`
        : l.response_status === 403
        ? `<span class="badge bg-danger-subtle text-danger">403 Forbidden</span>`
        : l.response_status === 401
        ? `<span class="badge bg-danger-subtle text-danger">401 Unauthorized</span>`
        : `<span class="badge bg-danger-subtle text-danger">${l.response_status}</span>`;

      const methodBadge = `<span class="badge bg-light text-dark border">${l.http_method}</span>`;
      const dateFormatted = new Date(l.requested_at).toLocaleString();

      const keyDisplay = l.key_prefix 
        ? `<code class="key-code">${escapeHtml(l.key_prefix)}</code>`
        : `<span class="text-muted small">None / Missing</span>`;

      const roleBadge = l.owner_type
        ? `<span class="badge-status ${l.owner_type}">${l.owner_type}</span>`
        : `<span class="text-muted small">—</span>`;

      tbody.append(`
        <tr>
          <td class="small text-muted">${dateFormatted}</td>
          <td>${methodBadge}</td>
          <td><code class="small text-dark">${escapeHtml(l.endpoint)}</code></td>
          <td>${statusBadge}</td>
          <td>${keyDisplay}</td>
          <td>${roleBadge}</td>
        </tr>
      `);
    });
  });
}

/**
 * Load Directory Caches for Key Generation Dropdown & Directory Tabs
 */
function loadDirectoryCaches() {
  ApiClient.get('/api/admin/students').done(res => {
    studentsListCache = res.students || [];
    $('#studentCountBadge').text(`${studentsListCache.length} Students`);
    renderStudentsDirectory(studentsListCache);
  });

  ApiClient.get('/api/admin/teachers').done(res => {
    teachersListCache = res.teachers || [];
    $('#teacherCountBadge').text(`${teachersListCache.length} Teachers`);
    renderTeachersDirectory(teachersListCache);
  });
}

function renderStudentsDirectory(students) {
  const tbody = $('#studentsDirTableBody');
  tbody.empty();
  if (students.length === 0) {
    tbody.html('<tr><td colspan="4" class="text-center py-3 text-muted">No students found.</td></tr>');
    return;
  }
  students.forEach(s => {
    tbody.append(`
      <tr>
        <td><code class="key-code">${escapeHtml(s.student_number)}</code></td>
        <td class="fw-semibold">${escapeHtml(s.full_name)}</td>
        <td class="text-muted">${escapeHtml(s.department)}</td>
        <td><span class="badge bg-light text-dark border">Sem ${s.semester}</span></td>
      </tr>
    `);
  });
}

function renderTeachersDirectory(teachers) {
  const tbody = $('#teachersDirTableBody');
  tbody.empty();
  if (teachers.length === 0) {
    tbody.html('<tr><td colspan="4" class="text-center py-3 text-muted">No teachers found.</td></tr>');
    return;
  }
  teachers.forEach(t => {
    tbody.append(`
      <tr>
        <td><code class="key-code">${escapeHtml(t.teacher_number)}</code></td>
        <td class="fw-semibold">${escapeHtml(t.full_name)}</td>
        <td class="text-muted">${escapeHtml(t.department)}</td>
        <td class="small text-muted">${escapeHtml(t.email)}</td>
      </tr>
    `);
  });
}

function filterStudentsDirectory() {
  const q = $('#studentDirSearch').val().toLowerCase();
  const filtered = studentsListCache.filter(s => 
    s.full_name.toLowerCase().includes(q) ||
    s.student_number.toLowerCase().includes(q) ||
    s.department.toLowerCase().includes(q)
  );
  renderStudentsDirectory(filtered);
}

function filterTeachersDirectory() {
  const q = $('#teacherDirSearch').val().toLowerCase();
  const filtered = teachersListCache.filter(t => 
    t.full_name.toLowerCase().includes(q) ||
    t.teacher_number.toLowerCase().includes(q) ||
    t.department.toLowerCase().includes(q)
  );
  renderTeachersDirectory(filtered);
}

/**
 * Open Generate Key Modal & setup dropdown
 */
function openGenerateKeyModal() {
  $('#generateKeyForm')[0].reset();
  $('#newKeyLimit').val(100);
  handleOwnerTypeChange();
  const modal = new bootstrap.Modal(document.getElementById('generateKeyModal'));
  modal.show();
}

function handleOwnerTypeChange() {
  const type = $('#newKeyOwnerType').val();
  const select = $('#newKeyOwnerId');
  select.empty();

  if (type === 'admin') {
    $('#ownerSelectContainer').addClass('d-none');
    select.removeAttr('required');
  } else {
    $('#ownerSelectContainer').removeClass('d-none');
    select.attr('required', 'required');

    if (type === 'student') {
      select.append('<option value="">Choose student...</option>');
      studentsListCache.forEach(s => {
        select.append(`<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.student_number)} - ${escapeHtml(s.department)})</option>`);
      });
    } else if (type === 'teacher') {
      select.append('<option value="">Choose faculty teacher...</option>');
      teachersListCache.forEach(t => {
        select.append(`<option value="${t.id}">${escapeHtml(t.full_name)} (${escapeHtml(t.teacher_number)} - ${escapeHtml(t.department)})</option>`);
      });
    }
  }
}

/**
 * Handle Generate Key Submission
 */
function handleKeyGenerationSubmit(e) {
  e.preventDefault();

  const ownerType = $('#newKeyOwnerType').val();
  const ownerId = $('#newKeyOwnerId').val();
  const keyName = $('#newKeyName').val();
  const requestLimit = parseInt($('#newKeyLimit').val(), 10);

  const payload = {
    ownerType,
    ownerId: ownerId ? parseInt(ownerId, 10) : null,
    keyName,
    requestLimit
  };

  const btn = $('#btnSubmitGenerateKey');
  btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Generating...');

  ApiClient.post('/api/admin/api-keys', payload).done(function (res) {
    bootstrap.Modal.getInstance(document.getElementById('generateKeyModal')).hide();
    
    // Show Reveal Modal
    $('#revealedKeyText').text(res.rawKey);
    const revealModal = new bootstrap.Modal(document.getElementById('keyRevealModal'));
    revealModal.show();

    ApiClient.showToast('Cryptographic API Key generated successfully!', 'success');
    loadApiKeys();
    loadDashboardStats();
  }).always(function () {
    btn.prop('disabled', false).html('<i class="bi bi-plus-circle me-1"></i> Generate Cryptographic Key');
  });
}

/**
 * Open Update Limit Modal
 */
window.openUpdateLimitModal = function (keyId, prefix, currentLimit) {
  $('#editKeyId').val(keyId);
  $('#editKeyPrefix').val(prefix);
  $('#editKeyLimitInput').val(currentLimit);
  const modal = new bootstrap.Modal(document.getElementById('updateLimitModal'));
  modal.show();
};

function handleSaveLimit() {
  const keyId = $('#editKeyId').val();
  const newLimit = parseInt($('#editKeyLimitInput').val(), 10);

  if (isNaN(newLimit) || newLimit <= 0) {
    ApiClient.showToast('Please enter a valid positive integer limit', 'warning');
    return;
  }

  ApiClient.patch(`/api/admin/api-keys/${keyId}/limit`, { requestLimit: newLimit }).done(function (res) {
    bootstrap.Modal.getInstance(document.getElementById('updateLimitModal')).hide();
    ApiClient.showToast(`Request limit successfully updated to ${newLimit}!`, 'success');
    loadApiKeys();
  });
}

/**
 * Open Revoke Modal
 */
window.openRevokeModal = function (keyId, keyName, prefix) {
  $('#revokeKeyId').val(keyId);
  $('#revokeKeyName').text(keyName);
  $('#revokeKeyPrefix').text(prefix);
  const modal = new bootstrap.Modal(document.getElementById('revokeConfirmModal'));
  modal.show();
};

function handleConfirmRevoke() {
  const keyId = $('#revokeKeyId').val();

  ApiClient.patch(`/api/admin/api-keys/${keyId}/revoke`, {}).done(function (res) {
    bootstrap.Modal.getInstance(document.getElementById('revokeConfirmModal')).hide();
    ApiClient.showToast('API Key revoked successfully. Subsequent requests will return 403 Forbidden.', 'danger');
    loadApiKeys();
    loadDashboardStats();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
