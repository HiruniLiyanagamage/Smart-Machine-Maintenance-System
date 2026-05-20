import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { breakdownAPI, machineAPI } from '../services/api';
import '../styles/Breakdowns.css';

const Breakdowns = () => {
    const user = useSelector(state => state.auth.user);
    const [breakdowns, setBreakdowns] = useState([]);
    const [machines, setMachines] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showReportForm, setShowReportForm] = useState(false);
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [selectedBreakdown, setSelectedBreakdown] = useState(null);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSeverity, setFilterSeverity] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [reportForm, setReportForm] = useState({
        machine_id: '',
        description: '',
        severity: 'medium'
    });
    const [updateForm, setUpdateForm] = useState({
        status: '',
        assigned_to: '',
        resolution_notes: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setError('');
            const [breakdownsRes, machinesRes] = await Promise.all([
                breakdownAPI.getAll(),
                machineAPI.getAll()
            ]);
            setBreakdowns(breakdownsRes.data || []);
            setMachines(machinesRes.data || []);
            // Simulate staff list - in real app, fetch from API
            const staffList = breakdownsRes.data
                ?.filter(b => b.assigned_to_name)
                .map(b => ({ id: b.assigned_to, name: b.assigned_to_name }))
                .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) || [];
            setStaff(staffList);
            setLoading(false);
        } catch (err) {
            setError('Failed to load breakdowns');
            setLoading(false);
        }
    };

    const handleReportChange = (e) => {
        const { name, value } = e.target;
        setReportForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleUpdateChange = (e) => {
        const { name, value } = e.target;
        setUpdateForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            await breakdownAPI.report(reportForm);
            setSuccess('Breakdown reported successfully');
            loadData();
            setReportForm({ machine_id: '', description: '', severity: 'medium' });
            setShowReportForm(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to report breakdown');
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!selectedBreakdown) return;
        try {
            setError('');
            await breakdownAPI.updateStatus(selectedBreakdown.breakdown_id, updateForm);
            setSuccess('Breakdown updated successfully');
            loadData();
            setShowUpdateForm(false);
            setSelectedBreakdown(null);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update breakdown');
        }
    };

    const handleEdit = (breakdown) => {
        setSelectedBreakdown(breakdown);
        setUpdateForm({
            status: breakdown.status,
            assigned_to: breakdown.assigned_to || '',
            resolution_notes: breakdown.resolution_notes || ''
        });
        setShowUpdateForm(true);
    };

    const filteredBreakdowns = breakdowns.filter(b => {
        const matchesStatus = !filterStatus || b.status === filterStatus;
        const matchesSeverity = !filterSeverity || b.severity === filterSeverity;
        return matchesStatus && matchesSeverity;
    });

    // Count breakdowns by status
    const breakdownStats = {
        reported: breakdowns.filter(b => b.status === 'reported').length,
        assigned: breakdowns.filter(b => b.status === 'assigned').length,
        inProgress: breakdowns.filter(b => b.status === 'in_progress').length,
        resolved: breakdowns.filter(b => b.status === 'resolved').length,
        critical: breakdowns.filter(b => b.severity === 'critical').length
    };

    if (loading) return <div className="loading">Loading breakdowns...</div>;

    return (
        <div className="breakdowns-container">
            <div className="page-header">
                <div>
                    <h1>Machine Breakdowns</h1>
                    <p>Report and manage machine breakdown issues</p>
                </div>
                <button className="btn-primary" onClick={() => setShowReportForm(!showReportForm)}>
                    {showReportForm ? 'Cancel' : '+ Report Breakdown'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Statistics Cards */}
            <div className="stats-cards">
                <div className="stat-card reported">
                    <div className="stat-number">{breakdownStats.reported}</div>
                    <div className="stat-label">Reported</div>
                </div>
                <div className="stat-card assigned">
                    <div className="stat-number">{breakdownStats.assigned}</div>
                    <div className="stat-label">Assigned</div>
                </div>
                <div className="stat-card in-progress">
                    <div className="stat-number">{breakdownStats.inProgress}</div>
                    <div className="stat-label">In Progress</div>
                </div>
                <div className="stat-card resolved">
                    <div className="stat-number">{breakdownStats.resolved}</div>
                    <div className="stat-label">Resolved</div>
                </div>
                <div className="stat-card critical">
                    <div className="stat-number">{breakdownStats.critical}</div>
                    <div className="stat-label">Critical</div>
                </div>
            </div>

            {/* Report Form */}
            {showReportForm && (
                <div className="form-section">
                    <h2>Report Breakdown</h2>
                    <form onSubmit={handleReportSubmit} className="report-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Machine *</label>
                                <select
                                    name="machine_id"
                                    value={reportForm.machine_id}
                                    onChange={handleReportChange}
                                    required
                                >
                                    <option value="">Select Machine</option>
                                    {machines.map(m => (
                                        <option key={m.machine_id} value={m.machine_id}>
                                            {m.machine_code} - {m.machine_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Severity *</label>
                                <select
                                    name="severity"
                                    value={reportForm.severity}
                                    onChange={handleReportChange}
                                    required
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div className="form-group full-width">
                                <label>Description *</label>
                                <textarea
                                    name="description"
                                    value={reportForm.description}
                                    onChange={handleReportChange}
                                    rows="4"
                                    placeholder="Describe the breakdown issue..."
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-success">Report Breakdown</button>
                            <button type="button" className="btn-secondary" onClick={() => setShowReportForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Update Form (Admin Only) */}
            {showUpdateForm && selectedBreakdown && user?.role === 'admin' && (
                <div className="form-section">
                    <h2>Update Breakdown - {selectedBreakdown.machine_name}</h2>
                    <form onSubmit={handleUpdateSubmit} className="update-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Status *</label>
                                <select
                                    name="status"
                                    value={updateForm.status}
                                    onChange={handleUpdateChange}
                                    required
                                >
                                    <option value="reported">Reported</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assign To (Staff)</label>
                                <input
                                    type="text"
                                    name="assigned_to"
                                    value={updateForm.assigned_to}
                                    onChange={handleUpdateChange}
                                    placeholder="Staff name or ID"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Resolution Notes</label>
                                <textarea
                                    name="resolution_notes"
                                    value={updateForm.resolution_notes}
                                    onChange={handleUpdateChange}
                                    rows="4"
                                    placeholder="Add resolution details..."
                                />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-success">Update Breakdown</button>
                            <button type="button" className="btn-secondary" onClick={() => setShowUpdateForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter Section */}
            <div className="filter-section">
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Status</option>
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                </select>
                <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Severity</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>

            {/* Breakdowns Table */}
            <div className="table-container">
                <table className="breakdowns-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Machine</th>
                            <th>Reported By</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                            <th>Description</th>
                            {user?.role === 'admin' && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBreakdowns.map(breakdown => (
                            <tr key={breakdown.breakdown_id} className={`severity-${breakdown.severity}`}>
                                <td>{new Date(breakdown.report_date).toLocaleDateString()}</td>
                                <td><strong>{breakdown.machine_code}</strong><br/>{breakdown.machine_name}</td>
                                <td>{breakdown.reported_by_name}</td>
                                <td>
                                    <span className={`badge severity-${breakdown.severity}`}>
                                        {breakdown.severity.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge status-${breakdown.status}`}>
                                        {breakdown.status.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                </td>
                                <td>{breakdown.assigned_to_name || '-'}</td>
                                <td>{breakdown.description.substring(0, 40)}...</td>
                                {user?.role === 'admin' && (
                                    <td className="actions">
                                        <button className="btn-sm btn-info" onClick={() => handleEdit(breakdown)}>
                                            ✏️ Update
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredBreakdowns.length === 0 && (
                <div className="empty-state">No breakdowns found</div>
            )}
        </div>
    );
};

export default Breakdowns;
