import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { machineAPI, serviceAPI, partsAPI, breakdownAPI, notificationAPI } from '../services/api';
import '../styles/Dashboard.css';

const Dashboard = () => {
    const user = useSelector(state => state.auth.user);
    const [machines, setMachines] = useState([]);
    const [upcomingServices, setUpcomingServices] = useState([]);
    const [overdueServices, setOverdueServices] = useState([]);
    const [lowStockParts, setLowStockParts] = useState([]);
    const [breakdownStats, setBreakdownStats] = useState({});
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        try {
            setError('');
            const [machinesRes, upcomingRes, overdueRes, lowStockRes, breakdownRes, notificationsRes] = await Promise.all([
                machineAPI.getWithStatus(),
                serviceAPI.getUpcoming().catch(() => ({ data: [] })),
                serviceAPI.getOverdue().catch(() => ({ data: [] })),
                partsAPI.getLowStock().catch(() => ({ data: [] })),
                breakdownAPI.getStats().catch(() => ({ data: {} })),
                notificationAPI.getAll().catch(() => ({ data: [] }))
            ]);

            setMachines(machinesRes.data || []);
            setUpcomingServices(upcomingRes.data || []);
            setOverdueServices(overdueRes.data || []);
            setLowStockParts(lowStockRes.data || []);
            setBreakdownStats(breakdownRes.data || {});
            setNotifications(notificationsRes.data || []);
            setLoading(false);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
            setError('Failed to load dashboard data');
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="dashboard-loading">Loading dashboard...</div>;
    }

    // Calculate machine status summary
    const machineStatusSummary = {
        active: machines.filter(m => m.service_status === 'OK').length,
        serviceSoon: machines.filter(m => m.service_status === 'Service Soon').length,
        overdue: machines.filter(m => m.service_status === 'Overdue').length,
        total: machines.length
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Welcome, {user?.first_name || user?.username}!</h1>
                <p>Dashboard Overview</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Alerts Section */}
            {(notifications.length > 0 || overdueServices.length > 0 || lowStockParts.length > 0 || breakdownStats.pending > 0) && (
                <div className="alerts-section">
                    <h2>⚠️ Alerts & Notifications</h2>
                    <div className="alerts-grid">
                        {overdueServices.length > 0 && (
                            <div className="alert-card alert-critical">
                                <div className="alert-icon">🔴</div>
                                <div className="alert-content">
                                    <h3>{overdueServices.length} Overdue Services</h3>
                                    <p>Machines require immediate attention</p>
                                    {overdueServices.slice(0, 3).map(s => (
                                        <div key={s.machine_id} className="alert-item">
                                            {s.machine_name} ({s.days_overdue} days overdue)
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {lowStockParts.length > 0 && (
                            <div className="alert-card alert-warning">
                                <div className="alert-icon">📦</div>
                                <div className="alert-content">
                                    <h3>{lowStockParts.length} Low Stock Items</h3>
                                    <p>Parts need to be reordered</p>
                                    {lowStockParts.slice(0, 3).map(p => (
                                        <div key={p.part_id} className="alert-item">
                                            {p.part_name} ({p.quantity_in_stock} units)
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {breakdownStats.pending > 0 && (
                            <div className="alert-card alert-warning">
                                <div className="alert-icon">🔧</div>
                                <div className="alert-content">
                                    <h3>{breakdownStats.pending} Pending Breakdowns</h3>
                                    <p>Breakdown reports awaiting assignment</p>
                                </div>
                            </div>
                        )}
                        {upcomingServices.length > 0 && (
                            <div className="alert-card alert-info">
                                <div className="alert-icon">📅</div>
                                <div className="alert-content">
                                    <h3>{upcomingServices.length} Services Due Soon</h3>
                                    <p>Schedule maintenance within 7 days</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Key Metrics */}
            <div className="metrics-section">
                <h2>Key Metrics</h2>
                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#4CAF50' }}>🏭</div>
                        <div className="metric-content">
                            <h3>{machineStatusSummary.total}</h3>
                            <p>Total Machines</p>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#2196F3' }}>✅</div>
                        <div className="metric-content">
                            <h3>{machineStatusSummary.active}</h3>
                            <p>Machines OK</p>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#FF9800' }}>⏰</div>
                        <div className="metric-content">
                            <h3>{machineStatusSummary.serviceSoon}</h3>
                            <p>Service Soon</p>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#F44336' }}>❌</div>
                        <div className="metric-content">
                            <h3>{machineStatusSummary.overdue}</h3>
                            <p>Overdue</p>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#9C27B0' }}>🔧</div>
                        <div className="metric-content">
                            <h3>{breakdownStats.total || 0}</h3>
                            <p>Total Breakdowns</p>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-icon" style={{ backgroundColor: '#FF5722' }}>🚨</div>
                        <div className="metric-content">
                            <h3>{breakdownStats.critical_count || 0}</h3>
                            <p>Critical Issues</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Machines Overview */}
            <div className="overview-section">
                <h2>Machine Status Overview</h2>
                <div className="table-container">
                    <table className="overview-table">
                        <thead>
                            <tr>
                                <th>Machine Code</th>
                                <th>Machine Name</th>
                                <th>Status</th>
                                <th>Service Status</th>
                                <th>Next Service</th>
                            </tr>
                        </thead>
                        <tbody>
                            {machines.slice(0, 10).map(machine => (
                                <tr key={machine.machine_id} className={`status-${machine.service_status.toLowerCase().replace(/ /g, '-')}`}>
                                    <td>{machine.machine_code}</td>
                                    <td>{machine.machine_name}</td>
                                    <td>
                                        <span className={`status-badge status-${machine.status}`}>
                                            {machine.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`service-status-badge service-${machine.service_status.toLowerCase().replace(/ /g, '-')}`}>
                                            {machine.service_status}
                                        </span>
                                    </td>
                                    <td>{machine.next_service_date ? new Date(machine.next_service_date).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {machines.length > 10 && (
                    <p className="view-more">Showing 10 of {machines.length} machines. Visit Machines page to see all.</p>
                )}
            </div>

            {/* Breakdown Statistics */}
            {user?.role === 'admin' && (
                <div className="stats-section">
                    <h2>Breakdown Statistics</h2>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Total Reports</h3>
                            <p className="stat-number">{breakdownStats.total_breakdowns || 0}</p>
                        </div>
                        <div className="stat-card pending">
                            <h3>Pending</h3>
                            <p className="stat-number">{breakdownStats.pending || 0}</p>
                        </div>
                        <div className="stat-card in-progress">
                            <h3>In Progress</h3>
                            <p className="stat-number">{breakdownStats.in_progress || 0}</p>
                        </div>
                        <div className="stat-card resolved">
                            <h3>Resolved</h3>
                            <p className="stat-number">{breakdownStats.resolved || 0}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

