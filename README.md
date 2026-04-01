# Book Club Organizer

A web app to help organize book clubs — think **Doodle + Goodreads + Notion, but simple**.

> **Status:** In development — local prototype

---

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Backend  | Python · FastAPI · SQLite   |
| Frontend | TypeScript · React · Vite · Tailwind CSS |
| Auth     | JWT tokens (admin + member roles) |

---

## Project Structure

```
book-club/
├── backend/
│   ├── main.py              # FastAPI app, startup, auth routes
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT creation, password hashing, role guards
│   ├── database.py          # SQLite engine and session
│   ├── routers/
│   │   ├── books.py         # Book nominations and voting
│   │   ├── schedule.py      # Meeting dates and availability
│   │   └── members.py       # Member management and preferences
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/           # LoginPage, Dashboard, Books, Schedule, Members
        ├── components/      # Navbar
        ├── context/         # AuthContext (login state)
        ├── api/             # Axios client with JWT interceptor
        └── types/           # TypeScript interfaces
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Copy the example env file (optional — defaults work for local dev)
cp .env.example .env

# Start the API server
uvicorn main:app --reload
```

The API will be running at `http://localhost:8000`.

On first run, an **admin account is created automatically** and the credentials are printed in the terminal.
Default credentials: `admin / bookclub123` — change these in `.env` before sharing with friends.

Interactive API docs: `http://localhost:8000/docs`

### 2. Set up the frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be running at `http://localhost:5173`.

---

## Usage

### As admin
1. Log in with admin credentials
2. Go to **Members** — create accounts for each book club member
3. Go to **Books** — nominate books for the current cycle
4. Go to **Schedule** — propose meeting dates
5. After voting closes, go to **Books** and click "Pick" on the winner

### As a member
1. Log in with the credentials the admin created for you
2. Go to **Books** — vote on nominated books
3. Go to **Schedule** — mark your availability for each proposed date

---

## Features

### Club Dashboard
- Overview of active books, next proposed date, and member count

### Book Voting
- Admin nominates books with title, author, genre, and page count
- All members vote (toggle on/off)
- Admin marks the winner — highlighted at the top

### Scheduling Poll
- Admin proposes dates (stored in UTC, displayed in ET and MT)
- Members click Available / Not available
- Live count of who can make each date

### Member Management (admin only)
- Create and delete member accounts
- View each member's scheduling preferences

### Member Preferences
- Each member can set: no weeknights, preferred days, notes, blackout dates

---

## Non-Goals

To keep scope in check, this app is intentionally **not**:
- A social network (no public profiles, no followers)
- A book review platform (no ratings/reviews system)
- A general-purpose scheduling tool (built specifically for book clubs)

---

## Future Features

### Nice to Have
- Best date suggestion based on availability (auto-rank)
- Notifications ("vote now!" reminders)
- Mobile-friendly responsive design

### Stretch Goals
- Goodreads API integration (pull book metadata automatically)
- Google Calendar sync
- Hosted version for friends to access without running locally
- Native mobile app
