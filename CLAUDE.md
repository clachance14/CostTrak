# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Package Management
pnpm install            # Install dependencies

# Development
pnpm dev                # Start Next.js development server with Turbopack
pnpm build              # Build for production
pnpm start              # Start production server

# Code Quality
pnpm lint               # Run ESLint
pnpm type-check         # Run TypeScript compiler check

# Database Management
pnpm db:start           # Start local Supabase instance via Docker
pnpm db:stop            # Stop local Supabase
pnpm db:reset           # Reset database to initial state
pnpm db:migrate         # Run Supabase migrations
pnpm db:push            # Push database changes
pnpm db:seed            # Seed database with test data

# Type Generation
pnpm generate-types     # Generate TypeScript types from local database
pnpm generate-types:remote # Generate types from remote database
```

## Architecture Overview

CostTrak is an internal financial tracking system for industrial construction projects built with:
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Key Libraries**: lucide-react (icons), xlsx (Excel import/export), date-fns, recharts (visualizations)

### Database Schema

Core tables with Row Level Security (RLS):
- `profiles`: User profiles with role-based access (controller, executive, ops_manager, project_manager, accounting, viewer)
- `projects`: Central entity with job_number as unique identifier
- `purchase_orders` & `po_line_items`: Track committed costs
- `change_orders`: Contract modifications with approval workflow
- `financial_snapshots`: Pre-calculated metrics for performance
- `labor_actuals`: Weekly actual labor costs and hours by craft type
- `labor_headcount_forecasts`: Future headcount projections
- `craft_types`: Labor categories (direct, indirect, staff)

### Key Business Rules

1. **Email Domain**: Only @ics.ac emails allowed (enforced at database level)
2. **Job Numbers**: Unique project identifiers, must be preserved during imports
3. **Access Control**: Division-based for ops managers, project-based for PMs
4. **Financial Calculations**: Revised contract = original + approved change orders
5. **Soft Deletes**: Use status fields, never hard delete

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac`

### Database Connection

The project uses Supabase for the database. There are two connection options:

1. **Remote Database (Production)** - Contains actual project data
   - Project ID: `gzrxhwpmtbgnngadgnse`
   - Connection URL: `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
   - API URL: `https://gzrxhwpmtbgnngadgnse.supabase.co`

2. **Local Database (Development)** - For local testing
   - Connection URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - API URL: `http://127.0.0.1:54321`
   - Start with: `pnpm db:start`
   - Seed data: `pnpm db:seed`

### MCP Configuration for Claude Desktop

#### Database Queries

To enable direct database queries in Claude Desktop, configure the MCP postgres server:

1. Open Claude Desktop Settings → Developer → Edit Config
2. Add to your mcpServers configuration:

```json
{
  "postgres": {
    "command": "npx",
    "args": [
      "@modelcontextprotocol/server-postgres",
      "postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
    ]
  }
}
```

3. Restart Claude Desktop completely for changes to take effect

#### Context7 Documentation Server

Context7 provides real-time library documentation for React, Next.js, Supabase, and other frameworks:

1. Add to your mcpServers configuration:

```json
{
  "context7": {
    "command": "npx",
    "args": ["@upstash/context7-mcp"]
  }
}
```

