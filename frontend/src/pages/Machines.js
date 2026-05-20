import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { machineAPI } from '../services/api';
import '../styles/Machines.css';

const Machines = () => {
    const user = useSelector(state => state.auth.user);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        machine_code: '',
        machine_name: '',
        description: '',
        model: '',
        manufacturer: '',
        purchase_date: '',
        location: '',
        service_interval_days: 30
    });

    useEffect(() => {
        loadMachines();
    }, []);

    const loadMachines = async () => {
        try {
            setError('');
            const response = await machineAPI.getWithStatus();
            setMachines(response.data || []);
            setLoading(false);
        } catch (err) {
            setError('Failed to load machines');
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            if (editingId) {
                await machineAPI.update(editingId, formData);
                setSuccess('Machine updated successfully');
            } else {
                await machineAPI.create(formData);
                setSuccess('Machine created successfully');
            }
            loadMachines();
            resetForm();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save machine');
        }
    };

    const handleEdit = (machine) => {
        setFormData(machine);
        setEditingId(machine.machine_id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this machine?')) {
            try {
                setError('');
                await machineAPI.delete(id);
                setSuccess('Machine deleted successfully');
                loadMachines();
                setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
                setError('Failed to delete machine');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            machine_code: '',
            machine_name: '',
            description: '',
            model: '',
            manufacturer: '',
            purchase_date: '',
            location: '',
            service_interval_days: 30
        });
        setEditingId(null);
        setShowForm(false);
    };

    const filteredMachines = machines.filter(m => {
        const matchesSearch = m.machine_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.machine_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = !filterStatus || m.service_status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    if (loading) return <div className="loading">Loading machines...</div>;

    return (
        <div className="machines-container">
            <div className="page-header">
                <div>
                    <h1>Machine Management</h1>
                    <p>Add, view, and update machine details</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : '+ Add New Machine'}
                    </button>
                )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Form Section */}
            {showForm && user?.role === 'admin' && (
                <div className="form-section">
                    <h2>{editingId ? 'Edit Machine' : 'Add New Machine'}</h2>
                    <form onSubmit={handleSubmit} className="machine-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Machine Code *</label>
                                <input
                                    type="text"
                                    name="machine_code"
                                    value={formData.machine_code}
                                    onChange={handleChange}
                                    required
                                    disabled={editingId}
                                />
                            </div>
                            <div className="form-group">
                                <label>Machine Name *</label>
                                <input
                                    type="text"
                                    name="machine_name"
                                    value={formData.machine_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input
                                    type="text"
                                    name="model"
                                    value={formData.model}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Manufacturer</label>
                                <input
                                    type="text"
                                    name="manufacturer"
                                    value={formData.manufacturer}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Purchase Date</label>
                                <input
                                    type="date"
                                    name="purchase_date"
                                    value={formData.purchase_date}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Service Interval (Days)</label>
                                <input
                                    type="number"
                                    name="service_interval_days"
                                    value={formData.service_interval_days}
                                    onChange={handleChange}
                                    min="1"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows="3"
                                />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-success">
                                {editingId ? 'Update Machine' : 'Create Machine'}
                            </button>
                            <button type="button" className="btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter Section */}
            <div className="filter-section">
                <input
                    type="text"
                    placeholder="Search by code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Service Status</option>
                    <option value="OK">OK</option>
                    <option value="Service Soon">Service Soon</option>
                    <option value="Overdue">Overdue</option>
                    <option value="New">New</option>
                </select>
            </div>

            {/* Machines Table */}
            <div className="table-container">
                <table className="machines-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Model</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Service Status</th>
                            <th>Next Service</th>
                            {user?.role === 'admin' && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMachines.map(machine => (
                            <tr key={machine.machine_id}>
                                <td className="code">{machine.machine_code}</td>
                                <td>{machine.machine_name}</td>
                                <td>{machine.model || 'N/A'}</td>
                                <td>{machine.location || 'N/A'}</td>
                                <td>
                                    <span className={`badge status-${machine.status}`}>
                                        {machine.status}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge service-${machine.service_status?.toLowerCase().replace(/ /g, '-')}`}>
                                        {machine.service_status}
                                    </span>
                                </td>
                                <td>{machine.next_service_date ? new Date(machine.next_service_date).toLocaleDateString() : 'N/A'}</td>
                                {user?.role === 'admin' && (
                                    <td className="actions">
                                        <button className="btn-sm btn-info" onClick={() => handleEdit(machine)}>
                                            ✏️ Edit
                                        </button>
                                        <button className="btn-sm btn-danger" onClick={() => handleDelete(machine.machine_id)}>
                                            🗑️ Delete
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="results-info">
                Showing {filteredMachines.length} of {machines.length} machines
            </div>
        </div>
    );
};

export default Machines;
