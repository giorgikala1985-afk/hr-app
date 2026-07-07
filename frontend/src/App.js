import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PortalAuthProvider } from './contexts/PortalAuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Register from './components/Auth/Register';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Layout/AdminRoute';
import Header from './components/Layout/Header';
import EmployeeForm from './components/Employees/EmployeeForm';
import OptionsPage from './components/Options/OptionsPage';
import ProfilePage from './components/Profile/ProfilePage';
import Analytics from './components/Analytics/Analytics';
import DocumentsPage from './components/Documents/DocumentsPage';
import SignDocument from './components/Documents/SignDocument';
import AccountingPage from './components/Accounting/AccountingPage';
import FloatingBots from './components/Accounting/FloatingBots';
import FloatingQuickAdd from './components/Home/FloatingQuickAdd';
import HomePage from './components/Home/HomePage';
import AdminPage from './components/Admin/AdminPage';
import PortalLogin from './components/Portal/PortalLogin';
import PortalPrivateRoute from './components/Portal/PortalPrivateRoute';
import PortalDashboard from './components/Portal/PortalDashboard';
import PortalDocuments from './components/Portal/PortalDocuments';
import PortalPayroll from './components/Portal/PortalPayroll';
import PortalScan from './components/Portal/PortalScan';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#dc2626' }}>
          <strong>Page Error:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 13 }}>
            {this.state.error.toString()}{'\n'}{this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function RadixThemeBridge({ children }) {
  const { theme } = useTheme();
  return (
    <Theme appearance={theme} accentColor="indigo" grayColor="slate" radius="medium" scaling="95%">
      {children}
    </Theme>
  );
}

function App() {
  return (
    <ThemeProvider>
    <RadixThemeBridge>
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
                <ErrorBoundary>
                  <Header />
                  <OptionsPage />
                </ErrorBoundary>
              </PrivateRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <ProfilePage />
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
            path="/finances"
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
        <FloatingBots />
        <FloatingQuickAdd />
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
    </RadixThemeBridge>
    </ThemeProvider>
  );
}

export default App;