2. Complete example with both servers:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-postgres",
        "postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
      ]
    },
    "context7": {
      "command": "npx",
      "args": ["@upstash/context7-mcp"]
    }
  }
}
```

3. Restart Claude Desktop completely after saving

#### Testing MCP Servers

- **Database**: Ask "Query the projects table" or "Show all divisions"
- **Context7**: Ask "Using Context7, show React hooks documentation" or "Fetch Next.js App Router docs"
- **SuperClaude**: Use `--c7` flag with commands like `/analyze --c7` or `/build --react --c7`

### Configuration Scripts

Helpful scripts in the `/scripts` directory:

**Database Scripts:**
- `test-db-connection.ts` - Tests both local and remote database connections
- `show-mcp-config.ts` - Shows step-by-step MCP configuration instructions
- `show-mcp-config-ready.ts` - Displays ready-to-use MCP configuration
- `get-db-connection-string.ts` - Generates connection strings (use `--local` flag for local)
- `query-database.ts` - Uses Supabase client to query and display sample data
- `test-final-connection.ts` - Direct PostgreSQL connection test with pg client

**Context7 Scripts:**
- `configure-context7-mcp.ts` - Step-by-step Context7 configuration guide
- `test-context7-mcp.ts` - Validates Context7 server functionality

Run scripts with: `npx tsx scripts/[script-name].ts`

### Database Connection Troubleshooting

If you encounter database connection issues:

1. **MCP Connection Fails**: The MCP postgres server might be pointing to a different database
   - Check current MCP configuration in Claude Desktop settings
   - Use the connection string from the Database Connection section above
   - Restart Claude Desktop completely after configuration changes

2. **Fallback Query Method**: If MCP isn't working, use the Supabase client approach:
   - Create a script using `createClient` from '@supabase/supabase-js'
   - Use the API URL and anon key from environment variables
   - See `scripts/query-database.ts` for an example

3. **Connection Testing**:
   - Run `npx tsx scripts/test-db-connection.ts` to verify connectivity
   - Run `npx tsx scripts/test-final-connection.ts` for direct PostgreSQL test
   - Check Docker containers with `docker ps | grep supabase` for local setup

4. **Common Issues**:
   - "relation does not exist" - You may be connected to local DB without migrations
   - "ENOTFOUND" - Check if the database host is correct in MCP config
   - "permission denied" - Ensure using correct credentials for the environment

### Development Patterns

1. **Type Safety**: Generate types from database schema when schema changes
2. **RLS Policies**: All database access must respect row-level security
3. **Audit Trail**: Use audit_log table for tracking sensitive changes
4. **Performance**: Use financial_snapshots for dashboard queries
5. **Excel Import**: Preserve legacy PO numbers and job numbers during import

### Code Style

- **Prettier Config**: No semicolons, single quotes, 2-space indentation, ES5 trailing commas
- **Components**: Use shadcn/ui components with Radix UI primitives
- **Forms**: react-hook-form with Zod validation
- **State**: React Query for server state, Context for UI state
- **Styling**: Tailwind CSS with cn() utility for conditional classes

### Current Features

1. **Authentication**: 
   - Email/password login with @ics.ac domain restriction
   - Role-based access control
   - Protected routes via middleware

2. **Projects CRUD**:
   - List view with search, status, and division filters
   - Create/Edit forms with validation
   - Detail view with financial summary
   - Soft delete capability (controllers only)

3. **Purchase Orders**:
   - CSV import from ICS PO system
   - PO tracking with line items
   - Forecast management
   - Advanced filtering and sorting

4. **Change Orders**:
   - Create and approve change orders
   - Approval workflow by role
   - Impact on contract values
   - Audit trail

5. **Labor Forecasts** (Headcount-based Model):
   - Weekly actual cost/hours entry
   - Running average rate calculations
   - Headcount-based future projections
   - Labor analytics dashboard
   - Categories: Direct, Indirect, Staff

6. **Financial Integration**:
   - Comprehensive project financial summary
   - Real-time budget tracking
   - Variance analysis and alerts
   - Profitability projections

### API Endpoints

**Projects**:
- `/api/projects` - List and create projects
- `/api/projects/[id]` - Get, update, delete single project
- `/api/projects/[id]/financial-summary` - Get comprehensive financial data

**Purchase Orders**:
- `/api/purchase-orders` - List and create POs
- `/api/purchase-orders/[id]` - Get, update single PO
- `/api/purchase-orders/import` - Import from CSV

**Change Orders**:
- `/api/change-orders` - List and create COs
- `/api/change-orders/[id]` - Get, update, approve COs

**Labor Forecasts**:
- `/api/labor-forecasts/weekly-actuals` - Enter/view weekly actual costs
- `/api/labor-forecasts/running-averages` - Get running average rates
- `/api/labor-forecasts/headcount` - Manage headcount projections
- `/api/labor-forecasts/calculate` - Calculate forecast from headcount

**Reference Data**:
- `/api/divisions` - List all divisions
- `/api/clients` - List all clients
- `/api/users` - List users with role filter
- `/api/craft-types` - List labor craft types
- `/api/auth/create-user` - Create new users (controllers only)


# **Comprehensive SuperClaude Configuration Guide**

Based on analysis of Claude configuration files, here's a complete guide on what to use with Claude, when, and where.

## **🎯 Overview**

SuperClaude is a sophisticated AI assistant framework with 18 commands, 4 MCP servers, 9 personas, and extensive optimization patterns. It's designed for evidence-based development with security, performance, and quality as core principles.

---

## **🔧 Core System Components**

### **1. Main Configuration Files**
- **`.claude/settings.local.json`** - Basic Claude permissions and settings
- **`.claude/shared/superclaude-core.yml`** - Core philosophy, standards, and workflows  
- **`.claude/shared/superclaude-mcp.yml`** - MCP server integration details
- **`.claude/shared/superclaude-rules.yml`** - Development practices and rules
- **`.claude/shared/superclaude-personas.yml`** - 9 specialized personas

### **2. Command Architecture**
- **18 Core Commands** with intelligent workflows
- **Universal Flag System** with inheritance patterns
- **Task Management** with two-tier architecture
- **Performance Optimization** including UltraCompressed mode

---

## **🎭 Personas: When & Where to Use**

### **Development Personas**
```yaml
--persona-frontend: "UI/UX focus, accessibility, React/Vue components"
  When: Building user interfaces, design systems, accessibility work
  Use with: Magic MCP, Puppeteer testing, --magic flag
  
