import { useEffect, useState } from 'react';
import { getDashboard, getBreakdowns, getMaintenanceTasks } from '../../utils/api';
import { DashboardStats, User, BreakdownReport, MaintenanceTask } from '../../types';

interface DashboardProps { user: User; }

export default function Dashboard({ user }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [staffBreakdowns, setStaffBreakdowns] = useState<BreakdownReport[]>([]);
  const [staffTasks, setStaffTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';
  const displayName = user.user_metadata?.name || (user as any).name || user.email;

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      if (isAdmin) {
        setStats(await getDashboard());
      } else {
        const [{ breakdowns }, { tasks }] = await Promise.all([getBreakdowns(), getMaintenanceTasks()]);
        setStaffBreakdowns(breakdowns);
        setStaffTasks(tasks);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading dashboard…</span></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  // Render Admin Dashboard
  if (isAdmin) {
    if (!stats) return <div className="alert alert-info">No data yet</div>;
    const { machineStats: ms, inventoryStats: inv, breakdownStats: bs } = stats;
    return (
      <div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.08) 100%)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          padding: '20px 24px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              👋 Welcome back, <span style={{ color: 'var(--accent-light)' }}>{displayName}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              You have full administrative access to the maintenance system.
            </div>
          </div>
          <span className="badge badge-green" style={{ fontSize: 12, padding: '5px 14px' }}>
            👔 Administrator
          </span>
        </div>

        <div className="stat-grid">
          <div className="stat-card green">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Machines OK</div>
              <div className="stat-value">{ms.ok}</div>
              <div className="stat-sub">Operational</div>
            </div>
            <div className="stat-icon">✅</div>
          </div>
          <div className="stat-card yellow">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Service Soon</div>
              <div className="stat-value">{(ms as any).serviceSoon || 0}</div>
              <div className="stat-sub">Due within 7 days</div>
            </div>
            <div className="stat-icon">⏰</div>
          </div>
          <div className="stat-card red">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Overdue</div>
              <div className="stat-value">{ms.overdue}</div>
              <div className="stat-sub">Needs immediate service</div>
            </div>
            <div className="stat-icon">🚨</div>
          </div>
          <div className="stat-card blue">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Total Machines</div>
              <div className="stat-value">{ms.total}</div>
              <div className="stat-sub">Incl. {(ms as any).condemned || 0} condemned</div>
            </div>
            <div className="stat-icon">⚙️</div>
          </div>
        </div>

        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card gray">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Total Parts</div>
              <div className="stat-value">{inv.totalParts}</div>
              <div className="stat-sub">Spare parts tracked</div>
            </div>
            <div className="stat-icon">🔩</div>
          </div>
          <div className="stat-card red">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Low Stock</div>
              <div className="stat-value">{inv.lowStock}</div>
              <div className="stat-sub">Need restocking</div>
            </div>
            <div className="stat-icon">📦</div>
          </div>
          <div className="stat-card yellow">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Pending Breakdown Reports</div>
              <div className="stat-value">{bs.pending}</div>
              <div className="stat-sub">Awaiting resolution</div>
            </div>
            <div className="stat-icon">⚠️</div>
          </div>
          <div className="stat-card blue">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label">Total Breakdowns</div>
              <div className="stat-value">{bs.total}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-icon">📋</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 8 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔩 Low Stock Alerts
                {inv.lowStock > 0 && <span className="badge badge-danger" style={{ marginLeft: 8 }}>{inv.lowStock}</span>}
              </span>
            </div>
            <div className="card-body">
              {stats.lowStockParts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>✅ All parts are well stocked</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {stats.lowStockParts.map(p => (
                    <div key={p.id} className="alert-list-item" style={{ marginBottom: 8 }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-base">{p.name}</div>
                          <div className="text-xs text-muted mt-1">#{p.partNumber} · {p.location}</div>
                        </div>
                        <span className="badge badge-danger">{p.currentStock} / {p.minimumStock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">⚠️ Pending Breakdown Reports
                {bs.pending > 0 && <span className="badge badge-warning" style={{ marginLeft: 8 }}>{bs.pending}</span>}
              </span>
            </div>
            <div className="card-body">
              {stats.pendingBreakdowns.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>✅ No pending breakdowns</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {stats.pendingBreakdowns.map(b => (
                    <div key={b.id} className="alert-list-item" style={{ marginBottom: 8 }}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-medium text-base">{b.machineName || 'Unknown Machine'}</div>
                        <span className={`badge ${b.priority === 'Critical' ? 'badge-danger' : b.priority === 'High' ? 'badge-warning' : 'badge-neutral'}`}>{b.priority}</span>
                      </div>
                      <div className="text-sm text-secondary">{b.description}</div>
                      <div className="text-xs text-muted mt-1">Reported by {b.reportedBy} · {new Date(b.reportedAt).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Staff Dashboard
  const myEmail = user.email.toLowerCase();
  const myTasks = staffTasks.filter(t => (t.assignedTo || []).some((a: any) => a.email?.toLowerCase() === myEmail || a.id === user.id));
  const myBreakdowns = staffBreakdowns.filter(b => {
    // b.assignedTo could be an array now (from DB alter) or a string
    if (Array.isArray(b.assignedTo)) {
      return b.assignedTo.some((a: any) => a.email?.toLowerCase() === myEmail || a.id === user.id);
    }
    return b.assignedTo?.toLowerCase() === myEmail || b.assignedTo?.toLowerCase() === displayName.toLowerCase();
  });

  const pendingTasks = myTasks.filter(t => {
    const comp = t.completions?.[user.id] || t.completions?.[myEmail];
    return !comp?.submitted || comp?.completion_level < 100;
  });
  const completedTasks = myTasks.filter(t => {
    const comp = t.completions?.[user.id] || t.completions?.[myEmail];
    return comp?.submitted && comp?.completion_level === 100;
  });

  const pendingBreakdowns = myBreakdowns.filter(b => b.status !== 'Resolved');
  const completedBreakdowns = myBreakdowns.filter(b => b.status === 'Resolved');

  const totalAssigned = myTasks.length + myBreakdowns.length;
  const totalPending = pendingTasks.length + pendingBreakdowns.length;
  const totalCompleted = completedTasks.length + completedBreakdowns.length;

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(2,132,199,0.08) 100%)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius)',
        padding: '20px 24px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            👋 Welcome back, <span style={{ color: 'var(--accent-light)' }}>{displayName}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Here is the summary of your assigned maintenance work.
          </div>
        </div>
        <span className="badge badge-info" style={{ fontSize: 12, padding: '5px 14px' }}>
          👷 Staff Member
        </span>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card blue">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Assigned Works</div>
            <div className="stat-value">{totalAssigned}</div>
            <div className="stat-sub">Tasks & Breakdowns</div>
          </div>
          <div className="stat-icon">📋</div>
        </div>

        <div className="stat-card yellow">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Pending Works</div>
            <div className="stat-value">{totalPending}</div>
            <div className="stat-sub">Awaiting completion</div>
          </div>
          <div className="stat-icon">⏳</div>
        </div>

        <div className="stat-card green">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Completed Works</div>
            <div className="stat-value">{totalCompleted}</div>
            <div className="stat-sub">Fully resolved</div>
          </div>
          <div className="stat-icon">✅</div>
        </div>
      </div>

      {totalPending > 0 ? (
        <div className="card mt-4">
          <div className="card-header">
            <span className="card-title">🚨 Your Pending Works</span>
          </div>
          <div className="card-body">
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {pendingBreakdowns.map(b => (
                <div key={b.id} className="alert-list-item" style={{ marginBottom: 8, borderLeft: '4px solid var(--error)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium text-base">[Breakdown] {b.machineName || 'Unknown Machine'}</div>
                    <span className="badge badge-warning">{b.priority} Priority</span>
                  </div>
                  <div className="text-sm text-secondary">{b.description}</div>
                </div>
              ))}
              {pendingTasks.map(t => (
                <div key={t.id} className="alert-list-item" style={{ marginBottom: 8, borderLeft: '4px solid var(--info)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium text-base">[Task] {t.title}</div>
                    <span className="badge badge-info">{new Date(t.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-secondary">{t.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
         <div className="alert alert-success mt-4">
           🎉 Great job! You have no pending assigned works.
         </div>
      )}
    </div>
  );
}

