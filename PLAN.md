# Book Club App — Launch Plan

This is your step-by-step path from "code on my laptop" to "live website my whole club can use."


---
Terminal 1 — Backend:


cd c:\Users\arian_oh3txn2\code\book-club\backend
venv\Scripts\activate
uvicorn main:app --reload

Terminal 2 — Frontend:
cd c:\Users\arian_oh3txn2\code\book-club\frontend
npm run dev


---

## Where things stand right now

| Area | Status |
|------|--------|
| Backend features | Done — books, voting poll, schedule, availability (AM/PM/Eve), members, cadence, final selection |
| Frontend features | Done — all pages built and connected |
| Local development | Needs DB reset (schema changed), then ready to run |
| Production code changes | 3 small changes needed before deploying |
| Deployment | Not done yet |
| Domain (thespicybookcoven.com) | Not connected yet |
| Members added | Not done (do after deploy) |

---

## Phase 1 — Get it running locally

Do this first. Don't touch deployment until the app works on your machine.

### 1a. Reset the database

The availability table schema changed (added time slots). The old `.db` file won't work with the new code.

```bash
# From the book-club folder:
del backend\bookclub.db
```

The database will be recreated automatically when the server starts.

### 1b. Start the backend

```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The server runs at `http://localhost:8000`. On first start it will print the club password.

### 1c. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### 1d. Verify each feature works

Go through this checklist before moving to deployment:

- [ ] Can enter the club with the password and pick a member
- [ ] Dashboard loads — shows stats, poll section, confirmed meeting section
- [ ] **Poll:** Admin can start a poll (needs 3+ books first); members can vote; winner shows when everyone votes or end date passes
- [ ] **Books:** Admin can add books; members can vote on them; admin can mark winner
- [ ] **Schedule:** Admin can set cadence; admin can confirm a book + meeting time; admin can propose dates; members can mark yes/no availability
- [ ] **My Availability:** Calendar loads; can select multiple slots (Morning, Afternoon, Evening, All day); clicking/dragging marks dates; saves automatically
- [ ] **Group Availability:** Heatmap shows combined member availability
- [ ] **Members:** Admin can add and remove members

---

## Phase 2 — Code changes before deploying

Three small changes are required so the app works in production. Make these before pushing to GitHub.

### 2a. Make the database URL configurable

Right now `database.py` hardcodes SQLite. Production will use Postgres on Render.

**Edit `backend/database.py`** — replace the hardcoded URL:

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bookclub.db")

# Render's Postgres URLs start with postgres:// but SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 2b. Make the frontend API URL configurable

Right now `client.ts` hardcodes `localhost`. Production needs to point at Render.

**Edit `frontend/src/api/client.ts`** — change the `baseURL` line:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});
```

### 2c. Lock down CORS to your real domain

Right now `allow_origins=["*"]` allows any website to call your API. Tighten this for production.

**Edit `backend/main.py`** — replace the CORS middleware block:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://thespicybookcoven.com",
        "https://www.thespicybookcoven.com",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2d. Add Postgres driver to requirements

**Edit `backend/requirements.txt`** — add one line:

```
psycopg2-binary==2.9.10
```

### 2e. Create a root `.gitignore`

There's no root-level `.gitignore` yet. Create one at `book-club/.gitignore`:

```
# Secrets
backend/.env

# Database
backend/*.db

# Python
backend/venv/
backend/__pycache__/
backend/**/__pycache__/

# Node
frontend/node_modules/
frontend/dist/

