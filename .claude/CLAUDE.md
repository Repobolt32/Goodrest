# Goodrest — Claude Code Project Config

## Pre-Reply Routing Protocol

**Before replying to any task, match the request domain to the correct agent and load its instructions.**

### Step 1: Classify the request domain from these keywords:

| Trigger Keywords | Agent | Read File |
|---|---|---|
| backend, server, api, endpoint, database, auth | Backend Specialist | `.claude/agents/backend-specialist.md` |
| bug, error, crash, broken, investigate, fix | Debugger | `.claude/agents/debugger.md` |
| deploy, production, server, pm2, rollback, ci/cd | DevOps Engineer | `.claude/agents/devops-engineer.md` |
| explore, audit, refactor, architecture | Explorer Agent | `.claude/agents/explorer-agent.md` |
| component, react, ui, ux, css, tailwind, responsive | Frontend Specialist | `.claude/agents/frontend-specialist.md` |
| multi-agent, coordinate, complex task | Orchestrator | `.claude/agents/orchestrator.md` |
| requirements, user story, acceptance criteria, product | Product Manager | `.claude/agents/product-manager.md` |
| plan, project, breakdown, task | Project Planner | `.claude/agents/project-planner.md` |
| e2e, playwright, cypress, pipeline, regression | QA Automation Engineer | `.claude/agents/qa-automation-engineer.md` |
| security, vulnerability, owasp, xss, injection, pentest | Security Auditor | `.claude/agents/security-auditor.md` |
| test, spec, coverage, jest, pytest | Test Engineer | `.claude/agents/test-engineer.md` |

### Step 2: Load the agent file. Apply its specialized rules before responding.

### Step 3: If multiple domains match, load the primary agent first, then secondary.

### Quick Reference

| Need | Agent | Key Skills |
|---|---|---|
| Web UI | Frontend Specialist | nextjs-react-expert, tailwind-patterns, responsive-design, obsidian-glass-card |
| API/Backend | Backend Specialist | api-patterns, nodejs-best-practices, database-design, razorpay |
| Electron Desktop | (use electron-best-practices skill) | electron-best-practices |
| Security | Security Auditor | vulnerability-scanner, red-team-tactics |
| Testing | Test Engineer | testing-patterns, tdd-workflow, webapp-testing |
| Debug | Debugger | systematic-debugging |
| Planning | Project Planner | brainstorming, plan-writing |

## Project Skills

Custom skills in `.claude/skills/` (loaded on-demand via when_to_use):

| Skill | Trigger |
|---|---|
| `code-review-graph` | Reviewing code in large codebases, token efficiency, blast radius analysis |
| `electron-best-practices` | Electron, electron-vite, electron-forge, contextBridge, IPC, desktop app |
| `next-best-practices` | Next.js 15+ performance, streaming, server components |
| `obsidian-glass-card` | Dark UI, glassmorphic cards, Gastronome design system |
| `powershell-windows` | Windows PowerShell scripts, Windows-specific commands |
| `razorpay` | Payment integration, checkout, webhooks, Supabase orders |
| `responsive-design` | Container queries, fluid typography, CSS Grid, mobile-first |
| `grill-me` | Relentless interview about a plan or design |
| `tdd` | Test-driven development with red-green-refactor loop |
| `diagnose` | Disciplined diagnosis loop for hard bugs |
| `improve-codebase-architecture` | Find deepening opportunities and refactor for AI-navigability |

## Project Type Routing

| Project Type | Primary Skills |
|---|---|
| **WEB** (Next.js) | `nextjs-react-expert`, `tailwind-patterns`, `responsive-design`, `obsidian-glass-card` |
| **BACKEND** (DB) | `supabase-postgres-best-practices`, `razorpay`, `api-patterns`, `database-design` |
| **ELECTRON** (Desktop) | `electron-best-practices` |

## Verification Scripts

| Script | When to Use |
|---|---|
| `checklist.py` | Dev checks: security, lint, schema, tests, UX, SEO |
| `verify_all.py` | Full deploy audit |

Run: `python .claude/scripts/checklist.py .` or `python .claude/scripts/verify_all.py .`

## Full Architecture Map

See `.claude/ARCHITECTURE.md` for complete agent/skill/workflow reference.