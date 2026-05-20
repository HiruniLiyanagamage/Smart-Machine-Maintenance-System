import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { partsAPI } from '../services/api';
import '../styles/Parts.css';

const Parts = () => {
    const user = useSelector(state => state.auth.user);
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        part_code: '',
        part_name: '',
        description: '',
        category: '',
        unit_price: '',
        quantity_in_stock: 0,
        reorder_level: 5,
        reorder_quantity: 10,
        supplier: ''
    });

    useEffect(() => {
        loadParts();
    }, []);

    const loadParts = async () => {
        try {
            setError('');
            const response = await partsAPI.getAll();
            setParts(response.data || []);
            setLoading(false);
        } catch (err) {
            setError('Failed to load parts');
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
                await partsAPI.update(editingId, formData);
                setSuccess('Part updated successfully');
            } else {
                await partsAPI.create(formData);
                setSuccess('Part created successfully');
            }
            loadParts();
            resetForm();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save part');
        }
    };

    const handleEdit = (part) => {
        setFormData(part);
        setEditingId(part.part_id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this part?')) {
            try {
                setError('');
                await partsAPI.delete(id);
                setSuccess('Part deleted successfully');
                loadParts();
                setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
                setError('Failed to delete part');
            }
        }
    };

    const handleUpdateInventory = async (id, currentQty) => {
        const newQty = prompt('Enter new quantity:', currentQty);
        if (newQty !== null) {
            try {
                setError('');
                await partsAPI.updateInventory(id, { quantity_in_stock: parseInt(newQty) });
                setSuccess('Inventory updated successfully');
                loadParts();
                setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
                setError('Failed to update inventory');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            part_code: '',
            part_name: '',
            description: '',
            category: '',
            unit_price: '',
            quantity_in_stock: 0,
            reorder_level: 5,
            reorder_quantity: 10,
            supplier: ''
        });
        setEditingId(null);
        setShowForm(false);
    };

    const categories = [...new Set(parts.map(p => p.category).filter(Boolean))];
    const lowStockParts = parts.filter(p => p.quantity_in_stock <= p.reorder_level);
    const filteredParts = parts.filter(p => {
        const matchesSearch = p.part_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.part_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !filterCategory || p.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    if (loading) return <div className="loading">Loading parts...</div>;

    return (
        <div className="parts-container">
            <div className="page-header">
                <div>
                    <h1>Spare Parts Inventory</h1>
                    <p>Manage spare parts and inventory levels</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : '+ Add New Part'}
                    </button>
                )}
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Low Stock Alert */}
            {lowStockParts.length > 0 && (
                <div className="alert-box alert-warning">
                    <h3>⚠️ Low Stock Alert</h3>
                    <p>{lowStockParts.length} item(s) require reordering:</p>
                    <ul>
                        {lowStockParts.slice(0, 5).map(p => (
                            <li key={p.part_id}>{p.part_name} ({p.quantity_in_stock}/{p.reorder_level})</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Form Section */}
            {showForm && user?.role === 'admin' && (
                <div className="form-section">
                    <h2>{editingId ? 'Edit Part' : 'Add New Part'}</h2>
                    <form onSubmit={handleSubmit} className="part-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Part Code *</label>
                                <input
                                    type="text"
                                    name="part_code"
                                    value={formData.part_code}
                                    onChange={handleChange}
                                    required
                                    disabled={editingId}
                                />
                            </div>
                            <div className="form-group">
                                <label>Part Name *</label>
                                <input
                                    type="text"
                                    name="part_name"
                                    value={formData.part_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <input
                                    type="text"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    list="categories"
                                />
                                <datalist id="categories">
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="form-group">
                                <label>Unit Price</label>
                                <input
                                    type="number"
                                    name="unit_price"
                                    value={formData.unit_price}
                                    onChange={handleChange}
                                    step="0.01"
                                />
                            </div>
                            <div className="form-group">
                                <label>Quantity in Stock</label>
                                <input
                                    type="number"
                                    name="quantity_in_stock"
                                    value={formData.quantity_in_stock}
                                    onChange={handleChange}
                                    min="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>Reorder Level</label>
                                <input
                                    type="number"
                                    name="reorder_level"
                                    value={formData.reorder_level}
                                    onChange={handleChange}
                                    min="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>Reorder Quantity</label>
                                <input
                                    type="number"
                                    name="reorder_quantity"
                                    value={formData.reorder_quantity}
                                    onChange={handleChange}
                                    min="1"
                                />
                            </div>
                            <div className="form-group">
                                <label>Supplier</label>
                                <input
                                    type="text"
                                    name="supplier"
                                    value={formData.supplier}
                                    onChange={handleChange}
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
                                {editingId ? 'Update Part' : 'Add Part'}
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
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Parts Table */}
            <div className="table-container">
                <table className="parts-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Unit Price</th>
                            <th>Stock</th>
                            <th>Status</th>
                            <th>Supplier</th>
                            {user?.role === 'admin' && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredParts.map(part => (
                            <tr key={part.part_id}>
                                <td className="code">{part.part_code}</td>
                                <td>{part.part_name}</td>
                                <td>{part.category || '-'}</td>
                                <td>${parseFloat(part.unit_price || 0).toFixed(2)}</td>
                                <td>
                                    <strong>{part.quantity_in_stock}</strong>
                                    <small> / {part.reorder_level}</small>
                                </td>
                                <td>
                                    <span className={`badge ${part.quantity_in_stock <= part.reorder_level ? 'low-stock' : 'in-stock'}`}>
                                        {part.quantity_in_stock <= part.reorder_level ? '⚠️ Low Stock' : '✅ OK'}
                                    </span>
                                </td>
                                <td>{part.supplier || '-'}</td>
                                {user?.role === 'admin' && (
                                    <td className="actions">
                                        <button className="btn-sm btn-info" onClick={() => handleEdit(part)}>
                                            ✏️ Edit
                                        </button>
                                        <button className="btn-sm btn-warning" onClick={() => handleUpdateInventory(part.part_id, part.quantity_in_stock)}>
                                            📦 Update Stock
                                        </button>
                                        <button className="btn-sm btn-danger" onClick={() => handleDelete(part.part_id)}>
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
                Showing {filteredParts.length} of {parts.length} parts
            </div>
        </div>
    );
};

export default Parts;
