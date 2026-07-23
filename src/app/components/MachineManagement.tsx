import { useEffect, useState } from 'react';
import {
  getMachines, createMachine, updateMachine,
  deleteMachine, condemnMachine, getServiceRecords, addServiceRecord
} from '../../utils/api';
import { Machine, ServiceRecord, User } from '../../types';

interface Props { user: User; }

const statusBadge = (status: string) => {
  if (status === 'OK') return <span className="badge badge-success">✅ OK</span>;
  if (status === 'Service Soon') return <span className="badge badge-warning">⏰ Service Soon</span>;
  if (status === 'Overdue') return <span className="badge badge-danger">🚨 Overdue</span>;
  if (status === 'Condemned') return <span className="badge badge-neutral">🚫 Condemned</span>;
  return <span className="badge badge-neutral">{status}</span>;
};

const calcStatus = (m: Machine): Machine['status'] => {
  if (!m.nextServiceDate) return 'OK';
  const days = Math.ceil((new Date(m.nextServiceDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Overdue';
  if (days <= 7) return 'Service Soon';
  return 'OK';
};

export default function MachineManagement({ user }: Props) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewTab, setViewTab] = useState<'active' | 'condemned'>('active');

  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showService, setShowService] = useState(false);
  const [showCondemn, setShowCondemn] = useState(false);
  const [selected, setSelected] = useState<Machine | null>(null);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [condemnReason, setCondemnReason] = useState('');

  const blank = { name: '', modelNumber: '', location: '', installationDate: '', serviceInterval: 30, lastServiceDate: '', nextServiceDate: '' };
  const [form, setForm] = useState(blank);
  const blankSvc = { serviceDate: new Date().toISOString().split('T')[0], description: '', technician: '', cost: '' };
  const [svcForm, setSvcForm] = useState(blankSvc);

  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';

  const load = async () => {
    setLoading(true);
    try {
      const { machines: data } = await getMachines();
      setMachines(data.map(m => ({ ...m, status: m.condemned ? 'Condemned' : calcStatus(m) })));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setSelected(null); setForm(blank); setShowAddEdit(true); };
  const openEdit = (m: Machine) => { setSelected(m); setForm({ name: m.name, modelNumber: m.modelNumber, location: m.location, installationDate: m.installationDate, serviceInterval: m.serviceInterval, lastServiceDate: m.lastServiceDate || '', nextServiceDate: m.nextServiceDate || '' }); setShowAddEdit(true); };
  const openCondemn = (m: Machine) => { setSelected(m); setCondemnReason(''); setShowCondemn(true); };
  const openService = async (m: Machine) => {
    setSelected(m); setSvcForm(blankSvc);
    const { services } = await getServiceRecords(m.id);
    setServiceRecords(services);
    setShowService(true);
  };

  const handleSave = async () => {
    try {
      if (!form.name.trim()) {
        setError('Machine name is required.');
        return;
      }
      if (!form.modelNumber.trim()) {
        setError('Model number is required.');
        return;
      }
      if (form.installationDate && form.lastServiceDate && form.lastServiceDate < form.installationDate) {
        setError('Last service date cannot be before the installation date.');
        return;
      }
      if (form.installationDate && form.nextServiceDate && form.nextServiceDate < form.installationDate) {
        setError('Next service date cannot be before the installation date.');
        return;
      }
      if (form.lastServiceDate && form.nextServiceDate && form.nextServiceDate < form.lastServiceDate) {
        setError('Next service date cannot be before the last service date.');
        return;
      }

      const payload: any = { ...form };
      // Convert empty date strings to null so Postgres doesn't get invalid date input
      if (!payload.installationDate) payload.installationDate = null;
      if (!payload.lastServiceDate) payload.lastServiceDate = null;
      if (!payload.nextServiceDate) payload.nextServiceDate = null;
      // Auto-compute nextServiceDate:
      // Priority: lastServiceDate → installationDate → leave null
      if (!payload.nextServiceDate) {
        const baseDate = payload.lastServiceDate || payload.installationDate;
        if (baseDate) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + (payload.serviceInterval || 30));
          payload.nextServiceDate = d.toISOString().split('T')[0];
        }
      }
      if (selected) await updateMachine(selected.id, payload);
      else await createMachine(payload);
      setShowAddEdit(false); setSuccess(selected ? 'Machine updated.' : 'Machine added.'); load();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (m: Machine) => {
    if (!window.confirm(`Delete "${m.name}"? This is only allowed if the machine has NO records.`)) return;
    try { await deleteMachine(m.id); setSuccess(`"${m.name}" deleted.`); load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleCondemn = async () => {
    if (!selected || !condemnReason.trim()) { setError('Please provide a reason.'); return; }
    try { await condemnMachine(selected.id, condemnReason); setShowCondemn(false); setSuccess(`"${selected.name}" condemned. Records preserved.`); load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleAddService = async () => {
    if (!selected) return;
    try {
      if (selected.installationDate && svcForm.serviceDate < selected.installationDate) {
        setError('Service date cannot be before the installation date.');
        return;
      }
      const cost = svcForm.cost ? parseFloat(svcForm.cost) : undefined;
      await addServiceRecord(selected.id, { ...svcForm, cost });
      const nextDate = new Date(svcForm.serviceDate);
      nextDate.setDate(nextDate.getDate() + selected.serviceInterval);
      await updateMachine(selected.id, { lastServiceDate: svcForm.serviceDate, nextServiceDate: nextDate.toISOString().split('T')[0] });
      setSvcForm(blankSvc);
      await openService(selected);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const active    = machines.filter(m => !m.condemned);
  const condemned = machines.filter(m => m.condemned);
  const display   = viewTab === 'active' ? active : condemned;

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading machines…</span></div>;

  return (
    <div>
      {error   && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}<button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <div className="seg-tabs">
          <button className={`seg-tab${viewTab === 'active' ? ' active' : ''}`} onClick={() => setViewTab('active')}>
            ⚙️ Active ({active.length})
          </button>
          <button className={`seg-tab${viewTab === 'condemned' ? ' active' : ''}`} onClick={() => setViewTab('condemned')}>
            🚫 Condemned ({condemned.length})
          </button>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>+ Add Machine</button>
        )}
      </div>

      {viewTab === 'condemned' && condemned.length > 0 && (
        <div className="alert alert-info mb-4">
          🔒 Condemned machines are permanently decommissioned. Their records are preserved and <strong>cannot be deleted</strong>.
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Machine Name</th>
              <th>Model No.</th>
              <th>Location</th>
              <th>{viewTab === 'active' ? 'Last Service' : 'Condemned On'}</th>
              <th>{viewTab === 'active' ? 'Next Service' : 'Reason'}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {display.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="table-empty">
                  <div className="empty-icon">{viewTab === 'active' ? '⚙️' : '🚫'}</div>
                  {viewTab === 'active' ? 'No active machines. Add your first machine!' : 'No condemned machines.'}
                </div>
              </td></tr>
            ) : display.map(m => (
              <tr key={m.id}>
                <td className="cell-primary">
                  {m.condemned && <span style={{ marginRight: 4 }}>🚫</span>}
                  {m.name}
                </td>
                <td>{m.modelNumber}</td>
                <td>{m.location}</td>
                <td>{m.condemned
                  ? (m.condemnedAt ? new Date(m.condemnedAt).toLocaleDateString() : '—')
                  : (m.lastServiceDate ? new Date(m.lastServiceDate).toLocaleDateString() : '—')
                }</td>
                <td style={{ maxWidth: 180 }}>
                  {m.condemned
                    ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }} title={m.condemnedReason}>{m.condemnedReason?.substring(0, 50)}{(m.condemnedReason?.length || 0) > 50 ? '…' : ''}</span>
                    : (m.nextServiceDate ? new Date(m.nextServiceDate).toLocaleDateString() : '—')
                  }
                </td>
                <td>{statusBadge(m.status)}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn-icon" title="View Service History" onClick={() => openService(m)}>📋</button>
                    {isAdmin && !m.condemned && (
                      <>
                        <button className="btn-icon" title="Edit" onClick={() => openEdit(m)}>✏️</button>
                        <button className="btn-icon warning" title="Condemn Machine" onClick={() => openCondemn(m)}>🚫</button>
                        <button className="btn-icon danger" title="Delete (only if no records)" onClick={() => handleDelete(m)}>🗑️</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddEdit && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddEdit(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{selected ? '✏️ Edit Machine' : '➕ Add Machine'}</span>
              <button className="modal-close" onClick={() => setShowAddEdit(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Basic Info */}
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Machine Details</div>

              <div className="form-group">
                <label className="form-label">Machine Name *</label>
                <input className="form-input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Hydraulic Press A1" required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Model Number *</label>
                  <input className="form-input" type="text" value={form.modelNumber} onChange={e => setForm({ ...form, modelNumber: e.target.value })} placeholder="e.g. HP-2000X" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Factory Floor B" />
                </div>
              </div>

              {/* Installation Date — calendar picker */}
              <div className="form-group">
                <label className="form-label">📅 Installation Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.installationDate}
                  onChange={e => {
                    const installDate = e.target.value;
                    // If no last service date, auto-calculate next service from installation date
                    let next = form.nextServiceDate;
                    let last = form.lastServiceDate;
                    if (installDate && last && last < installDate) last = '';
                    if (installDate && next && next < installDate) next = '';
                    if (installDate && !form.lastServiceDate) {
                      const d = new Date(installDate);
                      d.setDate(d.getDate() + (form.serviceInterval || 30));
                      next = d.toISOString().split('T')[0];
                    }
                    setForm({ ...form, installationDate: installDate, lastServiceDate: last, nextServiceDate: next });
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ cursor: 'pointer' }}
                />
                {form.installationDate && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    📆 {new Date(form.installationDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                )}
              </div>

              {/* Service Schedule */}
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 10 }}>Service Schedule</div>

              <div className="form-group">
                <label className="form-label">Service Interval (days)</label>
                <input className="form-input" type="number" value={form.serviceInterval} onChange={e => {
                  const interval = parseInt(e.target.value) || 30;
                  // Recalculate next service: prefer lastServiceDate, fall back to installationDate
                  let next = form.nextServiceDate;
                  const baseDate = form.lastServiceDate || form.installationDate;
                  if (baseDate) {
                    const d = new Date(baseDate);
                    d.setDate(d.getDate() + interval);
                    next = d.toISOString().split('T')[0];
                  }
                  setForm({ ...form, serviceInterval: interval, nextServiceDate: next });
                }} min={1} placeholder="30" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>How often this machine needs servicing</div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">🔧 Last Service Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.lastServiceDate}
                    min={form.installationDate || undefined}
                    max={new Date().toISOString().split('T')[0]}
                    style={{ cursor: 'pointer' }}
                    onChange={e => {
                      const lastDate = e.target.value;
                      // Auto-calculate next service date
                      let next = form.nextServiceDate;
                      if (lastDate) {
                        const d = new Date(lastDate);
                        d.setDate(d.getDate() + (form.serviceInterval || 30));
                        next = d.toISOString().split('T')[0];
                      }
                      setForm({ ...form, lastServiceDate: lastDate, nextServiceDate: next });
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Leave blank if never serviced yet</div>
                </div>
                <div className="form-group">
                  <label className="form-label">📅 Next Service Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.nextServiceDate}
                    min={form.lastServiceDate || form.installationDate || undefined}
                    style={{ cursor: 'pointer' }}
                    onChange={e => setForm({ ...form, nextServiceDate: e.target.value })}
                  />
                  {form.nextServiceDate && (
                    <div style={{ fontSize: 11, color: 'var(--accent-light)', marginTop: 4 }}>
                      ✅ Auto-calculated from {form.lastServiceDate ? 'Last Service' : 'Installation Date'} + {form.serviceInterval} days
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{selected ? 'Update' : 'Create'} Machine</button>
            </div>
          </div>
        </div>
      )}

      {/* Condemn Modal */}
      {showCondemn && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCondemn(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title" style={{ color: 'var(--warning)' }}>🚫 Condemn Machine</span>
              <button className="modal-close" onClick={() => setShowCondemn(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning mb-4">
                Condemning <strong>{selected?.name}</strong> will permanently decommission it. All records are preserved. <strong>This cannot be undone.</strong>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for Condemnation *</label>
                <textarea className="form-textarea" rows={3} value={condemnReason} onChange={e => setCondemnReason(e.target.value)} placeholder="e.g. Beyond economical repair, replaced by newer model…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCondemn(false)}>Cancel</button>
              <button className="btn btn-warning" onClick={handleCondemn}>🚫 Condemn Machine</button>
            </div>
          </div>
        </div>
      )}

      {/* Service History Modal */}
      {showService && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowService(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">📋 Service History — {selected?.name}</span>
              <button className="modal-close" onClick={() => setShowService(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Service Records ({serviceRecords.length})</div>
              {serviceRecords.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 13 }}>No service records yet.</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...serviceRecords].reverse().map(s => (
                    <div key={s.id} className="alert-list-item">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semi">{new Date(s.serviceDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-secondary mb-1">{s.description}</div>
                      <div className="text-xs text-muted">Technician: {s.technician}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowService(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
