import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import PrivateRoute from './components/Layout/PrivateRoute';
import Header from './components/Layout/Header';
import EmployeeForm from './components/Employees/EmployeeForm';
import OptionsPage from './components/Options/OptionsPage';
import Analytics from './components/Analytics/Analytics';
import DocumentsPage from './components/Documents/DocumentsPage';
import SignDocument from './components/Documents/SignDocument';
import AccountingPage from './components/Accounting/AccountingPage';
import HomePage from './components/Home/HomePage';
import './App.css';

function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

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

          {/* Public sign page */}
          <Route path="/sign/:token" element={<SignDocument />} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
