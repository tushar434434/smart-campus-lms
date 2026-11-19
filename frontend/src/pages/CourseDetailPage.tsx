import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownToLine, ArrowLeft, BookOpen, CalendarDays, ClipboardList, FileText, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { coursesApi } from '../api/courses.api';
import { courseMaterialsApi, type CourseMaterialInput } from '../api/course-materials.api';
import { enrollmentsApi } from '../api/enrollments.api';
import { EmptyState, ErrorNotice, LoadingState } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course, CourseMaterial, Enrollment } from '../types/api';

const materialTypes: Array<{ value: CourseMaterialInput['type']; label: string }> = [
  { value: 'notes', label: 'Unit notes' },
  { value: 'pyq', label: 'Previous-year paper' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'lecture_slides', label: 'Lecture slides' },
  { value: 'reference', label: 'Reference material' },
];

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const { token, user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (!token) throw new Error('Sign in to open this course.');
        const detail = await coursesApi.get(courseId, token);
        if (!active) return;
        setCourse(detail);
        let currentEnrollment: Enrollment | null = null;
        if (user?.role === 'student') {
          const current = await enrollmentsApi.mine(token);
          currentEnrollment = current.find((item) => item.courseId === courseId) ?? null;
          if (active) setEnrollment(currentEnrollment);
        }
        if (
          detail.approvalStatus === 'approved' &&
          (user?.role !== 'student' || currentEnrollment?.status === 'approved')
        ) {
          const list = await courseMaterialsApi.list(courseId, token);
          if (active) setMaterials(list);
        }
      } catch (caught) {
        if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load this course.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [courseId, token, user?.role]);

  async function requestEnrollment() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const request = await enrollmentsApi.request(courseId, token);
      setEnrollment(request);
      setSuccess('Your enrollment request was sent for review.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to request enrollment.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !course) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a course material file.');
      return;
    }
    const input: CourseMaterialInput = {
      title: String(form.get('title')).trim(),
      type: String(form.get('type')) as CourseMaterialInput['type'],
      ...(String(form.get('unitNumber')).trim() && { unitNumber: Number(form.get('unitNumber')) }),
      ...(String(form.get('description')).trim() && { description: String(form.get('description')).trim() }),
    };
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await courseMaterialsApi.upload(course.id, input, file, token);
      setMaterials(await courseMaterialsApi.list(course.id, token));
      event.currentTarget.reset();
      setSuccess('Course material uploaded.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to upload course material.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaterial(material: CourseMaterial) {
    if (!token || !window.confirm(`Delete ${material.title}?`)) return;
    setBusy(true);
    setError('');
    try {
      await courseMaterialsApi.remove(material.id, token);
      setMaterials((current) => current.filter((item) => item.id !== material.id));
      setSuccess('Course material deleted.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to delete course material.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadMaterial(material: CourseMaterial, open: boolean) {
    if (!token) return;
    try {
      const blob = open
        ? await courseMaterialsApi.view(material.id, token)
        : await courseMaterialsApi.download(material.id, token);
      const url = URL.createObjectURL(blob);
      if (open) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = material.originalFileName;
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to open this material.');
    }
  }

  if (loading) return <LoadingState label="Loading course details" />;
  if (error) return <ErrorNotice message={error} />;
  if (!course) return null;

  const canManageMaterials = user?.role === 'admin' || (user?.role === 'faculty' && course.ownerFacultyId === user.id);
  const materialGroups = new Map<string, CourseMaterial[]>();
  for (const material of materials) {
    const label = material.unitNumber ? `Unit ${material.unitNumber}` : 'Course resources';
    materialGroups.set(label, [...(materialGroups.get(label) ?? []), material]);
  }

  return (
    <div className="page-stack">
      <Link className="back-link" to="/courses"><ArrowLeft size={16} /> Back to courses</Link>
      <section className="course-detail-hero">
        <div className="course-detail-mark"><BookOpen size={25} /></div>
        <div><div className="section-kicker">COURSE OVERVIEW</div><h2>{course.title}</h2><p>{course.code} <span className="dot-separator">·</span> {course.credits} credits</p></div>
      </section>
      {error && <ErrorNotice message={error} />}
      {success && <div className="notice notice-success" role="status">{success}</div>}
      {user?.role === 'student' && course.approvalStatus === 'approved' && (
        <section className="content-card enrollment-panel">
          <div>
            <div className="section-kicker">ENROLLMENT</div>
            <h3>{enrollment?.status === 'approved' ? 'You are enrolled' : enrollment?.status === 'pending' ? 'Request under review' : enrollment?.status === 'rejected' ? 'Request not approved' : 'Join this course'}</h3>
            {enrollment?.status === 'rejected' && enrollment.rejectionReason && <p>{enrollment.rejectionReason}</p>}
          </div>
          {enrollment?.status !== 'approved' && <button className="button button-primary" onClick={() => void requestEnrollment()} disabled={busy || enrollment?.status === 'pending'}>{enrollment?.status === 'pending' ? 'Pending review' : enrollment?.status === 'rejected' ? 'Request again' : 'Request enrollment'}</button>}
        </section>
      )}
      {course.approvalStatus !== 'approved' && user?.role !== 'student' && (
        <div className={`status-pill status-${course.approvalStatus === 'pending' ? 'amber' : 'red'}`}>
          {course.approvalStatus === 'pending' ? 'Awaiting administrator approval' : `Rejected: ${course.rejectionReason ?? 'See review notes'}`}
        </div>
      )}
      {course.approvalStatus === 'approved' && (user?.role !== 'student' || enrollment?.status === 'approved') && (
        <section className="content-card material-section">
          <div className="section-heading">
            <div><div className="section-kicker">LEARNING RESOURCES</div><h2>Course materials</h2><p>Browse resources organized by unit and type.</p></div>
          </div>
          {canManageMaterials && (
            <form className="material-upload-form" onSubmit={(event) => void uploadMaterial(event)}>
              <label className="field-label" htmlFor="material-title">Material title</label>
              <input className="form-input" id="material-title" name="title" required minLength={3} maxLength={160} placeholder="e.g. Unit 1 lecture notes" />
              <label className="field-label" htmlFor="material-type">Resource type</label>
              <select className="form-input" id="material-type" name="type" defaultValue="notes">{materialTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
              <label className="field-label" htmlFor="material-unit">Unit number (optional)</label>
              <input className="form-input" id="material-unit" name="unitNumber" type="number" min="1" max="30" />
              <label className="field-label" htmlFor="material-description">Description (optional)</label>
              <input className="form-input" id="material-description" name="description" maxLength={1000} />
              <label className="field-label" htmlFor="material-file">File (PDF, image, text or Office document; max 10 MiB)</label>
              <input className="form-input" id="material-file" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" />
              <button className="button button-primary" type="submit" disabled={busy}><Plus size={16} /> {busy ? 'Uploading…' : 'Add material'}</button>
            </form>
          )}
          {materials.length ? (
            [...materialGroups.entries()].map(([group, items]) => (
              <div className="material-group" key={group}>
                <h3>{group}</h3>
                <div className="data-list">
                  {items.map((material) => (
                    <article className="data-row material-row" key={material.id}>
                      <FileText size={18} aria-hidden="true" />
                      <div className="row-main"><strong>{material.title}</strong><span>{materialTypes.find((type) => type.value === material.type)?.label} · {material.originalFileName} · {formatBytes(material.fileSize)}</span>{material.description && <span>{material.description}</span>}</div>
                      <div className="row-actions"><button className="button button-small button-outline" onClick={() => void downloadMaterial(material, true)}>View</button><button className="icon-button" aria-label={`Download ${material.title}`} title="Download" onClick={() => void downloadMaterial(material, false)}><ArrowDownToLine size={16} /></button>{canManageMaterials && <button className="icon-button danger-icon" aria-label={`Delete ${material.title}`} title="Delete" disabled={busy} onClick={() => void deleteMaterial(material)}><Trash2 size={16} /></button>}</div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          ) : <EmptyState title="No materials yet" description="Course resources added by faculty will appear here." />}
        </section>
      )}
      <section className="detail-grid">
        <article className="content-card detail-card"><div className="detail-card-icon violet"><CalendarDays size={19} /></div><div className="section-kicker">COURSE RECORD</div><h3>{course.code}</h3><p>Created {new Date(course.createdAt).toLocaleDateString()}</p></article>
        <article className="content-card detail-card"><div className="detail-card-icon blue"><ClipboardList size={19} /></div><div className="section-kicker">COURSE WORK</div><h3>Assignments</h3><p>Course assignments are available in the assignments workspace.</p><Link className="text-link" to="/assignments">Open assignments <ArrowLeft size={14} className="link-arrow" /></Link></article>
        <article className="content-card detail-card"><div className="detail-card-icon green"><GraduationCap size={19} /></div><div className="section-kicker">ASSESSMENTS</div><h3>Quizzes</h3><p>Published assessments and faculty quiz tools are in the quiz workspace.</p><Link className="text-link" to="/quizzes">Open quizzes <ArrowLeft size={14} className="link-arrow" /></Link></article>
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
