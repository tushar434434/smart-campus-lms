import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { StudentsPage, StudentDetailPage } from './pages/StudentsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { QuizzesPage } from './pages/QuizzesPage';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />
          <Route element={<ProtectedRoute roles={['faculty', 'admin']} />}>
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:studentId" element={<StudentDetailPage />} />
          </Route>
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}
