import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Shield,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { adminApi, type AdminDashboardStats } from '../api/admin.api';
import {
  EmptyState,
  ErrorNotice,
  LoadingState,
} from '../components/ui/Feedback';
import { useAuth } from '../contexts/AuthContext';

export function AdminOverviewPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setStats(await adminApi.getDashboardStats(token));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 403
          ? 'Administrator permission is required to view dashboard statistics.'
          : 'Unable to load administrator dashboard data.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading administrator overview" />;

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <div className="section-kicker">ADMINISTRATION</div>
          <h2>Campus overview</h2>
          <p>Current account and academic resource totals.</p>
        </div>
        <Link className="button button-outline" to="/admin/users">
          Manage users <ArrowRight size={16} />
        </Link>
      </div>

      {error && (
        <div>
          <ErrorNotice message={error} />
          <button
            className="button button-outline button-small"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      )}

      {stats && (
        <>
          <section className="stats-grid" aria-label="Campus statistics">
            <StatCard
              label="Total users"
              value={stats.totalUsers}
              icon={<Users size={19} />}
            />
            <StatCard
              label="Students"
              value={stats.students}
              icon={<GraduationCap size={19} />}
            />
            <StatCard
              label="Faculty"
              value={stats.faculty}
              icon={<Users size={19} />}
            />
            <StatCard
              label="Administrators"
              value={stats.administrators}
              icon={<Shield size={19} />}
            />
            <StatCard
              label="Courses"
              value={stats.courses}
              icon={<BookOpen size={19} />}
            />
            <StatCard
              label="Assignments"
              value={stats.assignments}
              icon={<ClipboardList size={19} />}
            />
            <StatCard
              label="Quizzes"
              value={stats.quizzes}
              icon={<GraduationCap size={19} />}
            />
          </section>

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>Recent registrations</h2>
                <p>Most recently created campus accounts.</p>
              </div>
              <Link className="text-link" to="/admin/users">
                All users <ArrowRight size={14} />
              </Link>
            </div>
            {stats.recentUsers.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUsers.map((account) => (
                      <tr key={account.id}>
                        <td data-label="Name">{account.name}</td>
                        <td data-label="Email">{account.email}</td>
                        <td data-label="Role">{account.role}</td>
                        <td data-label="Registered">
                          {new Date(account.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No user registrations yet"
                description="New accounts will appear here."
              />
            )}
          </section>

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h2>Recent role changes</h2>
                <p>Latest administrative role updates.</p>
              </div>
              <Link className="text-link" to="/admin/users">
                Role history <ArrowRight size={14} />
              </Link>
            </div>
            {stats.recentRoleChanges.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Administrator</th>
                      <th scope="col">Account</th>
                      <th scope="col">Role change</th>
                      <th scope="col">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentRoleChanges.map((change) => (
                      <tr key={change.id}>
                        <td data-label="Administrator">{change.actorName}</td>
                        <td data-label="Account">{change.targetName}</td>
                        <td data-label="Role change">
                          {change.previousRole}{' '}
                          <ArrowRight size={13} aria-label="changed to" />{' '}
                          {change.newRole}
                        </td>
                        <td data-label="When">
                          {new Date(change.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No role changes recorded"
                description="Role updates will appear here."
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon stat-violet">{icon}</div>
      <div className="stat-label">{label}</div>
      <strong>{value.toLocaleString()}</strong>
      <span>Current database total</span>
    </article>
  );
}
