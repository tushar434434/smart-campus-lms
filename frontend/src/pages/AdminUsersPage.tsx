import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, Search, Shield, X } from 'lucide-react';
import { ApiError } from '../api/client';
import {
  adminApi,
  type AdminUser,
  type RoleChangeAudit,
} from '../api/admin.api';
import {
  EmptyState,
  ErrorNotice,
  LoadingState,
  Notice,
} from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';
import type { Pagination, UserRole } from '../types/api';

const roleOptions: UserRole[] = ['student', 'faculty', 'admin'];

export function AdminUsersPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<RoleChangeAudit[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [auditPagination, setAuditPagination] = useState<Pagination | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [filter, setFilter] = useState<'all' | UserRole>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  async function loadUsers(currentToken: string, isCurrent = () => true) {
    const result = await adminApi.listUsers(currentToken, {
      page,
      limit: 10,
      ...(search ? { search } : {}),
      ...(filter !== 'all' ? { role: filter } : {}),
    });
    if (!isCurrent()) return;
    setUsers(result.users);
    setPagination(result.pagination);
  }

  async function loadLogs(currentToken: string, isCurrent = () => true) {
    const result = await adminApi.listRoleAuditLogs(
      currentToken,
      auditPage,
      10,
    );
    if (!isCurrent()) return;
    setLogs(result.logs);
    setAuditPagination(result.pagination);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError('');
    const isCurrent = () => active;
    Promise.all([loadUsers(token, isCurrent), loadLogs(token, isCurrent)])
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError && caught.status === 403
              ? 'Administrator permission is required to manage users.'
              : 'Unable to load user management data. Try again.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, page, auditPage, search, filter]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function setSuspension(account: AdminUser, suspended: boolean) {
    if (!token || busyUserId) return;
    const confirmed = window.confirm(
      suspended
        ? `Suspend ${account.name}? They will not be able to sign in.`
        : `Restore ${account.name}'s account?`,
    );
    if (!confirmed) return;
    setBusyUserId(account.id);
    setError('');
    setSuccess('');
    try {
      await adminApi.setSuspension(token, account.id, suspended);
      setSuccess(
        suspended
          ? `${account.name}'s account was suspended.`
          : `${account.name}'s account was restored.`,
      );
      await Promise.all([loadUsers(token), loadLogs(token)]);
      if (selectedUser?.id === account.id) {
        setSelectedUser(await adminApi.getUser(token, account.id));
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update account status.',
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function changeRole(account: AdminUser, nextRole: UserRole) {
    if (!token || nextRole === account.role || busyUserId) return;
    const confirmed = window.confirm(
      `Change ${account.name}'s role from ${account.role} to ${nextRole}?`,
    );
    if (!confirmed) return;

    setBusyUserId(account.id);
    setError('');
    setSuccess('');
    try {
      await adminApi.changeRole(token, account.id, nextRole);
      setSuccess(`${account.name}'s role was updated to ${nextRole}.`);
      await Promise.all([loadUsers(token), loadLogs(token)]);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 403
          ? 'Your administrator permission is no longer active. Sign in again or contact another administrator.'
          : 'Unable to update this role. Refresh the list and try again.',
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function retry() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadUsers(token), loadLogs(token)]);
    } catch {
      setError('Unable to load user management data. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(account: AdminUser) {
    if (!token) return;
    setSelectedUser(null);
    setDetailsError('');
    setDetailsLoading(true);
    try {
      setSelectedUser(await adminApi.getUser(token, account.id));
    } catch {
      setDetailsError('Unable to load account details. Try again.');
    } finally {
      setDetailsLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <div className="section-kicker">ADMINISTRATION</div>
          <h2>User and role management</h2>
          <p>Review campus accounts and manage access roles.</p>
        </div>
        <span className="status-pill status-green">
          <Shield size={14} /> Administrator
        </span>
      </div>

      {error && (
        <div>
          <ErrorNotice message={error} />
          <button
            className="button button-outline button-small"
            onClick={() => void retry()}
          >
            Retry
          </button>
        </div>
      )}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Registered users</h2>
            <p>Role changes are recorded in the audit history.</p>
          </div>
          {pagination && (
            <span className="result-count">{pagination.total} accounts</span>
          )}
        </div>
        <div className="list-toolbar admin-toolbar">
          <form className="search-form" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              aria-label="Search users"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name or email"
            />
            <button
              className="button button-small button-outline"
              type="submit"
            >
              Search
            </button>
          </form>
          <label className="admin-filter">
            <span>Role</span>
            <select
              className="form-input"
              aria-label="Filter by role"
              value={filter}
              onChange={(event) => {
                setPage(1);
                setFilter(event.target.value as 'all' | UserRole);
              }}
            >
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option value={role} key={role}>
                  {role[0]?.toUpperCase()}
                  {role.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <LoadingState label="Loading user accounts" />
        ) : users.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Change role</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.id}>
                    <td data-label="Name">
                      {account.name}
                      {account.id === user?.id && (
                        <span className="admin-you"> (you)</span>
                      )}
                    </td>
                    <td data-label="Email">{account.email}</td>
                    <td data-label="Role">
                      <span className="role-label">{account.role}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`status-pill ${account.suspendedAt ? 'status-neutral' : 'status-green'}`}>
                        {account.suspendedAt ? 'Suspended' : 'Active'}
                      </span>
                      {account.id !== user?.id && (
                        <button
                          className="button button-outline button-small"
                          disabled={busyUserId !== null}
                          onClick={() =>
                            void setSuspension(account, !account.suspendedAt)
                          }
                        >
                          {account.suspendedAt ? 'Restore' : 'Suspend'}
                        </button>
                      )}
                    </td>
                    <td data-label="Change role">
                      <div className="admin-role-action">
                        <select
                          className="form-input"
                          aria-label={`Role for ${account.name}`}
                          value={account.role}
                          disabled={
                            busyUserId !== null || account.id === user?.id
                          }
                          onChange={(event) =>
                            void changeRole(
                              account,
                              event.target.value as UserRole,
                            )
                          }
                        >
                          {roleOptions.map((role) => (
                            <option value={role} key={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        {busyUserId === account.id && (
                          <span role="status">Saving…</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Details">
                      <button
                        className="button button-outline button-small"
                        onClick={() => void viewDetails(account)}
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No users found"
            description={
              search || filter !== 'all'
                ? 'Try another search or role filter.'
                : 'Registered accounts will appear here.'
            }
          />
        )}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              className="button button-outline button-small"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ArrowLeft size={14} /> Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="button button-outline button-small"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        )}
      </section>

      {(detailsLoading || detailsError || selectedUser) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSelectedUser(null);
            setDetailsError('');
          }}
        >
          <section
            className="content-card admin-user-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <h2 id="account-details-title">Account details</h2>
                <p>Basic account information available to administrators.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close account details"
                onClick={() => {
                  setSelectedUser(null);
                  setDetailsError('');
                }}
              >
                <X size={18} />
              </button>
            </div>
            {detailsLoading && <LoadingState label="Loading account details" />}
            {detailsError && <ErrorNotice message={detailsError} />}
            {selectedUser && (
              <dl className="admin-details-list">
                <dt>Name</dt>
                <dd>{selectedUser.name}</dd>
                <dt>Email</dt>
                <dd>{selectedUser.email}</dd>
                <dt>Role</dt>
                <dd>{selectedUser.role}</dd>
                <dt>Status</dt>
                <dd>{selectedUser.suspendedAt ? 'Suspended' : 'Active'}</dd>
                <dt>Registered</dt>
                <dd>{new Date(selectedUser.createdAt).toLocaleString()}</dd>
                <dt>Account ID</dt>
                <dd>{selectedUser.id}</dd>
              </dl>
            )}
          </section>
        </div>
      )}

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h2>Role-change history</h2>
            <p>Recent administrator actions and affected accounts.</p>
          </div>
        </div>
        {logs.length ? (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Administrator</th>
                    <th scope="col">Account</th>
                    <th scope="col">Role change</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td data-label="When">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td data-label="Administrator">
                        {log.actorName}{' '}
                        <span className="admin-muted">({log.actorEmail})</span>
                      </td>
                      <td data-label="Account">
                        {log.targetName}{' '}
                        <span className="admin-muted">({log.targetEmail})</span>
                      </td>
                      <td data-label="Role change">
                        {log.previousRole}{' '}
                        <ArrowRight size={13} aria-label="changed to" />{' '}
                        {log.newRole}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditPagination && auditPagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="button button-outline button-small"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((value) => value - 1)}
                >
                  <ArrowLeft size={14} /> Previous
                </button>
                <span>
                  Page {auditPagination.page} of {auditPagination.totalPages}
                </span>
                <button
                  className="button button-outline button-small"
                  disabled={auditPage >= auditPagination.totalPages}
                  onClick={() => setAuditPage((value) => value + 1)}
                >
                  Next <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No role changes recorded"
            description="Successful role changes will appear here."
          />
        )}
      </section>
    </div>
  );
}
