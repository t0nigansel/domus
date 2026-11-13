import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { AlertCircle, CheckCircle, Clock, Activity, Calendar, Paperclip } from 'lucide-react';
import { PageHeader, CollapsiblePanel, useToast, List, ListRow, ListEmpty, ListToolbar, Badge } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import IssueForm from '../components/IssueForm';
import { emptyIssue, issueFormData, issuePayload } from '../domain/issues';
import { ISSUE_STATUS } from '../constants/status';
import './Issues.css';

const statusFilters = [
    [ISSUE_STATUS.OPEN, 'Open'],
    [ISSUE_STATUS.IN_PROGRESS, 'In Progress'],
    [ISSUE_STATUS.CLOSED, 'Closed'],
    ['All', 'All'],
];

const StatusIcon = ({ status }) => {
    if (status === ISSUE_STATUS.CLOSED) return <CheckCircle size={20} className="text-success" />;
    if (status === ISSUE_STATUS.IN_PROGRESS) return <Clock size={20} className="text-primary" />;
    return <AlertCircle size={20} className="text-warning" />;
};

const Issues = () => {
    const { t } = useTranslation();
    const { issues, properties, tenants, resolveIssue, addIssue, updateIssue } = useData();
    const [isAddingIssue, setIsAddingIssue] = useQuickAction();
    const { addToast } = useToast();

    const [filterStatus, setFilterStatus] = useState(ISSUE_STATUS.OPEN);
    const [searchTerm, setSearchTerm] = useState('');
    const [newIssueData, setNewIssueData] = useState(emptyIssue);

    // Inline Expansion State
    const [expandedIssueId, setExpandedIssueId] = useState(null);
    const [editFormData, setEditFormData] = useState(null);

    const term = searchTerm.toLowerCase();
    const filteredIssues = issues.filter(issue => {
        const matchesStatus = filterStatus === 'All' || issue.status === filterStatus;
        const matchesSearch = issue.title.toLowerCase().includes(term) || (issue.description || '').toLowerCase().includes(term);
        return matchesStatus && matchesSearch;
    });

    // Ohne Wohnung betrifft das Anliegen das ganze Haus.
    const getPropertyName = (id) => id ? (properties.find(p => p.id === id)?.name || t('Unknown Property')) : t('Haus');
    const getTenantName = (id) => tenants.find(tenant => tenant.id === id)?.name || null;

    const handleResolve = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await resolveIssue(id);
            if (expandedIssueId === id) setExpandedIssueId(null);
            addToast('Issue resolved');
        } catch {
            addToast('Failed to resolve issue', 'error');
        }
    };

    const closeNewIssue = () => {
        setIsAddingIssue(false);
        setNewIssueData(emptyIssue());
    };

    const handleAddSubmit = async () => {
        try {
            await addIssue({ ...issuePayload(newIssueData), tenantId: null });
            closeNewIssue();
            addToast('Issue reported successfully');
        } catch {
            addToast('Failed to report issue', 'error');
        }
    };

    const handleIssueClick = (issue) => {
        if (expandedIssueId === issue.id) {
            setExpandedIssueId(null);
            setEditFormData(null);
        } else {
            setExpandedIssueId(issue.id);
            setEditFormData(issueFormData(issue));
        }
    };

    const handleSave = async () => {
        try {
            await updateIssue(expandedIssueId, issuePayload(editFormData));
            setExpandedIssueId(null);
            addToast('Issue updated successfully');
        } catch {
            addToast('Failed to update issue', 'error');
        }
    };

    return (
        <div className="page-container">
            <PageHeader title={t("Issues & Requests")} onAction={() => setIsAddingIssue(true)} />

            <CollapsiblePanel title={t("New Issue")} isOpen={isAddingIssue} onClose={closeNewIssue}>
                <IssueForm
                    idPrefix="new-issue"
                    value={newIssueData}
                    onChange={setNewIssueData}
                    properties={properties}
                    onSubmit={handleAddSubmit}
                    onCancel={closeNewIssue}
                    onError={message => addToast(message, 'error')}
                    submitLabel={t("Save Issue")}
                />
            </CollapsiblePanel>

            <ListToolbar
                search={{ value: searchTerm, onChange: setSearchTerm, placeholder: t("Search issues...") }}
                filters={statusFilters.map(([value, label]) => [value, t(label), value === 'All' ? issues.length : issues.filter(i => i.status === value).length])}
                filter={filterStatus}
                onFilter={setFilterStatus}
            />

            {filteredIssues.length > 0 ? (
                <List>
                    {filteredIssues.map(issue => {
                        const isExpanded = expandedIssueId === issue.id;
                        return (
                            <ListRow
                                key={issue.id}
                                expanded={isExpanded}
                                onToggle={() => handleIssueClick(issue)}
                                muted={issue.status === ISSUE_STATUS.CLOSED}
                                icon={<StatusIcon status={issue.status} />}
                                title={issue.title}
                                subtitle={<>
                                    {getPropertyName(issue.propertyId)}
                                    {issue.tenantId && ` • ${getTenantName(issue.tenantId)}`}
                                </>}
                                meta={<>
                                    {issue.status === ISSUE_STATUS.IN_PROGRESS && <Badge tone="primary">{t("In Progress")}</Badge>}
                                    {issue.attachments?.length > 0 && <Badge icon={Paperclip} title={t("Attachments")}>{issue.attachments.length}</Badge>}
                                    <Badge tone={issue.priority.toLowerCase()}>{t(issue.priority)}</Badge>
                                    <Badge icon={Calendar}>{issue.dueDate || t("No due date")}</Badge>
                                </>}
                            >
                                {editFormData && (
                                        <IssueForm
                                            idPrefix={`issue-${issue.id}`}
                                            value={editFormData}
                                            onChange={setEditFormData}
                                            properties={properties}
                                            onSubmit={handleSave}
                                            onCancel={() => { setExpandedIssueId(null); setEditFormData(null); }}
                                            onError={message => addToast(message, 'error')}
                                            submitLabel={t("Save")}
                                        >
                                            {issue.status !== ISSUE_STATUS.CLOSED && (
                                                <button type="button" className="btn-outline small" style={{ marginLeft: 'auto' }} onClick={(e) => handleResolve(issue.id, e)}>{t("Mark Resolved")}</button>
                                            )}
                                        </IssueForm>
                                )}
                            </ListRow>
                        );
                    })}
                </List>
            ) : (
                <ListEmpty icon={<Activity size={40} />}>{t("No issues found matching your filters.")}</ListEmpty>
            )}
        </div>
    );
};

export default Issues;
