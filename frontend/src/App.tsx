import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import EntryPage from "./pages/EntryPage";
import DashboardPage from "./pages/DashboardPage";
import BooksPage from "./pages/BooksPage";
import SchedulePage from "./pages/SchedulePage";
import MembersPage from "./pages/MembersPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import GroupAvailabilityPage from "./pages/GroupAvailabilityPage";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/enter" replace />;
  if (adminOnly && user.club_role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/enter" element={user ? <Navigate to="/dashboard" replace /> : <EntryPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen">
              <Navbar />
              {/*
                key={user?.club_id} forces all page components to fully remount
                when the active club changes, so their useEffect hooks re-fire
                and fetch fresh data for the new club.
              */}
              <main key={user?.club_id ?? 0} className="max-w-5xl mx-auto px-4 py-8">
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/books" element={<BooksPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/availability" element={<AvailabilityPage />} />
                  <Route path="/group-availability" element={<GroupAvailabilityPage />} />
                  <Route
                    path="/members"
                    element={
                      <ProtectedRoute adminOnly>
                        <MembersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
