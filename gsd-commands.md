To give you the smoothest development experience in `goodrest`, you should treat these **GSD Commands** like a professional flight checklist. 

Here are the most powerful commands and how to string them together for a "Pro" flow.

---

### 🟢 Phase 1: The Ignition (Start of Day / Feature)

| Command | What it does | When to use it |
|---|---|---|
| **`/gsd:new-project`** | Scaffolds the entire root (`REQUIREMENTS.md`, `ROADMAP.md`). | Use this ONCE at the start of `goodrest`. |
| **`/gsd:analyze`** | Scans your `goodrest` folder and tells you what's missing. | Use this if you feel I am "forgetting" how the backend and frontend connect. |

---

### 🟡 Phase 2: The Execution (Drip Feed)
*This is how you keep me moving without me getting confused by too much data.*

| Command | What it does | Why it’s "Pro" |
|---|---|---|
| **`/gsd:next`** | Picks the next unchecked task in `task.md` and starts coding it. | Prevents me from "thinking" about the whole project. Keeps me focused on **one small win** at a time. |
| **`/gsd:status`** | Renders a progress bar and a list of completed vs. pending tasks. | Use this if you want to know: "How long until we can launch?" |
| **`/gsd:checkpoint`** | Saves the current "State" of the project into `STATE.md`. | Use this before you go for a lunch break. When you come back, I’ll know exactly where I left off. |

---

### 🔴 Phase 3: The Recovery (When things break)

| Command | What it does | How it helps |
|---|---|---|
| **`/gsd:debug`** | Enters "Deep Debug" mode. I will stop coding and start **Logic Tracing**. | Use this if you see a bug that doesn't make sense. It stops me from "guessing" and makes me "prove" the fix. |
| **`/gsd:rebase`** | Re-aligns the `task.md` with the code if they get out of sync. | Use this if I finished a task but forgot to check the box. |

---

### 🔵 Phase 4: The Verification (The "Zero Bug" Rule)

| Command | What it does | The Result |
|---|---|---|
| **`/gsd:test`** | Runs the `checklist.py` and all unit tests. | Use this **before every commit**. It’s the "Final Gate" that ensures the code is clean. |
| **`/gsd:ship`** | Prepares the code for Vercel/Railway deployment. | Use this only when every box in the `task.md` is checked `[x]`. |

---

### 🔥 The "Elite" Workflow Strategy:

**1. The 15-Minute Sync:**
Every 15 minutes, if I haven't talked to you, just type **`/gsd:status`**. This keeps me "awake" and focused on the physical files in your root.

**2. The Atomic Step:**
Instead of saying "Build the whole app," say **`/gsd:next`**. This forces me to follow your `ROADMAP.md` step-by-step. This is the **number one secret** to how `Lazyhire` reached such high quality—you never let me do too much at once.

**3. The Plan Audit:**
Before I write a single line of code for a new task, I will generate an `implementation_plan.md`. Read it! If you see something you don't like, say **"STOP. Add X to the plan."** Then run **`/gsd:next`** again.

**Ready to fire the first shot with `/gsd:new-project`?**