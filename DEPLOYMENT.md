# Deployment Guide — thespicybookcoven.com

This guide walks through deploying the full app:
- **Frontend** (React) → Vercel → `thespicybookcoven.com`
- **Backend** (FastAPI) → Render
- **Database** (Postgres) → Render
- **Domain** → Namecheap DNS pointed at Vercel

> Complete this guide only once the app is working locally.

---

## Overview

```
Browser → thespicybookcoven.com → Vercel (React frontend)
                                       ↓ API calls
                              Render (FastAPI backend)
                                       ↓
                              Render (Postgres database)
```

---

## Step 1 — Push code to GitHub

1. Go to github.com and create a new repository named `book-club` (set to Private)
2. In your terminal, from the `book-club` folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/book-club.git
git branch -M main
git push -u origin main
```

> Make sure `.env` is in your `.gitignore` so your passwords are never pushed to GitHub.
> Add this line to `.gitignore` if it isn't there:
> ```
> backend/.env
> ```

---

## Step 2 — Set up the database on Render

1. Go to render.com and create a free account
2. Click **New → PostgreSQL**
3. Fill in:
   - **Name:** `book-club-db`
   - **Region:** pick the one closest to you (US East is fine)
   - **Plan:** Free
4. Click **Create Database**
5. On the database page, find the **Internal Database URL** — copy it and save it somewhere (you'll need it in Step 3)

---

## Step 3 — Deploy the backend on Render

### 3a. Code changes before deploying

The backend currently uses SQLite. Swap it for Postgres by updating two files:

**`backend/requirements.txt`** — add psycopg2:
```
psycopg2-binary==2.9.10
```

**`backend/database.py`** — replace the hardcoded SQLite URL with an environment variable:
```python
import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bookclub.db")
```

Render's Postgres URLs start with `postgres://` but SQLAlchemy requires `postgresql://`.
Add this fix right after:
```python
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
```

Commit and push these changes:
```bash
git add backend/requirements.txt backend/database.py
git commit -m "Add Postgres support for production"
git push
```

### 3b. Create the web service on Render

1. In Render, click **New → Web Service**
2. Connect your GitHub account and select the `book-club` repository
3. Fill in:
   - **Name:** `book-club-api`
   - **Root directory:** `backend`
   - **Runtime:** Python 3
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Scroll down to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste the Internal Database URL from Step 2)* |
| `SECRET_KEY` | *(any long random string — e.g. open a terminal and run `python -c "import secrets; print(secrets.token_hex(32))"`)* |
| `CLUB_PASSWORD` | *(the password your friends will use to enter the site)* |
| `ADMIN_USERNAME` | *(your admin username)* |

5. Click **Create Web Service**
6. Wait for the first deploy to finish (2–5 minutes)
7. Copy the URL Render gives you — it will look like `https://book-club-api.onrender.com`

---

## Step 4 — Deploy the frontend on Vercel

### 4a. Code change — point the frontend at the live backend

Update `frontend/src/api/client.ts` — replace the hardcoded localhost URL with an environment variable:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});
```

Update `frontend/vite.config.ts` — no changes needed, Vite reads `VITE_*` env vars automatically.

Also update `backend/main.py` — add your live domain to the CORS allowed origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://thespicybookcoven.com",
        "https://www.thespicybookcoven.com",
    ],
    ...
)
```

Commit and push:
```bash
git add frontend/src/api/client.ts backend/main.py
git commit -m "Configure frontend and CORS for production"
git push
```

### 4b. Deploy on Vercel

1. Go to vercel.com and create a free account (sign in with GitHub)
2. Click **Add New → Project**
3. Import your `book-club` repository
4. Fill in:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite (Vercel detects this automatically)
   - **Build command:** `npm run build` (default)
   - **Output directory:** `dist` (default)
5. Scroll down to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | *(the Render URL from Step 3, e.g. `https://book-club-api.onrender.com`)* |

6. Click **Deploy**
7. Wait for the build to finish (1–2 minutes)
8. Vercel will give you a temporary URL like `https://book-club-xyz.vercel.app` — test it before setting up the domain

---

## Step 5 — Connect thespicybookcoven.com

### 5a. Add the domain in Vercel

1. In Vercel, go to your project → **Settings → Domains**
2. Type `thespicybookcoven.com` and click **Add**
3. Also add `www.thespicybookcoven.com`
4. Vercel will show you DNS records to add — you'll need:
   - An **A record** for the apex domain (`@`)
   - A **CNAME record** for `www`

### 5b. Update DNS in Namecheap

1. Log in to Namecheap → **Domain List** → click **Manage** next to `thespicybookcoven.com`
2. Go to **Advanced DNS**
3. Delete any existing A records and CNAME records for `@` and `www`
4. Add the records Vercel showed you:

| Type | Host | Value |
|------|------|-------|
| A Record | `@` | `76.76.21.21` *(Vercel's IP — confirm in Vercel dashboard)* |
| CNAME | `www` | `cname.vercel-dns.com` *(confirm in Vercel dashboard)* |

5. Set TTL to **Automatic**
6. Save

> DNS changes can take anywhere from 5 minutes to 48 hours to propagate worldwide.
> Vercel will show a green checkmark once it detects the DNS is working.

---

## Step 6 — Verify everything works

- [ ] `https://thespicybookcoven.com` loads the app
- [ ] Club password entry works
- [ ] Name picker shows members
- [ ] Books and schedule pages load
- [ ] Vercel auto-deploys when you push to `main` on GitHub

---

## Ongoing workflow

Once deployed, your workflow for making changes is:

```bash
# Make changes locally, test them
# Then:
git add .
git commit -m "your message"
git push
# Vercel and Render will automatically redeploy
```

---

## Notes

**Free tier limitations:**
- Render's free backend **spins down after 15 minutes of inactivity** — the first request after it sleeps takes ~30 seconds to wake up. This is fine for a small book club. You can upgrade to Render's $7/month plan to keep it always on.
- Vercel's free tier has no meaningful limits for a site this size.

**Sharing with friends:**
- Tell them to go to `thespicybookcoven.com`
- Give them the club password
- Create their accounts from the Members page before they visit