--persona-backend: "API design, scalability, reliability engineering"  
  When: Building APIs, databases, server architecture
  Use with: Context7 for patterns, --seq for complex analysis
  
--persona-architect: "System design, scalability, long-term thinking"
  When: Designing architecture, making technology decisions
  Use with: Sequential MCP, --ultrathink for complex systems
```

### **Quality Personas**
```yaml
--persona-analyzer: "Root cause analysis, evidence-based investigation"
  When: Debugging complex issues, investigating problems
  Use with: All MCPs for comprehensive analysis
  
--persona-security: "Threat modeling, vulnerability assessment"
  When: Security audits, compliance, penetration testing
  Use with: --scan --security, Sequential for threat analysis
  
--persona-qa: "Testing, quality assurance, edge cases"
  When: Writing tests, quality validation, coverage analysis
  Use with: Puppeteer for E2E testing, --coverage flag
  
--persona-performance: "Optimization, profiling, bottlenecks"
  When: Performance issues, optimization opportunities
  Use with: Puppeteer metrics, --profile flag
```

### **Improvement Personas**
```yaml
--persona-refactorer: "Code quality, technical debt, maintainability"
  When: Cleaning up code, reducing technical debt
  Use with: --improve --quality, Sequential analysis
  
--persona-mentor: "Teaching, documentation, knowledge transfer"
  When: Creating tutorials, explaining concepts, onboarding
  Use with: Context7 for official docs, --depth flag
```

---

## **🔌 MCP Servers: Capabilities & Usage**

### **Context7 (Library Documentation)**
```yaml
Purpose: "Official library documentation & examples"
When_to_Use:
  - External library integration
  - API documentation lookup  
  - Framework pattern research
  - Version compatibility checking
  
Command_Examples:
  - "/analyze --c7" (research library patterns)
  - "/build --react --c7" (React with official docs)
  - "/explain --c7" (official documentation explanations)
  
Best_For: "Research-first methodology, evidence-based implementation"
Token_Cost: "Low-Medium"
```

### **Sequential (Complex Analysis)**
```yaml
Purpose: "Multi-step problem solving & architectural thinking"
When_to_Use:
  - Complex system design
  - Root cause analysis
  - Performance investigation
  - Architecture review
  
