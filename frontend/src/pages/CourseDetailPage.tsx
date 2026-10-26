import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, GraduationCap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { coursesApi } from '../api/courses.api';
import { ErrorNotice, LoadingState } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course } from '../types/api';

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const { token } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    coursesApi.get(courseId, token ?? undefined)
      .then((result) => { if (active) setCourse(result); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof ApiError ? caught.message : 'Unable to load this course.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, token]);

  if (loading) return <LoadingState label="Loading course details" />;
  if (error) return <ErrorNotice message={error} />;
  if (!course) return null;

  return (
    <div className="page-stack">
      <Link className="back-link" to="/courses"><ArrowLeft size={16} /> Back to courses</Link>
      <section className="course-detail-hero">
        <div className="course-detail-mark"><BookOpen size={25} /></div>
        <div><div className="section-kicker">COURSE OVERVIEW</div><h2>{course.title}</h2><p>{course.code} <span className="dot-separator">·</span> {course.credits} credits</p></div>
      </section>
      <section className="detail-grid">
        <article className="content-card detail-card"><div className="detail-card-icon violet"><CalendarDays size={19} /></div><div className="section-kicker">COURSE RECORD</div><h3>{course.code}</h3><p>Created {new Date(course.createdAt).toLocaleDateString()}</p></article>
        <article className="content-card detail-card"><div className="detail-card-icon blue"><ClipboardList size={19} /></div><div className="section-kicker">COURSE WORK</div><h3>Assignments</h3><p>Course assignments are available in the assignments workspace.</p><Link className="text-link" to="/assignments">Open assignments <ArrowLeft size={14} className="link-arrow" /></Link></article>
        <article className="content-card detail-card"><div className="detail-card-icon green"><GraduationCap size={19} /></div><div className="section-kicker">ASSESSMENTS</div><h3>Quizzes</h3><p>Published assessments and faculty quiz tools are in the quiz workspace.</p><Link className="text-link" to="/quizzes">Open quizzes <ArrowLeft size={14} className="link-arrow" /></Link></article>
      </section>
    </div>
  );
}
