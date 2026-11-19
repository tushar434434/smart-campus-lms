import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { coursesApi } from '../api/courses.api';
import { studentsApi } from '../api/students.api';
import { submissionsApi } from '../api/submissions.api';
import { quizzesApi } from '../api/quizzes.api';
import { ErrorNotice, LoadingState, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type {
  Course,
  Quiz,
  StudentAssignmentActivity,
  StudentQuizActivity,
} from '../types/api';
import { ApiError } from '../api/client';
import { EnrollmentRequestsPanel } from '../components/EnrollmentRequestsPanel';

function isStudentProfileMissingError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === 'STUDENT_NOT_LINKED') {
      return true;
    }
    if (
      error.status === 403 &&
      /not linked|student record|student profile/i.test(error.message)
    ) {
      return true;
    }
  }
  return false;
}

export function DashboardPage() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCount, setCourseCount] = useState(0);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [assignmentActivity, setAssignmentActivity] = useState<StudentAssignmentActivity[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [quizActivity, setQuizActivity] = useState<StudentQuizActivity[]>([]);
  const [studentProfileMissing, setStudentProfileMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const accessToken: string = token ?? '';
    if (accessToken.length === 0) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const sectionErrors: string[] = [];
      try {
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
          setCourses([]);
          setCourseCount(0);
          setStudentCount(null);
          sectionErrors.push(
            caught instanceof ApiError ? caught.message : 'Unable to load workspace data.',
          );
        }

        if (user?.role !== 'student') {
          setAssignmentActivity([]);
          setQuizActivity([]);
          setAvailableQuizzes([]);
          setStudentProfileMissing(false);
          if (sectionErrors.length > 0) {
            setError(Array.from(new Set(sectionErrors)).join(' '));
          }
          return;
        }

        const [quizSettled, submissionsSettled, attemptsSettled] =
          await Promise.allSettled([
            quizzesApi.listMine(accessToken),
            submissionsApi.myActivity(accessToken),
            quizzesApi.studentActivity(accessToken),
          ]);
        if (!active) return;

        if (quizSettled.status === 'fulfilled') {
          setAvailableQuizzes(quizSettled.value);
        } else {
          setAvailableQuizzes([]);
          if (!isStudentProfileMissingError(quizSettled.reason)) {
            sectionErrors.push(
              quizSettled.reason instanceof ApiError
                ? quizSettled.reason.message
                : 'Unable to load quizzes.',
            );
          }
        }

        if (submissionsSettled.status === 'fulfilled') {
          setAssignmentActivity(submissionsSettled.value);
        } else {
          setAssignmentActivity([]);
          if (!isStudentProfileMissingError(submissionsSettled.reason)) {
            sectionErrors.push(
              submissionsSettled.reason instanceof ApiError
                ? submissionsSettled.reason.message
                : 'Unable to load your assignment activity.',
            );
          }
        }

        if (attemptsSettled.status === 'fulfilled') {
          setQuizActivity(attemptsSettled.value);
        } else {
          setQuizActivity([]);
          if (!isStudentProfileMissingError(attemptsSettled.reason)) {
            sectionErrors.push(
              attemptsSettled.reason instanceof ApiError
                ? attemptsSettled.reason.message
                : 'Unable to load your quiz attempt activity.',
            );
          }
        }

        const isMissingProfile =
          quizSettled.status === 'rejected' &&
          isStudentProfileMissingError(quizSettled.reason);
        setStudentProfileMissing(isMissingProfile);

        if (!isMissingProfile && sectionErrors.length > 0) {
          setError(Array.from(new Set(sectionErrors)).join(' '));
        }
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

      {user.role === 'student' && studentProfileMissing && (
        <Notice tone="warning">
          Your account is not linked to a student profile yet. Ask faculty or an administrator to create and link your student record.
        </Notice>
      )}

      {user.role === 'student' && !studentProfileMissing && (
        <section className="content-card" aria-label="Available quizzes">
          <div className="section-heading compact-heading">
            <div>
              <div className="section-kicker">QUIZZES</div>
              <h2>Published for you</h2>
            </div>
            <Link className="text-link" to="/quizzes">
              Open quizzes <ArrowUpRight size={15} />
            </Link>
          </div>
          {availableQuizzes.length ? (
            <div className="data-list">
              {availableQuizzes.map((quiz) => (
                <article className="activity-row" key={quiz.id}>
                  <div>
                    <strong>{quiz.title}</strong>
                    <span>{quiz.durationMinutes} min · {quiz.maxMarks} marks</span>
                  </div>
                  <div className="activity-result">
                    <span className="status-pill status-green">{quiz.status}</span>
                    <Link className="text-link" to={`/quizzes?quizId=${quiz.id}`}>Take quiz</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="inline-empty">No published quizzes in your enrolled courses yet.</div>
          )}
        </section>
      )}

      {user.role === 'student' && !studentProfileMissing && (
        <section className="student-activity-grid" aria-label="Your academic activity">
          <article className="content-card">
            <div className="section-heading compact-heading">
              <div><div className="section-kicker">ASSIGNMENTS</div><h2>Your submissions</h2></div>
              <span className="result-count">{assignmentActivity.length}</span>
            </div>
            {assignmentActivity.length ? (
              <div className="data-list">
                {assignmentActivity.map((item) => (
                  <article className="activity-row" key={item.id}>
                    <div><strong>{item.assignmentTitle}</strong><span>{item.courseTitle}</span></div>
                    <div className="activity-result">
                      <span className={`status-pill ${item.status === 'graded' ? 'status-green' : 'status-blue'}`}>{item.status}</span>
                      {item.status === 'graded' && item.marks !== undefined && <span>{item.marks}/{item.maxMarks} marks</span>}
                    </div>
                    {item.feedback && <p className="activity-feedback">{item.feedback}</p>}
                  </article>
                ))}
              </div>
            ) : <div className="inline-empty">No assignment submissions yet.</div>}
          </article>
          <article className="content-card">
            <div className="section-heading compact-heading">
              <div><div className="section-kicker">QUIZZES</div><h2>Your attempts</h2></div>
              <span className="result-count">{quizActivity.length}</span>
            </div>
            {quizActivity.length ? (
              <div className="data-list">
                {quizActivity.map((item) => (
                  <article className="activity-row" key={item.id}>
                    <div><strong>{item.quizTitle}</strong><span>{item.courseTitle} · Attempt {item.attemptNumber}</span></div>
                    <div className="activity-result">
                      <span className={`status-pill ${item.status === 'submitted' || item.status === 'auto_submitted' ? 'status-green' : 'status-amber'}`}>{item.status.replace('_', ' ')}</span>
                      {item.score !== null && <span>{item.score} marks</span>}
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="inline-empty">No quiz attempts yet.</div>}
          </article>
        </section>
      )}

      {user.role === 'faculty' && <EnrollmentRequestsPanel />}

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