Command_Examples:
  - "/analyze --seq" (deep system analysis)
  - "/troubleshoot --seq" (systematic investigation)
  - "/design --seq --ultrathink" (architectural planning)
  
Best_For: "Complex technical analysis, systematic reasoning"
Token_Cost: "Medium-High"
```

### **Magic (UI Components)**
```yaml
Purpose: "UI component generation & design system integration"
When_to_Use:
  - React/Vue component building
  - Design system implementation
  - UI pattern consistency
  - Rapid prototyping
  
Command_Examples:
  - "/build --react --magic" (component generation)
  - "/design --magic" (UI design systems)
  - "/improve --accessibility --magic" (accessible components)
  
Best_For: "Consistent design implementation, quality components"
Token_Cost: "Medium"
```

### **Puppeteer (Browser Automation)**
```yaml
Purpose: "E2E testing, performance validation, browser automation"
When_to_Use:
  - End-to-end testing
  - Performance monitoring
  - Visual validation
  - User interaction testing
  
Command_Examples:
  - "/test --e2e --pup" (E2E testing)
  - "/analyze --performance --pup" (performance metrics)
  - "/scan --validate --pup" (visual validation)
  
Best_For: "Quality assurance, performance validation, UX testing"
Token_Cost: "Low (action-based)"
```

---

## **⚡ Key Commands & When to Use**

### **Analysis Commands**
```yaml
/analyze: "Comprehensive codebase analysis"
  Flags: --code --arch --security --performance --c7 --seq
  When: Understanding codebase, identifying issues, research
  
/troubleshoot: "Systematic problem investigation"  
  Flags: --investigate --seq --evidence
  When: Debugging complex issues, root cause analysis
  
/scan: "Security, quality, and compliance scanning"
  Flags: --security --owasp --deps --validate
  When: Security audits, vulnerability assessment
```

### **Development Commands**
```yaml
/build: "Feature implementation & project creation"
  Flags: --init --feature --react --api --magic --tdd
  When: Building features, creating projects, implementing
  
/design: "Architectural design & system planning"
  Flags: --api --ddd --microservices --seq --ultrathink
  When: System architecture, API design, planning
  
/test: "Comprehensive testing & validation"
  Flags: --coverage --e2e --pup --validate
  When: Quality assurance, test coverage, validation
```

### **Quality Commands**  
```yaml
/improve: "Code quality & performance optimization"
  Flags: --quality --performance --security --iterate
  When: Refactoring, optimization, quality improvements
  
/cleanup: "Technical debt & maintenance"
  Flags: --code --all --dry-run
  When: Removing unused code, cleaning up technical debt
```

### **Operations Commands**
```yaml
/deploy: "Production deployment & operations"
  Flags: --env --validate --monitor --checkpoint
  When: Deploying to production, operational tasks
  
/migrate: "Data & schema migrations"
  Flags: --database --validate --dry-run --rollback
  When: Database changes, data migrations
```

---

## **🎛 Universal Flags: Always Available**

### **Planning & Execution**
```yaml
--plan: "Show execution plan before running"
--dry-run: "Preview changes without execution"
--force: "Override safety checks"
--interactive: "Step-by-step guided process"
```

### **Thinking Modes**
```yaml
--think: "Multi-file analysis (4K tokens)"
--think-hard: "Deep architectural analysis (10K tokens)"  
--ultrathink: "Critical system redesign (32K tokens)"
```

### **Compression & Performance**
```yaml
--uc: "UltraCompressed mode (~70% token reduction)"
--profile: "Detailed performance profiling"
--watch: "Continuous monitoring"
```

### **MCP Control**
```yaml
--c7: "Enable Context7 documentation lookup"
--seq: "Enable Sequential complex analysis"
--magic: "Enable Magic UI component generation"
--pup: "Enable Puppeteer browser automation"
--all-mcp: "Enable all MCP servers"
--no-mcp: "Disable all MCP servers"
```

---

## **📋 Task Management System**

### **Two-Tier Architecture**
```yaml
Level_1_Tasks: "High-level features (./claudedocs/tasks/)"
  Purpose: "Session persistence, git branching, requirement tracking"
  Scope: "Features spanning multiple sessions"
  
