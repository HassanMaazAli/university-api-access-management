const { pool } = require('../config/db');

/**
 * GET /api/teacher/profile
 * Get authenticated teacher's profile
 */
async function getProfile(req, res) {
  try {
    const teacherId = req.auth.ownerId;

    if (!teacherId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No teacher profile linked to this API key.'
      });
    }

    const [teachers] = await pool.execute(
      `SELECT id, teacher_number, full_name, email, department, created_at 
       FROM teachers WHERE id = ?`,
      [teacherId]
    );

    if (teachers.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Teacher record not found.'
      });
    }

    return res.json({
      success: true,
      teacher: teachers[0],
      quota: {
        keyName: req.auth.keyName,
        keyPrefix: req.auth.keyPrefix,
        requestLimit: req.auth.requestLimit,
        requestCount: req.auth.requestCount,
        remaining: req.auth.remaining
      }
    });
  } catch (error) {
    console.error('Teacher Profile Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch teacher profile.' });
  }
}

/**
 * GET /api/teacher/students
 * View all university students with filtering
 */
async function getAllStudents(req, res) {
  try {
    const { department = '', semester = '', search = '' } = req.query;
    let query = 'SELECT id, student_number, full_name, email, department, semester, created_at FROM students WHERE 1=1';
    const params = [];

    if (department.trim()) {
      query += ' AND department = ?';
      params.push(department.trim());
    }

    if (semester && !isNaN(parseInt(semester, 10))) {
      query += ' AND semester = ?';
      params.push(parseInt(semester, 10));
    }

    if (search.trim()) {
      query += ' AND (full_name LIKE ? OR student_number LIKE ? OR email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY department ASC, semester ASC, student_number ASC';

    const [students] = await pool.execute(query, params);

    return res.json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    console.error('Teacher Students Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch student directory.' });
  }
}

/**
 * GET /api/teacher/marks
 * View academic marks across all students with filters
 */
async function getAllMarks(req, res) {
  try {
    const { student_number = '', department = '', semester = '', subject = '', search = '' } = req.query;

    let query = `
      SELECT 
        m.id, 
        m.student_id, 
        s.student_number, 
        s.full_name AS student_name, 
        s.department AS student_department, 
        s.semester AS student_semester, 
        m.subject_name, 
        m.total_marks, 
        m.obtained_marks, 
        m.semester AS mark_semester,
        t.full_name AS teacher_name,
        t.department AS teacher_department
      FROM academic_marks m
      JOIN students s ON m.student_id = s.id
      JOIN teachers t ON m.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (student_number.trim()) {
      query += ' AND s.student_number = ?';
      params.push(student_number.trim());
    }

    if (department.trim()) {
      query += ' AND s.department = ?';
      params.push(department.trim());
    }

    if (semester && !isNaN(parseInt(semester, 10))) {
      query += ' AND m.semester = ?';
      params.push(parseInt(semester, 10));
    }

    if (subject.trim()) {
      query += ' AND m.subject_name LIKE ?';
      params.push(`%${subject.trim()}%`);
    }

    if (search.trim()) {
      query += ' AND (s.full_name LIKE ? OR s.student_number LIKE ? OR m.subject_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY s.student_number ASC, m.semester ASC, m.subject_name ASC';

    const [marks] = await pool.execute(query, params);

    // Compute overview stats for teacher dashboard cards
    const [[studentStats]] = await pool.execute('SELECT COUNT(DISTINCT id) AS total_students FROM students');
    const [[marksStats]] = await pool.execute('SELECT COUNT(*) AS total_marks_records, COALESCE(AVG(obtained_marks), 0) AS average_score FROM academic_marks');

    return res.json({
      success: true,
      stats: {
        totalStudents: studentStats.total_students,
        totalMarksRecords: marksStats.total_marks_records,
        averageScore: Number(Number(marksStats.average_score).toFixed(2))
      },
      count: marks.length,
      marks
    });
  } catch (error) {
    console.error('Teacher Marks Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve academic marks.' });
  }
}

module.exports = {
  getProfile,
  getAllStudents,
  getAllMarks
};
