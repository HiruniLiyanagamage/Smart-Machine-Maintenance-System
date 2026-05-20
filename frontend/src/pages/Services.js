import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { serviceAPI, machineAPI } from '../services/api';
import '../styles/Services.css';

const Services = () => {
    const user = useSelector(state => state.auth.user);
    const [services, setServices] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [filterMachine, setFilterMachine] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        machine_id: '',
        service_date: new Date().toISOString().split('T')[0],
        service_type: 'Routine',
        description: '',
        cost: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setError('');
            const [servicesRes, machinesRes] = await Promise.all([
                serviceAPI.getAll(),
                machineAPI.getAll()
            ]);
            setServices(servicesRes.data || []);
            setMachines(machinesRes.data || []);
            setLoading(false);
        } catch (err) {
            setError('Failed to load services');
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
            await serviceAPI.record({
                ...formData,
                performed_by: user.user_id
            });
            setSuccess('Service recorded successfully');
            loadData();
            setFormData({
                machine_id: '',
                service_date: new Date().toISOString().split('T')[0],
                service_type: 'Routine',
                description: '',
                cost: ''
            });
            setShowForm(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to record service');
        }
    };

    const filteredServices = filterMachine 
        ? services.filter(s => s.machine_id === parseInt(filterMachine))
        : services;

    if (loading) return <div className="loading">Loading services...</div>;

    return (
        <div className="services-container">
            <div className="page-header">
                <div>
                    <h1>Service History</h1>
                    <p>Track maintenance and service schedules</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : '+ Record Service'}
                    </button>
                )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Form Section */}
            {showForm && user?.role === 'admin' && (
                <div className="form-section">
                    <h2>Record Service</h2>
                    <form onSubmit={handleSubmit} className="service-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Machine *</label>
                                <select
                                    name="machine_id"
                                    value={formData.machine_id}
                                    onChange={handleChange}
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
                                <label>Service Date *</label>
                                <input
                                    type="date"
                                    name="service_date"
                                    value={formData.service_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Service Type *</label>
                                <select
                                    name="service_type"
                                    value={formData.service_type}
                                    onChange={handleChange}
                                    required
                                >
                                    <option>Routine</option>
                                    <option>Preventive</option>
                                    <option>Corrective</option>
                                    <option>Emergency</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cost</label>
                                <input
                                    type="number"
                                    name="cost"
                                    value={formData.cost}
                                    onChange={handleChange}
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Service details..."
                                />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="btn-success">Record Service</button>
                            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter Section */}
            <div className="filter-section">
                <select
                    value={filterMachine}
                    onChange={(e) => setFilterMachine(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Machines</option>
                    {machines.map(m => (
                        <option key={m.machine_id} value={m.machine_id}>
                            {m.machine_code} - {m.machine_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Services Table */}
            <div className="table-container">
                <table className="services-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Machine</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Next Service</th>
                            <th>Cost</th>
                            <th>Performed By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredServices.map(service => (
                            <tr key={service.service_id}>
                                <td>{new Date(service.service_date).toLocaleDateString()}</td>
                                <td><strong>{service.machine_code}</strong> {service.machine_name}</td>
                                <td><span className="badge">{service.service_type}</span></td>
                                <td>{service.description || '-'}</td>
                                <td>{service.next_service_date ? new Date(service.next_service_date).toLocaleDateString() : '-'}</td>
                                <td>{service.cost ? `$${parseFloat(service.cost).toFixed(2)}` : '-'}</td>
                                <td>{service.performed_by_name || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {filteredServices.length === 0 && (
                <div className="empty-state">No services found</div>
            )}
        </div>
    );
};

export default Services;
