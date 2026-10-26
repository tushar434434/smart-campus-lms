import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Link2, Plus, Search, Trash2, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { listAllCourses } from '../api/courses.api';
import { studentsApi, type StudentInput } from '../api/students.api';
import { EmptyState, ErrorNotice, LoadingState, Modal, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course, Enrollment, Pagination, Student } from '../types/api';

export function StudentsPage() {
  const { token } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError('');
    studentsApi.list(page, search, token)
      .then((result) => {
        if (!active) return;
        setStudents(result.students);
        setPagination(result.pagination);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load student records.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, token]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const student: StudentInput = {
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim(),
      enrollmentNumber: String(form.get('enrollmentNumber')).trim(),
      department: String(form.get('department')).trim(),
      semester: Number(form.get('semester')),
    };
    setBusy(true);
    setError('');
    try {
      await studentsApi.create(student, token);
      setCreating(false);
      setPage(1);
      setSearch('');
      setSearchInput('');
      const result = await studentsApi.list(1, '', token);
      setStudents(result.students);
      setPagination(result.pagination);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create student record.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(student: Student) {
    if (!token || !window.confirm(`Delete the student record for ${student.name}?`)) return;
    try {
      await studentsApi.delete(student.id, token);
      const result = await studentsApi.list(page, search, token);
      setStudents(result.students);
      setPagination(result.pagination);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete student record.');
    }
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><div className="section-kicker">PEOPLE</div><h2>Students</h2><p>Manage campus profiles and course enrollment.</p></div>
        <button className="button button-primary" onClick={() => { setError(''); setCreating(true); }}><Plus size={17} /> Add student</button>
      </div>
      <Notice>Student records and login accounts are separate in the backend. Link a record to a student account to enable personal submission and quiz workflows.</Notice>
      <section className="content-card">
        <div className="list-toolbar">
          <form className="search-form" onSubmit={submitSearch}>
            <Search size={17} /><input aria-label="Search students" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email or enrollment number" />
            <button className="button button-small button-outline" type="submit">Search</button>
          </form>
          {pagination && <span className="result-count">{pagination.total} {pagination.total === 1 ? 'student' : 'students'}</span>}
        </div>
        {error && !creating && <ErrorNotice message={error} />}
        {loading ? <LoadingState label="Loading students" /> : students.length ? (
          <div className="data-list">
            {students.map((student) => (
              <article className="data-row" key={student.id}>
                <div className="row-icon row-icon-blue"><Users size={19} /></div>
                <div className="row-main"><strong>{student.name}</strong><span>{student.email} <span className="dot-separator">·</span> {student.enrollmentNumber}</span></div>
                <span className={`status-pill ${student.userId ? 'status-green' : 'status-neutral'}`}>{student.userId ? 'Account linked' : 'Not linked'}</span>
                <div className="row-actions">
                  <Link className="button button-small button-outline" to={`/students/${student.id}`}>Profile <ArrowRight size={14} /></Link>
                  <button className="icon-button danger-icon" onClick={() => void deleteStudent(student)} aria-label={`Delete ${student.name}`}><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title={search ? 'No matching student records' : 'No student records'} description={search ? 'Try another name, email address or enrollment number.' : 'Create the first student record to get started.'} />}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="button button-outline button-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={14} /> Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="button button-outline button-small" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight size={14} /></button>
          </div>
        )}
      </section>
      {creating && (
        <Modal title="Create student record" onClose={() => setCreating(false)}>
          <form className="form-stack modal-form" onSubmit={(event) => void createStudent(event)}>
            <label className="field-label" htmlFor="student-name">Full name</label><input className="form-input" id="student-name" name="name" required minLength={3} maxLength={100} />
            <label className="field-label" htmlFor="student-email">Email address</label><input className="form-input" id="student-email" name="email" type="email" required />
            <label className="field-label" htmlFor="enrollment-number">Enrollment number</label><input className="form-input" id="enrollment-number" name="enrollmentNumber" required minLength={5} maxLength={30} />
            <label className="field-label" htmlFor="department">Department</label><input className="form-input" id="department" name="department" required minLength={2} maxLength={100} />
            <label className="field-label" htmlFor="semester">Semester</label><select className="form-input" id="semester" name="semester" defaultValue="1">{[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>Semester {value}</option>)}</select>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCreating(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create record'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function StudentDetailPage() {
  const { studentId = '' } = useParams();
  const { token } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [userId, setUserId] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    const [profile, studentEnrollments, catalog] = await Promise.all([
      studentsApi.get(studentId, token),
      studentsApi.enrollments(studentId, token),
      listAllCourses(token),
    ]);
    setStudent(profile);
    setEnrollments(studentEnrollments);
    setCourses(catalog);
  }

  useEffect(() => {
    let active = true;
    if (!token) return;
    setLoading(true);
    setError('');
    Promise.all([
      studentsApi.get(studentId, token),
      studentsApi.enrollments(studentId, token),
      listAllCourses(token),
    ])
      .then(([profile, studentEnrollments, catalog]) => {
        if (!active) return;
        setStudent(profile);
        setEnrollments(studentEnrollments);
        setCourses(catalog);
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load student profile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [studentId, token]);

  async function addEnrollment() {
    if (!token || !courseId) return;
    setBusy(true);
    setError('');
    try {
      await studentsApi.enroll(studentId, courseId, token);
      setCourseId('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to enroll this student.');
    } finally {
      setBusy(false);
    }
  }

  async function removeEnrollment(enrollment: Enrollment) {
    if (!token || !window.confirm('Remove this course enrollment?')) return;
    setBusy(true);
    try {
      await studentsApi.removeEnrollment(enrollment.id, token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to remove enrollment.');
    } finally {
      setBusy(false);
    }
  }

  async function linkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const linked = await studentsApi.linkUser(studentId, userId.trim(), token);
      setStudent(linked);
      setUserId('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to link account.');
    } finally {
      setBusy(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !student) return;
    const form = new FormData(event.currentTarget);
    const input: StudentInput = {
      name: String(form.get('name')).trim(),
      email: String(form.get('email')).trim(),
      enrollmentNumber: String(form.get('enrollmentNumber')).trim(),
      department: String(form.get('department')).trim(),
      semester: Number(form.get('semester')),
    };
    setBusy(true);
    setError('');
    try {
      setStudent(await studentsApi.update(student.id, input, token));
      setEditingProfile(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update student profile.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading student profile" />;
  if (error && !student) return <ErrorNotice message={error} />;
  if (!student) return null;

  const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.courseId));
  const availableCourses = courses.filter((course) => !enrolledIds.has(course.id));

  return (
    <div className="page-stack">
      <Link className="back-link" to="/students"><ArrowLeft size={16} /> Back to students</Link>
      {error && <ErrorNotice message={error} />}
      <section className="student-profile-card content-card">
        <div className="student-profile-avatar">{student.name.charAt(0).toUpperCase()}</div>
        <div className="student-profile-main"><div className="section-kicker">STUDENT PROFILE</div><h2>{student.name}</h2><p>{student.email}</p></div>
        <div className={`status-pill ${student.userId ? 'status-green' : 'status-neutral'}`}>{student.userId ? 'Account linked' : 'Not linked'}</div>
        <button className="button button-outline button-small" onClick={() => { setError(''); setEditingProfile(true); }}>Edit profile</button>
      </section>
      <section className="detail-grid student-details-grid">
        <article className="content-card detail-card"><div className="detail-card-icon violet"><GraduationCap size={18} /></div><div className="section-kicker">ACADEMIC RECORD</div><h3>{student.enrollmentNumber}</h3><p>{student.department} · Semester {student.semester}</p></article>
        <article className="content-card detail-card"><div className="section-kicker">CAMPUS LOGIN</div><h3>{student.userId ? 'Linked account' : 'No account linked'}</h3><p>{student.userId ? `User ID: ${student.userId}` : 'Link the student record to a registered student account.'}</p>
          {!student.userId && <form className="inline-link-form" onSubmit={(event) => void linkAccount(event)}><label className="sr-only" htmlFor="user-id">Student account user ID</label><input id="user-id" className="form-input" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Registered user ID" required /><button className="button button-outline button-small" disabled={busy}><Link2 size={14} /> Link</button></form>}
        </article>
      </section>
      <section className="content-card">
        <div className="section-heading"><div><div className="section-kicker">COURSE ENROLLMENT</div><h2>Enrolled courses</h2><p>Manage this student’s course registrations.</p></div></div>
        <div className="inline-enroll">
          <label className="sr-only" htmlFor="enroll-course">Choose course to enroll</label>
          <select id="enroll-course" className="form-input" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">Select a course</option>
            {availableCourses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
          </select>
          <button className="button button-primary" disabled={!courseId || busy} onClick={() => void addEnrollment()}><Plus size={16} /> Enroll</button>
        </div>
        {enrollments.length ? <div className="data-list">{enrollments.map((enrollment) => {
          const course = courses.find((item) => item.id === enrollment.courseId);
          return <div className="data-row" key={enrollment.id}><div className="row-icon row-icon-purple"><GraduationCap size={18} /></div><div className="row-main"><strong>{course?.title ?? 'Course'}</strong><span>{course?.code ?? enrollment.courseId} <span className="dot-separator">·</span> Enrolled {new Date(enrollment.enrolledAt).toLocaleDateString()}</span></div><button className="icon-button danger-icon" onClick={() => void removeEnrollment(enrollment)} aria-label="Remove course enrollment" disabled={busy}><Trash2 size={16} /></button></div>;
        })}</div> : <div className="inline-empty">No enrollments have been added for this student.</div>}
      </section>
      {editingProfile && (
        <Modal title="Edit student profile" onClose={() => setEditingProfile(false)}>
          <form className="form-stack modal-form" onSubmit={(event) => void updateProfile(event)}>
            <label className="field-label" htmlFor="edit-student-name">Full name</label><input className="form-input" id="edit-student-name" name="name" required minLength={3} maxLength={100} defaultValue={student.name} />
            <label className="field-label" htmlFor="edit-student-email">Email address</label><input className="form-input" id="edit-student-email" name="email" type="email" required defaultValue={student.email} />
            <label className="field-label" htmlFor="edit-enrollment-number">Enrollment number</label><input className="form-input" id="edit-enrollment-number" name="enrollmentNumber" required minLength={5} maxLength={30} defaultValue={student.enrollmentNumber} />
            <label className="field-label" htmlFor="edit-department">Department</label><input className="form-input" id="edit-department" name="department" required minLength={2} maxLength={100} defaultValue={student.department} />
            <label className="field-label" htmlFor="edit-semester">Semester</label><select className="form-input" id="edit-semester" name="semester" defaultValue={student.semester}>{[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>Semester {value}</option>)}</select>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setEditingProfile(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
