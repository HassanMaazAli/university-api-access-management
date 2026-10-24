/**
 * University API Access Management System - Student Dashboard Controller
 * Enforces key-derived identity isolation via jQuery AJAX
 */

let performanceChart = null;

$(document).ready(function () {
  checkStudentAuth();

  // Navigation tab click handler
  $('.sidebar-nav .nav-link[data-tab]').on('click', function (e) {
    e.preventDefault();
    const tab = $(this).data('tab');
    navigateToStudentTab(tab);
  });

  // Logout / Disconnect
  $('#studentLogoutBtn').on('click', function () {
    ApiClient.clearSession();
    window.location.href = '/settings';
  });

  // Fetch Marks & Profile
  loadStudentData();
});

/**
 * Verify student key in session. If not present, default to Zainab Ahmed demo key.
 */
function checkStudentAuth() {
  const currentKey = ApiClient.getKey();
  const currentRole = ApiClient.getRole();

  if (!currentKey || currentRole !== 'student') {
    const demoStudentKey = 'uap_student_zainab_ahmed_2026_demo_key';
    ApiClient.setSession(demoStudentKey, 'student', { full_name: 'Zainab Ahmed', role: 'student' });
  }
}

/**
 * Switch tabs
 */
function navigateToStudentTab(tabName) {
  $('.sidebar-nav .nav-link').removeClass('active');
  $(`.sidebar-nav .nav-link[data-tab="${tabName}"]`).addClass('active');

  $('.tab-pane-content').addClass('d-none');
  if (tabName === 'marks') $('#sectionMarks').removeClass('d-none');
  else if (tabName === 'profile') $('#sectionProfile').removeClass('d-none');
  else if (tabName === 'quota') $('#sectionQuota').removeClass('d-none');

  $('.app-sidebar').removeClass('show');
  $('.sidebar-backdrop').removeClass('show');
}

/**
 * Fetch marks strictly via GET /api/student/marks
 */
function loadStudentData() {
  ApiClient.get('/api/student/marks').done(function (res) {
    if (res.success) {
      renderStudentProfile(res.student, res.quota);
      renderStudentMarks(res.marks);
      renderStudentSummary(res.summary, res.student);
      renderPerformanceChart(res.marks);
      renderQuotaDetails(res.quota);
    }
  }).fail(function (xhr) {
    if (xhr.status === 401 || xhr.status === 403) {
      ApiClient.showToast('Authentication failed or invalid student key. Redirecting to settings...', 'danger');
      setTimeout(() => { window.location.href = '/settings'; }, 2000);
    }
  });
}

function renderStudentProfile(student, quota) {
  $('#topbarHeaderName').text(`Welcome, ${student.full_name}`);
  $('#topbarHeaderSub').text(`Department of ${student.department} • Semester ${student.semester}`);

  $('#sidebarStudentName').text(student.full_name);
  $('#sidebarStudentNumber').text(student.student_number);
  const initials = student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  $('#sidebarAvatar').text(initials);

  // Profile tab fields
  $('#profileFullName').text(student.full_name);
  $('#profileRollNumber').text(student.student_number);
  $('#profileEmail').text(student.email);
  $('#profileDepartment').text(student.department);
  $('#profileSemester').text(`Semester ${student.semester}`);
  $('#profileCreatedAt').text(new Date(student.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }));
}

function renderStudentSummary(summary, student) {
  $('#cardTotalSubjects').text(summary.totalSubjects);
  $('#cardSemesterText').text(`Semester ${student.semester} Enrolled`);

  $('#cardObtainedMarks').text(summary.totalObtainedMarks);
  $('#cardTotalMaxMarks').text(`Out of ${summary.totalMaxMarks} Total Marks`);

  $('#cardPercentage').text(`${summary.percentage}%`);
  $('#cardGradeStanding').text(summary.grade);
}

function renderStudentMarks(marks) {
  const tbody = $('#studentMarksTableBody');
  tbody.empty();

  if (!marks || marks.length === 0) {
    tbody.html('<tr><td colspan="6" class="text-center py-4 text-muted">No academic marks recorded for your profile.</td></tr>');
    return;
  }

  marks.forEach(m => {
    const pct = ((Number(m.obtained_marks) / Number(m.total_marks)) * 100).toFixed(1);
    const badgeClass = pct >= 85 ? 'bg-success-subtle text-success' : pct >= 70 ? 'bg-primary-subtle text-primary' : 'bg-warning-subtle text-warning';

    tbody.append(`
      <tr>
        <td class="fw-semibold text-dark">${escapeHtml(m.subject_name)}</td>
        <td><span class="badge bg-light text-dark border">Semester ${m.semester}</span></td>
        <td>${m.total_marks}</td>
        <td class="fw-bold">${m.obtained_marks}</td>
        <td><span class="badge ${badgeClass} px-2 py-1">${pct}%</span></td>
        <td class="small text-muted">${escapeHtml(m.teacher_name)}</td>
      </tr>
    `);
  });
}

function renderPerformanceChart(marks) {
  const ctx = document.getElementById('studentPerformanceChart');
  if (!ctx || !marks || marks.length === 0) return;

  if (performanceChart) performanceChart.destroy();

  const labels = marks.map(m => m.subject_name.length > 20 ? m.subject_name.slice(0, 18) + '...' : m.subject_name);
  const obtainedData = marks.map(m => Number(m.obtained_marks));
  const maxData = marks.map(m => Number(m.total_marks));

  performanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Obtained Marks',
          data: obtainedData,
          backgroundColor: '#4f46e5',
          borderRadius: 6
        },
        {
          label: 'Total Possible',
          data: maxData,
          backgroundColor: '#e2e8f0',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { font: { family: 'Inter', size: 11 } }
        },
        x: {
          ticks: { font: { family: 'Inter', size: 11 } }
        }
      },
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 } } }
      }
    }
  });
}

function renderQuotaDetails(quota) {
  if (!quota) return;

  $('#bannerKeyPrefix').text(quota.keyPrefix);
  $('#bannerQuotaText').text(`${quota.requestCount} / ${quota.requestLimit}`);
  $('#bannerRemainingText').text(`${quota.remaining} remaining`);

  $('#quotaLimitVal').text(quota.requestLimit);
  $('#quotaConsumedVal').text(quota.requestCount);
  $('#quotaRemainingVal').text(quota.remaining);

  const pct = Math.min(100, Math.round((quota.requestCount / quota.requestLimit) * 100));
  $('#quotaProgressBar').css('width', `${pct}%`).removeClass('bg-primary bg-warning bg-danger')
    .addClass(pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-primary');
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
