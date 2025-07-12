# Dashboard Guide

## Overview

CostTrak provides role-specific dashboards designed to deliver relevant insights and functionality to each user type. All dashboards update in real-time and are optimized for both desktop and mobile viewing.

## Dashboard Access

Dashboards are automatically assigned based on user roles:

| Role | Dashboard URL | Access Level |
|------|--------------|--------------|
| Executive | `/executive` | Company-wide read-only |
| Ops Manager | `/ops-manager` | All divisions, create projects |
| Project Manager | `/project-manager` | Assigned projects only |
| Controller | `/controller` | Full system access |
| Accounting | `/accounting` | Financial data access |
| Viewer | `/viewer` | Specific projects read-only |

## Executive Dashboard

### Purpose
Provides high-level company performance metrics for executive decision-making.

### Key Features
- **Company Metrics**: Active projects, total backlog, average margins
- **Division Breakdown**: Visual representation of performance by division
- **Status Distribution**: Projects categorized by current status
- **Top Projects**: Highest value active projects at a glance

### Key Metrics Explained
- **Total Backlog**: Sum of all active project revised contracts
- **Average Margin**: Mean profit margin across all active projects
- **Recent Commitments**: Purchase orders created in the last 30 days

### Navigation
- Click on project job numbers to view detailed project information
- All data is read-only for executives

## Operations Manager Dashboard

### Purpose
Enables cross-division operational oversight and project management.

### Key Features
- **Division Performance Table**: Compare metrics across all divisions
- **Project Filtering**: Filter projects by division for focused analysis
- **At-Risk Alerts**: Automatic alerts for projects with margins below 10%
- **Quick Actions**: Direct access to create new projects

### Key Metrics Explained
- **Total Contract Value**: Sum of all project values across divisions
- **Average Margin by Division**: Division-specific profitability metrics
- **Active vs Total Projects**: Project status breakdown by division

### Navigation
- Use "Filter" buttons to focus on specific divisions
- "View" links navigate to detailed project dashboards
- "New Project" button opens project creation form

## Project Manager Dashboard

### Purpose
Provides focused view of assigned projects with performance tracking.

### Key Features
- **Portfolio Overview**: All assigned projects in one view
- **Financial Summaries**: Contract values, committed costs, margins
- **Progress Tracking**: Percentage complete for each project
- **At-Risk Alerts**: Highlighted projects requiring attention

### Key Metrics Explained
- **Contract Value**: Current revised contract amount
- **Committed**: Total purchase order commitments
- **Margin %**: Projected profit margin
- **Complete %**: Based on costs incurred vs. budget

### Alert Thresholds
- Projects with margins below 10% are highlighted in orange
- Dedicated alert section lists all at-risk projects

## Controller Dashboard

### Purpose
System administration hub with full oversight capabilities.

### Key Features
- **System Health Monitoring**: Database, API, and security status
- **User Management**: Summary of users by role with quick access
- **Audit Trail**: Recent system activity across all users
- **Admin Quick Actions**: Direct links to common tasks

### System Metrics
- **Active Users**: Users who logged in within the last 7 days
- **System Health**: Overall system operational status
- **Last Backup**: Most recent database backup timestamp
- **Audit Entries**: Count of tracked system changes

### Administrative Functions
- Add User: Create new system users
- Generate Reports: Access reporting tools
- System Settings: Configure application settings
- Full Audit Log: Complete system activity history

## Accounting Dashboard

### Purpose
Comprehensive financial oversight and reporting capabilities.

### Key Features
- **Financial Metrics Grid**: 8 key financial indicators
- **Division Financial Summary**: Detailed breakdown by division
- **Outstanding Balances**: Projects with high unbilled amounts
- **Export Functions**: Quick access to financial reports

### Financial Metrics Explained
- **Total Revenue**: Sum of all project revised contracts
- **Total Committed**: All purchase order commitments
- **Total Invoiced**: Amount billed to date
- **Outstanding**: Committed but not yet invoiced
- **Cash Position**: Estimated available cash (90% of invoiced)
- **Projected Profit**: Revenue minus committed costs
- **Budget Utilization**: Percentage of budget committed

### Alert Conditions
- Outstanding amounts over $500,000 highlighted
- Low margin projects (< 10%) shown in alert section

## Viewer Dashboard

### Purpose
Limited read-only access to specific assigned projects.

### Key Features
- **Project Cards**: Visual display of accessible projects
- **Basic Information**: Essential project details only
- **Contact Information**: Project manager contact details
- **Status Indicators**: Current project status badges

### Access Limitations
- No financial details beyond contract value
- No edit capabilities
- No access to other projects
- Clear messaging about access restrictions

## Best Practices

### Performance Optimization
1. Dashboards load data on-demand to ensure fresh metrics
2. Large datasets are paginated automatically
3. Filters reduce data load for better performance

### Using Alerts
1. Address high-priority alerts (red) immediately
2. Review warning alerts (orange) during regular check-ins
3. Use alert details to navigate directly to problem areas

### Navigation Patterns
1. Click job numbers or "View" buttons for project details
2. Use breadcrumbs to navigate back to dashboards
3. Browser back button maintains filter states

### Mobile Usage
1. All dashboards are responsive
2. Tables scroll horizontally on mobile
3. Key metrics remain visible during scrolling
4. Touch-optimized buttons and links

## Troubleshooting

### Common Issues

**Dashboard Not Loading**
- Check internet connection
- Verify user is logged in
- Clear browser cache
- Contact IT if issue persists

**Missing Projects**
- Verify user role assignments
- Check project status (deleted projects hidden)
- Confirm division assignments for ops managers
- Review viewer access permissions

**Incorrect Metrics**
- Metrics update in real-time
- Check "Last Updated" timestamp
- Refresh page for latest data
- Report persistent issues to support

**Access Denied**
- Confirm correct user role
- Verify project assignments
- Check with administrator for permission updates

## Security Notes

1. All dashboard data respects row-level security
2. Sensitive financial data limited to authorized roles
3. Audit trails track all data access
4. Session timeout after 30 minutes of inactivity
5. Multi-factor authentication recommended for financial roles