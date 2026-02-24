import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import './Insurance.css';

function InsurancePage() {
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Plan form
  const [provider, setProvider] = useState('');
  const [planName, setPlanName] = useState('');
  const [coverageType, setCoverageType] = useState('');
  const [premium, setPremium] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Assignment form
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansRes, assignmentsRes, employeesRes] = await Promise.all([
        api.get('/insurance/plans'),
        api.get('/insurance/assignments'),
        api.get('/employees'),
      ]);
      setPlans(plansRes.data.plans);
      setAssignments(assignmentsRes.data.assignments);
      setEmployees(employeesRes.data.employees);
    } catch (err) {
      setError(t('ins.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => { setError(''); setSuccess(''); };

  // ===== Plan CRUD =====
  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setSavingPlan(true);
    try {
      const payload = {
        provider, plan_name: planName, coverage_type: coverageType, premium: parseFloat(premium),
      };
      if (editingPlan) {
        await api.put(`/insurance/plans/${editingPlan.id}`, payload);
        setSuccess(t('ins.planUpdated'));
      } else {
        await api.post('/insurance/plans', payload);
        setSuccess(t('ins.planCreated'));
      }
      resetPlanForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('ins.saveFailed'));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setProvider(plan.provider);
    setPlanName(plan.plan_name);
    setCoverageType(plan.coverage_type);
    setPremium(plan.premium.toString());
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm(t('ins.deletePlanConfirm'))) return;
    clearMessages();
    try {
      await api.delete(`/insurance/plans/${id}`);
      setSuccess(t('ins.planDeleted'));
      loadData();
    } catch (err) {
      setError(t('ins.deleteFailed'));
    }
  };

  const resetPlanForm = () => {
    setEditingPlan(null);
    setProvider('');
    setPlanName('');
    setCoverageType('');
    setPremium('');
  };

  // ===== Assignment CRUD =====
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setSavingAssignment(true);
    try {
      await api.post('/insurance/assignments', {
        employee_id: selectedEmployee,
        plan_id: selectedPlan,
        start_date: startDate,
      });
      setSuccess(t('ins.assigned'));
      setSelectedEmployee('');
      setSelectedPlan('');
      setStartDate('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('ins.assignFailed'));
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm(t('ins.removeConfirm'))) return;
    clearMessages();
    try {
      await api.delete(`/insurance/assignments/${id}`);
      setSuccess(t('ins.removed'));
      loadData();
    } catch (err) {
      setError(t('ins.removeFailed'));
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const totalMonthly = assignments.reduce((sum, a) => sum + parseFloat(a.insurance_plans?.premium || 0), 0);

  if (loading) return <div className="emp-loading">{t('billing.loading')}</div>;

  return (
    <div className="ins-container">
      <div className="ins-header">
        <h1>{t('ins.title')}</h1>
        <p>{t('ins.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <div className="ins-layout">
        {/* Left: Plan Form */}
        <div className="ins-form-card">
          <h3>{editingPlan ? t('ins.editPlan') : t('ins.addPlan')}</h3>
          <form onSubmit={handlePlanSubmit}>
            <div className="ins-form-group">
              <label>{t('ins.provider')}</label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder={t('ins.providerPlaceholder')}
                required
              />
            </div>
            <div className="ins-form-group">
              <label>{t('ins.planName')}</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={t('ins.planNamePlaceholder')}
                required
              />
            </div>
            <div className="ins-form-group">
              <label>{t('ins.coverageType')}</label>
              <input
                type="text"
                value={coverageType}
                onChange={(e) => setCoverageType(e.target.value)}
                placeholder={t('ins.coveragePlaceholder')}
                required
              />
            </div>
            <div className="ins-form-group">
              <label>{t('ins.monthlyPremium')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder={t('ins.premiumPlaceholder')}
                required
              />
            </div>
            <div className="ins-form-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={savingPlan}>
                {savingPlan ? t('ins.saving') : editingPlan ? t('ins.updatePlan') : t('ins.addPlanBtn')}
              </button>
              {editingPlan && (
                <button type="button" className="btn-secondary btn-sm" onClick={resetPlanForm}>
                  {t('ins.cancel')}
                </button>
              )}
            </div>
          </form>

          {/* Plans List */}
          {plans.length > 0 && (
            <div className="ins-plans-list">
              <h4>{t('ins.plans').replace('{count}', plans.length)}</h4>
              {plans.map((plan) => (
                <div key={plan.id} className="ins-plan-item">
                  <div className="ins-plan-info">
                    <span className="ins-plan-name">{plan.plan_name}</span>
                    <span className="ins-plan-meta">{plan.provider} &middot; {plan.coverage_type}</span>
                  </div>
                  <span className="ins-plan-price">{formatCurrency(plan.premium)}</span>
                  <div className="ins-plan-actions">
                    <button className="btn-icon" onClick={() => handleEditPlan(plan)} title={t('common.edit')}>✏️</button>
                    <button className="btn-icon btn-delete" onClick={() => handleDeletePlan(plan.id)} title={t('common.delete')}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Assignments */}
        <div className="ins-assignments-card">
          {/* Assign Form */}
          {plans.length > 0 && (
            <div className="ins-assign-form">
              <h3>{t('ins.assignEmployee')}</h3>
              <form onSubmit={handleAssignSubmit}>
                <div className="ins-assign-grid">
                  <div className="ins-form-group">
                    <label>{t('ins.employee')}</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">{t('ins.selectEmployee')}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ins-form-group">
                    <label>{t('ins.plan')}</label>
                    <select
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">{t('ins.selectPlan')}</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.plan_name} - {plan.provider} ({formatCurrency(plan.premium)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ins-form-group">
                    <label>{t('ins.startDate')}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={savingAssignment}>
                  {savingAssignment ? t('ins.assigning') : t('ins.assign')}
                </button>
              </form>
            </div>
          )}

          {/* Assignments Table */}
          <h3>{t('ins.assignments').replace('{count}', assignments.length)}</h3>
          {assignments.length === 0 ? (
            <div className="ins-empty">{t('ins.noAssignments')}</div>
          ) : (
            <>
              <div className="emp-table-wrapper">
                <table className="emp-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Position</th>
                      <th>Plan</th>
                      <th>Provider</th>
                      <th>{t('ins.coverage')}</th>
                      <th>{t('ins.premium')}</th>
                      <th>Start Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        <td className="emp-name">
                          {a.employees?.first_name} {a.employees?.last_name}
                        </td>
                        <td><span className="position-badge">{a.employees?.position}</span></td>
                        <td>{a.insurance_plans?.plan_name}</td>
                        <td>{a.insurance_plans?.provider}</td>
                        <td><span className="position-badge">{a.insurance_plans?.coverage_type}</span></td>
                        <td className="salary">{formatCurrency(a.insurance_plans?.premium)}</td>
                        <td>{formatDate(a.start_date)}</td>
                        <td>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteAssignment(a.id)}
                            title={t('common.remove')}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ins-total">
                <span>{t('ins.totalMonthlyCost')}</span>
                <span className="ins-total-amount">{formatCurrency(totalMonthly)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsurancePage;
