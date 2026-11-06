import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Bookmark, Check, Clock3, Plus, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { ApiError } from '../api/client';
import { listAllCourses, listEnrolledCourses, listTeachingCourses } from '../api/courses.api';
import { quizzesApi, type QuestionInput, type QuizInput } from '../api/quizzes.api';
import { reportsApi, savePdf } from '../api/reports.api';
import { EmptyState, ErrorNotice, LoadingState, Modal, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type {
  Course,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizRosterRow,
} from '../types/api';

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function readError(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.message : fallback;
}

export function QuizzesPage() {
  const { user, token } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selected, setSelected] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [roster, setRoster] = useState<QuizRosterRow[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatus, setRosterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quizModal, setQuizModal] = useState<'create' | 'edit' | null>(null);
  const [questionModal, setQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>('multiple_choice');
  const [pastedImages, setPastedImages] = useState<Partial<Record<'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD', File>>>({});
  const [runner, setRunner] = useState<{ quiz: Quiz; attempt: QuizAttempt; questions: QuizQuestion[] } | null>(null);
  const [releaseMarks, setReleaseMarks] = useState(false);
  const [releaseAnswers, setReleaseAnswers] = useState(false);
  const staff = user?.role === 'faculty' || user?.role === 'admin';
  const admin = user?.role === 'admin';
  const filteredRoster = useMemo(() => {
    const query = rosterSearch.trim().toLocaleLowerCase();
    return roster.filter((row) => {
      const matchesSearch =
        !query ||
        [row.student.name, row.student.email, row.student.enrollmentNumber]
          .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesSearch && (rosterStatus === 'all' || row.status === rosterStatus);
    });
  }, [roster, rosterSearch, rosterStatus]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    (user?.role === 'faculty'
      ? listTeachingCourses(token)
      : user?.role === 'student'
        ? listEnrolledCourses(token)
        : listAllCourses(token))
      .then((result) => {
        if (!active) return;
        setCourses(result);
        setCourseId((current) => current || result[0]?.id || '');
      })
      .catch((caught: unknown) => { if (active) setError(readError(caught, 'Unable to load courses.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]);

  useEffect(() => {
    if (!token || !courseId) {
      setQuizzes([]);
      setSelected(null);
      setQuestions([]);
      setRoster([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    quizzesApi.listByCourse(courseId, token)
      .then((result) => {
        if (!active) return;
        setQuizzes(result);
        setSelected(null);
        setQuestions([]);
      })
      .catch((caught: unknown) => { if (active) setError(readError(caught, 'Unable to load quizzes.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, token]);

  async function selectQuiz(quiz: Quiz) {
    if (!token) return;
    setSelected(quiz);
    setQuestionsLoading(true);
    setRosterLoading(staff);
    setError('');
    try {
      const [quizQuestions, quizRoster] = await Promise.all([
        quizzesApi.questions(quiz.id, token),
        staff ? quizzesApi.roster(quiz.id, token) : Promise.resolve([]),
      ]);
      setQuestions(quizQuestions);
      setRoster(quizRoster);
      setReleaseMarks(quiz.showMarks);
      setReleaseAnswers(quiz.showCorrectAnswers);
    } catch (caught) {
      setError(readError(caught, 'Unable to load quiz questions.'));
    } finally {
      setQuestionsLoading(false);
      setRosterLoading(false);
    }
  }

  async function refreshSelected() {
    if (!token || !courseId) return;
    const result = await quizzesApi.listByCourse(courseId, token);
    setQuizzes(result);
    if (selected) {
      const current = result.find((quiz) => quiz.id === selected.id);
      if (current) {
        setSelected(current);
        setQuestions(await quizzesApi.questions(current.id, token));
        if (staff) setRoster(await quizzesApi.roster(current.id, token));
      } else {
        setSelected(null);
        setQuestions([]);
        setRoster([]);
      }
    }
  }

  async function saveQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !courseId) return;
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get('startsAt'));
    const endsAt = String(form.get('endsAt'));
    const base = {
      title: String(form.get('title')).trim(),
      description: String(form.get('description')).trim(),
      durationMinutes: Number(form.get('durationMinutes')),
      maxMarks: Number(form.get('maxMarks')),
      maxAttempts: Number(form.get('maxAttempts')),
    };
    setBusy(true);
    setError('');
    try {
      if (quizModal === 'edit' && selected) {
        await quizzesApi.update(selected.id, {
          ...base,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        }, token);
      } else {
        const input: QuizInput = {
          ...base,
          courseId,
          ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
        };
        const created = await quizzesApi.create(input, token);
        setSelected(created);
        setQuestions([]);
      }
      setQuizModal(null);
      await refreshSelected();
    } catch (caught) {
      setError(readError(caught, 'Unable to save quiz.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selected) return;
    const form = new FormData(event.currentTarget);
    const input: QuestionInput = {
      questionType,
      questionText: String(form.get('questionText')).trim(),
      optionA: questionType === 'true_false' ? 'True' : String(form.get('optionA')).trim(),
      optionB: questionType === 'true_false' ? 'False' : String(form.get('optionB')).trim(),
      optionC: questionType === 'true_false' ? '' : String(form.get('optionC')).trim(),
      optionD: questionType === 'true_false' ? '' : String(form.get('optionD')).trim(),
      correctOption: String(form.get('correctOption')) as QuestionInput['correctOption'],
      marks: Number(form.get('marks')),
    };
    setBusy(true);
    setError('');
    try {
      const saved = editingQuestion
        ? await quizzesApi.updateQuestion(selected.id, editingQuestion.id, input, token)
        : await quizzesApi.createQuestion(selected.id, input, token);
      const slots = ['question', 'optionA', 'optionB', 'optionC', 'optionD'] as const;
      for (const slot of slots) {
        const selectedFile = form.get(`image-${slot}`);
        const file = selectedFile instanceof File && selectedFile.size > 0
          ? selectedFile
          : pastedImages[slot];
        if (file) await quizzesApi.uploadQuestionImage(selected.id, saved.id, slot, file, token);
      }
      setQuestionModal(false);
      setEditingQuestion(null);
      setPastedImages({});
      setQuestions(await quizzesApi.questions(selected.id, token));
    } catch (caught) {
      setError(readError(caught, 'Unable to save quiz question.'));
    } finally {
      setBusy(false);
    }
  }

  function pasteQuestionImage(
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    slot: 'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD',
  ) {
    const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    setPastedImages((current) => ({ ...current, [slot]: file }));
  }

  function clearPastedImage(slot: 'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD') {
    setPastedImages((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  async function publishQuiz(quiz: Quiz) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await quizzesApi.publish(quiz.id, token);
      await refreshSelected();
    } catch (caught) {
      setError(readError(caught, 'Unable to publish quiz.'));
    } finally {
      setBusy(false);
    }
  }

  async function releaseResults() {
    if (!token || !selected) return;
    setBusy(true);
    setError('');
    try {
      const updated = await quizzesApi.release(selected.id, releaseMarks, releaseAnswers, token);
      setSelected(updated);
      await refreshSelected();
    } catch (caught) {
      setError(readError(caught, 'Unable to update result visibility.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(question: QuizQuestion) {
    if (!token || !selected || !window.confirm('Delete this quiz question?')) return;
    setError('');
    try {
      await quizzesApi.deleteQuestion(selected.id, question.id, token);
      setQuestions(await quizzesApi.questions(selected.id, token));
    } catch (caught) {
      setError(readError(caught, 'Unable to delete question.'));
    }
  }

  async function deleteQuiz(quiz: Quiz) {
    if (!token || !admin || !window.confirm(`Delete quiz “${quiz.title}”?`)) return;
    setError('');
    try {
      await quizzesApi.delete(quiz.id, token);
      setSelected(null);
      setQuestions([]);
      await refreshSelected();
    } catch (caught) {
      setError(readError(caught, 'Unable to delete quiz.'));
    }
  }

  async function startQuiz(quiz: Quiz) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const attempt = await quizzesApi.startAttempt(quiz.id, token);
      const attemptQuestions = await quizzesApi.attemptQuestions(attempt.id, token);
      setRunner({ quiz, attempt, questions: attemptQuestions });
    } catch (caught) {
      setError(readError(caught, 'Unable to start this quiz.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveRunnerAnswer(questionId: string, answer: 'A' | 'B' | 'C' | 'D') {
    if (!token || !runner) throw new Error('Quiz attempt is no longer active.');
    await quizzesApi.saveAnswer(runner.attempt.id, questionId, answer, token);
  }

  async function saveRunnerBookmark(questionId: string, bookmarked: boolean) {
    if (!token || !runner) throw new Error('Quiz attempt is no longer active.');
    await quizzesApi.bookmark(runner.attempt.id, questionId, bookmarked, token);
  }

  async function submitRunner() {
    if (!token || !runner) return;
    setBusy(true);
    setError('');
    try {
      const result = await quizzesApi.submitAttempt(runner.attempt.id, token);
      setRunner({ ...runner, attempt: result });
    } catch (caught) {
      setError(readError(caught, 'Unable to submit quiz attempt.'));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function downloadQuizReport(quiz: Quiz) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      savePdf(await reportsApi.quiz(quiz.id, token), `quiz-report-${quiz.id}.pdf`);
    } catch (caught) {
      setError(readError(caught, 'Unable to download the quiz report.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !courses.length) return <LoadingState label="Loading courses" />;

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div><div className="section-kicker">ASSESSMENT CENTER</div><h2>Quizzes</h2><p>Published assessments and faculty quiz management.</p></div>
        {staff && courseId && <button className="button button-primary" onClick={() => { setError(''); setQuizModal('create'); }}><Plus size={17} /> Create quiz</button>}
      </div>
      {user?.role === 'student' && <Notice tone="warning">Quiz attempts require your student account to be linked to a student profile and enrolled in the course. The backend verifies both conditions when an attempt starts.</Notice>}
      <div className="course-filter">
        <label htmlFor="quiz-course">Course</label>
        <select className="form-input" id="quiz-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
          {courses.length === 0 && <option value="">No courses available</option>}
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
        </select>
      </div>
      {error && !quizModal && !questionModal && <ErrorNotice message={error} />}
      {loading ? <LoadingState label="Loading quizzes" /> : (
        <div className="quiz-workspace">
          <section className="content-card quiz-list-card">
            <div className="section-heading compact-heading"><div><div className="section-kicker">COURSE ASSESSMENTS</div><h2>{courses.find((course) => course.id === courseId)?.title ?? 'Quizzes'}</h2></div><span className="result-count">{quizzes.length} total</span></div>
            {quizzes.length ? <div className="quiz-list">{quizzes.map((quiz) => (
              <article className={`quiz-row ${selected?.id === quiz.id ? 'quiz-row-active' : ''}`} key={quiz.id}>
                <button className="quiz-row-main" onClick={() => void selectQuiz(quiz)}>
                  <span className="quiz-row-icon"><Trophy size={18} /></span>
                  <span className="quiz-row-copy"><strong>{quiz.title}</strong><small>{quiz.durationMinutes} min <span>·</span> {quiz.maxMarks} marks</small></span>
                  <span className={`status-pill ${quiz.status === 'published' ? 'status-green' : quiz.status === 'closed' ? 'status-neutral' : 'status-amber'}`}>{quiz.status}</span>
                </button>
                {user?.role === 'student' && quiz.status === 'published' && <button className="button button-small button-outline" disabled={busy} onClick={() => void startQuiz(quiz)}>Start <ArrowRight size={14} /></button>}
              </article>
            ))}</div> : <EmptyState title="No quizzes for this course" description={user?.role === 'student' ? 'Published quizzes will appear here when available.' : 'Create a draft quiz and add questions before publishing.'} />}
          </section>
          <section className="content-card quiz-detail-card">
            {selected ? (
              <>
                <div className="section-heading compact-heading"><div><div className="section-kicker">QUIZ DETAILS</div><h2>{selected.title}</h2><p>{selected.description}</p></div>{staff && <button className="button button-outline button-small" disabled={busy} onClick={() => void downloadQuizReport(selected)}>Download PDF</button>}</div>
                <div className="quiz-meta-grid"><div><Clock3 size={16} /><span>{selected.durationMinutes} minutes</span></div><div><Trophy size={16} /><span>{selected.maxMarks} marks</span></div><div><ShieldCheck size={16} /><span>{selected.maxAttempts} allowed attempts</span></div></div>
                {(selected.startsAt || selected.endsAt) && <div className="quiz-schedule"><Clock3 size={15} />{selected.startsAt && <span>Opens {new Date(selected.startsAt).toLocaleString()}</span>}{selected.endsAt && <span>Closes {new Date(selected.endsAt).toLocaleString()}</span>}</div>}
                {staff && (
                  <div className="quiz-management">
                    <div className="quiz-management-head"><h3>Questions <span>{questions.length}</span></h3><div className="quiz-management-actions">{selected.status === 'draft' && <><button className="button button-small button-outline" onClick={() => { setError(''); setQuizModal('edit'); }}>Edit quiz</button><button className="button button-small button-outline" onClick={() => { setEditingQuestion(null); setQuestionType('multiple_choice'); setPastedImages({}); setError(''); setQuestionModal(true); }}><Plus size={14} /> Add question</button></>}</div></div>
                    {questionsLoading ? <LoadingState label="Loading questions" /> : questions.length ? <div className="question-list">{questions.map((question, index) => (
                      <article className="staff-question" key={question.id}>
                        <div className="question-index">{String(index + 1).padStart(2, '0')}</div>
                        <div className="staff-question-body"><strong>{question.questionText}</strong><span>{question.questionType === 'true_false' ? 'True / False' : 'Multiple choice'} · {question.marks} {question.marks === 1 ? 'mark' : 'marks'}{question.correctOption && <span className="correct-answer"> · Correct: {question.correctOption}</span>}</span>{question.imageSlots?.includes('question') && <ProtectedQuizImage quizId={selected.id} questionId={question.id} slot="question" token={token ?? ''} alt="Question illustration" />}</div>
                        {selected.status === 'draft' && <><button className="icon-button" onClick={() => { setEditingQuestion(question); setQuestionType(question.questionType); setPastedImages({}); setError(''); setQuestionModal(true); }} aria-label="Edit question"><ClipboardIcon /></button><button className="icon-button danger-icon" onClick={() => void deleteQuestion(question)} aria-label="Delete question"><Trash2 size={15} /></button></>}
                      </article>
                    ))}</div> : <div className="inline-empty">Add at least one question before publishing this quiz.</div>}
                    <section className="quiz-roster" aria-labelledby="quiz-roster-heading">
                      <div className="quiz-management-head">
                        <h3 id="quiz-roster-heading">Student activity <span>{roster.length}</span></h3>
                      </div>
                      {rosterLoading ? <LoadingState label="Loading student quiz activity" /> : roster.length ? (
                        <>
                          <div className="roster-filters">
                            <label className="sr-only" htmlFor="quiz-roster-search">Search students</label>
                            <input
                              className="form-input"
                              id="quiz-roster-search"
                              type="search"
                              placeholder="Search name, email or enrollment"
                              value={rosterSearch}
                              onChange={(event) => setRosterSearch(event.target.value)}
                            />
                            <label className="sr-only" htmlFor="quiz-roster-status">Filter by quiz activity</label>
                            <select
                              className="form-input"
                              id="quiz-roster-status"
                              value={rosterStatus}
                              onChange={(event) => setRosterStatus(event.target.value)}
                            >
                              <option value="all">All activity</option>
                              <option value="not_attempted">Not attempted</option>
                              <option value="in_progress">In progress</option>
                              <option value="submitted">Submitted</option>
                              <option value="auto_submitted">Auto-submitted</option>
                              <option value="flagged">Flagged</option>
                            </select>
                          </div>
                          {filteredRoster.length ? <div className="data-list">
                          {filteredRoster.map((row) => (
                            <article className="activity-row" key={row.student.id}>
                              <div>
                                <strong>{row.student.name}</strong>
                                <span>{row.student.enrollmentNumber} · {row.student.email}</span>
                              </div>
                              <div className="activity-result">
                                <span className={`status-pill ${row.attemptCount ? 'status-blue' : 'status-neutral'}`}>{row.status.replace('_', ' ')}</span>
                                <span>{row.attemptCount}/{selected.maxAttempts} attempts</span>
                                {row.latestAttempt?.score !== null && row.latestAttempt?.score !== undefined && <span>{row.latestAttempt.score}/{selected.maxMarks} marks</span>}
                              </div>
                            </article>
                          ))}
                          </div> : <div className="inline-empty">No students match these filters.</div>}
                        </>
                      ) : <div className="inline-empty">No students are enrolled in this course.</div>}
                    </section>
                    {selected.status === 'draft' && <button className="button button-primary button-full management-action" disabled={!questions.length || busy} onClick={() => void publishQuiz(selected)}>{busy ? 'Publishing…' : 'Publish quiz'}</button>}
                    {selected.status === 'published' && <div className="release-panel">
                      <h3>Result visibility</h3>
                      <label className="check-row"><input type="checkbox" checked={releaseMarks} onChange={(event) => setReleaseMarks(event.target.checked)} /> Release marks to students</label>
                      <label className="check-row"><input type="checkbox" checked={releaseAnswers} onChange={(event) => setReleaseAnswers(event.target.checked)} /> Release correct answers</label>
                      <button className="button button-outline button-small" disabled={busy} onClick={() => void releaseResults()}>{busy ? 'Saving…' : 'Update result visibility'}</button>
                    </div>}
                    {admin && <button className="text-danger-button" onClick={() => void deleteQuiz(selected)}>Delete quiz <Trash2 size={14} /></button>}
                  </div>
                )}
                {!staff && <div className="student-quiz-note"><ShieldCheck size={17} /> Correct answers remain hidden until the instructor releases results.</div>}
              </>
            ) : (
              <div className="quiz-detail-placeholder"><div className="quiz-placeholder-icon"><Trophy size={23} /></div><h3>Select an assessment</h3><p>Choose a quiz to review its details and available actions.</p></div>
            )}
          </section>
        </div>
      )}
      {quizModal && (
        <Modal title={quizModal === 'edit' ? 'Edit quiz' : 'Create quiz'} onClose={() => setQuizModal(null)}>
          <form className="form-stack modal-form" onSubmit={(event) => void saveQuiz(event)}>
            <label className="field-label" htmlFor="quiz-title">Title</label><input className="form-input" id="quiz-title" name="title" required minLength={3} defaultValue={quizModal === 'edit' ? selected?.title : ''} />
            <label className="field-label" htmlFor="quiz-description">Description</label><textarea className="form-input" id="quiz-description" name="description" rows={3} required minLength={5} defaultValue={quizModal === 'edit' ? selected?.description : ''} />
            <div className="two-fields"><div><label className="field-label" htmlFor="quiz-duration">Duration (minutes)</label><input className="form-input" id="quiz-duration" name="durationMinutes" type="number" min="1" step="1" required defaultValue={quizModal === 'edit' ? selected?.durationMinutes : ''} /></div><div><label className="field-label" htmlFor="quiz-max-marks">Maximum marks</label><input className="form-input" id="quiz-max-marks" name="maxMarks" type="number" min="0.01" step="any" required defaultValue={quizModal === 'edit' ? selected?.maxMarks : ''} /></div></div>
            <label className="field-label" htmlFor="quiz-attempts">Maximum attempts</label><input className="form-input" id="quiz-attempts" name="maxAttempts" type="number" min="1" step="1" required defaultValue={quizModal === 'edit' ? selected?.maxAttempts : '1'} />
            <div className="two-fields"><div><label className="field-label" htmlFor="quiz-starts">Opens (optional)</label><input className="form-input" id="quiz-starts" name="startsAt" type="datetime-local" defaultValue={quizModal === 'edit' ? localDateTime(selected?.startsAt ?? null) : ''} /></div><div><label className="field-label" htmlFor="quiz-ends">Closes (optional)</label><input className="form-input" id="quiz-ends" name="endsAt" type="datetime-local" defaultValue={quizModal === 'edit' ? localDateTime(selected?.endsAt ?? null) : ''} /></div></div>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setQuizModal(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : quizModal === 'edit' ? 'Save changes' : 'Create draft'}</button></div>
          </form>
        </Modal>
      )}
      {questionModal && selected && (
        <Modal title={editingQuestion ? 'Edit question' : 'Add quiz question'} onClose={() => setQuestionModal(false)} wide>
          <form className="form-stack modal-form" onSubmit={(event) => void saveQuestion(event)}>
            <label className="field-label" htmlFor="question-type">Question type</label><select className="form-input" id="question-type" value={questionType} onChange={(event) => setQuestionType(event.target.value as typeof questionType)}><option value="multiple_choice">Multiple choice</option><option value="true_false">True / False</option></select>
            <label className="field-label" htmlFor="question-text">Question</label><textarea className="form-input" id="question-text" name="questionText" rows={3} required minLength={5} defaultValue={editingQuestion?.questionText ?? ''} onPaste={(event) => pasteQuestionImage(event, 'question')} />
            <label className="field-label" htmlFor="question-image">Question image (optional; paste an image into the question field or choose a file)</label><input className="form-input" id="question-image" name="image-question" type="file" accept="image/jpeg,image/png,image/webp" onChange={() => clearPastedImage('question')} />{pastedImages.question && <span className="result-count">Pasted image ready: {pastedImages.question.name}</span>}
            <div className="two-fields">
              {(questionType === 'true_false' ? ['A', 'B'] as const : ['A', 'B', 'C', 'D'] as const).map((option) => <div key={option}><label className="field-label" htmlFor={`option-${option}`}>Option {option}</label><input className="form-input" id={`option-${option}`} name={`option${option}`} required={questionType === 'multiple_choice'} readOnly={questionType === 'true_false'} defaultValue={questionType === 'true_false' ? (option === 'A' ? 'True' : 'False') : editingQuestion?.[`option${option}`] ?? ''} onPaste={(event) => pasteQuestionImage(event, `option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD')} /><label className="field-label" htmlFor={`image-option-${option}`}>Option image (optional)</label><input className="form-input" id={`image-option-${option}`} name={`image-option${option}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={() => clearPastedImage(`option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD')} />{pastedImages[`option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD'] && <span className="result-count">Pasted option image ready</span>}</div>)}
            </div>
            <div className="two-fields"><div><label className="field-label" htmlFor="correct-option">Correct option</label><select className="form-input" id="correct-option" name="correctOption" defaultValue={editingQuestion?.correctOption ?? 'A'}>{(questionType === 'true_false' ? ['A', 'B'] as const : ['A', 'B', 'C', 'D'] as const).map((option) => <option key={option} value={option}>Option {option}</option>)}</select></div><div><label className="field-label" htmlFor="question-marks">Marks</label><input className="form-input" id="question-marks" name="marks" type="number" required min="0.01" step="any" defaultValue={editingQuestion?.marks ?? 1} /></div></div>
            {error && <ErrorNotice message={error} />}
            <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setQuestionModal(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editingQuestion ? 'Save question' : 'Add question'}</button></div>
          </form>
        </Modal>
      )}
      {runner && <QuizRunner
        quiz={runner.quiz}
        attempt={runner.attempt}
        questions={runner.questions}
        onClose={() => setRunner(null)}
        onSaveAnswer={saveRunnerAnswer}
        onBookmark={saveRunnerBookmark}
        token={token ?? ''}
        onSubmit={submitRunner}
        error={error}
        busy={busy}
        clearError={() => setError('')}
      />}
    </div>
  );
}

function ClipboardIcon() {
  return <span className="edit-glyph" aria-hidden="true">✎</span>;
}

function ProtectedQuizImage({
  quizId,
  questionId,
  slot,
  token,
  alt,
}: {
  quizId: string;
  questionId: string;
  slot: 'question' | 'optionA' | 'optionB' | 'optionC' | 'optionD';
  token: string;
  alt: string;
}) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void quizzesApi.questionImage(quizId, questionId, slot, token)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [quizId, questionId, slot, token]);

  if (failed) return <span className="quiz-image-error" role="status">Image unavailable</span>;
  if (!url) return <span className="quiz-image-loading" role="status">Loading image…</span>;
  return <img className="quiz-content-image" src={url} alt={alt} />;
}

function QuizRunner({
  quiz,
  attempt,
  questions,
  onClose,
  onSaveAnswer,
  onBookmark,
  token,
  onSubmit,
  error,
  busy,
  clearError,
}: {
  quiz: Quiz;
  attempt: QuizAttempt;
  questions: QuizQuestion[];
  onClose: () => void;
  onSaveAnswer: (questionId: string, answer: 'A' | 'B' | 'C' | 'D') => Promise<void>;
  onBookmark: (questionId: string, bookmarked: boolean) => Promise<void>;
  token: string;
  onSubmit: () => Promise<void>;
  error: string;
  busy: boolean;
  clearError: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>(() =>
    Object.fromEntries(
      questions.flatMap((question) =>
        question.selectedOption ? [[question.id, question.selectedOption]] : [],
      ),
    ),
  );
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    () => new Set(questions.filter((question) => question.bookmarked).map((question) => question.id)),
  );
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set(questions[0] ? [questions[0].id] : []),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(attempt.startedAt).getTime() + quiz.durationMinutes * 60_000 - Date.now()));
  const submittedRef = useRef(false);
  const complete = attempt.status !== 'in_progress';
  const currentQuestion = questions[currentIndex];
  const unansweredCount = questions.filter((question) => !answers[question.id]).length;

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, new Date(attempt.startedAt).getTime() + quiz.durationMinutes * 60_000 - Date.now());
      setRemaining(next);
      if (next === 0 && !submittedRef.current) {
        void submitNow();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.startedAt, complete, quiz.durationMinutes]);

  useEffect(() => {
    function navigate(event: KeyboardEvent) {
      if (complete || confirmSubmit || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        event.preventDefault();
        goTo(currentIndex + 1);
      } else if (event.key === 'ArrowLeft' && currentIndex > 0) {
        event.preventDefault();
        goTo(currentIndex - 1);
      }
    }
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
  }, [complete, confirmSubmit, currentIndex, questions.length]);

  function goTo(index: number) {
    const question = questions[index];
    if (!question) return;
    setCurrentIndex(index);
    setVisited((current) => new Set(current).add(question.id));
  }

  async function choose(questionId: string, option: 'A' | 'B' | 'C' | 'D') {
    clearError();
    setAnswerError('');
    setSavingQuestion(questionId);
    try {
      await onSaveAnswer(questionId, option);
      setAnswers((current) => ({ ...current, [questionId]: option }));
    } catch (caught) {
      setAnswerError(readError(caught, 'The answer could not be saved. Please try again.'));
    } finally {
      setSavingQuestion(null);
    }
  }

  async function toggleBookmark() {
    if (!currentQuestion || complete) return;
    const next = !bookmarks.has(currentQuestion.id);
    try {
      await onBookmark(currentQuestion.id, next);
      setBookmarks((current) => {
        const updated = new Set(current);
        if (next) updated.add(currentQuestion.id);
        else updated.delete(currentQuestion.id);
        return updated;
      });
    } catch (caught) {
      setAnswerError(readError(caught, 'The bookmark could not be saved.'));
    }
  }

  async function submitNow() {
    if (submittedRef.current || complete) return;
    submittedRef.current = true;
    try {
      await onSubmit();
    } catch {
      submittedRef.current = false;
      setAnswerError('Your attempt was not submitted. Please try again.');
    }
  }

  function submit() {
    if (submittedRef.current || complete) return;
    setConfirmSubmit(true);
  }

  const minutes = Math.floor(remaining / 60_000).toString().padStart(2, '0');
  const seconds = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, '0');

  return (
    <Modal title={complete ? 'Quiz submitted' : quiz.title} fullscreen onClose={complete ? onClose : () => window.confirm('Leave this quiz? Your current attempt remains active until its timer expires.') && onClose()}>
      {complete ? (
        <div className="quiz-result">
          <div className="result-icon"><Check size={25} /></div>
          <div className="section-kicker">ATTEMPT COMPLETE</div>
          <h3>{attempt.status === 'auto_submitted' ? 'Time is up' : 'Your answers have been submitted'}</h3>
          <p>{attempt.score === null ? 'Your instructor has not released marks yet. Results will appear when they become available.' : `Your score: ${attempt.score} / ${quiz.maxMarks}`}</p>
          <button className="button button-primary" onClick={onClose}>Back to quizzes</button>
        </div>
      ) : (
        <div className="quiz-runner">
          <div className={`timer-banner ${remaining < 60_000 ? 'timer-warning' : ''}`}><Clock3 size={18} /><span>Time remaining</span><strong>{minutes}:{seconds}</strong><span className="save-indicator">Answers save as you go</span></div>
          {error && <ErrorNotice message={error} />}
          {answerError && <ErrorNotice message={answerError} />}
          {questions.length && currentQuestion ? (
            <div className="runner-layout">
              <main className="runner-main">
                <div className="runner-progress"><span>Question {currentIndex + 1} of {questions.length}</span><span>{Math.round((Object.keys(answers).length / questions.length) * 100)}% answered</span><div className="runner-progress-track"><span style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }} /></div></div>
                <article className="runner-question" key={currentQuestion.id}>
                  <div className="runner-question-title"><span>{String(currentIndex + 1).padStart(2, '0')}</span><strong>{currentQuestion.questionText}</strong><small>{currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}</small></div>
                  {currentQuestion.imageSlots?.includes('question') && <ProtectedQuizImage quizId={quiz.id} questionId={currentQuestion.id} slot="question" token={token} alt="Quiz question image" />}
                  <div className="runner-options">{(['A', 'B', 'C', 'D'] as const).filter((option) => currentQuestion.questionType !== 'true_false' || option === 'A' || option === 'B').map((option) => (
                    <label className={`runner-option ${answers[currentQuestion.id] === option ? 'runner-option-selected' : ''}`} key={option}>
                      <input type="radio" name={currentQuestion.id} value={option} checked={answers[currentQuestion.id] === option} disabled={savingQuestion === currentQuestion.id} onChange={() => void choose(currentQuestion.id, option)} />
                      <span className="option-letter">{option}</span><span>{currentQuestion[`option${option}`]}{currentQuestion.imageSlots?.includes(`option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD') && <ProtectedQuizImage quizId={quiz.id} questionId={currentQuestion.id} slot={`option${option}` as 'optionA' | 'optionB' | 'optionC' | 'optionD'} token={token} alt={`Option ${option} image`} />}</span>
                    </label>
                  ))}</div>
                  {savingQuestion === currentQuestion.id && <span className="saving-label" role="status">Saving answer…</span>}
                  <button className={`button button-outline button-small ${bookmarks.has(currentQuestion.id) ? 'bookmark-active' : ''}`} type="button" onClick={() => void toggleBookmark()}><Bookmark size={15} fill={bookmarks.has(currentQuestion.id) ? 'currentColor' : 'none'} /> {bookmarks.has(currentQuestion.id) ? 'Bookmarked' : 'Bookmark for review'}</button>
                </article>
                <div className="runner-navigation"><button className="button button-outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}><ArrowLeft size={15} /> Previous</button><button className="button button-outline" disabled={currentIndex >= questions.length - 1} onClick={() => goTo(currentIndex + 1)}>Next <ArrowRight size={15} /></button></div>
              </main>
              <aside className="question-palette" aria-label="Question palette">
                <h3>Questions</h3>
                <div className="question-palette-grid">{questions.map((question, index) => {
                  const answered = Boolean(answers[question.id]);
                  const unseen = !visited.has(question.id);
                  const state = answered ? 'answered' : unseen ? 'not-visited' : 'not-answered';
                  return <button key={question.id} className={`palette-question palette-${state} ${currentIndex === index ? 'palette-current' : ''} ${bookmarks.has(question.id) ? 'palette-bookmarked' : ''}`} aria-label={`Question ${index + 1}, ${answered ? 'answered' : unseen ? 'not visited' : 'not answered'}${bookmarks.has(question.id) ? ', bookmarked' : ''}`} aria-current={currentIndex === index ? 'step' : undefined} onClick={() => goTo(index)}>{index + 1}{bookmarks.has(question.id) && <Bookmark size={10} fill="currentColor" />}</button>;
                })}</div>
                <div className="palette-legend"><span><i className="palette-answered" /> Answered</span><span><i className="palette-not-answered" /> Not answered</span><span><i className="palette-not-visited" /> Not visited</span><span><Bookmark size={12} /> Bookmarked</span></div>
                <button className="button button-primary button-full" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit attempt'}</button>
              </aside>
            </div>
          ) : <EmptyState title="No questions were returned" description="The quiz cannot be completed right now." />}
          <div className="runner-footer"><div><ShieldCheck size={16} /> Your instructor controls when results and correct answers are released.</div><span>{unansweredCount} unanswered</span></div>
          {confirmSubmit && <div className="runner-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="submit-confirm-title"><section><h3 id="submit-confirm-title">Submit this attempt?</h3><p>{unansweredCount ? `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} remain unanswered.` : 'All questions have an answer.'} You cannot change answers after submission.</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmSubmit(false)}>Review answers</button><button className="button button-primary" disabled={busy} onClick={() => { setConfirmSubmit(false); void submitNow(); }}>{busy ? 'Submitting…' : 'Confirm submission'}</button></div></section></div>}
        </div>
      )}
    </Modal>
  );
}
