/**
 * University API Access Management System - Settings Controller
 * Handles key validation, session state management, and account identity display
 */

$(document).ready(function () {
  // Check if an existing session key is saved
  checkCurrentKeyStatus();

  // Form submit
  $('#keyValidationForm').on('submit', handleKeyValidationSubmit);

  // Disconnect button
  $('#btnDisconnectKey').on('click', handleDisconnect);

  // Toggle password visibility
  $('#toggleKeyVisibilityBtn').on('click', function () {
    const input = $('#inputApiKey');
    const type = input.attr('type') === 'password' ? 'text' : 'password';
    input.attr('type', type);
    $(this).find('i').toggleClass('bi-eye bi-eye-slash');
  });
});

/**
 * Quick Preset autofill helper
 */
window.presetKey = function (key) {
  $('#inputApiKey').val(key);
  $('#keyValidationForm').trigger('submit');
};

/**
 * Check if a key is already connected in sessionStorage
 */
function checkCurrentKeyStatus() {
  const currentKey = ApiClient.getKey();
  if (currentKey) {
    $('#inputApiKey').val(currentKey);
    validateAndDisplayKey(currentKey, false);
  } else {
    showDisconnectedState();
  }
}

/**
 * Handle form submit
 */
function handleKeyValidationSubmit(e) {
  e.preventDefault();
  const rawKey = $('#inputApiKey').val().trim();

  if (!rawKey) {
    ApiClient.showToast('Please enter an API key', 'warning');
    return;
  }

  validateAndDisplayKey(rawKey, true);
}

/**
 * Validate key with backend AJAX POST /api/settings/validate-key
 */
function validateAndDisplayKey(rawKey, showSuccessToast) {
  const btn = $('#btnValidateKey');
  btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Validating...');

  ApiClient.post('/api/settings/validate-key', { apiKey: rawKey }).done(function (res) {
    if (res.valid) {
      // Save in session
      ApiClient.setSession(rawKey, res.ownerType, res.owner);

      showConnectedState(res);

      if (showSuccessToast) {
        ApiClient.showToast(`Connected successfully as ${res.ownerType.toUpperCase()}!`, 'success', 'Key Validated');
      }
    }
  }).fail(function (xhr) {
    showDisconnectedState();
  }).always(function () {
    btn.prop('disabled', false).html('<i class="bi bi-check-circle me-1"></i> Validate & Connect');
  });
}

/**
 * Render Connected UI State
 */
function showConnectedState(data) {
  $('#connectionStatusBadge')
    .removeClass('bg-secondary-subtle text-secondary bg-danger-subtle text-danger')
    .addClass('bg-success-subtle text-success')
    .html('<i class="bi bi-check-circle-fill me-1"></i> Connected & Active');

  $('#connectedDetailsSection').removeClass('d-none');

  // Account Name & Number
  const owner = data.owner || {};
  const name = owner.full_name || 'System User';
  const idNum = owner.student_number || owner.teacher_number || (data.ownerType === 'admin' ? 'ADMIN-ROOT' : 'ID: ' + data.ownerId);

  $('#dispAccountName').text(name);
  $('#dispAccountIdentifier').text(idNum);

  // Role Badge
  let roleBadge = '';
  let targetPortalUrl = '/';

  if (data.ownerType === 'admin') {
    roleBadge = '<span class="badge-status admin"><i class="bi bi-shield-fill"></i> System Administrator</span>';
    targetPortalUrl = '/admin';
  } else if (data.ownerType === 'teacher') {
    roleBadge = '<span class="badge-status teacher"><i class="bi bi-person-workspace"></i> Faculty Teacher</span>';
    targetPortalUrl = '/teacher/dashboard';
  } else if (data.ownerType === 'student') {
    roleBadge = '<span class="badge-status student"><i class="bi bi-mortarboard-fill"></i> Enrolled Student</span>';
    targetPortalUrl = '/student/dashboard';
  }

  $('#dispAccountRole').html(roleBadge);
  $('#dispAccountDept').text(owner.department ? `${owner.department} ${owner.semester ? '• Semester ' + owner.semester : ''}` : 'University System');

  // Quota
  const limit = data.requestLimit || 100;
  const count = data.requestCount || 0;
  const remaining = Math.max(0, limit - count);
  const percentage = Math.min(100, Math.round((count / limit) * 100));

  $('#dispQuotaText').text(`${count} / ${limit} Requests Used`);
  $('#dispQuotaProgress').css('width', `${percentage}%`).removeClass('bg-primary bg-warning bg-danger')
    .addClass(percentage >= 90 ? 'bg-danger' : percentage >= 70 ? 'bg-warning' : 'bg-primary');
  
  $('#dispKeyPrefix').text(`Key Prefix: ${data.keyPrefix}`);
  $('#dispRemainingQuota').text(`Remaining: ${remaining} calls`);

  // Target Portal Link
  $('#btnGoToRolePortal').attr('href', targetPortalUrl).html(
    `<i class="bi bi-box-arrow-up-right me-1"></i> Open ${data.ownerType.charAt(0).toUpperCase() + data.ownerType.slice(1)} Dashboard`
  );
}

/**
 * Render Disconnected UI State
 */
function showDisconnectedState() {
  $('#connectionStatusBadge')
    .removeClass('bg-success-subtle text-success')
    .addClass('bg-secondary-subtle text-secondary')
    .html('<i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i> Disconnected');

  $('#connectedDetailsSection').addClass('d-none');
}

/**
 * Handle Disconnect
 */
function handleDisconnect() {
  ApiClient.clearSession();
  $('#inputApiKey').val('');
  showDisconnectedState();
  ApiClient.showToast('API key disconnected from session.', 'info');
}
