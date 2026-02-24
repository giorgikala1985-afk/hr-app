import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import './Gym.css';

function GymPage() {
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Plan form
  const [planName, setPlanName] = useState('');
  const [planProvider, setPlanProvider] = useState('');
  const [planPrice, setPlanPrice] = useState('');
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
        api.get('/gym/plans'),
        api.get('/gym/assignments'),
        api.get('/employees'),
      ]);
      setPlans(plansRes.data.plans);
      setAssignments(assignmentsRes.data.assignments);
      setEmployees(employeesRes.data.employees);
    } catch (err) {
      setError(t('gym.loadFailed'));
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
      if (editingPlan) {
        await api.put(`/gym/plans/${editingPlan.id}`, {
          name: planName, provider: planProvider, price: parseFloat(planPrice),
        });
        setSuccess(t('gym.planUpdated'));
      } else {
        await api.post('/gym/plans', {
          name: planName, provider: planProvider, price: parseFloat(planPrice),
        });
        setSuccess(t('gym.planCreated'));
      }
      resetPlanForm();
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('gym.saveFailed'));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanProvider(plan.provider);
    setPlanPrice(plan.price.toString());
  };

  const handleDeletePlan = async (id) => {
    if (!window.confirm(t('gym.deletePlanConfirm'))) return;
    clearMessages();
    try {
      await api.delete(`/gym/plans/${id}`);
      setSuccess(t('gym.planDeleted'));
      loadData();
    } catch (err) {
      setError(t('gym.deleteFailed'));
    }
  };

  const resetPlanForm = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanProvider('');
    setPlanPrice('');
  };

  // ===== Assignment CRUD =====
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setSavingAssignment(true);
    try {
      await api.post('/gym/assignments', {
        employee_id: selectedEmployee,
        plan_id: selectedPlan,
        start_date: startDate,
      });
      setSuccess(t('gym.assigned'));
      setSelectedEmployee('');
      setSelectedPlan('');
      setStartDate('');
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('gym.assignFailed'));
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm(t('gym.removeConfirm'))) return;
    clearMessages();
    try {
      await api.delete(`/gym/assignments/${id}`);
      setSuccess(t('gym.removed'));
      loadData();
    } catch (err) {
      setError(t('gym.removeFailed'));
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const totalMonthly = assignments.reduce((sum, a) => sum + parseFloat(a.gym_plans?.price || 0), 0);

  if (loading) return <div className="emp-loading">{t('billing.loading')}</div>;

  return (
    <div className="gym-container">
      <div className="gym-header">
        <h1>{t('gym.title')}</h1>
        <p>{t('gym.subtitle')}</p>
      </div>

      {error && <div className="msg-error">{error}</div>}
      {success && <div className="msg-success">{success}</div>}

      <div className="gym-layout">
        {/* Left: Plan Form */}
        <div className="gym-form-card">
          <h3>{editingPlan ? t('gym.editPlan') : t('gym.addPlan')}</h3>
          <form onSubmit={handlePlanSubmit}>
            <div className="gym-form-group">
              <label>{t('gym.planName')}</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={t('gym.planNamePlaceholder')}
                required
              />
            </div>
            <div className="gym-form-group">
              <label>{t('gym.provider')}</label>
              <input
                type="text"
                value={planProvider}
                onChange={(e) => setPlanProvider(e.target.value)}
                placeholder={t('gym.providerPlaceholder')}
                required
              />
            </div>
            <div className="gym-form-group">
              <label>{t('gym.monthlyPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
                placeholder={t('gym.pricePlaceholder')}
                required
              />
            </div>
            <div className="gym-form-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={savingPlan}>
                {savingPlan ? t('gym.saving') : editingPlan ? t('gym.updatePlan') : t('gym.addPlanBtn')}
              </button>
              {editingPlan && (
                <button type="button" className="btn-secondary btn-sm" onClick={resetPlanForm}>
                  {t('gym.cancel')}
                </button>
              )}
            </div>
          </form>

          {/* Plans List */}
          {plans.length > 0 && (
            <div className="gym-plans-list">
              <h4>{t('gym.plans').replace('{count}', plans.length)}</h4>
              {plans.map((plan) => (
                <div key={plan.id} className="gym-plan-item">
                  <div className="gym-plan-info">
                    <span className="gym-plan-name">{plan.name}</span>
                    <span className="gym-plan-provider">{plan.provider}</span>
                  </div>
                  <span className="gym-plan-price">{formatCurrency(plan.price)}</span>
                  <div className="gym-plan-actions">
                    <button className="btn-icon" onClick={() => handleEditPlan(plan)} title={t('common.edit')}>✏️</button>
                    <button className="btn-icon btn-delete" onClick={() => handleDeletePlan(plan.id)} title={t('common.delete')}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Assignments */}
        <div className="gym-assignments-card">
          {/* Assign Form */}
          {plans.length > 0 && (
            <div className="gym-assign-form">
              <h3>{t('gym.assignEmployee')}</h3>
              <form onSubmit={handleAssignSubmit}>
                <div className="gym-assign-grid">
                  <div className="gym-form-group">
                    <label>{t('gym.employee')}</label>
                    <select
                      value={selectedEmployee}
                      onChange={(e) => setSelectedEmployee(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">{t('gym.selectEmployee')}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="gym-form-group">
                    <label>{t('gym.plan')}</label>
                    <select
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">{t('gym.selectPlan')}</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} - {plan.provider} ({formatCurrency(plan.price)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="gym-form-group">
                    <label>{t('gym.startDate')}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary btn-sm" disabled={savingAssignment}>
                  {savingAssignment ? t('gym.assigning') : t('gym.assign')}
                </button>
              </form>
            </div>
          )}

          {/* Assignments Table */}
          <h3>{t('gym.assignments').replace('{count}', assignments.length)}</h3>
          {assignments.length === 0 ? (
            <div className="gym-empty">{t('gym.noAssignments')}</div>
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
                      <th>{t('common.price')}</th>
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
                        <td>{a.gym_plans?.name}</td>
                        <td>{a.gym_plans?.provider}</td>
                        <td className="salary">{formatCurrency(a.gym_plans?.price)}</td>
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
              <div className="gym-total">
                <span>{t('gym.totalMonthlyCost')}</span>
                <span className="gym-total-amount">{formatCurrency(totalMonthly)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GymPage;
