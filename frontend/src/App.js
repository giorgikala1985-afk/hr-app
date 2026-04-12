import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PortalAuthProvider } from './contexts/PortalAuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Register from './components/Auth/Register';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Layout/AdminRoute';
import Header from './components/Layout/Header';
import EmployeeForm from './components/Employees/EmployeeForm';
import OptionsPage from './components/Options/OptionsPage';
import Analytics from './components/Analytics/Analytics';
import DocumentsPage from './components/Documents/DocumentsPage';
import SignDocument from './components/Documents/SignDocument';
import AccountingPage from './components/Accounting/AccountingPage';
import HomePage from './components/Home/HomePage';
import AdminPage from './components/Admin/AdminPage';
import PortalLogin from './components/Portal/PortalLogin';
import PortalPrivateRoute from './components/Portal/PortalPrivateRoute';
import PortalDashboard from './components/Portal/PortalDashboard';
import PortalDocuments from './components/Portal/PortalDocuments';
import PortalPayroll from './components/Portal/PortalPayroll';
import PortalScan from './components/Portal/PortalScan';
import './App.css';

function App() {
  return (
    <ThemeProvider>
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <HomePage />
                </>
              </PrivateRoute>
            }
          />
          <Route path="/employees" element={<Navigate to="/documents" replace />} />
          <Route
            path="/employees/new"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <EmployeeForm />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/employees/:id/edit"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <EmployeeForm />
                </>
              </PrivateRoute>
            }
          />

          <Route
            path="/options"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <OptionsPage />
                </>
              </PrivateRoute>
            }
          />

          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <Analytics />
                </>
              </PrivateRoute>
            }
          />

          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <DocumentsPage />
                </>
              </PrivateRoute>
            }
          />

          <Route
            path="/accounting"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <AccountingPage />
                </>
              </PrivateRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <>
                  <Header />
                  <AdminPage />
                </>
              </AdminRoute>
            }
          />

          {/* Public sign page */}
          <Route path="/sign/:token" element={<SignDocument />} />

          {/* Employee portal */}
          <Route path="/portal" element={<PortalAuthProvider><PortalLogin /></PortalAuthProvider>} />
          <Route path="/portal/home" element={<PortalAuthProvider><PortalPrivateRoute><PortalDashboard /></PortalPrivateRoute></PortalAuthProvider>} />
          <Route path="/portal/documents" element={<PortalAuthProvider><PortalPrivateRoute><PortalDocuments /></PortalPrivateRoute></PortalAuthProvider>} />
          <Route path="/portal/payroll" element={<PortalAuthProvider><PortalPrivateRoute><PortalPayroll /></PortalPrivateRoute></PortalAuthProvider>} />
          <Route path="/portal/scan" element={<PortalAuthProvider><PortalPrivateRoute><PortalScan /></PortalPrivateRoute></PortalAuthProvider>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
