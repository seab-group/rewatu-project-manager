import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from '@/store/AppStore';
import { AppShell } from '@/components/layout/AppShell';
import PortfolioDashboard from '@/pages/PortfolioDashboard';
import MyTasks from '@/pages/MyTasks';
import CalendarPage from '@/pages/CalendarPage';
import ProjectsList from '@/pages/ProjectsList';
import NewProjectWizard from '@/pages/NewProjectWizard';
import DocumentsGlobal from '@/pages/DocumentsGlobal';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import ProjectWorkspace from '@/pages/project/ProjectWorkspace';
import ProjectDashboard from '@/pages/project/ProjectDashboard';
import ProjectSetup from '@/pages/project/ProjectSetup';
import DeliveryPlan from '@/pages/project/DeliveryPlan';
import SubmissionsRegister from '@/pages/project/SubmissionsRegister';
import ProjectDocuments from '@/pages/project/ProjectDocuments';
import ProjectReports from '@/pages/project/ProjectReports';

/**
 * Path routing in development and behind a real server. A single-file build —
 * one HTML document with no server to rewrite paths — uses hash routing, so a
 * reload or a shared deep link still lands where it should.
 */
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<PortfolioDashboard />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="projects" element={<ProjectsList />} />
            <Route path="projects/new" element={<NewProjectWizard />} />
            <Route path="projects/:projectId" element={<ProjectWorkspace />}>
              <Route index element={<ProjectDashboard />} />
              <Route path="setup" element={<ProjectSetup />} />
              <Route path="plan" element={<DeliveryPlan />} />
              <Route path="submissions" element={<SubmissionsRegister />} />
              <Route path="documents" element={<ProjectDocuments />} />
              <Route path="reports" element={<ProjectReports />} />
            </Route>
            <Route path="documents" element={<DocumentsGlobal />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}
