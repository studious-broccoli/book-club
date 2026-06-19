# The Spicy Book Coven — Features

A web app for organizing a book club: nominating books, voting, scheduling meetings, and tracking availability across members.

---

## Dashboard

The home screen gives a quick snapshot of the club's current state.

- **Confirmed meeting** — displays the locked-in book and date/time once an admin confirms them
- **Current pick** — shows the book the club is actively reading
- **Book vote** — surfaces the active poll (if one is running) so members can vote without navigating away
- **Next proposed date** — shows the nearest proposed meeting date and how many members are available
- **Stat cards** — quick counts of nominated books, proposed dates, and members, each linking to the full page
- **How to use** — collapsible step-by-step guide for new members

---

## Books

Members can nominate books and vote on what the club should read next.

- **Google Books search** — search by title or author; selecting a result auto-fills title, author, genre, and page count
- **Manual entry** — fill in any fields the search didn't populate
- **Duplicate prevention** — the app blocks adding a book that's already on the list
- **Voting** — any member can toggle their vote on any nominated book; vote counts are visible to all
- **My Ranking** — drag-and-drop (or arrow buttons) to set a personal preference order; used by admins when generating a poll
- **Current pick** — admin can mark one book as the book the club is currently reading (highlighted at the top)
- **Completed archive** — admin marks a book as read after the club finishes it; completed books move to a separate "Books we've read" section and are excluded from future polls

---

## Polls

Admins can run a structured vote to choose the next book.

- **Poll creation** — admin sets a closing date; the app automatically selects 3 books based on members' saved rankings
- **Blind voting** — results are hidden while voting is open; members only see how many people have voted
- **Results** — once the poll closes, vote counts and a bar chart are revealed, and the winner is highlighted
- **One vote per member** — members pick one book; changing a vote replaces the previous one
- **Poll management** — admin can delete an active poll at any time

---

## Schedule

Coordinates when the club will meet.

- **Meeting cadence** — admin can record the club's recurring meeting pattern (e.g. "2nd Saturday of every month, Evening") as a reference for members
- **Proposed dates** — any member can propose a date and time; proposals are timezone-aware (ET, CT, MT, PT)
- **Availability voting** — members mark themselves as Available or Not Available on each proposed date; a live count shows how many can make it
- **Confirmed meeting** — admin picks a final book and date/time; optionally adds notes (e.g. Zoom link); this confirmed meeting appears on the dashboard
- **Quick confirm** — admin can promote a proposed date directly to the confirmed meeting with one click

---

## My Availability

A personal calendar for marking general recurring availability.

- **3-month calendar view** — shows the current month and two months ahead
- **Time slots** — each day has three slots: Morning (10am MT / 12pm ET), Afternoon (1pm MT / 3pm ET), Evening (6pm MT / 8pm ET)
- **Three statuses** — Available, Tentative, or Unavailable per slot
- **Drag to mark** — click and drag across multiple days to mark a range at once
- **Auto-save** — changes save automatically as you interact

---

## Group Availability

A read-only view of the whole club's availability calendar, so anyone can see when the group is free at a glance.

---

## Members

Manages who is in the club.

- **Member list** — all club members shown with their display name, role (admin or member), and personal heart color
- **Add member** — admin can create a new account (first name, last name, password, optional email) or add an existing user to the club
- **Remove member** — admin can remove someone from a club without deleting their account
- **Multi-club support** — a single user account can belong to multiple book clubs; a global admin can manage all clubs from one view
- **Create club** — global admin can create new clubs with a name and shared password

---

## Authentication

- **Club password** — members enter a shared club password to identify which club they're joining
- **Personal login** — each member has their own username and password
- **Roles** — two roles: `admin` (full access) and `member` (can nominate, vote, and mark availability)
- **JWT tokens** — sessions are maintained via tokens; no cookies
