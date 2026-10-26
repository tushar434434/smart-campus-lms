import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Clock3, Plus, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { ApiError } from '../api/client';
import { listAllCourses } from '../api/courses.api';
import { quizzesApi, type QuestionInput, type QuizInput } from '../api/quizzes.api';
import { EmptyState, ErrorNotice, LoadingState, Modal, Notice } from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Course, Quiz, QuizAttempt, QuizQuestion } from '../types/api';

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
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quizModal, setQuizModal] = useState<'create' | 'edit' | null>(null);
  const [questionModal, setQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [runner, setRunner] = useState<{ quiz: Quiz; attempt: QuizAttempt; questions: QuizQuestion[] } | null>(null);
  const [releaseMarks, setReleaseMarks] = useState(false);
  const [releaseAnswers, setReleaseAnswers] = useState(false);
  const staff = user?.role === 'faculty' || user?.role === 'admin';
  const admin = user?.role === 'admin';

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    listAllCourses(token)
      .then((result) => {
        if (!active) return;
        setCourses(result);
        setCourseId((current) => current || result[0]?.id || '');
      })
      .catch((caught: unknown) => { if (active) setError(readError(caught, 'Unable to load courses.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || !courseId) {
      setQuizzes([]);
      setSelected(null);
      setQuestions([]);
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
    setError('');
    try {
      setQuestions(await quizzesApi.questions(quiz.id, token));
      setReleaseMarks(quiz.showMarks);
      setReleaseAnswers(quiz.showCorrectAnswers);
    } catch (caught) {
      setError(readError(caught, 'Unable to load quiz questions.'));
    } finally {
      setQuestionsLoading(false);
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
      } else {
        setSelected(null);
        setQuestions([]);
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
      questionText: String(form.get('questionText')).trim(),
      optionA: String(form.get('optionA')).trim(),
      optionB: String(form.get('optionB')).trim(),
      optionC: String(form.get('optionC')).trim(),
      optionD: String(form.get('optionD')).trim(),
      correctOption: String(form.get('correctOption')) as QuestionInput['correctOption'],
      marks: Number(form.get('marks')),
    };
    setBusy(true);
    setError('');
    try {
      if (editingQuestion) await quizzesApi.updateQuestion(selected.id, editingQuestion.id, input, token);
      else await quizzesApi.createQuestion(selected.id, input, token);
      setQuestionModal(false);
      setEditingQuestion(null);
      setQuestions(await quizzesApi.questions(selected.id, token));
    } catch (caught) {
      setError(readError(caught, 'Unable to save quiz question.'));
    } finally {
      setBusy(false);
    }
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

  async function submitRunner() {
    if (!token || !runner) return;
    setBusy(true);
    setError('');
    try {
      const result = await quizzesApi.submitAttempt(runner.attempt.id, token);
      setRunner({ ...runner, attempt: result });
    } catch (caught) {
      setError(readError(caught, 'Unable to submit quiz attempt.'));
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
                <div className="section-heading compact-heading"><div><div className="section-kicker">QUIZ DETAILS</div><h2>{selected.title}</h2><p>{selected.description}</p></div></div>
                <div className="quiz-meta-grid"><div><Clock3 size={16} /><span>{selected.durationMinutes} minutes</span></div><div><Trophy size={16} /><span>{selected.maxMarks} marks</span></div><div><ShieldCheck size={16} /><span>{selected.maxAttempts} allowed attempts</span></div></div>
                {(selected.startsAt || selected.endsAt) && <div className="quiz-schedule"><Clock3 size={15} />{selected.startsAt && <span>Opens {new Date(selected.startsAt).toLocaleString()}</span>}{selected.endsAt && <span>Closes {new Date(selected.endsAt).toLocaleString()}</span>}</div>}
                {staff && (
                  <div className="quiz-management">
                    <div className="quiz-management-head"><h3>Questions <span>{questions.length}</span></h3><div className="quiz-management-actions">{selected.status === 'draft' && <><button className="button button-small button-outline" onClick={() => { setError(''); setQuizModal('edit'); }}>Edit quiz</button><button className="button button-small button-outline" onClick={() => { setEditingQuestion(null); setError(''); setQuestionModal(true); }}><Plus size={14} /> Add question</button></>}</div></div>
                    {questionsLoading ? <LoadingState label="Loading questions" /> : questions.length ? <div className="question-list">{questions.map((question, index) => (
                      <article className="staff-question" key={question.id}>
                        <div className="question-index">{String(index + 1).padStart(2, '0')}</div>
                        <div className="staff-question-body"><strong>{question.questionText}</strong><span>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}{question.correctOption && <span className="correct-answer"> · Correct: {question.correctOption}</span>}</span></div>
                        {selected.status === 'draft' && <><button className="icon-button" onClick={() => { setEditingQuestion(question); setError(''); setQuestionModal(true); }} aria-label="Edit question"><ClipboardIcon /></button><button className="icon-button danger-icon" onClick={() => void deleteQuestion(question)} aria-label="Delete question"><Trash2 size={15} /></button></>}
                      </article>
                    ))}</div> : <div className="inline-empty">Add at least one question before publishing this quiz.</div>}
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
            <label className="field-label" htmlFor="question-text">Question</label><textarea className="form-input" id="question-text" name="questionText" rows={3} required minLength={5} defaultValue={editingQuestion?.questionText ?? ''} />
            <div className="two-fields">
              {(['A', 'B', 'C', 'D'] as const).map((option) => <div key={option}><label className="field-label" htmlFor={`option-${option}`}>Option {option}</label><input className="form-input" id={`option-${option}`} name={`option${option}`} required defaultValue={editingQuestion?.[`option${option}`] ?? ''} /></div>)}
            </div>
            <div className="two-fields"><div><label className="field-label" htmlFor="correct-option">Correct option</label><select className="form-input" id="correct-option" name="correctOption" defaultValue={editingQuestion?.correctOption ?? 'A'}>{(['A', 'B', 'C', 'D'] as const).map((option) => <option key={option} value={option}>Option {option}</option>)}</select></div><div><label className="field-label" htmlFor="question-marks">Marks</label><input className="form-input" id="question-marks" name="marks" type="number" required min="0.01" step="any" defaultValue={editingQuestion?.marks ?? 1} /></div></div>
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

function QuizRunner({
  quiz,
  attempt,
  questions,
  onClose,
  onSaveAnswer,
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
  onSubmit: () => Promise<void>;
  error: string;
  busy: boolean;
  clearError: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [savingQuestion, setSavingQuestion] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState('');
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(attempt.startedAt).getTime() + quiz.durationMinutes * 60_000 - Date.now()));
  const submittedRef = useRef(false);
  const complete = attempt.status !== 'in_progress';

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, new Date(attempt.startedAt).getTime() + quiz.durationMinutes * 60_000 - Date.now());
      setRemaining(next);
      if (next === 0 && !submittedRef.current) {
        submittedRef.current = true;
        void onSubmit();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.startedAt, complete, onSubmit, quiz.durationMinutes]);

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

  async function submit() {
    if (submittedRef.current || complete) return;
    if (!window.confirm('Submit your quiz now? You will not be able to change answers after submission.')) return;
    submittedRef.current = true;
    await onSubmit();
  }

  const minutes = Math.floor(remaining / 60_000).toString().padStart(2, '0');
  const seconds = Math.floor((remaining % 60_000) / 1000).toString().padStart(2, '0');

  return (
    <Modal title={complete ? 'Quiz submitted' : quiz.title} onClose={complete ? onClose : () => window.confirm('Leave this quiz? Your current attempt remains active until its timer expires.') && onClose()} wide>
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
          {questions.length ? questions.map((question, index) => (
            <article className="runner-question" key={question.id}>
              <div className="runner-question-title"><span>{String(index + 1).padStart(2, '0')}</span><strong>{question.questionText}</strong><small>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</small></div>
              <div className="runner-options">{(['A', 'B', 'C', 'D'] as const).map((option) => (
                <label className={`runner-option ${answers[question.id] === option ? 'runner-option-selected' : ''}`} key={option}>
                  <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} disabled={savingQuestion === question.id} onChange={() => void choose(question.id, option)} />
                  <span className="option-letter">{option}</span><span>{question[`option${option}`]}</span>
                </label>
              ))}</div>
              {savingQuestion === question.id && <span className="saving-label">Saving answer…</span>}
            </article>
          )) : <EmptyState title="No questions were returned" description="The quiz cannot be completed right now." />}
          <div className="runner-footer"><div><ShieldCheck size={16} /> Your instructor controls when results and correct answers are released.</div><button className="button button-primary" onClick={() => void submit()} disabled={busy || !questions.length}>{busy ? 'Submitting…' : 'Submit quiz'} <ArrowRight size={15} /></button></div>
        </div>
      )}
    </Modal>
  );
}
