---
trigger: always_on
---

# GEMINI.md - Project Constitution

> This file defines the core behavioral and architectural rules for this workspace. Standardized protocols for planning, execution, and verification are enforced here.

---

## 🔒 Skill-First Protocol (NON-NEGOTIABLE — Enforced Before Every Task)

**This section is Active Law. Violation = STOP. Re-read skills and restart planning.**

Before writing ANY code or making ANY implementation decision, the agent MUST:

1. **Skill & MCP Audit (NON-NEGOTIABLE):** Run `list_dir .agent/skills` and `list_resources` BEFORE performing ANY task. For documentation-only tools (like `context7`), listing resources is OPTIONAL; instead, identify the relevant library IDs needed for the current task.
2. **Cite Skills & Tools:** Every `implementation_plan.md` MUST include `## Skills Consulted` and `## MCP Tools Identified` sections.
3. **Strategic Documentation (Context7 Rule):** Never call Context7 "blindly" at the start. Use it **proactively** during research and coding to verify the latest stable syntax for frameworks (React, Next.js, Framer Motion) used in the implementation.
4. **No Memory Shortcuts:** Training data knowledge is a fallback ONLY. Skills override memory.
5. **Secret-Zero Protocol:** Before writing, generating, or committing ANY code, the agent MUST run a secret scan. No API keys, database URLs, or tokens may ever be hardcoded. Use `.env` with `.gitignore`.

If the user gives a vague instruction, the agent MUST still complete the Skill Audit before touching code.

---

## 📋 GSD Execution Protocol (Every Task, No Exceptions)

Every task MUST follow this exact sequence — no shortcuts:

| Step | Action | Gate |
|------|--------|------|
| 0 | Audit: `list_dir .agent/skills` + `list_resources` (Data) + `context7:resolve-library-id` (Docs) | No code until done |
| 1 | Task List: add sub-steps to `task.md` with `[ ]` checkboxes | No code until done |
| 2 | Implementation Plan: write `implementation_plan.md`, cite skills, get approval | No code until approved |
| 3 | Execute: write code task-by-task, check off `task.md` | Follow plan exactly |
| 4 | Verify: run tests, update `walkthrough.md` | No "done" without proof |

Every `task.md` MUST start with:
- [ ] Skill Audit: Read relevant skills from `.agent/skills/`
- [ ] Write `implementation_plan.md` and get user approval

---

## 📥 REQUEST CLASSIFIER (STEP 1)

**Before ANY action, classify the request:**

| Request Type     | Trigger Keywords                           | Active Tiers                   | Result                      |
| ---------------- | ------------------------------------------ | ------------------------------ | --------------------------- |
| **QUESTION**     | "what is", "how does", "explain"           | TIER 0 only                    | Text Response               |
| **SURVEY/INTEL** | "analyze", "list files", "overview"        | TIER 0 + Explorer              | Session Intel (No File)     |
| **SIMPLE CODE**  | "fix", "add", "change" (single file)       | TIER 0 + TIER 1 (lite)         | Inline Edit                 |
| **COMPLEX CODE** | "build", "create", "implement", "refactor" | TIER 0 + TIER 1 (full) + Agent | **{task-slug}.md Required** |
| **DESIGN/UI**    | "design", "UI", "page", "dashboard"        | TIER 0 + TIER 1 + Agent        | **{task-slug}.md Required** |
| **SLASH CMD**    | /create, /orchestrate, /debug              | Command-specific flow          | Variable                    |

---

## 🤖 INTELLIGENT AGENT ROUTING (STEP 2 - AUTO)

**ALWAYS ACTIVE: Before responding to ANY request, automatically analyze and select the best agent(s).**

> 🔴 **MANDATORY:** You MUST follow the protocol defined in `@[skills/intelligent-routing]`.

### Auto-Selection Protocol

1. **Analyze (Silent)**: Detect domains (Backend, Database, Counter UI, Dashboard, SMS) from user request.
2. **Select Agent(s)**: Choose the most appropriate specialist(s).
3. **Inform User**: Concisely state which expertise is being applied.
4. **Apply**: Generate response using the selected agent's persona and rules.

### Response Format (MANDATORY)

When auto-applying an agent, inform the user:

```markdown
🤖 **Applying knowledge of `@[agent-name]`...**

[Continue with specialized response]
```

**Rules:**

1. **Silent Analysis**: No verbose meta-commentary.
2. **Respect Overrides**: If user mentions `@agent`, use it.
3. **Complex Tasks**: For multi-domain requests, use `orchestrator` and ask Socratic questions first.

---

## TIER 0: UNIVERSAL RULES (Always Active)

### 🌐 Language Handling

When user's prompt is NOT in English:
1. **Internally translate** for better comprehension
2. **Respond in user's language** - match their communication
3. **Code comments/variables** remain in English

### 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow `@[skills/clean-code]` rules. No exceptions.**

- **Code**: Concise, direct, no over-engineering. Self-documenting.
- **Testing**: Mandatory. Pyramid (Unit > Int > E2E) + AAA Pattern.
- **Performance**: Measure first. Adhere to 2025 standards.
- **Infra/Safety**: Verify secrets in environment variables. Never hardcode keys.

---

---

## 🏗️ Architectural Invariants

- **Backend**: Node.js with Express / Fastify / Next.js API.
- **Database**: Supabase (PostgreSQL) / Prisma / Drizzle.
- **Environment**: All secrets in `.env`.

---

## 📂 Folder Structure

```
├── ARCHITECTURE.md      # System Architecture Map
├── CODEBASE.md          # File Dependency Awareness Map
├── .env                 # Secrets
├── .gitignore           # Must ignore .env
├── .planning/           # GSD Operational Artifacts (PLAN.md, UI-SPEC.md)
├── .agent/              # Antigravity Kit (Specialist Agents, Skills, Workflows)
├── .gemini/             # GSD Operational Engine (GSD Agents, Workflows)
├── server/              # Backend logic
└── public/              # Frontend assets
```

---

## 🏁 Final Checklist Protocol (MANDATORY)

A task is NOT finished until verified against the project checklist.

| Script                     | Skill                 | When to Use              |
| -------------------------- | --------------------- | ------------------------ |
| `security_scan.py`         | vulnerability-scanner | Always on deploy         |
| `dependency_analyzer.py`   | vulnerability-scanner | Weekly / Deploy          |
| `lint_runner.py`           | lint-and-validate     | Every code change        |
| `test_runner.py`           | testing-patterns      | After logic change       |
| `schema_validator.py`      | database-design       | After DB change          |
| `ux_audit.py`              | frontend-design       | After UI change          |
| `route_validator.py`       | api-patterns          | After adding new route   |
| `sms_integration_test.py`  | api-patterns          | After Fast2SMS changes   |
| `playwright_runner.py`     | webapp-testing        | Before deploy            |
