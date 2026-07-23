import { useEffect, useState } from 'react';
import {
  getMachines, getStaffList, getMaintenanceTasks,
  createMaintenanceTask, deleteMaintenanceTask, submitMaintenanceTask,
  getBreakdowns, respondToTaskAssignment
} from '../../utils/api';
import { Machine, MaintenanceTask, StaffMember, User, BreakdownReport } from '../../types';

interface Props { user: User; }

const priorityBar = (p: string) => {
  const cls = p.toLowerCase();
  return <div className={`priority-bar ${cls}`} />;
};

const priorityBadge = (p: string) => {
  if (p === 'Critical') return <span className="badge badge-danger">🔴 Critical</span>;
  if (p === 'High')     return <span className="badge badge-warning">🟠 High</span>;
  if (p === 'Medium')   return <span className="badge badge-info">🔵 Medium</span>;
  return <span className="badge badge-neutral">⚪ Low</span>;
};
const statusBadge = (s: string) => {
  if (s === 'Completed')  return <span className="badge badge-success">✅ Completed</span>;
  if (s === 'In Progress') return <span className="badge badge-info">🔄 In Progress</span>;
  return <span className="badge badge-warning">⏳ Pending</span>;
};

export default function MaintenanceAssignment({ user }: Props) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [breakdowns, setBreakdowns] = useState<BreakdownReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [completionLevel, setCompletionLevel] = useState(100);

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [taskToReject, setTaskToReject] = useState<MaintenanceTask | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');

  const blankForm = { machineId: '', title: '', description: '', priority: 'Medium' as any, scheduledDate: new Date().toISOString().split('T')[0], assignedTo: [] as StaffMember[] };
  const [form, setForm] = useState(blankForm);

  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';
  const userId = user.id;
  const userEmail = user.email;

  const load = async () => {
    setLoading(true);
    try {
      const [{ tasks: td }, { machines: md }, { staff }, { breakdowns: bd }] = await Promise.all([
        getMaintenanceTasks(),
        getMachines(),
        getStaffList(),
        getBreakdowns()
      ]);
      setTasks(td.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setMachines(md.filter(m => !m.condemned));
      setStaffList(staff);
      setBreakdowns(bd);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleStaff = (s: StaffMember) => {
    const already = form.assignedTo.some(x => x.id === s.id);
    setForm({ ...form, assignedTo: already ? form.assignedTo.filter(x => x.id !== s.id) : [...form.assignedTo, s] });
  };

  const handleCreate = async () => {
    if (!form.machineId || !form.title || form.assignedTo.length === 0) {
      setError('Fill all required fields and assign at least one staff member.');
      return;
    }
    try {
      const machine = machines.find(m => m.id === form.machineId);
      if (editingTaskId) {
        await updateMaintenanceTask(editingTaskId, { ...form, machineName: machine?.name || '' });
        setSuccess('Maintenance task updated.');
      } else {
        await createMaintenanceTask({ ...form, machineName: machine?.name || '' });
        setSuccess('Maintenance task created and assigned successfully.');
      }
      setShowCreate(false);
      setEditingTaskId(null);
      setForm(blankForm);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const openEditTask = (t: MaintenanceTask) => {
    setEditingTaskId(t.id);
    setForm({
      machineId: t.machineId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      scheduledDate: t.scheduledDate,
      assignedTo: t.assignedTo || []
    });
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this maintenance task?')) return;
    try { await deleteMaintenanceTask(id); setSuccess('Task deleted.'); load(); }
    catch (e: any) { setError(e.message); }
  };

  const [submitServiceDate, setSubmitServiceDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmitOk = async () => {
    if (!selectedTask) return;
    try {
      const r = await submitMaintenanceTask(selectedTask.id, submitNotes, completionLevel, undefined, submitServiceDate);
      setShowSubmit(false);
      if (r.allCompleted) {
        setSuccess('🎉 All staff have fully completed this task! Recorded in machine service history.');
      } else {
        setSuccess(completionLevel === 100 ? 'Your 100% completion submitted & recorded in service history!' : 'Progress updated.');
      }
      load();
    } catch (e: any) { setError(e.message); }
  };

  const isAssignedToMe = (t: MaintenanceTask) =>
    t.assignedTo?.some(a => a.id === userId || a.email === userEmail);

  const hasSubmitted = (t: MaintenanceTask) =>
    t.completions?.[userId]?.submitted && t.completions?.[userId]?.completion_level === 100;

  const completionCount = (t: MaintenanceTask) => {
    const done = Object.values(t.completions || {}).filter((c: any) => c.submitted && c.completion_level === 100).length;
    return { done, total: t.assignedTo?.length || 0 };
  };

  const completionPct = (t: MaintenanceTask) => {
    const { done, total } = completionCount(t);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

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

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading tasks…</span></div>;

  // Filter tasks for staff: only their assigned tasks
  const displayTasks = isAdmin ? tasks : tasks.filter(t => isAssignedToMe(t));
  const activeTasks    = displayTasks.filter(t => t.status !== 'Completed');
  const completedTasks = displayTasks.filter(t => t.status === 'Completed');
  const myPending = activeTasks.filter(t => !isAdmin && isAssignedToMe(t) && !hasSubmitted(t));

  return (
    <div>
      {error   && <div className="alert alert-danger mb-4">{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}
      {success && <div className="alert alert-success mb-4">{success}<button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      {/* Staff: action needed banner */}
      {!isAdmin && myPending.length > 0 && (
        <div className="alert alert-warning mb-4">
          🔔 You have <strong>{myPending.length} task(s)</strong> awaiting your OK sign-off. Please submit below.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {isAdmin ? `${activeTasks.length} active · ${completedTasks.length} completed` : `${displayTasks.length} task(s) assigned to you`}
          </div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { setForm(blankForm); setShowCreate(true); }}>
            + Assign Task
          </button>
        )}
      </div>

      {/* Active tasks */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {isAdmin ? `Active Tasks (${activeTasks.length})` : `Pending / In Progress (${activeTasks.length})`}
        </div>

        {activeTasks.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              {isAdmin ? 'No active maintenance tasks.' : 'No tasks assigned to you currently.'}
            </div>
          </div>
        ) : activeTasks.map(task => {
          const { done, total } = completionCount(task);
          const pct = completionPct(task);
          const me  = isAssignedToMe(task);
          const submitted = hasSubmitted(task);
          const exp = expanded === task.id;

          return (
            <div key={task.id} className="task-card">
              {priorityBar(task.priority)}
              <div className="task-body">
                <div className="flex justify-between items-start">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="cell-primary font-semi">{task.title}</span>
                      {priorityBadge(task.priority)}
                      {statusBadge(task.status)}
                      {!isAdmin && submitted && <span className="badge badge-success">✅ You submitted OK</span>}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      ⚙️ <strong style={{ color: 'var(--text-secondary)' }}>{task.machineName}</strong> &nbsp;·&nbsp;
                      📅 {new Date(task.scheduledDate).toLocaleDateString()}
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>👥 Completions: {done}/{total}</span>
                      <div className="progress-bar" style={{ flex: 1, maxWidth: 160 }}>
                        <div className={`progress-fill${pct === 100 ? ' complete' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>

                    {/* Assigned staff chips */}
                    <div className="flex flex-wrap gap-2">
                      {task.assignedTo?.map(s => {
                        const compLevel = task.completions?.[s.id]?.completion_level || 0;
                        const isDone = task.completions?.[s.id]?.submitted && compLevel === 100;
                        const acceptStatus = task.completions?.[s.id]?.acceptanceStatus;
                        const rejectionReason = task.completions?.[s.id]?.rejectionReason;

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
                          <span key={s.id} className={`badge ${badgeClass}`} title={rejectionReason ? `Reason: ${rejectionReason}` : ''}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" style={{ marginLeft: 12, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {!isAdmin && me && task.status !== 'Completed' && (
                      <>
                        {!task.completions?.[userId]?.acceptanceStatus ? (
                          <>
                            <button 
                              className="btn btn-success btn-sm" 
                              onClick={async () => {
                                try {
                                  await respondToTaskAssignment(task.id, 'Accepted');
                                  setSuccess('Task assignment approved/accepted!');
                                  load();
                                } catch (e: any) { setError(e.message); }
                              }}
                            >
                              👍 Approve
                            </button>
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => {
                                setTaskToReject(task);
                                setRejectReason('');
                                setShowReject(true);
                              }}
                            >
                              👎 Reject
                            </button>
                          </>
                        ) : task.completions?.[userId]?.acceptanceStatus === 'Accepted' && !submitted && (
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            const currentLvl = task.completions?.[userId]?.completion_level || 0;
                            setSelectedTask(task);
                            setSubmitNotes(task.completions?.[userId]?.notes || '');
                            setSubmitServiceDate(new Date().toISOString().split('T')[0]);
                            setCompletionLevel(currentLvl);
                            setShowSubmit(true);
                          }}>
                            ✅ Update Status
                          </button>
                        )}
                      </>
                    )}
                    <button className="expand-btn" onClick={() => setExpanded(exp ? null : task.id)} title={exp ? 'Collapse' : 'Expand'}>
                      {exp ? '▲' : '▼'}
                    </button>
                    {isAdmin && (
                      <>
                        {task.status !== 'Completed' && (
                          <button className="btn-icon" onClick={() => openEditTask(task)} title="Edit Task">✏️</button>
                        )}
                        <button className="btn-icon danger" onClick={() => handleDelete(task.id)} title="Delete task">🗑️</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {exp && (
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                    {task.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        <strong>Description:</strong> {task.description}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Created by {task.createdBy} on {new Date(task.createdAt).toLocaleDateString()}
                    </div>
                    {Object.entries(task.completions || {}).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Submitted completions:</div>
                        {Object.entries(task.completions).filter(([, c]: any) => c.submitted).map(([uid, c]: any) => (
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div>
          <hr className="divider" />
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Completed Tasks ({completedTasks.length})
          </div>
          <div className="table-wrapper" style={{ opacity: 0.8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Machine</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Scheduled</th>
                  <th>Completed On</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {completedTasks.map(t => (
                  <tr key={t.id}>
                    <td className="cell-primary">{t.title}</td>
                    <td>{t.machineName}</td>
                    <td>{priorityBadge(t.priority)}</td>
                    <td>{t.assignedTo?.map(s => s.name).join(', ') || '—'}</td>
                    <td>{new Date(t.scheduledDate).toLocaleDateString()}</td>
                    <td>{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—'}</td>
                    <td><button className="expand-btn" onClick={() => setExpanded(t.id)} title="View details">▼</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expanded && completedTasks.some(t => t.id === expanded) && (
        <div className="modal-overlay" onClick={() => setExpanded(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Task Details</span>
              <button className="modal-close" onClick={() => setExpanded(null)}>✕</button>
            </div>
            <div className="modal-body">
              {(() => {
                const task = completedTasks.find(t => t.id === expanded);
                if (!task) return null;
                return (
                  <div>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
                      Task: <strong>{task.title}</strong><br />
                      Machine: <strong>{task.machineName}</strong><br />
                      Scheduled: <strong>{new Date(task.scheduledDate).toLocaleDateString()}</strong>
                    </div>
                    {task.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        <strong>Description:</strong> {task.description}
                      </div>
                    )}
                    {Object.entries(task.completions || {}).length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Submitted completions:</div>
                        {Object.entries(task.completions).filter(([, c]: any) => c.submitted).map(([uid, c]: any) => (
                          <div key={uid} className="flex items-start gap-2 mb-2">
                            <span style={{ color: 'var(--accent)', fontSize: 14 }}>{c.completion_level === 100 ? '✅' : '🔄'}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.submittedByName} <span style={{fontSize:10, color:'var(--text-muted)'}}>({c.completion_level || 100}%)</span></div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(c.submittedAt).toLocaleString()}{c.notes ? ` - "${c.notes}"` : ''}
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

      {/* Create Task Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => {
          if (e.target === e.currentTarget) {
            setShowCreate(false);
            setEditingTaskId(null);
            setForm(blankForm);
          }
        }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">📋 {editingTaskId ? 'Edit Maintenance Task' : 'Assign Maintenance Task'}</span>
              <button className="modal-close" onClick={() => {
                setShowCreate(false);
                setEditingTaskId(null);
                setForm(blankForm);
              }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Machine *</label>
                  <select className="form-select" value={form.machineId} onChange={e => setForm({...form, machineId: e.target.value})}>
                    <option value="">— Select Machine —</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name} — {m.location}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Quarterly lubrication check" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed instructions for the assigned staff…" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority *</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                    {['Low','Medium','High','Critical'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Scheduled Date *</label>
                  <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm({...form, scheduledDate: e.target.value})} />
                </div>
              </div>

              {/* Multi staff select */}
              <div className="form-group">
                <label className="form-label">Assign To (Staff / Group) *</label>
                
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
                    <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 12 }}>No staff accounts found for this role. Create staff accounts first via the sign-up page.</div>
                  ) : staffList.filter(s => selectedRoleFilter === 'All' || s.role === selectedRoleFilter).map(s => {
                    const checked = form.assignedTo.some(x => x.id === s.id);
                    const rejected = checked && selectedTask?.completions?.[s.id]?.acceptanceStatus === 'Rejected';
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
                {form.assignedTo.length > 0 && (
                  <div className="alert alert-info mt-2">
                    ℹ️ Task becomes <strong>Completed</strong> only when all <strong>{form.assignedTo.length}</strong> assigned member(s) submit their OK (100%).
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => {
                setShowCreate(false);
                setEditingTaskId(null);
                setForm(blankForm);
              }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>📋 {editingTaskId ? 'Update Task' : 'Assign Task'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit OK Modal */}
      {showSubmit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSubmit(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">✅ Update Status</span>
              <button className="modal-close" onClick={() => setShowSubmit(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
                Task: <strong>{selectedTask?.title}</strong><br />
                Machine: <strong>{selectedTask?.machineName}</strong>
              </div>
              <div className="form-group">
                <label className="form-label flex justify-between">
                  <span>Level of Completion</span>
                  <span>{completionLevel}%</span>
                </label>
                <input 
                  type="range" 
                  min={selectedTask?.completions?.[userId]?.completion_level || 0} max="100" step="5" 
                  value={completionLevel} 
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    const minLvl = selectedTask?.completions?.[userId]?.completion_level || 0;
                    setCompletionLevel(Math.max(minLvl, val));
                  }} 
                  style={{ width: '100%' }} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">📅 Service Date</label>
                <input className="form-input" type="date" value={submitServiceDate} onChange={e => setSubmitServiceDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Completion Notes (optional)</label>
                <textarea className="form-textarea" rows={3} value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} placeholder="Any remarks about the maintenance performed…" />
              </div>
              {completionLevel === 100 && (
                <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 4 }}>
                  ℹ️ Submitting 100% completion will automatically add this record to the machine's service history for Admin review.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowSubmit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitOk}>✅ Submit</button>
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
                Please provide a reason for rejecting the task <strong>{taskToReject?.title}</strong>.
              </p>
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)} 
                  placeholder="E.g., I am currently engaged in higher priority tasks..." 
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
                  if (!taskToReject) return;
                  try {
                    await respondToTaskAssignment(taskToReject.id, 'Rejected', rejectReason);
                    setSuccess('Task assignment rejected.');
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
