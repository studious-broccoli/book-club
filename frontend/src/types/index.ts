export interface User {
  id: number;
  username: string;
  email: string | null;
  heart_color: string;
  role: "admin" | "member";       // global role
  display_name: string;            // per-club display name
  club_role: "admin" | "member";  // role within the current club
  club_id: number;
  club_name: string;
  created_at: string;
}

export interface UserOut {
  id: number;
  username: string;
  email: string | null;
  heart_color: string;
  role: "admin" | "member";
  created_at: string;
}

export interface ClubMember {
  user_id: number;
  username: string;
  display_name: string;
  heart_color: string;
  role: "admin" | "member";
}

export interface ClubEntry {
  club_id: number;
  club_name: string;
  members: ClubMember[];
}

export interface Preferences {
  no_weeknights: boolean;
  preferred_days: string[];
  notes: string | null;
  blackout_dates: string[];
}

export interface UserWithPreferences extends User {
  preferences: Preferences | null;
}

export interface MemberWithPreferences {
  user_id: number;
  username: string;
  display_name: string;
  heart_color: string;
  role: "admin" | "member";
  email: string | null;
  preferences: Preferences | null;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  genre: string | null;
  pages: number | null;
  is_winner: boolean;
  vote_count: number;
  user_voted: boolean;
  suggested_by_id: number;
  suggested_by_name: string;
  suggested_by_heart: string;
  created_at: string;
}

export interface BookRanking {
  book_ids_ordered: number[];
}

export interface AvailabilityEntry {
  user_id: number;
  display_name: string;
  status: "yes" | "no";
}

export interface AvailabilitySummary {
  yes: number;
  no: number;
  total: number;
}

export interface MeetingDate {
  id: number;
  datetime_utc: string;
  label: string | null;
  availability_summary: AvailabilitySummary;
  my_status: "yes" | "no" | null;
  availabilities: AvailabilityEntry[];
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface SlotAvailability {
  available: number;
  tentative: number;
  unavailable: number;
}

export interface GroupAvailabilityDay {
  date: string;
  morning: SlotAvailability;
  afternoon: SlotAvailability;
  evening: SlotAvailability;
  total_members: number;
}

// ── Poll ──────────────────────────────────────────────────────────────────────

export interface PollBookOption {
  book_id: number;
  title: string;
  author: string;
  vote_count: number;
  user_voted: boolean;
}

export interface Poll {
  id: number;
  book_options: PollBookOption[];
  end_date: string;          // ISO date "2026-05-01"
  winner_book_id: number | null;
  total_members: number;
  votes_cast: number;
  is_complete: boolean;
}

// ── Cadence ───────────────────────────────────────────────────────────────────

export interface Cadence {
  frequency: "weekly" | "biweekly" | "monthly";
  day_of_week: number | null;   // 0=Mon … 6=Sun
  week_of_month: number | null; // 1–5
  preferred_time: "morning" | "afternoon" | "evening" | null;
  notes: string | null;
}

// ── Final Selection ───────────────────────────────────────────────────────────

export interface FinalSelection {
  book_id: number | null;
  book_title: string | null;
  book_author: string | null;
  confirmed_datetime: string | null;
  notes: string | null;
  updated_at: string;
}
