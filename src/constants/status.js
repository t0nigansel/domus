export const TENANT_STATUS = {
    ACTIVE: 'Active',
    PAST: 'Past',
    PENDING: 'Pending' // For future use
};

export const ISSUE_STATUS = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    CLOSED: 'Closed'
};

// CSS-Klasse für einen Status, z. B. 'In Progress' -> 'in-progress'.
export const issueStatusClass = (status) => String(status || '').toLowerCase().split(' ').join('-');

export const PRIORITY_LEVEL = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High'
};

export const DOCUMENT_CATEGORY = {
    ALL: 'All',
    LEASES: 'Leases',
    INVOICES: 'Invoices',
    INSURANCE: 'Insurance',
    MISC: 'Misc'
};
