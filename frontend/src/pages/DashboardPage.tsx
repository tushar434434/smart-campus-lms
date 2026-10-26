import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../api/courses.api';
import { studentsApi } from '../api/students.api';
import { ErrorNotice, LoadingState, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course } from '../types/api';
import { ApiError } from '../api/client';

export function DashboardPage() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCount, setCourseCount] = useState(0);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const accessToken: string = token ?? '';
    if (accessToken.length === 0) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [coursePage, students] = await Promise.all([
          coursesApi.list(1, '', accessToken),
          user?.role === 'student'
            ? Promise.resolve(null)
            : studentsApi.list(1, '', accessToken),
        ]);
        if (!active) return;
        setCourses(coursePage.courses.slice(0, 4));
        setCourseCount(coursePage.pagination.total);
        setStudentCount(students?.pagination.total ?? null);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof ApiError ? caught.message : 'Unable to load workspace data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [token, user?.role]);

  if (!user) return null;
  if (loading) return <LoadingState label="Gathering your campus workspace" />;

  return (
    <div className="page-stack">
      {error && <ErrorNotice message={error} />}
      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="eyebrow-light">YOUR ACADEMIC WORKSPACE</div>
          <h2>Good to have you here, {user.name.split(' ')[0]}.</h2>
          <p>Pick up where you left off and keep your campus work moving.</p>
          <Link to="/courses" className="button button-white">Explore courses <ArrowUpRight size={16} /></Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-book"><BookOpen size={45} strokeWidth={1.4} /></div>
          <span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" />
        </div>
      </section>

      <section className="stats-grid" aria-label="Workspace summary">
        <article className="stat-card">
          <div className="stat-icon stat-violet"><BookOpen size={19} /></div>
          <div className="stat-label">Available courses</div>
          <strong>{courseCount}</strong>
          <span>In the course catalog</span>
        </article>
        {studentCount !== null ? (
          <article className="stat-card">
            <div className="stat-icon stat-teal"><Users size={19} /></div>
            <div className="stat-label">Student records</div>
            <strong>{studentCount}</strong>
            <span>Managed campus profiles</span>
          </article>
        ) : (
          <article className="stat-card">
            <div className="stat-icon stat-teal"><GraduationCap size={19} /></div>
            <div className="stat-label">Your account</div>
            <strong className="stat-role">{user.role}</strong>
            <span>Campus learning access</span>
          </article>
        )}
        <article className="stat-card">
          <div className="stat-icon stat-amber"><ClipboardCheck size={19} /></div>
          <div className="stat-label">Assignments</div>
          <strong className="stat-unavailable">—</strong>
          <span>Course-specific view</span>
        </article>
      </section>

      {user.role === 'student' && (
        <Notice tone="warning">
          Your campus profile, enrollment list, and personal assignment history are not available from the current student-facing API. Ask faculty or an administrator to create and link your student record.
        </Notice>
      )}

      <section className="content-card">
        <div className="section-heading">
          <div><div className="section-kicker">CATALOG</div><h2>Recently added courses</h2><p>Latest courses returned by the campus catalog.</p></div>
          <Link className="text-link" to="/courses">View catalog <ArrowUpRight size={15} /></Link>
        </div>
        {courses.length ? (
          <div className="course-preview-grid">
            {courses.map((course) => (
              <Link className="course-preview" key={course.id} to={`/courses/${course.id}`}>
                <div className="course-preview-top"><span className="course-monogram">{course.code.slice(0, 2)}</span><span className="credit-pill">{course.credits} credits</span></div>
                <h3>{course.title}</h3>
                <p>{course.code}</p>
                <div className="course-preview-footer">Course details <ArrowUpRight size={14} /></div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="inline-empty">No courses have been added to the catalog yet.</div>
        )}
      </section>
      {error && error.includes('permission') && <Notice tone="info">Student totals are visible to faculty and administrators only.</Notice>}
    </div>
  );
}