# OS
.DS_Store
Thumbs.db
```

---

## Phase 3 — Push to GitHub

1. Create a new **private** repository on github.com named `book-club`
2. From the `book-club` folder in your terminal:

```bash
git remote add origin https://github.com/YOUR_USERNAME/book-club.git
git branch -M main
git add .
git commit -m "Ready for deployment"
git push -u origin main
```

Verify on GitHub that `backend/.env` and `backend/bookclub.db` are **not** in the repo.

---

## Phase 4 — Deploy the database (Render)

1. Go to [render.com](https://render.com) → sign up / log in
2. Click **New → PostgreSQL**
3. Fill in:
   - **Name:** `book-club-db`
   - **Region:** Oregon (US West) or Ohio (US East) — pick the closest
   - **Plan:** Free
4. Click **Create Database**
5. On the database dashboard, copy the **Internal Database URL** — save it, you'll need it in Phase 5

---

## Phase 5 — Deploy the backend (Render)

1. In Render, click **New → Web Service**
2. Connect your GitHub account → select the `book-club` repo
3. Fill in:
   - **Name:** `book-club-api`
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Scroll to **Environment Variables** → add all four:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | The Internal Database URL you copied in Phase 4 |
| `SECRET_KEY` | Run `python -c "import secrets; print(secrets.token_hex(32))"` in your terminal and paste the output |
| `CLUB_PASSWORD` | Whatever password your club will use to log in |
| `ADMIN_USERNAME` | Your admin username (e.g. `ari`) |

5. Click **Create Web Service**
6. Wait 3–5 minutes for the first deploy
7. Copy your Render URL — looks like `https://book-club-api.onrender.com`
8. Test it: open `https://book-club-api.onrender.com/docs` in a browser — you should see the FastAPI docs page

---

## Phase 6 — Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → sign up with GitHub
2. Click **Add New → Project** → import `book-club`
3. Fill in:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite (auto-detected)
   - **Build command:** `npm run build` (default)
   - **Output directory:** `dist` (default)
4. Scroll to **Environment Variables** → add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Your Render URL from Phase 5 (e.g. `https://book-club-api.onrender.com`) |

5. Click **Deploy** — takes 1–2 minutes
6. Vercel gives you a temporary URL like `https://book-club-xyz.vercel.app`
7. Open it and test the full app before connecting the domain

---

## Phase 7 — Connect thespicybookcoven.com

### In Vercel:
1. Go to your project → **Settings → Domains**
2. Add `thespicybookcoven.com` and `www.thespicybookcoven.com`
3. Vercel will show you the DNS records you need

### In Namecheap:
1. Log in → **Domain List** → **Manage** next to `thespicybookcoven.com`
2. Go to **Advanced DNS**
3. Delete any existing A records and CNAME records for `@` and `www`
4. Add the records Vercel shows you (typically):

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

5. Save — DNS can take up to 48 hours but usually works within 30 minutes
6. Vercel shows a green checkmark when it's verified

---

## Phase 8 — Initial club setup

Once the live site is working, do this before sharing with anyone:

1. **Log in as admin** using the club password and your admin username
2. **Add every member** from the Members page (name + username for each person)
3. **Set the meeting cadence** on the Schedule page so everyone knows the recurring pattern
4. **Add the books** your club is currently considering to the Books page
5. **Start a poll** if you're ready to vote on the next book (needs 3+ books)
6. **Share the site and password** with your club members

---

## Ongoing workflow

Once everything is live, making changes is simple:

```bash
# Make and test changes locally
# Then push to GitHub:
git add .
git commit -m "describe what you changed"
git push
```

Vercel and Render will automatically redeploy within a few minutes. No manual steps needed.

---

## Known limitations (free tiers)

| Service | Limitation | Impact |
|---------|-----------|--------|
| Render free backend | Spins down after 15 min of no traffic | First visit after inactivity takes ~30 sec to load. Upgrade to $7/mo to eliminate this. |
| Render free Postgres | 1 GB storage, expires after 90 days | Fine for a book club. You'll need to recreate the DB every 90 days on the free plan, or upgrade to $7/mo. |
| Vercel free frontend | No meaningful limits for this use case | No issues expected. |

---

## Quick reference — what each URL does

| URL | What it is |
|-----|-----------|
| `http://localhost:5173` | Frontend while developing locally |
| `http://localhost:8000` | Backend API while developing locally |
| `http://localhost:8000/docs` | Interactive API docs (useful for debugging) |
| `https://book-club-api.onrender.com` | Live backend (your actual URL will differ) |
| `https://thespicybookcoven.com` | Live frontend — what your club visits |