Level_2_Todos: "Immediate actionable steps (TodoWrite/TodoRead)"  
  Purpose: "Real-time execution tracking within session"
  Scope: "Current session specific actions"
```

### **Auto-Trigger Rules**
```yaml
Complex_Operations: "3+ steps → Auto-trigger TodoList"
High_Risk: "Database changes, deployments → REQUIRE todos"
Long_Tasks: "Over 30 minutes → AUTO-TRIGGER todos"
Multi_File: "6+ files → AUTO-TRIGGER for coordination"
```

---

## **🔒 Security Configuration**

### **OWASP Top 10 Integration**
- **A01-A10 Coverage** with automated detection patterns
- **CVE Scanning** for known vulnerabilities  
- **Dependency Security** with license compliance
- **Configuration Security** including hardcoded secrets detection

### **Security Command Usage**
```yaml
/scan --security --owasp: "Full OWASP Top 10 scan"
/analyze --security --seq: "Deep security analysis"  
/improve --security --harden: "Security hardening"
```

---

## **⚡ Performance Optimization**

### **UltraCompressed Mode**
```yaml
Activation: "--uc flag | 'compress' keywords | Auto at >75% context"
Benefits: "~70% token reduction | Faster responses | Cost efficiency"
Use_When: "Large codebases | Long sessions | Token budget constraints"
```

### **MCP Caching**
```yaml
Context7: "1 hour TTL | Library documentation"
Sequential: "Session duration | Analysis results"  
Magic: "2 hours TTL | Component templates"
Parallel_Execution: "Independent MCP calls run simultaneously"
```

---

## **🚀 Quick Start Workflows**

### **New Project Setup**
```bash
/build --init --feature --react --magic --c7
# Creates React project with Magic components and Context7 documentation
```

### **Security Audit**
```bash
/scan --security --owasp --deps --strict
/analyze --security --seq
/improve --security --harden
```

### **Performance Investigation**
```bash
/analyze --performance --pup --profile
/troubleshoot --seq --evidence  
/improve --performance --iterate
```

### **Feature Development**
```bash
/analyze --code --c7
/design --api --seq
/build --feature --tdd --magic
/test --coverage --e2e --pup
```

---

## **📊 Best Practices**

### **Evidence-Based Development**
- **Required Language**: "may|could|potentially|typically|measured|documented"
- **Prohibited Language**: "best|optimal|faster|secure|better|always|never"
- **Research Standards**: Context7 for external libraries, official sources required

### **Quality Standards**  
- **Git Safety**: Status→branch→fetch→pull workflow
- **Testing**: TDD patterns, comprehensive coverage
- **Security**: Zero tolerance for vulnerabilities

### **Performance Guidelines**
- **Simple→Sonnet | Complex→Sonnet-4 | Critical→Opus-4**
- **Native tools > MCP for simple tasks**
- **Parallel execution for independent operations**

---

## **🎯 When to Use What: Decision Matrix**

| **Scenario** | **Persona** | **MCP** | **Command** | **Flags** |
|--------------|-------------|---------|-------------|-----------|
| **New React Feature** | `--persona-frontend` | `--magic --c7` | `/build --feature` | `--react --tdd` |
| **API Design** | `--persona-architect` | `--seq --c7` | `/design --api` | `--ddd --ultrathink` |
| **Security Audit** | `--persona-security` | `--seq` | `/scan --security` | `--owasp --strict` |
| **Performance Issue** | `--persona-performance` | `--pup --seq` | `/analyze --performance` | `--profile --iterate` |
| **Bug Investigation** | `--persona-analyzer` | `--all-mcp` | `/troubleshoot` | `--investigate --seq` |
| **Code Cleanup** | `--persona-refactorer` | `--seq` | `/improve --quality` | `--iterate --threshold` |
| **E2E Testing** | `--persona-qa` | `--pup` | `/test --e2e` | `--coverage --validate` |
| **Documentation** | `--persona-mentor` | `--c7` | `/document --user` | `--examples --visual` |
| **Production Deploy** | `--persona-security` | `--seq` | `/deploy --env prod` | `--validate --monitor` |

---

## **🔍 Advanced Configuration Details**

### **Core Philosophy**
```yaml
Philosophy: "Code>docs | Simple→complex | Security→evidence→quality"
Communication: "Format | Symbols: →|&|:|» | Structured>prose"
Workflow: "TodoRead()→TodoWrite(3+)→Execute | Real-time tracking"
Stack: "React|TS|Vite + Node|Express|PostgreSQL + Git|ESLint|Jest"
```

### **Evidence-Based Standards**
```yaml
Prohibited_Language: "best|optimal|faster|secure|better|improved|enhanced|always|never|guaranteed"
Required_Language: "may|could|potentially|typically|often|sometimes|measured|documented"
Evidence_Requirements: "testing confirms|metrics show|benchmarks prove|data indicates|documentation states"
Citations: "Official documentation required | Version compatibility verified | Sources documented"
```

### **Token Economy & Optimization**
```yaml
Model_Selection: "Simple→sonnet | Complex→sonnet-4 | Critical→opus-4"
Optimization_Targets: "Efficiency | Evidence-based responses | Structured deliverables"
Template_System: "@include shared/*.yml | 70% reduction achieved"
Symbols: "→(leads to) |(separator) &(combine) :(define) »(sequence) @(location)"
```

### **Intelligent Auto-Activation**
```yaml
File_Type_Detection: 
  tsx_jsx: "→frontend persona"
  py_js: "→appropriate stack"
  sql: "→data operations"
  Docker: "→devops workflows"
  test: "→qa persona"
  api: "→backend focus"

