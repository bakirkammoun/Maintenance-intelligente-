import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import websocket from '../services/websocket';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  MoreVertical,
  Activity,
  Plus
} from 'lucide-react';
import './AlertsPage.css';

const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    type: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;


  useEffect(() => {
    fetchAlerts();
    // fetchStatistics(); // Removed separate call, can be derived or kept if backend provides
    setCurrentPage(1); // Reset page on filter change

    // Setup WebSocket
    websocket.connect();
    websocket.on('alert', handleNewAlert);

    return () => {
      websocket.off('alert', handleNewAlert);
    };
  }, [filters]);

  const handleNewAlert = (data) => {
    if (data.type === 'alert') {
      const newAlert = data.data;

      // Check if filters apply to this new alert
      let matchesFilter = true;
      if (filters.status && newAlert.status !== filters.status) matchesFilter = false;
      if (filters.severity && newAlert.severity !== filters.severity) matchesFilter = false;
      if (filters.type && newAlert.type !== filters.type) matchesFilter = false;

      if (matchesFilter) {
        setAlerts(prev => {
          const filtered = prev.filter(a => a._id !== newAlert._id);
          return [newAlert, ...filtered];
        });
      }
    }
  };

  const fetchAlerts = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.type) params.type = filters.type;

      const response = await api.get('/alerts', { params });
      setAlerts(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des alertes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await api.get('/alerts/statistics');
      setStatistics(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
    }
  };


  const addTestAlert = () => {
    const newAlert = {
      _id: 'test-' + Date.now(),
      type: ['vibration', 'temperature', 'current', 'sound'][Math.floor(Math.random() * 4)],
      severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
      message: 'Alerte de Test simulée pour validation visuelle',
      deviceId: 'DEVICE-TEST-001',
      date: new Date().toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
      value: Math.floor(Math.random() * 100)
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="alerts-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Alertes</h1>
          <button onClick={addTestAlert} className="btn-test-alert">
            <Plus size={16} /> Simuler Alerte
          </button>
        </div>

        <div className="filters-container">
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les statuts</option>
              <option value="open">Ouvert</option>
              <option value="acknowledged">Reconnu</option>
              <option value="resolved">Résolu</option>
              <option value="closed">Fermé</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="filter-select"
            >
              <option value="">Toutes les sévérités</option>
              <option value="low">Faible</option>
              <option value="medium">Moyenne</option>
              <option value="high">Élevée</option>
              <option value="critical">Critique</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les types</option>
              <option value="vibration">Vibration</option>
              <option value="temperature">Température</option>
              <option value="current">Courant</option>
              <option value="sound">Son</option>
            </select>
          </div>
        </div>
      </div>

      <div className="alerts-stats-grid">
        <div className="stat-card-premium total">
          <div className="icon-wrapper"><Activity size={20} /></div>
          <div className="stat-content">
            <span className="label">Total Alertes</span>
            <span className="value">{alerts.length}</span>
          </div>
        </div>
        <div className="stat-card-premium critical">
          <div className="icon-wrapper"><AlertTriangle size={20} /></div>
          <div className="stat-content">
            <span className="label">Critiques</span>
            <span className="value">{alerts.filter(a => a.severity === 'critical').length}</span>
          </div>
        </div>
        <div className="stat-card-premium open">
          <div className="icon-wrapper"><Clock size={20} /></div>
          <div className="stat-content">
            <span className="label">En attente</span>
            <span className="value">{alerts.filter(a => a.status === 'open').length}</span>
          </div>
        </div>
        <div className="stat-card-premium resolved">
          <div className="icon-wrapper"><CheckCircle2 size={20} /></div>
          <div className="stat-content">
            <span className="label">Résolues</span>
            <span className="value">{alerts.filter(a => a.status === 'resolved').length}</span>
          </div>
        </div>
      </div>

      <div className="alerts-content-grid">
        {alerts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((alert) => (
          <div key={alert._id} className={`alert-card-premium ${alert.severity}`}>
            <div className="card-top-row">
              <div className="alert-type-badge">
                {alert.type === 'temperature' && <span className="icon-temp">🌡️</span>}
                {alert.type === 'vibration' && <span className="icon-vib">〰️</span>}
                {alert.type === 'current' && <span className="icon-curr">⚡</span>}
                {alert.type}
              </div>
              <span className="alert-time">{format(new Date(alert.updatedAt || alert.createdAt || Date.now()), 'dd MMM, HH:mm')}</span>
            </div>

            <h3 className="alert-title">{alert.message}</h3>

            <div className="alert-meta-row">
              <span className="device-id-tag">#{alert.deviceId}</span>
              {alert.value && <span className="value-tag">Val: {alert.value}</span>}
            </div>

            <div className="card-actions-row">
              <span className={`status-pill small ${alert.status}`}>{alert.status}</span>

              {alert.status === 'open' && (
                <div className="action-buttons-placeholder">
                  {/* Buttons removed per user request */}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {alerts.length === 0 && (
        <div className="empty-state-card">
          <div className="empty-icon-bg">
            <CheckCircle2 size={48} className="empty-icon" />
          </div>
          <h3>Tout est calme</h3>
          <p>Aucune alerte à signaler pour le moment.</p>
          <button onClick={addTestAlert} className="btn-create-test">
            Générer une alerte de test
          </button>
        </div>
      )}

      {alerts.length > itemsPerPage && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>

          <span className="pagination-info">
            Page {currentPage} sur {Math.ceil(alerts.length / itemsPerPage)}
          </span>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(alerts.length / itemsPerPage), p + 1))}
            disabled={currentPage === Math.ceil(alerts.length / itemsPerPage)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;

