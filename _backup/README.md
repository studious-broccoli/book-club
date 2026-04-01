# Auth Backup — Full JWT Authentication

This folder contains the original full JWT authentication implementation.
Swap these back in if you want individual username/password login for each member.

## Files

- `backend/auth_jwt.py` → replace `backend/auth.py`
- `frontend/LoginPage_jwt.tsx` → replace `frontend/src/pages/LoginPage.tsx`
- `frontend/AuthContext_jwt.tsx` → replace `frontend/src/context/AuthContext.tsx`

You'll also need to:
1. Remove the club-password flow from `backend/main.py` (`/auth/enter` and `/auth/select`)
2. Restore the `POST /auth/login` endpoint that takes `{username, password}`
3. Update `frontend/src/App.tsx` to route `/login` → `LoginPage` instead of `EntryPage`
