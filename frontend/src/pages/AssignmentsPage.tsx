import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { assignmentsApi, type AssignmentInput, type AssignmentUpdate } from '../api/assignments.api';
import { listAllCourses, listTeachingCourses } from '../api/courses.api';
import { submissionsApi } from '../api/submissions.api';
import { studentsApi } from '../api/students.api';
import { reportsApi, savePdf } from '../api/reports.api';
import { EmptyState, ErrorNotice, LoadingState, Modal, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type {
  Assignment,
  AssignmentRosterRow,
  Course,
  StudentAssignmentActivity,
  Submission,
} from '../types/api';

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
  const [roster, setRoster] = useState<AssignmentRosterRow[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatus, setRosterStatus] = useState('all');
  const [studentId, setStudentId] = useState('');
  const [studentSubmissions, setStudentSubmissions] = useState<StudentAssignmentActivity[]>([]);
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [studentActivityLoading, setStudentActivityLoading] = useState(false);
  const [studentSuccess, setStudentSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = user?.role === 'faculty' || user?.role === 'admin';
  const canDelete = user?.role === 'admin';
  const filteredRoster = useMemo(() => {
    const query = rosterSearch.trim().toLocaleLowerCase();
    return roster.filter((row) => {
      const matchesSearch =
        !query ||
        [row.student.name, row.student.email, row.student.enrollmentNumber]
          .some((value) => value.toLocaleLowerCase().includes(query));
      const isLate =
        row.submission !== null &&
        selected !== null &&
        new Date(row.submission.submittedAt) > new Date(selected.dueAt);
      const status = !row.submission
        ? 'not_submitted'
        : row.submission.status === 'graded'
          ? 'graded'
          : isLate
            ? 'late'
            : 'submitted';
      return matchesSearch && (rosterStatus === 'all' || status === rosterStatus);
    });
  }, [roster, rosterSearch, rosterStatus, selected]);

  useEffect(() => {
    if (!token || user?.role !== 'student') return;
    let active = true;
    setStudentActivityLoading(true);
    Promise.all([studentsApi.getMe(token), submissionsApi.myActivity(token)])
      .then(([student, activity]) => {
        if (!active) return;
        setStudentId(student.id);
        setStudentSubmissions(activity);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load your submission history.');
      })
      .finally(() => { if (active) setStudentActivityLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    (user?.role === 'faculty' ? listTeachingCourses(token) : listAllCourses(token))
      .then((result) => {
        if (!active) return;
        setCourses(result);
        if (!courseId && result[0]) setCourseId(result[0].id);
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load courses.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);

  useEffect(() => {
    if (!courseId || searchParams.get('courseId') === courseId) return;
    setSearchParams({ courseId }, { replace: true });
  }, [courseId, searchParams, setSearchParams]);

  useEffect(() => {
    if (!token || !courseId) {
      setAssignments([]);
      setSelected(null);
      setRoster([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    assignmentsApi.listByCourse(courseId, token)
      .then((result) => {
        if (!active) return;
        setAssignments(result);
        setSelected(null);
        setRoster([]);
      })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load assignments.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, token]);

  async function openSubmissions(assignment: Assignment) {
    if (!token || !canManage) return;
    setSelected(assignment);
    setSubmissionsLoading(true);
    setError('');
    try {
      setRoster(await submissionsApi.listRosterByAssignment(assignment.id, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load submissions.');
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function saveStudentSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !studentId || !selected || user?.role !== 'student') return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get('content')).trim();
    if (!studentFile && content.length < 10) {
      setError('Add at least 10 characters of text or attach a valid file.');
      return;
    }
    if (studentFile && studentFile.size > 10 * 1024 * 1024) {
      setError('Submission files cannot exceed 10 MiB.');
      return;
    }

    const existing = studentSubmissions.find(
      (submission) => submission.assignmentId === selected.id,
    );
    setBusy(true);
    setError('');
    setStudentSuccess('');
    try {
      let updated: Submission;
      if (existing) {
        updated = content.length >= 10
          ? await submissionsApi.update(existing.id, content, token)
          : existing;
        if (studentFile) {
          updated = await submissionsApi.uploadFile(existing.id, studentFile, token);
        }
      } else if (studentFile) {
        updated = await submissionsApi.createWithFile(selected.id, studentFile, content, token);
      } else {
        updated = await submissionsApi.create(studentId, selected.id, content, token);
      }
      const assignment = selected;
      const activity: StudentAssignmentActivity = {
        ...updated,
        assignmentTitle: assignment.title,
        courseTitle: courses.find((course) => course.id === assignment.courseId)?.title ?? '',
        dueAt: assignment.dueAt,
        maxMarks: assignment.maxMarks,
      };
      setStudentSubmissions((items) => [
        activity,
        ...items.filter((item) => item.assignmentId !== assignment.id),
      ]);
      if (studentFile) {
        updated = await submissionsApi.uploadFile(updated.id, studentFile, token);
      }
      setStudentSubmissions((items) => {
        const activity: StudentAssignmentActivity = {
          ...updated,
          assignmentTitle: assignment.title,
          courseTitle: courses.find((course) => course.id === assignment.courseId)?.title ?? '',
          dueAt: assignment.dueAt,
          maxMarks: assignment.maxMarks,
        };
        return [
          activity,
          ...items.filter((item) => item.assignmentId !== assignment.id),
        ];
      });
      setStudentFile(null);
      formElement.reset();
      setStudentSuccess('Your submission was saved successfully.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save your submission.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadSubmissionFile(submissionId: string) {
    if (!token) return;
    try {
      const file = await submissionsApi.downloadFile(submissionId, token);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `submission-${submissionId}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download the submission file.');
    }
  }

  async function viewSubmissionFile(submissionId: string) {
    if (!token) return;
    try {
      const file = await submissionsApi.viewFile(submissionId, token);
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to view the submission file.');
    }
  }

  async function openAssignmentFile(assignment: Assignment, download: boolean) {
    if (!token) return;
    try {
      const blob = await assignmentsApi.file(assignment.id, token, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = assignment.file?.originalFileName ?? `assignment-${assignment.id}`;
        anchor.click();
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to open the assignment file.');
    }
  }

  async function downloadAssignmentReport(assignment: Assignment) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      savePdf(
        await reportsApi.assignment(assignment.id, token),
        `assignment-report-${assignment.id}.pdf`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to download the assignment report.');
    } finally {
      setBusy(false);
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
    const file = form.get('file');
    if (file instanceof File && file.size > 10 * 1024 * 1024) {
      setError('Assignment files cannot exceed 10 MiB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let saved: Assignment;
      if (editing) {
        const update: AssignmentUpdate = base;
        saved = await assignmentsApi.update(editing.id, update, token);
      } else {
        const input: AssignmentInput = { ...base, courseId };
        saved = await assignmentsApi.create(input, token);
      }
      if (file instanceof File && file.size > 0) {
        setEditing(saved);
        await assignmentsApi.uploadFile(saved.id, file, token);
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
      {user?.role === 'student' && studentActivityLoading && <LoadingState label="Loading your submission history" />}
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
                    <button className="assignment-select" onClick={() => {
                      if (canManage) void openSubmissions(assignment);
                      else {
                        setError('');
                        setStudentSuccess('');
                        setStudentFile(null);
                        setSelected(assignment);
                      }
                    }}>
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
            <div className="section-heading compact-heading"><div><div className="section-kicker">SUBMISSIONS</div><h2>{selected ? selected.title : 'Review work'}</h2><p>{selected ? 'Review and grade student submissions.' : 'Select an assignment to see submissions.'}</p></div>{canManage && selected && <div className="row-actions"><button className="button button-outline button-small" disabled={busy} onClick={() => void downloadAssignmentReport(selected)}>PDF report</button>{selected.file && <><button className="button button-outline button-small" onClick={() => void openAssignmentFile(selected, false)}>View assignment</button><button className="button button-outline button-small" onClick={() => void openAssignmentFile(selected, true)}>Download assignment</button></>}</div>}</div>
            {!canManage ? (
              selected ? (
                <div className="student-assignment-detail">
                  <p>{selected.description}</p>
                  <p>Due {new Date(selected.dueAt).toLocaleString()} · {selected.maxMarks} marks</p>
                  {(() => {
                    const existing = studentSubmissions.find((item) => item.assignmentId === selected.id);
                    return (
                      <>
                        {selected.file && <div className="row-actions"><button className="button button-outline button-small" onClick={() => void openAssignmentFile(selected, false)}>View assignment</button><button className="button button-outline button-small" onClick={() => void openAssignmentFile(selected, true)}>Download assignment</button></div>}
                        {existing?.status === 'graded' && <div className="grade-result"><CheckCircle2 size={15} /> {existing.marks} / {selected.maxMarks} marks {existing.feedback && <span>· {existing.feedback}</span>}</div>}
                        {existing?.file && <button className="button button-outline button-small" onClick={() => void downloadSubmissionFile(existing.id)}>Download attached file</button>}
                        {studentSuccess && <Notice tone="success">{studentSuccess}</Notice>}
                        {error && <ErrorNotice message={error} />}
                        {existing?.status !== 'graded' && (
                          <form className="form-stack" onSubmit={(event) => void saveStudentSubmission(event)}>
                            <label className="field-label" htmlFor="student-submission-content">Written response (optional with a file)</label>
                            <textarea className="form-input" id="student-submission-content" name="content" rows={5} minLength={10} defaultValue={existing?.content ?? ''} />
                            <label className="field-label" htmlFor="student-submission-file">Attach PDF or image (max 10 MiB)</label>
                            <input className="form-input" id="student-submission-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setStudentFile(event.target.files?.[0] ?? null)} />
                            <button className="button button-primary" type="submit" disabled={busy || !studentId}>{busy ? 'Saving…' : existing ? 'Update submission' : 'Submit assignment'}</button>
                          </form>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="review-placeholder"><div className="detail-card-icon amber"><ClipboardList size={19} /></div><h3>Choose an assignment</h3><p>Select an assignment to submit work or view feedback.</p></div>
              )
            ) : submissionsLoading ? <LoadingState label="Loading submissions" /> : !selected ? (
              <div className="review-placeholder"><div className="detail-card-icon blue"><ClipboardList size={19} /></div><h3>Choose an assignment</h3><p>Its submissions will appear here for grading.</p></div>
            ) : roster.length ? (
            <>
              <div className="roster-filters">
                <label className="sr-only" htmlFor="assignment-roster-search">Search students</label>
                <input
                  className="form-input"
                  id="assignment-roster-search"
                  type="search"
                  placeholder="Search name, email or enrollment"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                />
                <label className="sr-only" htmlFor="assignment-roster-status">Filter by submission status</label>
                <select
                  className="form-input"
                  id="assignment-roster-status"
                  value={rosterStatus}
                  onChange={(event) => setRosterStatus(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="not_submitted">Not submitted</option>
                  <option value="submitted">Submitted</option>
                  <option value="late">Late</option>
                  <option value="graded">Graded</option>
                </select>
              </div>
              {filteredRoster.length ? (
                <div className="submission-list">{filteredRoster.map((row) => <SubmissionCard key={row.student.id} row={row} assignment={selected} token={token ?? ''} onViewFile={(id) => void viewSubmissionFile(id)} onUpdated={(updated) => setRoster((items) => items.map((item) => item.student.id === updated.studentId ? { ...item, submission: updated, status: 'graded' } : item))} onError={setError} />)}</div>
              ) : (
                <EmptyState title="No matching students" description="Change or clear the search and status filters." />
              )}
            </>
            ) : <EmptyState title="No enrolled students" description="Students must be enrolled in the course to appear here." />}
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
            <label className="field-label" htmlFor="assignment-file">Assignment file (PDF or image, max 10 MiB)</label><input className="form-input" id="assignment-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            {editing?.file && <span className="result-count">Current file: {editing.file.originalFileName}</span>}
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create assignment'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SubmissionCard({
  row,
  assignment,
  token,
  onViewFile,
  onUpdated,
  onError,
}: {
  row: AssignmentRosterRow;
  assignment: Assignment;
  token: string;
  onViewFile: (id: string) => void;
  onUpdated: (submission: Submission) => void;
  onError: (message: string) => void;
}) {
  const { submission } = row;
  const [grading, setGrading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function grade(event: FormEvent<HTMLFormElement>) {
    if (!submission) return;
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

  async function downloadFile() {
    if (!submission?.file) return;
    try {
      const file = await submissionsApi.downloadFile(submission.id, token);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `submission-${submission.id}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : 'Unable to download the submission file.');
    }
  }

  return (
    <article className="submission-card">
      <div className="submission-card-head"><div className="student-mini-avatar">{row.student.name.charAt(0).toUpperCase()}</div><div><strong>{row.student.name}</strong><span>{row.student.enrollmentNumber} · {row.student.email}</span>{submission && <span>Submitted {new Date(submission.submittedAt).toLocaleString()}</span>}</div><span className={`status-pill ${row.status === 'graded' ? 'status-green' : row.status === 'not_submitted' ? 'status-neutral' : row.status === 'late' ? 'status-amber' : 'status-blue'}`}>{row.status.replace('_', ' ')}</span></div>
      {submission && <div className="submission-content">{submission.content}</div>}
      {submission?.file && <div className="row-actions"><button className="button button-outline button-small" onClick={() => onViewFile(submission.id)}>View file</button><button className="button button-outline button-small" onClick={() => void downloadFile()}>Download file</button></div>}
      {submission?.status === 'graded' && <div className="grade-result"><CheckCircle2 size={15} /> {submission.marks} / {assignment.maxMarks} marks {submission.feedback && <span>· {submission.feedback}</span>}</div>}
      {submission?.status === 'submitted' && (grading ? (
        <form className="grade-form" onSubmit={(event) => void grade(event)}>
          <label className="field-label" htmlFor={`marks-${submission.id}`}>Marks (max {assignment.maxMarks})</label><input id={`marks-${submission.id}`} name="marks" type="number" min="0" max={assignment.maxMarks} step="any" className="form-input" required />
          <label className="field-label" htmlFor={`feedback-${submission.id}`}>Feedback (optional)</label><textarea id={`feedback-${submission.id}`} name="feedback" maxLength={1000} rows={2} className="form-input" />
          <div className="grade-actions"><button type="button" className="button button-outline button-small" onClick={() => setGrading(false)}>Cancel</button><button className="button button-primary button-small" disabled={busy}>{busy ? 'Saving…' : 'Submit grade'}</button></div>
        </form>
      ) : <button className="button button-outline button-small grade-trigger" onClick={() => setGrading(true)}>Grade submission <ArrowRight size={14} /></button>)}
    </article>
  );
}
