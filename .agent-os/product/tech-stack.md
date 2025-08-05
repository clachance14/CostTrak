# Technical Stack

> Last Updated: 2025-07-23
> Version: 1.0.0

## Core Technologies

- **Application Framework:** Next.js 15.3.5
- **Database System:** PostgreSQL 17 (via Supabase)
- **JavaScript Framework:** React 19.0.0
- **Import Strategy:** node
- **CSS Framework:** Tailwind CSS 4.x
- **UI Component Library:** shadcn/ui (Radix UI primitives)
- **Fonts Provider:** next/font (local)
- **Icon Library:** lucide-react

## Infrastructure

- **Application Hosting:** Vercel
- **Database Hosting:** Supabase Cloud
- **Asset Hosting:** Vercel CDN
- **Deployment Solution:** GitHub Actions → Vercel

## Development Tools

- **Package Manager:** pnpm
- **Type System:** TypeScript 5.x
- **Build Tool:** Next.js with Turbopack
- **Linting:** ESLint with Next.js presets
- **Formatting:** Prettier with Tailwind plugin
- **Testing:** Vitest, Playwright, Puppeteer

## Key Libraries

### State Management
- **Server State:** TanStack Query v5
- **Client State:** React Context API
- **Form State:** react-hook-form

### Data Validation
- **Runtime Validation:** Zod
- **Type Generation:** Supabase CLI

### Authentication & Security
- **Auth Provider:** Supabase Auth
- **2FA:** speakeasy + qrcode
- **Row-Level Security:** PostgreSQL RLS policies

### Data Processing
- **Excel Operations:** xlsx
- **Date Handling:** date-fns
- **Charts & Visualizations:** recharts

### UI Utilities
- **Class Management:** clsx + tailwind-merge
- **Component Variants:** class-variance-authority

## Database Architecture

- **ORM:** Supabase client (no traditional ORM)
- **Migrations:** Supabase CLI migrations
- **Type Safety:** Auto-generated TypeScript types
- **Caching:** Materialized views (mv_project_summary, mv_division_summary)

## Code Repository

- **Repository URL:** https://github.com/[organization]/costtrak
- **Branching Strategy:** Feature branches → main
- **CI/CD:** GitHub Actions
- **Code Review:** 2 independent reviewers required

## Environment Configuration

- **Development:** Remote Supabase database
- **Staging:** Manual deployment with smoke testing
- **Production:** Automated deployment on main branch merge
- **Environment Variables:** Consistent keys across all environments