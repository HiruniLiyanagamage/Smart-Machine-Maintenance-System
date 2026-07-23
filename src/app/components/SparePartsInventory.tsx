import { useEffect, useState } from 'react';
import { getSpareParts, createSparePart, updateSparePart, deleteSparePart, getPartRequests, updatePartRequestStatus } from '../../utils/api';
import { SparePart, User, PartRequest } from '../../types';

interface Props { user: User; }

export default function SparePartsInventory({ user }: Props) {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selected, setSelected] = useState<SparePart | null>(null);

  const role: 'Admin' | 'Staff' = user.user_metadata?.role || (user as any).role || 'Staff';
  const isAdmin = role === 'Admin';

  const blankForm = { name: '', partNumber: '', currentStock: 0, minimumStock: 0, location: '', unitPrice: '', supplier: '' };
  const [form, setForm] = useState(blankForm);

  const load = async () => {
    setLoading(true);
    try { 
      const [partsRes, reqsRes] = await Promise.all([getSpareParts(), getPartRequests()]);
      setParts(partsRes.parts); 
      setRequests(reqsRes.requests);
    }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setSelected(null); setForm(blankForm); setShowDialog(true); };
  const openEdit = (p: SparePart) => {
    setSelected(p);
    setForm({ name: p.name, partNumber: p.partNumber, currentStock: p.currentStock, minimumStock: p.minimumStock, location: p.location, unitPrice: p.unitPrice?.toString() || '', supplier: p.supplier || '' });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    try {
      const data = { 
        ...form, 
        currentStock: Math.max(0, parseInt(String(form.currentStock)) || 0), 
        minimumStock: Math.max(0, parseInt(String(form.minimumStock)) || 0), 
        unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined 
      };
      if (selected) await updateSparePart(selected.id, data);
      else await createSparePart(data);
      setShowDialog(false); load();
    } catch (e: any) { setError(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this spare part?')) return;
    try { await deleteSparePart(id); load(); } catch (e: any) { setError(e.message); }
  };

  const handleRequest = async (req: PartRequest, action: 'Approved' | 'Rejected') => {
    try {
      if (action === 'Approved') {
        const part = parts.find(p => p.id === req.partId);
        if (part) {
          if (part.currentStock < req.amount) {
            setError(`Cannot approve: insufficient stock for ${part.name}`);
            return;
          }
          await updateSparePart(part.id, { currentStock: part.currentStock - req.amount });
        }
      }
      await updatePartRequestStatus(req.id, action);
      load();
    } catch (e: any) { setError(e.message); }
  };

  const getStatus = (p: SparePart) => {
    if (p.currentStock <= p.minimumStock) return { label: 'Low Stock', cls: 'badge-danger' };
    if (p.currentStock <= p.minimumStock * 1.5) return { label: 'Running Low', cls: 'badge-warning' };
    return { label: 'In Stock', cls: 'badge-success' };
  };

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading spare parts…</span></div>;

  return (
    <div>
      {error && <div className="alert alert-danger mb-4">{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      {/* Toolbar */}
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Spare Part</button>
        </div>
      )}

      {/* Summary row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 20 }}>
        <div className="stat-card blue">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Total Parts</div>
            <div className="stat-value">{parts.length}</div>
          </div>
          <div className="stat-icon">🔩</div>
        </div>
        <div className="stat-card red">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Low Stock</div>
            <div className="stat-value">{parts.filter(p => p.currentStock <= p.minimumStock).length}</div>
          </div>
          <div className="stat-icon">⚠️</div>
        </div>
        <div className="stat-card green">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="stat-label">Well Stocked</div>
            <div className="stat-value">{parts.filter(p => p.currentStock > p.minimumStock * 1.5).length}</div>
          </div>
          <div className="stat-icon">✅</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Part No.</th>
              <th>Stock</th>
              <th>Min. Stock</th>
              <th>Location</th>
              <th>Unit Price</th>
              <th>Supplier</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 ? (
              <tr><td colSpan={isAdmin ? 9 : 8}>
                <div className="table-empty">
                  <div className="empty-icon">🔩</div>
                  No spare parts recorded yet. Add your first part!
                </div>
              </td></tr>
            ) : parts.map(p => {
              const st = getStatus(p);
              return (
                <tr key={p.id}>
                  <td className="cell-primary">{p.name}</td>
                  <td>{p.partNumber}</td>
                  <td style={{ fontWeight: 600, color: p.currentStock <= p.minimumStock ? 'var(--danger)' : 'var(--accent)' }}>{p.currentStock}</td>
                  <td>{p.minimumStock}</td>
                  <td>{p.location}</td>
                  <td>{p.unitPrice ? `LKR ${p.unitPrice}` : '—'}</td>
                  <td>{p.supplier || '—'}</td>
                  <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                  {isAdmin && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✏️</button>
                        <button className="btn-icon danger" onClick={() => handleDelete(p.id)} title="Delete">🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isAdmin && requests.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Pending Staff Requests ({requests.filter(r => r.status === 'Pending').length})
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requested On</th>
                  <th>Staff Member</th>
                  <th>Part Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>{r.staffName}</td>
                    <td className="cell-primary">{r.partName}</td>
                    <td>{r.amount}</td>
                    <td>
                      {r.status === 'Pending' && <span className="badge badge-warning">⏳ Pending</span>}
                      {r.status === 'Approved' && <span className="badge badge-success">✅ Approved</span>}
                      {r.status === 'Rejected' && <span className="badge badge-danger">❌ Rejected</span>}
                    </td>
                    <td>
                      {r.status === 'Pending' && (
                        <div className="flex gap-2">
                          <button className="btn btn-primary btn-sm" onClick={() => handleRequest(r, 'Approved')}>✅ Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRequest(r, 'Rejected')}>❌ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showDialog && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDialog(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{selected ? '✏️ Edit Spare Part' : '➕ Add Spare Part'}</span>
              <button className="modal-close" onClick={() => setShowDialog(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Part Name *</label><input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Part Number *</label><input className="form-input" value={form.partNumber} onChange={e => setForm({...form, partNumber: e.target.value})} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Current Stock *</label><input className="form-input" type="number" min="0" value={form.currentStock} onChange={e => setForm({...form, currentStock: Math.max(0, parseInt(e.target.value) || 0)})} /></div>
                <div className="form-group"><label className="form-label">Minimum Stock *</label><input className="form-input" type="number" min="0" value={form.minimumStock} onChange={e => setForm({...form, minimumStock: Math.max(0, parseInt(e.target.value) || 0)})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Location *</label><input className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Unit Price (LKR)</label><input className="form-input" type="number" value={form.unitPrice} onChange={e => setForm({...form, unitPrice: e.target.value})} placeholder="0.00" /></div>
                <div className="form-group"><label className="form-label">Supplier</label><input className="form-input" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>{selected ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
