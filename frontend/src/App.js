import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import PrivateRoute from './components/Layout/PrivateRoute';
import Header from './components/Layout/Header';
import EmployeeList from './components/Employees/EmployeeList';
import EmployeeForm from './components/Employees/EmployeeForm';
import SalaryList from './components/Salaries/SalaryList';
import OptionsPage from './components/Options/OptionsPage';
import Analytics from './components/Analytics/Analytics';
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
                  <EmployeeList />
                </>
              </PrivateRoute>
            }
          />
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
            path="/salaries"
            element={
              <PrivateRoute>
                <>
                  <Header />
                  <SalaryList />
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

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
