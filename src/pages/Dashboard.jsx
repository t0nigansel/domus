import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Home, AlertCircle, CheckCircle, Paperclip, File, Trash2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { useData } from '../context/DataContext';
import './Dashboard.css';

const Dashboard = () => {
    const { issues, properties } = useData();
    const navigate = useNavigate();

    // Calculate stats
    const stats = useMemo(() => {
        const totalProperties = properties.length;
        const occupied = properties.filter(p => p.status === 'Occupied').length;
        const maintenance = properties.filter(p => p.status === 'Maintenance').length;
        const activeIssuesCount = issues.filter(i => i.status === 'Open').length;

        // Calculate Revenue (sum of total rent for occupied units)
        const rentedProperties = properties.filter(p => p.status === 'Occupied' && !['NonRental', 'Usufruct'].includes(p.occupancyKind));
        const revenueIncomplete = rentedProperties.some(p => !Number.isFinite(p.coldRent) || !Number.isFinite(p.nebenkosten));
        const totalRevenue = rentedProperties
            .reduce((sum, p) => sum + (p.coldRent + p.nebenkosten), 0);

        const occupancyRate = Math.round((occupied / totalProperties) * 100);

        return {
            revenue: revenueIncomplete ? null : totalRevenue,
            occupancy: occupancyRate,
            maintenance: maintenance,
            issues: activeIssuesCount,
            total: totalProperties
        };
    }, [properties, issues]);

    const [expandedIssueId, setExpandedIssueId] = React.useState(null);
    const [editFormData, setEditFormData] = React.useState({});
    const { updateIssue, resolveIssue } = useData();

    const activeIssues = issues.filter(i => i.status === 'Open').slice(0, 5);

    const handleIssueClick = (issue) => {
        if (expandedIssueId === issue.id) {
            setExpandedIssueId(null);
        } else {
            setExpandedIssueId(issue.id);
            setEditFormData({ ...issue });
        }
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = (e) => {
        e.stopPropagation();
        updateIssue(expandedIssueId, editFormData);
        setExpandedIssueId(null);
    };

    const handleResolve = (e) => {
        e.stopPropagation();
        resolveIssue(expandedIssueId);
        setExpandedIssueId(null);
    }

    const fileInputRef = React.useRef(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const newFile = {
                id: `f${Date.now()}`,
                name: file.name,
                url: URL.createObjectURL(file),
                type: file.type
            };
            setEditFormData(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), newFile]
            }));
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1 className="dashboard-title">Dashboard</h1>
            </header>

            <section className="stats-grid">
                <StatCard title="Total Revenue" value={stats.revenue === null ? 'Angaben fehlen' : `€${stats.revenue}`} icon={Wallet} color="primary" />
                <StatCard title="Occupancy Rate" value={`${stats.occupancy}%`} icon={CheckCircle} color="success" trend={`${stats.total} total units`} />
                <StatCard
                    title="Open Issues"
                    value={stats.issues}
                    icon={AlertCircle}
                    color="warning"
                    trend="Requires attention"
                    onClick={() => navigate('/issues')}
                    style={{ cursor: 'pointer' }}
                />
                <StatCard
                    title="Properties"
                    value={stats.total}
                    icon={Home}
                    color="primary"
                    trend="Portfolio size"
                    onClick={() => navigate('/properties')}
                    style={{ cursor: 'pointer' }}
                />
            </section>

            <div className="dashboard-content">
                <section className="dashboard-section">
                    <h2>Active Issues</h2>
                    {activeIssues.length > 0 ? (
                        <div className="issues-list">
                            {activeIssues.map(issue => {
                                const relatedProperty = properties.find(p => p.id === issue.propertyId);
                                const isExpanded = expandedIssueId === issue.id;

                                return (
                                    <div
                                        key={issue.id}
                                        className={`issue-item ${isExpanded ? 'expanded' : ''}`}
                                        onClick={() => handleIssueClick(issue)}
                                    >
                                        <div className="issue-summary">
                                            <div className="issue-icon-wrapper">
                                                <AlertCircle size={20} color="var(--color-warning)" />
                                            </div>
                                            <div className="issue-info">
                                                <h4>{issue.title}</h4>
                                                <p className="issue-meta">
                                                    {relatedProperty ? relatedProperty.name : 'General'} • Due: {issue.dueDate || 'No Date'}
                                                </p>
                                            </div>
                                            <span className={`priority-badge ${issue.priority?.toLowerCase()}`}>{issue.priority}</span>
                                        </div>

                                        {isExpanded && (
                                            <div className="issue-edit-form" onClick={(e) => e.stopPropagation()}>
                                                <div className="form-group">
                                                    <label>Title</label>
                                                    <input
                                                        type="text"
                                                        name="title"
                                                        value={editFormData.title || ''}
                                                        onChange={handleEditChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Description</label>
                                                    <textarea
                                                        name="description"
                                                        value={editFormData.description || ''}
                                                        onChange={handleEditChange}
                                                        className="edit-textarea"
                                                        rows="3"
                                                    />
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group" style={{ flex: 1 }}>
                                                        <label>Priority</label>
                                                        <select name="priority" value={editFormData.priority} onChange={handleEditChange} className="edit-select">
                                                            <option value="Low">Low</option>
                                                            <option value="Medium">Medium</option>
                                                            <option value="High">High</option>
                                                        </select>
                                                    </div>
                                                    <div className="form-group" style={{ flex: 1 }}>
                                                        <label>Due Date</label>
                                                        <input type="date" name="dueDate" value={editFormData.dueDate || ''} onChange={handleEditChange} className="edit-input" />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <label>Attachments</label>
                                                        <input
                                                            type="file"
                                                            ref={fileInputRef}
                                                            style={{ display: 'none' }}
                                                            onChange={handleFileUpload}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <button className="btn-text small" onClick={(e) => {
                                                            e.stopPropagation();
                                                            fileInputRef.current.click();
                                                        }}>
                                                            <Paperclip size={14} /> Add File
                                                        </button>
                                                    </div>
                                                    <div className="attachments-list">
                                                        {(editFormData.attachments && editFormData.attachments.length > 0) ? (
                                                            editFormData.attachments.map(file => (
                                                                <div key={file.id} className="attachment-item">
                                                                    <div className="file-info">
                                                                        <File size={16} className="text-muted" />
                                                                        <a href={file.url} className="file-link" target="_blank" rel="noopener noreferrer">{file.name}</a>
                                                                    </div>
                                                                    <button className="btn-icon-danger" onClick={(e) => {
                                                                        e.stopPropagation(); // Stop expansion toggle
                                                                        setEditFormData(prev => ({
                                                                            ...prev,
                                                                            attachments: prev.attachments.filter(f => f.id !== file.id)
                                                                        }));
                                                                    }}>
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-muted small">No attachments.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="form-actions">
                                                    <button className="btn-primary small" onClick={handleSave}>Save</button>
                                                    <button className="btn-outline small" onClick={handleResolve}>Mark Resolved</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No open issues. Great job!</p>
                        </div>
                    )}
                </section>

                <section className="dashboard-section">
                    <h2>Quick Actions</h2>
                    <div className="action-buttons">
                        <button
                            className="btn-action"
                            onClick={() => navigate('/tenants', { state: { openAdd: true } })}
                        >
                            Add Tenant
                        </button>
                        <button
                            className="btn-action"
                            onClick={() => navigate('/costs', { state: { openAdd: true } })}
                        >
                            Log Expense
                        </button>
                        <button
                            className="btn-action"
                            onClick={() => navigate('/issues', { state: { openAdd: true } })}
                        >
                            Create Request
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
