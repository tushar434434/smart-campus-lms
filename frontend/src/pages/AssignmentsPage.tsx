import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { assignmentsApi, type AssignmentInput, type AssignmentUpdate } from '../api/assignments.api';
import { listAllCourses } from '../api/courses.api';
import { submissionsApi } from '../api/submissions.api';
import { EmptyState, ErrorNotice, LoadingState, Modal, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Assignment, Course, Submission } from '../types/api';

function asLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AssignmentsPage() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(searchParams.get('courseId') ?? '');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = user?.role === 'faculty' || user?.role === 'admin';
  const canDelete = user?.role === 'admin';

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    listAllCourses(token)
      .then((result) => {
        if (!active) return;
        setCourses(result);
        if (!courseId && result[0]) setCourseId(result[0].id);
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load courses.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || !courseId) {
      setAssignments([]);
      setSelected(null);
      setSubmissions([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setSearchParams({ courseId }, { replace: true });
    assignmentsApi.listByCourse(courseId, token)
      .then((result) => {
        if (!active) return;
        setAssignments(result);
        setSelected(null);
        setSubmissions([]);
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load assignments.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, token, setSearchParams]);

  async function openSubmissions(assignment: Assignment) {
    if (!token || !canManage) return;
    setSelected(assignment);
    setSubmissionsLoading(true);
    setError('');
    try {
      setSubmissions(await submissionsApi.listByAssignment(assignment.id, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load submissions.');
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !courseId) return;
    const form = new FormData(event.currentTarget);
    const base = {
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim(),
      dueAt: new Date(String(form.get('dueAt'))).toISOString(),
      maxMarks: Number(form.get('maxMarks')),
    };
    setBusy(true);
    setError('');
    try {
      if (editing) {
        const update: AssignmentUpdate = base;
        await assignmentsApi.update(editing.id, update, token);
      } else {
        const input: AssignmentInput = { ...base, courseId };
        await assignmentsApi.create(input, token);
      }
      setCreating(false);
      setEditing(null);
      setAssignments(await assignmentsApi.listByCourse(courseId, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save assignment.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAssignment(assignment: Assignment) {
    if (!token || !window.confirm(`Delete assignment “${assignment.title}”?`)) return;
    setError('');
    try {
      await assignmentsApi.delete(assignment.id, token);
      setAssignments(await assignmentsApi.listByCourse(courseId, token));
      if (selected?.id === assignment.id) setSelected(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete assignment.');
    }
  }

  if (loading && !courses.length) return <LoadingState label="Loading courses" />;

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><div className="section-kicker">COURSE WORK</div><h2>Assignments</h2><p>Review deadlines, course instructions and submissions.</p></div>
        {canManage && courseId && <button className="button button-primary" onClick={() => { setEditing(null); setError(''); setCreating(true); }}><Plus size={17} /> New assignment</button>}
      </div>
      {user?.role === 'student' && <Notice tone="warning">The backend has no student self-profile lookup or enrollment listing. You can view assignments by course, but personal submission actions are unavailable until a linked student record is accessible.</Notice>}
      <div className="course-filter">
        <label htmlFor="assignment-course">Course</label>
        <select className="form-input" id="assignment-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          {courses.length === 0 && <option value="">No courses available</option>}
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
        </select>
      </div>
      {error && !creating && <ErrorNotice message={error} />}
      {loading ? <LoadingState label="Loading assignments" /> : assignments.length ? (
        <div className="assignment-layout">
          <section className="content-card assignment-list-card">
            <div className="section-heading compact-heading"><div><div className="section-kicker">COURSE TASKS</div><h2>{courses.find((course) => course.id === courseId)?.title ?? 'Assignments'}</h2></div></div>
            <div className="data-list">
              {assignments.map((assignment) => {
                const isPastDue = new Date(assignment.dueAt).getTime() < Date.now();
                return (
                  <article className={`assignment-item ${selected?.id === assignment.id ? 'assignment-item-active' : ''}`} key={assignment.id}>
                    <div className="row-icon row-icon-amber"><ClipboardList size={19} /></div>
                    <button className="assignment-select" onClick={() => canManage ? void openSubmissions(assignment) : setSelected(assignment)}>
                      <strong>{assignment.title}</strong><span><CalendarClock size={14} /> Due {new Date(assignment.dueAt).toLocaleString()}</span>
                    </button>
                    <span className={`status-pill ${isPastDue ? 'status-neutral' : 'status-blue'}`}>{isPastDue ? 'Past due' : `${assignment.maxMarks} marks`}</span>
                    {canManage && <button className="icon-button" onClick={() => { setEditing(assignment); setError(''); setCreating(true); }} aria-label={`Edit ${assignment.title}`}><ClipboardList size={16} /></button>}
                    {canDelete && <button className="icon-button danger-icon" onClick={() => void deleteAssignment(assignment)} aria-label={`Delete ${assignment.title}`}><Trash2 size={16} /></button>}
                    {canManage && <button className="button button-small button-outline" onClick={() => void openSubmissions(assignment)}>Review <ArrowRight size={13} /></button>}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="content-card review-card">
            <div className="section-heading compact-heading"><div><div className="section-kicker">SUBMISSIONS</div><h2>{selected ? selected.title : 'Review work'}</h2><p>{selected ? 'Review and grade student submissions.' : 'Select an assignment to see submissions.'}</p></div></div>
            {!canManage ? (
              <div className="review-placeholder"><div className="detail-card-icon amber"><ClipboardList size={19} /></div><h3>Submission details</h3><p>Personal submission lists require the linked student ID, which is not returned to student users through the current API.</p></div>
            ) : submissionsLoading ? <LoadingState label="Loading submissions" /> : !selected ? (
              <div className="review-placeholder"><div className="detail-card-icon blue"><ClipboardList size={19} /></div><h3>Choose an assignment</h3><p>Its submissions will appear here for grading.</p></div>
            ) : submissions.length ? (
              <div className="submission-list">{submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission} assignment={selected} token={token ?? ''} onUpdated={(updated) => setSubmissions((items) => items.map((item) => item.id === updated.id ? updated : item))} onError={setError} />)}</div>
            ) : <EmptyState title="No submissions yet" description="Submitted work will appear here." />}
          </section>
        </div>
      ) : (
        <section className="content-card"><EmptyState title={courses.length ? 'No assignments yet' : 'No courses available'} description={courses.length ? 'There are no assignments for this course.' : 'Courses need to be added before assignments can be created.'} /></section>
      )}
      {creating && (
        <Modal title={editing ? 'Edit assignment' : 'Create assignment'} onClose={() => setCreating(false)}>
          <form className="form-stack modal-form" onSubmit={(event) => void saveAssignment(event)}>
            <label className="field-label" htmlFor="assignment-title">Title</label><input id="assignment-title" name="title" className="form-input" required minLength={3} defaultValue={editing?.title ?? ''} />
            <label className="field-label" htmlFor="assignment-description">Description</label><textarea id="assignment-description" name="description" className="form-input" required minLength={5} rows={4} defaultValue={editing?.description ?? ''} />
            <label className="field-label" htmlFor="assignment-due">Due date and time</label><input id="assignment-due" name="dueAt" className="form-input" type="datetime-local" required defaultValue={editing ? asLocalDateTime(editing.dueAt) : ''} />
            <label className="field-label" htmlFor="assignment-marks">Maximum marks</label><input id="assignment-marks" name="maxMarks" className="form-input" type="number" required min="0.01" step="any" defaultValue={editing?.maxMarks ?? ''} />
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create assignment'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SubmissionCard({
  submission,
  assignment,
  token,
  onUpdated,
  onError,
}: {
  submission: Submission;
  assignment: Assignment;
  token: string;
  onUpdated: (submission: Submission) => void;
  onError: (message: string) => void;
}) {
  const [grading, setGrading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function grade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const marks = Number(form.get('marks'));
    const feedback = String(form.get('feedback')).trim();
    setBusy(true);
    onError('');
    try {
      onUpdated(await submissionsApi.grade(submission.id, marks, feedback, token));
      setGrading(false);
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : 'Unable to grade this submission.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="submission-card">
      <div className="submission-card-head"><div className="student-mini-avatar">{submission.studentId.slice(0, 1).toUpperCase()}</div><div><strong>Student submission</strong><span>Submitted {new Date(submission.submittedAt).toLocaleString()}</span></div><span className={`status-pill ${submission.status === 'graded' ? 'status-green' : 'status-amber'}`}>{submission.status}</span></div>
      <div className="submission-content">{submission.content}</div>
      {submission.status === 'graded' && <div className="grade-result"><CheckCircle2 size={15} /> {submission.marks} / {assignment.maxMarks} marks {submission.feedback && <span>· {submission.feedback}</span>}</div>}
      {submission.status === 'submitted' && (grading ? (
        <form className="grade-form" onSubmit={(event) => void grade(event)}>
          <label className="field-label" htmlFor={`marks-${submission.id}`}>Marks (max {assignment.maxMarks})</label><input id={`marks-${submission.id}`} name="marks" type="number" min="0" max={assignment.maxMarks} step="any" className="form-input" required />
          <label className="field-label" htmlFor={`feedback-${submission.id}`}>Feedback (optional)</label><textarea id={`feedback-${submission.id}`} name="feedback" maxLength={1000} rows={2} className="form-input" />
          <div className="grade-actions"><button type="button" className="button button-outline button-small" onClick={() => setGrading(false)}>Cancel</button><button className="button button-primary button-small" disabled={busy}>{busy ? 'Saving…' : 'Submit grade'}</button></div>
        </form>
      ) : <button className="button button-outline button-small grade-trigger" onClick={() => setGrading(true)}>Grade submission <ArrowRight size={14} /></button>)}
    </article>
  );
}
