/**
 * University API Access Management System - Teacher Dashboard Controller
 * Powered by jQuery AJAX
 */

$(document).ready(function () {
  checkTeacherAuth();

  // Navigation tab click handler
  $('.sidebar-nav .nav-link[data-tab]').on('click', function (e) {
    e.preventDefault();
    const tab = $(this).data('tab');
    navigateToTeacherTab(tab);
  });

  // Logout / Disconnect
  $('#teacherLogoutBtn').on('click', function () {
    ApiClient.clearSession();
    window.location.href = '/settings';
  });

  // Filters
  $('#teacherMarksSearch, #marksDeptFilter, #marksSemesterFilter').on('input change', debounce(loadTeacherMarks, 300));
  $('#btnRefreshTeacherMarks').on('click', loadTeacherMarks);

  $('#tStudentSearch, #tStudentDeptFilter').on('input change', debounce(loadTeacherStudents, 300));

  // Initial Loads
  loadTeacherProfile();
  loadTeacherMarks();
  loadTeacherStudents();
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Check teacher auth key in session
 */
function checkTeacherAuth() {
  const currentKey = ApiClient.getKey();
  const currentRole = ApiClient.getRole();

  if (!currentKey || currentRole !== 'teacher') {
    const demoTeacherKey = 'uap_teacher_alan_turing_sec_2026_demo_key';
    ApiClient.setSession(demoTeacherKey, 'teacher', { full_name: 'Dr. Alan Turing', role: 'teacher' });
  }
}

/**
 * Switch tabs
 */
function navigateToTeacherTab(tabName) {
  $('.sidebar-nav .nav-link').removeClass('active');
  $(`.sidebar-nav .nav-link[data-tab="${tabName}"]`).addClass('active');

  $('.tab-pane-content').addClass('d-none');
  if (tabName === 'marks') $('#sectionAllMarks').removeClass('d-none');
  else if (tabName === 'students') $('#sectionStudents').removeClass('d-none');
  else if (tabName === 'profile') $('#sectionProfile').removeClass('d-none');

  $('.app-sidebar').removeClass('show');
  $('.sidebar-backdrop').removeClass('show');
}

/**
 * Load Teacher Profile
 */
function loadTeacherProfile() {
  ApiClient.get('/api/teacher/profile').done(function (res) {
    if (res.success) {
      const t = res.teacher;
      $('#topbarTeacherName').text(`Welcome, ${t.full_name}`);
      $('#topbarTeacherDept').text(`Faculty of ${t.department} • University Examiner`);

      $('#sidebarTeacherName').text(t.full_name);
      $('#sidebarTeacherNumber').text(t.teacher_number);

      const initials = t.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      $('#sidebarTeacherAvatar').text(initials);

      // Profile Tab
      $('#tProfileName').text(t.full_name);
      $('#tProfileNumber').text(t.teacher_number);
      $('#tProfileDept').text(t.department);
      $('#tProfileEmail').text(t.email);
    }
  }).fail(function (xhr) {
    if (xhr.status === 401 || xhr.status === 403) {
      ApiClient.showToast('Invalid teacher API key or insufficient permissions. Redirecting to settings...', 'danger');
      setTimeout(() => { window.location.href = '/settings'; }, 2000);
    }
  });
}

/**
 * Load all students' marks with filters
 */
function loadTeacherMarks() {
  const search = $('#teacherMarksSearch').val();
  const department = $('#marksDeptFilter').val();
  const semester = $('#marksSemesterFilter').val();

  ApiClient.get('/api/teacher/marks', { search, department, semester }).done(function (res) {
    const tbody = $('#teacherMarksTableBody');
    tbody.empty();

    if (res.stats) {
      $('#tStatStudents').text(res.stats.totalStudents);
      $('#tStatRecords').text(res.stats.totalMarksRecords);
      $('#tStatAverage').text(`${res.stats.averageScore}%`);
    }

    $('#marksCountBadge').text(`${res.marks.length} Records`);

    if (!res.marks || res.marks.length === 0) {
      tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">No marks records found matching filter criteria.</td></tr>');
      return;
    }

    res.marks.forEach(m => {
      const pct = ((Number(m.obtained_marks) / Number(m.total_marks)) * 100).toFixed(1);
      const badgeClass = pct >= 85 ? 'bg-success-subtle text-success' : pct >= 70 ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning';

      tbody.append(`
        <tr>
          <td><code class="key-code">${escapeHtml(m.student_number)}</code></td>
          <td class="fw-semibold text-dark">${escapeHtml(m.student_name)}</td>
          <td><span class="badge bg-light text-dark border">${escapeHtml(m.student_department)}</span></td>
          <td>${escapeHtml(m.subject_name)}</td>
          <td><span class="badge bg-light text-muted border">Sem ${m.semester}</span></td>
          <td class="fw-bold">${m.obtained_marks} / ${m.total_marks}</td>
          <td><span class="badge ${badgeClass} px-2 py-1">${pct}%</span></td>
          <td class="small text-muted">${escapeHtml(m.teacher_name)}</td>
        </tr>
      `);
    });
  });
}

/**
 * Load all students
 */
function loadTeacherStudents() {
  const search = $('#tStudentSearch').val();
  const department = $('#tStudentDeptFilter').val();

  ApiClient.get('/api/teacher/students', { search, department }).done(function (res) {
    const tbody = $('#tStudentsTableBody');
    tbody.empty();

    if (!res.students || res.students.length === 0) {
      tbody.html('<tr><td colspan="6" class="text-center py-4 text-muted">No students found.</td></tr>');
      return;
    }

    res.students.forEach(s => {
      const dateFormatted = new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

      tbody.append(`
        <tr>
          <td><code class="key-code">${escapeHtml(s.student_number)}</code></td>
          <td class="fw-semibold">${escapeHtml(s.full_name)}</td>
          <td class="small text-muted">${escapeHtml(s.email)}</td>
          <td><span class="badge bg-light text-dark border">${escapeHtml(s.department)}</span></td>
          <td>Semester ${s.semester}</td>
          <td class="small text-muted">${dateFormatted}</td>
        </tr>
      `);
    });
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
