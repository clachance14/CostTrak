# CostTrak - Financial Tracking for Construction

CostTrak is an internal financial tracking and reporting system for industrial construction projects. It provides a centralized platform for managing projects, purchase orders, change orders, and labor costs, with role-based access control to ensure data security and integrity.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Testing](#testing)
- [User Roles and Permissions](#user-roles-and-permissions)

## Features

- **Project Management:** Create and manage projects, including budgets, timelines, and status.
- **Purchase Orders:** Track purchase orders and their status, with support for importing legacy data.
- **Change Orders:** Manage change orders and their impact on project budgets.
- **Labor Tracking:** Monitor labor costs and hours, with support for running averages and headcount forecasting.
- **Document Management:** Upload and manage project-related documents, such as contracts, invoices, and drawings.
- **Notifications:** Receive real-time notifications for important events, such as project updates and approvals.
- **Role-Based Access Control:** Secure access to data and features based on user roles and permissions.
- **Dashboard:** A comprehensive dashboard that provides a high-level overview of project financials and performance.

## Technologies Used

- **Framework:** [Next.js](https://nextjs.org/)
- **Database:** [Supabase](https://supabase.io/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/)
- **Form Management:** [React Hook Form](https://react-hook-form.com/)
- **Data Fetching:** [React Query](https://tanstack.com/query/v5)
- **Schema Validation:** [Zod](https://zod.dev/)
- **Testing:** [Playwright](https://playwright.dev/)

## Project Structure

The project is organized into the following directories:

- `app/`: Contains the application's routes and pages.
  - `(auth)/`: Authentication-related pages (login, password reset).
  - `(dashboard)/`: Protected dashboard pages.
  - `api/`: API routes for handling server-side logic.
- `components/`: Reusable UI components.
- `contexts/`: React contexts for managing global state.
- `hooks/`: Custom React hooks.
- `lib/`: Shared libraries and utility functions.
  - `security/`: Security-related utilities.
  - `services/`: Business logic services.
  - `supabase/`: Supabase client and server configurations.
  - `validations/`: Zod schemas for data validation.
- `public/`: Static assets.
- `scripts/`: Helper scripts for development and database management.
- `supabase/`: Supabase database migrations and schema definitions.
- `types/`: TypeScript type definitions.

## Database Schema

The database schema is managed using Supabase migrations. The core tables include:

- `users`: Stores user information and roles.
- `projects`: Manages project details, budgets, and status.
- `change_orders`: Tracks change orders and their impact on project financials.
- `purchase_orders`: Stores purchase order information and line items.
- `labor_actuals`: Records weekly labor costs and hours.
- `labor_headcount_forecasts`: Manages labor headcount forecasts.
- `documents`: Stores metadata for uploaded documents.
- `notifications`: Manages user notifications.

For a detailed schema, refer to the migration files in the `supabase/migrations/` directory.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/costtrak.git
   cd costtrak
   ```

2. Install the dependencies:

   ```bash
   pnpm install
   ```

3. Set up your environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Update the `.env.local` file with your Supabase project URL and anon key.

4. Start the Supabase services:

   ```bash
   supabase start
   ```

5. Apply the database migrations:

   ```bash
   pnpm db:migrate
   ```

### Running the Application

To run the application in development mode, use the following command:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Testing

The project uses Playwright for end-to-end testing. To run the tests, use the following command:

```bash
pnpm test
```

## User Roles and Permissions

The application has the following user roles:

- **Controller:** Full access to all data and features.
- **Executive:** Read-only access to all data and high-level reports.
- **Ops Manager:** Access to projects within their division.
- **Project Manager:** Access to their assigned projects.
- **Accounting:** Access to financial data and reports.
- **Viewer:** Read-only access to a limited set of data.

Permissions are enforced using Supabase's Row Level Security (RLS) policies. For detailed information on the RLS policies, refer to the migration files in the `supabase/migrations/` directory.
