import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import JournalAnalyst from './pages/JournalAnalyst';
import JournalMaker from './pages/JournalMaker';
import EbookMaker from './pages/EbookMaker';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/journal-analyst" element={
          <ProtectedRoute>
            <JournalAnalyst />
          </ProtectedRoute>
        } />
        <Route path="/journal-maker" element={
          <ProtectedRoute>
            <JournalMaker />
          </ProtectedRoute>
        } />
        <Route path="/ebook-maker" element={
          <ProtectedRoute>
            <EbookMaker />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
