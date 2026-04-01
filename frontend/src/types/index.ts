export interface User {
  id: number;
  username: string;
  email: string | null;
  role: "admin" | "member";
  heart_color: string;
  created_at: string;
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

export interface Book {
  id: number;
  title: string;
  author: string;
  genre: string | null;
  pages: number | null;
  is_winner: boolean;
  vote_count: number;
  user_voted: boolean;
  created_at: string;
}

export interface AvailabilityEntry {
  user_id: number;
  username: string;
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
