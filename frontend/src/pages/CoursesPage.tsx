import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, BookOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { coursesApi, type CourseInput } from '../api/courses.api';
import { ErrorNotice, EmptyState, LoadingState, Modal } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course, Pagination } from '../types/api';

const blankCourse: CourseInput = { title: '', code: '', credits: 3 };

export function CoursesPage() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pendingCourses, setPendingCourses] = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Course | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<Course | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [success, setSuccess] = useState('');
  const canManage = user?.role === 'faculty' || user?.role === 'admin';
  const canDelete = user?.role === 'admin';

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result =
        user?.role === 'faculty' && token
          ? await coursesApi.teaching(page, search, token)
          : await coursesApi.list(page, search, token ?? undefined);
      setCourses(result.courses);
      setPagination(result.pagination);
      if (user?.role === 'admin' && token) {
        const pending = await coursesApi.pendingApproval(1, '', token);
        setPendingCourses(pending.courses);
      } else {
        setPendingCourses([]);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  }, [page, search, token, user?.role]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const input: CourseInput = {
      title: String(form.get('title')).trim(),
      code: String(form.get('code')).trim().toUpperCase(),
      credits: Number(form.get('credits')),
    };
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (editing) await coursesApi.update(editing.id, input, token);
      else await coursesApi.create(input, token);
      if (!editing && user?.role === 'faculty') {
        setSuccess('Course submitted for administrator approval.');
      }
      setCreating(false);
      setEditing(null);
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this course.');
    } finally {
      setBusy(false);
    }
  }

  async function approveCourse(course: Course) {
    if (!token) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await coursesApi.approve(course.id, token);
      setSuccess(`${course.code} is now approved and available in the catalog.`);
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to approve this course.');
    } finally {
      setBusy(false);
    }
  }

  async function rejectCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !rejecting) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await coursesApi.reject(rejecting.id, rejectionReason, token);
      setSuccess(`${rejecting.code} was returned to faculty with a reason.`);
      setRejecting(null);
      setRejectionReason('');
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reject this course.');
    } finally {
      setBusy(false);
    }
  }

  async function resubmitCourse(course: Course) {
    if (!token) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await coursesApi.resubmit(course.id, token);
      setSuccess(`${course.code} was resubmitted for approval.`);
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to resubmit this course.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse(course: Course) {
    if (!token || !window.confirm(`Delete ${course.title}? Related course content may also be removed.`)) return;
    try {
      await coursesApi.delete(course.id, token);
      await loadCourses();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete this course.');
    }
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><div className="section-kicker">LEARNING CATALOG</div><h2>Courses</h2><p>Browse course offerings and open a course workspace.</p></div>
        {canManage && <button className="button button-primary" onClick={() => { setEditing(null); setCreating(true); }}><Plus size={17} /> Add course</button>}
      </div>
      <section className="content-card">
        {error && <ErrorNotice message={error} />}
        {success && <div className="notice notice-success" role="status">{success}</div>}
        {user?.role === 'admin' && (
          <section className="approval-queue" aria-labelledby="course-approval-heading">
            <div className="section-heading">
              <div><h2 id="course-approval-heading">Course approval queue</h2><p>{pendingCourses.length} courses awaiting review</p></div>
              <button className="button button-outline button-small" onClick={() => void loadCourses()} disabled={loading}>Refresh</button>
            </div>
            {pendingCourses.length ? (
              <div className="data-list">
                {pendingCourses.map((course) => (
                  <article className="data-row" key={course.id}>
                    <div className="row-main"><strong>{course.title}</strong><span>{course.code} · {course.credits} credits</span></div>
                    <span className="status-pill status-amber">Pending review</span>
                    <div className="row-actions">
                      <button className="button button-small button-primary" onClick={() => void approveCourse(course)} disabled={busy}>Approve</button>
                      <button className="button button-small button-outline" onClick={() => { setRejecting(course); setRejectionReason(''); }} disabled={busy}>Reject</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="No courses awaiting review" description="New faculty course submissions will appear here." />}
          </section>
        )}
        <div className="list-toolbar">
          <form className="search-form" onSubmit={submitSearch}>
            <Search size={17} />
            <input aria-label="Search courses" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by course title or code" />
            <button className="button button-small button-outline" type="submit">Search</button>
          </form>
          {pagination && <span className="result-count">{pagination.total} {pagination.total === 1 ? 'course' : 'courses'}</span>}
        </div>
        {loading ? <LoadingState label="Loading courses" /> : courses.length ? (
          <div className="data-list">
            {courses.map((course) => (
              <article className="data-row course-row" key={course.id}>
                <div className="row-icon row-icon-purple"><BookOpen size={20} /></div>
                <div className="row-main"><strong>{course.title}</strong><span>{course.code} <span className="dot-separator">·</span> {course.credits} credits</span></div>
                <div className="row-date">Added {new Date(course.createdAt).toLocaleDateString()}</div>
                <div className="row-actions">
                  <ApprovalBadge status={course.approvalStatus} />
                  {canManage && <button className="icon-button" onClick={() => { setEditing(course); setCreating(true); }} aria-label={`Edit ${course.title}`}><ArrowDownRight size={17} /></button>}
                  {user?.role === 'faculty' && course.approvalStatus === 'rejected' && <button className="button button-small button-outline" onClick={() => void resubmitCourse(course)} disabled={busy}>Resubmit</button>}
                  {canDelete && <button className="icon-button danger-icon" onClick={() => void deleteCourse(course)} aria-label={`Delete ${course.title}`}><Trash2 size={16} /></button>}
                  <Link className="button button-small button-outline" to={`/courses/${course.id}`}>Open <ArrowRight size={14} /></Link>
                </div>
                {course.approvalStatus === 'rejected' && course.rejectionReason && <p className="approval-reason">Review note: {course.rejectionReason}</p>}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title={search ? 'No matching courses' : 'No courses yet'} description={search ? 'Try a different course name or code.' : 'The course catalog is empty right now.'} />
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button className="button button-outline button-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={14} /> Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button className="button button-outline button-small" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight size={14} /></button>
          </div>
        )}
      </section>
      {creating && (
        <Modal title={editing ? 'Edit course' : 'Add a course'} onClose={() => setCreating(false)}>
          <form className="form-stack modal-form" onSubmit={(event) => void saveCourse(event)}>
            <label className="field-label" htmlFor="course-title">Course title</label>
            <input className="form-input" id="course-title" name="title" required minLength={3} maxLength={100} defaultValue={editing?.title ?? blankCourse.title} />
            <label className="field-label" htmlFor="course-code">Course code</label>
            <input className="form-input" id="course-code" name="code" required pattern="[A-Za-z]{2,5}[0-9]{3,4}" title="2–5 letters followed by 3–4 digits" defaultValue={editing?.code ?? ''} placeholder="e.g. CSE204" />
            <label className="field-label" htmlFor="course-credits">Credits</label>
            <select className="form-input" id="course-credits" name="credits" defaultValue={editing?.credits ?? 3}>{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} credits</option>)}</select>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create course'}</button></div>
          </form>
        </Modal>
      )}
      {rejecting && (
        <Modal title={`Review ${rejecting.code}`} onClose={() => setRejecting(null)}>
          <form className="form-stack modal-form" onSubmit={(event) => void rejectCourse(event)}>
            <p>Provide a clear reason so faculty can update and resubmit the course.</p>
            <label className="field-label" htmlFor="course-rejection-reason">Reason</label>
            <textarea className="form-input" id="course-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} required minLength={5} maxLength={1000} rows={4} />
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setRejecting(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Reject course'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ApprovalBadge({ status }: { status: Course['approvalStatus'] }) {
  const tone = status === 'approved' ? 'green' : status === 'pending' ? 'amber' : 'red';
  const label = status === 'approved' ? 'Approved' : status === 'pending' ? 'Pending review' : 'Rejected';
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
