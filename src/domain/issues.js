import { ISSUE_STATUS, PRIORITY_LEVEL } from '../constants/status';

// Leeres Anliegen mit den gewünschten Vorgaben: Priorität mittel, Status offen, betrifft das Haus.
export const emptyIssue = (propertyId = '') => ({
    title: '', priority: PRIORITY_LEVEL.MEDIUM, description: '', status: ISSUE_STATUS.OPEN,
    dueDate: '', attachments: [], propertyId,
});

export const issueFormData = (issue) => ({
    ...emptyIssue(),
    ...issue,
    propertyId: issue.propertyId || '',
    dueDate: issue.dueDate || '',
    description: issue.description || '',
    attachments: issue.attachments || [],
});

// propertyId leer = Haus (keine einzelne Wohnung).
export const issuePayload = (data) => ({
    ...data,
    title: data.title.trim(),
    propertyId: data.propertyId || null,
    dueDate: data.dueDate || null,
});

