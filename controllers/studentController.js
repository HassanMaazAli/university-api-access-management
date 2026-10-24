const { pool } = require('../config/db');

/**
 * GET /api/student/profile
 * Get authenticated student's profile
 * Server derives identity SOLELY from validated API key in req.auth
 */
async function getProfile(req, res) {
  try {
    const studentId = req.auth.ownerId;

    if (!studentId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No student record associated with this API key.'
      });
    }

    const [students] = await pool.execute(
      `SELECT id, student_number, full_name, email, department, semester, created_at 
       FROM students 
       WHERE id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Student profile not found in university directory.'
      });
    }

    return res.json({
      success: true,
      student: students[0],
      quota: {
        keyName: req.auth.keyName,
        keyPrefix: req.auth.keyPrefix,
        requestLimit: req.auth.requestLimit,
        requestCount: req.auth.requestCount,
        remaining: req.auth.remaining
      }
    });
  } catch (error) {
    console.error('Student Profile Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch student profile.' });
  }
}

/**
 * GET /api/student/marks
 * Get authenticated student's academic marks
 * Never accepts student_id from client; strictly uses req.auth.ownerId
 */
async function getMarks(req, res) {
  try {
    const studentId = req.auth.ownerId;

    if (!studentId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No student record linked to this API key.'
      });
    }

    // 1. Fetch Student Info
    const [students] = await pool.execute(
      `SELECT id, student_number, full_name, email, department, semester 
       FROM students WHERE id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Student profile not found.'
      });
    }

    // 2. Fetch Marks for THIS student only
    const [marks] = await pool.execute(
      `SELECT 
        m.id, 
        m.subject_name, 
        m.total_marks, 
        m.obtained_marks, 
        m.semester, 
        m.created_at,
        t.full_name AS teacher_name,
        t.department AS teacher_department
       FROM academic_marks m
       JOIN teachers t ON m.teacher_id = t.id
       WHERE m.student_id = ?
       ORDER BY m.semester ASC, m.subject_name ASC`,
      [studentId]
    );

    // Compute Academic Summary
    const totalSubjects = marks.length;
    let totalMaxMarks = 0;
    let totalObtainedMarks = 0;

    marks.forEach(item => {
      totalMaxMarks += Number(item.total_marks);
      totalObtainedMarks += Number(item.obtained_marks);
    });

    const percentage = totalMaxMarks > 0 ? ((totalObtainedMarks / totalMaxMarks) * 100).toFixed(2) : 0;

    // Academic Performance calculation
    let grade = 'N/A';
    if (percentage >= 85) grade = 'A+ (High Distinction)';
    else if (percentage >= 80) grade = 'A (Distinction)';
    else if (percentage >= 70) grade = 'B (Merit)';
    else if (percentage >= 60) grade = 'C (Pass)';
    else if (percentage >= 50) grade = 'D';
    else if (totalSubjects > 0) grade = 'F';

    return res.json({
      success: true,
      student: students[0],
      marks,
      summary: {
        totalSubjects,
        totalMaxMarks,
        totalObtainedMarks: Number(totalObtainedMarks.toFixed(2)),
        percentage: Number(percentage),
        grade
      },
      quota: {
        keyName: req.auth.keyName,
        keyPrefix: req.auth.keyPrefix,
        requestLimit: req.auth.requestLimit,
        requestCount: req.auth.requestCount,
        remaining: req.auth.remaining
      }
    });
  } catch (error) {
    console.error('Student Marks Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve academic marks.' });
  }
}

module.exports = {
  getProfile,
  getMarks
};
