import { useEffect, useState } from 'react';
import { getSpareParts, createPartRequest, getPartRequests } from '../../utils/api';
import { SparePart, PartRequest, User } from '../../types';

interface Props {
  user: User;
}

export default function StaffSpareParts({ user }: Props) {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [requestAmount, setRequestAmount] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const [partsRes, reqRes] = await Promise.all([
        getSpareParts(),
        getPartRequests()
      ]);
      setParts(partsRes.parts);
      // Only show this staff's requests
      setRequests(reqRes.requests.filter((r: PartRequest) => r.staffId === user.id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openRequest = (p: SparePart) => {
    setSelectedPart(p);
    setRequestAmount(1);
    setShowRequestModal(true);
  };

  const submitRequest = async () => {
    if (!selectedPart || requestAmount <= 0) return;
    if (requestAmount > selectedPart.currentStock) {
      setError(`Cannot request more than available stock (${selectedPart.currentStock}).`);
      return;
    }
    try {
      await createPartRequest({
        partId: selectedPart.id,
        partName: selectedPart.name,
        amount: requestAmount
      });
      setShowRequestModal(false);
      setSuccess('Part request submitted successfully.');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"/><span>Loading inventory…</span></div>;

  const pendingRequests = requests.filter(r => r.status === 'Pending');
  const pastRequests = requests.filter(r => r.status !== 'Pending');

  return (
    <div>
      {error && <div className="alert alert-danger mb-4">{error}<button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}
      {success && <div className="alert alert-success mb-4">{success}<button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button></div>}

      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Spare Parts Stock</h2>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>View available parts and request from admin</div>
        </div>
      </div>

      <div className="table-wrapper mb-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Part Number</th>
              <th>Location</th>
              <th>Available Stock</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id}>
                <td className="cell-primary">{p.name}</td>
                <td>{p.partNumber}</td>
                <td>{p.location}</td>
                <td>
                  <span className={`badge ${p.currentStock <= p.minimumStock ? 'badge-danger' : 'badge-success'}`}>
                    {p.currentStock} in stock
                  </span>
                </td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => openRequest(p)} disabled={p.currentStock === 0}>
                    {p.currentStock === 0 ? 'Out of Stock' : 'Request Item'}
                  </button>
                </td>
              </tr>
            ))}
            {parts.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No spare parts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {requests.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            My Requests ({requests.length})
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requested On</th>
                  <th>Part Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="cell-primary">{r.partName}</td>
                    <td>{r.amount}</td>
                    <td>
                      {r.status === 'Pending' && <span className="badge badge-warning">⏳ Pending</span>}
                      {r.status === 'Approved' && <span className="badge badge-success">✅ Approved</span>}
                      {r.status === 'Rejected' && <span className="badge badge-danger">❌ Rejected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showRequestModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowRequestModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">📦 Request Part</span>
              <button className="modal-close" onClick={() => setShowRequestModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: 13 }}>
                Part: <strong>{selectedPart?.name}</strong><br />
                Available Stock: <strong>{selectedPart?.currentStock}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">Amount Required</label>
                <input 
                  className="form-input" 
                  type="number" 
                  min="1" 
                  max={selectedPart?.currentStock || 1} 
                  value={requestAmount} 
                  onChange={e => setRequestAmount(parseInt(e.target.value))} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitRequest}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
