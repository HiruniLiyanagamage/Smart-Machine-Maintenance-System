import { useEffect, useState } from 'react';
import { getBreakdowns, createBreakdown, updateBreakdown, getMachines, getStaffList, submitBreakdown, respondToBreakdownAssignment, getMaintenanceTasks } from '../../utils/api';
import { BreakdownReport, Machine, StaffMember, User, MaintenanceTask } from '../../types';

interface Props { user: User; }

const priorityBadge = (p: string) => {
  if (p === 'Critical') return <span className="badge badge-danger">🔴 Critical</span>;
  if (p === 'High')     return <span className="badge badge-warning">🟠 High</span>;
  if (p === 'Medium')   return <span className="badge badge-info">🔵 Medium</span>;
  return <span className="badge badge-neutral">⚪ Low</span>;
};
const statusBadge = (s: string) => {
  if (s === 'Resolved')    return <span className="badge badge-success">✅ Resolved</span>;
  if (s === 'In Progress') return <span className="badge badge-info">🔄 In Progress</span>;
  return <span className="badge badge-warning">⏳ Pending</span>;
};

export default function BreakdownReporting({ user }: Props) {
  const [breakdowns, setBreakdowns] = useState<BreakdownReport[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'assigned'>('all');

  const [showReport, setShowReport] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [selected, setSelected] = useState<BreakdownReport | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [completionLevel, setCompletionLevel] = useState(100);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [breakdownToReject, setBreakdownToReject] = useState<BreakdownReport | null>(null);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');

  const [form, setForm] = useState({ machineId: '', description: '', priority: 'Medium' as any });
  const [upForm, setUpForm] = useState({ status: 'Pending' as any, assignedTo: [] as StaffMember[], resolution: '' });

  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';
  const userName = user.user_metadata?.name || (user as any).name || user.email;

  const load = async () => {
    setLoading(true);
    try {
      const [{ breakdowns: bd }, { machines: mc }, { staff: st }, { tasks: td }] = await Promise.all([
        getBreakdowns(),
        getMachines(),
        getStaffList(),
        getMaintenanceTasks()
      ]);
      setBreakdowns(bd.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()));
      setMachines(mc);
      setStaffList(st);
      setTasks(td);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleReport = async () => {
    try {
      const machine = machines.find(m => m.id === form.machineId);
      await createBreakdown({ ...form, machineName: machine?.name });
      setShowReport(false);
      setForm({ machineId: '', description: '', priority: 'Medium' });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  const openUpdate = (b: BreakdownReport) => {
    if (b.status === 'Resolved') {
      setExpanded(b.id);
      return;
    }
    setSelected(b);
    const userComp = b.completions?.[user.id];
    setUpForm({ status: b.status, assignedTo: b.assignedTo || [], resolution: userComp?.notes || b.resolution || '' });
    setServiceDate(new Date().toISOString().split('T')[0]);
    setCompletionLevel(userComp?.completion_level || 0);
    setShowUpdate(true);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    if (selected.status === 'Resolved') {
      setError('Resolved breakdowns cannot be edited. Open details to view them.');
      return;
    }
    try {
      if (isAdmin) {
        const updates: any = { ...upForm };
        if (upForm.status === 'Resolved' && !selected.resolvedAt) updates.resolvedAt = new Date().toISOString();
        await updateBreakdown(selected.id, updates);
      } else {
        await submitBreakdown(selected.id, upForm.resolution, completionLevel, undefined, serviceDate);
      }
      setShowUpdate(false); load();
    } catch (e: any) { setError(e.message); }
  };

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading breakdowns…</span></div>;

  const isAssignedToCurrent = (b: BreakdownReport) =>
    b.assignedTo?.some(a => a.id === user.id || a.email === user.email) ?? false;

  const getStaffWorkload = (sId: string) => {
    const activeTasksCount = tasks.filter(t => t.status !== 'Completed' && t.assignedTo?.some(a => a.id === sId)).length;
    const activeBdsCount = breakdowns.filter(b => b.status !== 'Resolved' && b.assignedTo?.some(a => a.id === sId)).length;
    const completedTasksCount = tasks.filter(t => t.status === 'Completed' && t.assignedTo?.some(a => a.id === sId)).length;
    const completedBdsCount = breakdowns.filter(b => b.status === 'Resolved' && b.assignedTo?.some(a => a.id === sId)).length;
    return {
      active: activeTasksCount + activeBdsCount,
      completed: completedTasksCount + completedBdsCount
    };
  };

  const myAssignedBreakdowns = breakdowns.filter(b => isAssignedToCurrent(b));
  const activeMyAssigned = myAssignedBreakdowns.filter(b => b.status !== 'Resolved');

  // For KPI cards: admin sees all, staff sees only their own
  const kpiSource = isAdmin ? breakdowns : myAssignedBreakdowns;
  const pending   = kpiSource.filter(b => b.status === 'Pending');
  const inProg    = kpiSource.filter(b => b.status === 'In Progress');
  const resolved  = kpiSource.filter(b => b.status === 'Resolved');

  const displayBreakdowns = !isAdmin
    ? myAssignedBreakdowns
    : breakdowns;

  const toggleStaff = (s: StaffMember) => {
    const already = upForm.assignedTo.some(x => x.id === s.id);
    setUpForm({ ...upForm, assignedTo: already ? upForm.assignedTo.filter(x => x.id !== s.id) : [...upForm.assignedTo, s] });
  };

  return (
    <div>
      {error && <div className="alert alert-danger mb-4">{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      {/* Staff banner if assigned breakdowns */}
      {!isAdmin && activeMyAssigned.length > 0 && (
        <div className="alert alert-warning mb-4">
          🔥 You have <strong>{activeMyAssigned.length} breakdown report(s)</strong> assigned to you for resolution.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3 flex-wrap gap-3">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,auto)', gap: 12, marginBottom: 0 }}>
          <div className="stat-card red" style={{ padding: '12px 16px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label" style={{ fontSize: 10 }}>Pending</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{pending.length}</div>
            </div>
            <div className="stat-icon" style={{ width: 36, height: 36, fontSize: 18 }}>⏳</div>
          </div>
          <div className="stat-card yellow" style={{ padding: '12px 16px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label" style={{ fontSize: 10 }}>In Progress</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{inProg.length}</div>
            </div>
            <div className="stat-icon" style={{ width: 36, height: 36, fontSize: 18 }}>🔄</div>
          </div>
          <div className="stat-card green" style={{ padding: '12px 16px' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="stat-label" style={{ fontSize: 10 }}>Resolved</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{resolved.length}</div>
            </div>
            <div className="stat-icon" style={{ width: 36, height: 36, fontSize: 18 }}>✅</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-danger" onClick={() => { setForm({ machineId: '', description: '', priority: 'Medium' }); setShowReport(true); }}>
            ⚠️ Report Breakdown
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Machine</th>
              <th>Description</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Reported By</th>
              <th>Reported At</th>
              <th>Assigned Staff</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayBreakdowns.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="table-empty">
                  <div className="empty-icon">✅</div>
                  {viewFilter === 'assigned'
                    ? 'No breakdowns currently assigned to you!'
                    : 'No breakdown reports. All machines operating normally!'}
                </div>
              </td></tr>
            ) : displayBreakdowns.map(b => {
              const assignedToMe = isAssignedToCurrent(b);
              const isResolved = b.status === 'Resolved';
              const canEdit = !isResolved && (isAdmin || assignedToMe);
              return (
                <tr key={b.id} style={{ opacity: b.status === 'Resolved' ? 0.7 : 1 }}>
                  <td className="cell-primary">{b.machineName || b.machineId?.slice(0, 8)}</td>
                  <td style={{ maxWidth: 220 }}>
                    <span title={b.description}>{b.description.length > 60 ? b.description.substring(0, 60) + '…' : b.description}</span>
                  </td>
                  <td>{priorityBadge(b.priority)}</td>
                  <td>{statusBadge(b.status)}</td>
                  <td>
                    {(() => {
                      const r = b.reportedBy;
                      if (!r) return 'Unknown';
                      const match = staffList.find(s => s.email?.toLowerCase() === r.toLowerCase() || s.name?.toLowerCase() === r.toLowerCase());
                      return match ? match.name : r;
                    })()}
                  </td>
                  <td>{new Date(b.reportedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {b.assignedTo && b.assignedTo.length > 0 ? b.assignedTo.map(s => {
                        const compLevel = b.completions?.[s.id]?.completion_level || 0;
                        const isDone = b.completions?.[s.id]?.submitted && compLevel === 100;
                        const acceptStatus = b.completions?.[s.id]?.acceptanceStatus;
                        const rejectionReason = b.completions?.[s.id]?.rejectionReason;

                        let badgeClass = 'badge-neutral';
                        let label = `👤 ${s.name}`;
                        if (acceptStatus === 'Accepted') {
                          badgeClass = 'badge-info';
                          label = `👍 ${s.name} (Accepted)`;
                        } else if (acceptStatus === 'Rejected') {
                          badgeClass = 'badge-danger';
                          label = `👎 ${s.name} (Rejected)`;
                        }
                        if (isDone) {
                          badgeClass = 'badge-success';
                          label = `✅ ${s.name}`;
                        } else if (compLevel > 0) {
                          badgeClass = 'badge-warning';
                          label = `🔄 ${s.name} (${compLevel}%)`;
                        }

                        return (
                          <span key={s.id} className={`badge ${badgeClass}`} style={{fontSize: 11}} title={rejectionReason ? `Reason: ${rejectionReason}` : ''}>
                            {label}
                          </span>
                        );
                      }) : (
                        <span className="text-muted" style={{ fontStyle: 'italic', fontSize: 12 }}>Unassigned</span>
                      )}
                    </div>
                  </td>
                  <td style={{ minWidth: 150, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                      {!isResolved && !isAdmin && assignedToMe && !b.completions?.[user.id]?.acceptanceStatus ? (
                        <>
                          <button 
                            className="btn btn-success btn-sm" 
                            style={{ padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                            onClick={async () => {
                              try {
                                await respondToBreakdownAssignment(b.id, 'Accepted');
                                load();
                              } catch (e: any) { setError(e.message); }
                            }}
                          >
                            👍 Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            style={{ padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setBreakdownToReject(b);
                              setRejectReason('');
                              setShowReject(true);
                            }}
                          >
                            👎 Reject
                          </button>
                        </>
                      ) : (
                        canEdit && (
                          (!isAdmin && b.completions?.[user.id]?.acceptanceStatus !== 'Accepted') ? null :
                          (!isAdmin && b.completions?.[user.id]?.completion_level === 100) ? null : (
                            <button className="btn-icon" onClick={() => openUpdate(b)} title={isAdmin ? "Update / Assign Breakdown" : "Update Status"}>✏️</button>
                          )
                        )
                      )}
                      {!canEdit && !assignedToMe && !isResolved && <span className="text-muted" style={{ fontSize: 12 }}>—</span>}
                      <button className="expand-btn" onClick={() => setExpanded(expanded === b.id ? null : b.id)} title="Details">
                        {expanded === b.id ? '▲' : '▼'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded details below the table for better view */}
      {expanded && (
        <div className="modal-overlay" onClick={() => setExpanded(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Breakdown Details</span>
              <button className="modal-close" onClick={() => setExpanded(null)}>✕</button>
            </div>
            <div className="modal-body">
              {(() => {
                const b = displayBreakdowns.find(x => x.id === expanded);
                if (!b) return null;
                return (
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      <strong>Description:</strong> {b.description}
                    </div>
                    {b.resolution && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        <strong>Resolution:</strong> {b.resolution}
                      </div>
                    )}
                    {Object.entries(b.completions || {}).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Submitted completions:</div>
                        {Object.entries(b.completions!).filter(([, c]: any) => c.submitted).map(([uid, c]: any) => (
                          <div key={uid} className="flex items-start gap-2 mb-2">
                            <span style={{ color: 'var(--accent)', fontSize: 14 }}>{c.completion_level === 100 ? '✅' : '🔄'}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.submittedByName} <span style={{fontSize:10, color:'var(--text-muted)'}}>({c.completion_level || 100}%)</span></div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(c.submittedAt).toLocaleString()}{c.notes ? ` — "${c.notes}"` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReport(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">⚠️ Report a Breakdown</span>
              <button className="modal-close" onClick={() => setShowReport(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Machine *</label>
                <select className="form-select" value={form.machineId} onChange={e => setForm({...form, machineId: e.target.value})} required>
                  <option value="">— Select Machine —</option>
                  {machines.filter(m => !m.condemned).map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.modelNumber}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the breakdown in detail…" required />
              </div>
              <div className="form-group">
                <label className="form-label">Priority *</label>
                <select className="form-select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReport(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReport}>⚠️ Submit Report</button>
            </div>
          </div>
        </div>
      )}

      {/* Update / Assign Modal */}
      {showUpdate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpdate(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">✏️ {isAdmin ? 'Update / Assign Breakdown' : 'Update Resolution'}</span>
              <button className="modal-close" onClick={() => setShowUpdate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                Machine: <strong>{selected?.machineName}</strong> · Reported by: <strong>{selected?.reportedBy}</strong> ({selected ? new Date(selected.reportedAt).toLocaleDateString() : ''})
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={upForm.status} onChange={e => setUpForm({...upForm, status: e.target.value as any})}>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {/* Staff selection dropdown for Admin */}
              {isAdmin ? (
                <div className="form-group">
                  <label className="form-label">Assign To (Staff / Group)</label>
                  
                  {/* Role filtering dropdown */}
                  <div style={{ marginBottom: 12 }}>
                    <select 
                      className="form-select" 
                      value={selectedRoleFilter} 
                      onChange={e => setSelectedRoleFilter(e.target.value)}
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    >
                      <option value="All">🔍 Filter by Specialization / Role (All)</option>
                      {Array.from(new Set(staffList.map(s => s.role).filter(Boolean))).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="multi-select-list">
                    {staffList.filter(s => selectedRoleFilter === 'All' || s.role === selectedRoleFilter).length === 0 ? (
                      <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>No staff found for this role.</div>
                    ) : staffList.filter(s => selectedRoleFilter === 'All' || s.role === selectedRoleFilter).map(s => {
                      const checked = upForm.assignedTo.some(x => x.id === s.id);
                      const rejected = checked && selected?.completions?.[s.id]?.acceptanceStatus === 'Rejected';
                      const workload = getStaffWorkload(s.id);
                      const isBusy = workload.active >= 2;
                      const isFree = workload.active === 0;
                      const workloadColor = isFree ? 'badge-success' : isBusy ? 'badge-danger' : 'badge-warning';

                      return (
                        <div key={s.id} className={`multi-select-item${checked ? ' selected' : ''}${rejected ? ' rejected-item' : ''}`} onClick={() => toggleStaff(s)}>
                          <div className={`checkbox${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</div>
                          <div className="flex justify-between items-center w-full">
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                {s.name} {rejected && <span className="badge badge-danger" style={{fontSize:9, padding: '2px 4px', marginLeft: 6}}>👎 Rejected</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email} · <strong style={{ color: 'var(--accent-light)' }}>{s.role}</strong></div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className={`badge ${workloadColor}`} style={{ fontSize: 9, padding: '2px 6px', display: 'inline-block' }}>
                                {isFree ? '🟢 Free' : isBusy ? `🔴 Busy (${workload.active} active)` : `⏳ ${workload.active} active`}
                              </span>
                              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                                Done: {workload.completed} works
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label flex justify-between">
                    <span>Level of Completion</span>
                    <span>{completionLevel}%</span>
                  </label>
                  <input 
                    type="range" 
                    min={selected?.completions?.[user.id]?.completion_level || 0} max="100" step="5" 
                    value={completionLevel} 
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      const minLvl = selected?.completions?.[user.id]?.completion_level || 0;
                      setCompletionLevel(Math.max(minLvl, val));
                    }} 
                    style={{ width: '100%' }} 
                  />
                </div>
              )}

              {!isAdmin && (
                <div className="form-group">
                  <label className="form-label">📅 Service Date</label>
                  <input className="form-input" type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Resolution Notes</label>
                <textarea className="form-textarea" rows={3} value={upForm.resolution} onChange={e => setUpForm({...upForm, resolution: e.target.value})} placeholder="Describe actions taken to resolve or fix this breakdown…" />
              </div>

              {!isAdmin && completionLevel === 100 && (
                <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 4 }}>
                  ℹ️ Submitting 100% resolution will automatically add this record to the machine's service history for Admin review.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowUpdate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdate}>💾 {isAdmin ? 'Save Changes' : 'Submit Resolution'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReject(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--danger)' }}>👎 Reject Assignment</span>
              <button className="modal-close" onClick={() => setShowReject(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Please provide a reason for rejecting this breakdown assignment <strong>{breakdownToReject?.machineName}</strong>.
              </p>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)} 
                  placeholder="E.g., I don't have the necessary parts at the moment..." 
                  autoFocus 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowReject(false)}>Cancel</button>
              <button 
                className="btn btn-danger" 
                onClick={async () => {
                  if (!rejectReason.trim()) return setError('Please enter a reason.');
                  if (!breakdownToReject) return;
                  try {
                    await respondToBreakdownAssignment(breakdownToReject.id, 'Rejected', rejectReason);
                    setShowReject(false);
                    load();
                  } catch (e: any) { setError(e.message); }
                }}
              >
                Reject Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