Keyword_Triggers:
  bug_error_issue: "→analyzer persona"
  optimize_performance: "→performance persona"
  secure_auth_vulnerability: "→security persona"
  refactor_clean: "→refactorer persona"
  explain_document_tutorial: "→mentor persona"
  design_architecture: "→architect persona"
```

---

## **📁 Directory Structure & File Organization**

### **Documentation Paths**
```yaml
Claude_Docs: ".claudedocs/"
Reports: ".claudedocs/reports/"
Metrics: ".claudedocs/metrics/"
Summaries: ".claudedocs/summaries/"
Checkpoints: ".claudedocs/checkpoints/"
Tasks: ".claudedocs/tasks/"

Project_Documentation: "docs/"
API_Docs: "docs/api/"
User_Docs: "docs/user/"
Developer_Docs: "docs/dev/"
```

### **Configuration Files Structure**
```yaml
Main_Config: ".claude/settings.local.json"
Shared_Configs: ".claude/shared/"
Command_Patterns: ".claude/commands/shared/"
Personas: ".claude/shared/superclaude-personas.yml"
MCP_Integration: ".claude/shared/superclaude-mcp.yml"
```

---

This configuration system provides unprecedented power and flexibility for AI-assisted development. Use the personas to match expertise to your task, leverage MCP servers for specialized capabilities, and apply the appropriate flags for optimal results.

## **🚀 Getting Started**

1. **Choose your persona** based on the type of work you're doing
2. **Select appropriate MCP servers** for your specific needs  
3. **Use the right command** with relevant flags
4. **Apply evidence-based practices** throughout development
5. **Leverage UltraCompressed mode** for efficiency when needed

The system is designed to be intelligent, adaptive, and focused on delivering high-quality, evidence-based solutions while maintaining security and performance standards.
Super_Claude_Docs.md

Displaying Super_Claude_Docs.md.