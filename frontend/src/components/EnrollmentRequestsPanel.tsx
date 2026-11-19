import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../api/client';
import { enrollmentsApi } from '../api/enrollments.api';
import { EmptyState, ErrorNotice, LoadingState, Modal } from './ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Enrollment } from '../types/api';

type EnrollmentRequest = Enrollment & {
  student: { id: string; name: string; email: string; enrollmentNumber: string };
  course: { id: string; title: string; code: string };
};

const filters = ['pending', 'approved', 'rejected'] as const;

export function EnrollmentRequestsPanel() {
  const { token } = useAuth();
  const [status, setStatus] = useState<(typeof filters)[number]>('pending');
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejecting, setRejecting] = useState<EnrollmentRequest | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setRequests(await enrollmentsApi.requests(token, status));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load enrollment requests.');
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => { void load(); }, [load]);

  async function approve(request: EnrollmentRequest) {
    if (!token) return;
    setBusyId(request.id);
    setError('');
    setSuccess('');
    try {
      await enrollmentsApi.approve(request.id, token);
      setSuccess(`${request.student.name} was enrolled in ${request.course.code}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to approve enrollment.');
    } finally {
      setBusyId('');
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !rejecting) return;
    setBusyId(rejecting.id);
    setError('');
    try {
      await enrollmentsApi.reject(rejecting.id, reason, token);
      setSuccess(`${rejecting.student.name}'s request was rejected.`);
      setRejecting(null);
      setReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reject enrollment.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="content-card enrollment-requests-panel">
      <div className="section-heading">
        <div><div className="section-kicker">COURSE ACCESS</div><h2>Enrollment requests</h2><p>Review requests for your courses or the full campus.</p></div>
        <button className="icon-button" type="button" title="Refresh requests" aria-label="Refresh requests" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /></button>
      </div>
      <div className="request-filter" role="group" aria-label="Enrollment request status">
        {filters.map((filter) => <button key={filter} type="button" className={`filter-tab ${status === filter ? 'filter-tab-active' : ''}`} aria-pressed={status === filter} onClick={() => setStatus(filter)}>{filter}</button>)}
      </div>
      {error && <ErrorNotice message={error} />}
      {success && <div className="notice notice-success" role="status">{success}</div>}
      {loading ? <LoadingState label="Loading enrollment requests" /> : requests.length ? (
        <div className="data-list">
          {requests.map((request) => (
            <article className="data-row enrollment-request-row" key={request.id}>
              <div className="row-main"><strong>{request.student.name} <span className="request-enrollment-number">{request.student.enrollmentNumber}</span></strong><span>{request.student.email} · {request.course.code} · {request.course.title}</span>{request.rejectionReason && <span className="approval-reason">Reason: {request.rejectionReason}</span>}</div>
              <span className={`status-pill status-${request.status === 'approved' ? 'green' : request.status === 'pending' ? 'amber' : 'red'}`}>{request.status}</span>
              {request.status === 'pending' && <div className="row-actions"><button className="icon-button" type="button" title="Approve request" aria-label={`Approve ${request.student.name}`} disabled={busyId === request.id} onClick={() => void approve(request)}><Check size={17} /></button><button className="icon-button danger-icon" type="button" title="Reject request" aria-label={`Reject ${request.student.name}`} disabled={busyId === request.id} onClick={() => { setRejecting(request); setReason(''); }}><X size={17} /></button></div>}
            </article>
          ))}
        </div>
      ) : <EmptyState title={`No ${status} requests`} description="Enrollment activity for your courses will appear here." />}
      {rejecting && <Modal title="Reject enrollment request" onClose={() => setRejecting(null)}><form className="form-stack modal-form" onSubmit={(event) => void reject(event)}><p>{rejecting.student.name} · {rejecting.course.code}</p><label className="field-label" htmlFor="enrollment-rejection-reason">Reason</label><textarea className="form-input" id="enrollment-rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={1000} rows={4} required />{error && <ErrorNotice message={error} />}<div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setRejecting(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={busyId === rejecting.id}>{busyId === rejecting.id ? 'Saving…' : 'Reject request'}</button></div></form></Modal>}
    </section>
  );
}
