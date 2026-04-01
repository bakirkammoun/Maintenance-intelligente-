import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { format } from 'date-fns';
import {
  Search,
  Calendar,
  Filter,
  History,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle2
} from 'lucide-react';
import './LogsPage.css';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    deviceId: '',
    level: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    // Note: Cette page nécessiterait un endpoint API pour les logs
    // Pour l'instant, on simule des données
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    // TODO: Implémenter l'endpoint API pour les logs
    // Pour l'instant, on simule
    setTimeout(() => {
      setLogs([
        {
          id: 1,
          timestamp: new Date(),
          level: 'info',
          deviceId: 'ESP32-001',
          message: 'Mesure reçue avec succès',
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 60000),
          level: 'warning',
          deviceId: 'ESP32-002',
          message: 'Seuil de vibration dépassé',
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 120000),
          level: 'error',
          deviceId: 'ESP32-001',
          message: 'Erreur de connexion MQTT',
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'info': return <Info size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      case 'error': return <XCircle size={16} />;
      case 'success': return <CheckCircle2 size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className="logs-page">
      <div className="header-group">
        <h1><History size={28} className="header-icon" /> Logs Système</h1>
        <p className="dashboard-subtitle">Historique des événements et alertes du système.</p>
      </div>

      <div className="logs-controls-card">
        <div className="search-group">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par Device ID..."
            value={filters.deviceId}
            onChange={(e) => setFilters({ ...filters, deviceId: e.target.value })}
            className="premium-search-input"
          />
        </div>

        <div className="filters-row">
          <div className="filter-wrapper">
            <Filter size={16} className="field-icon" />
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
              className="premium-select-filter"
            >
              <option value="">Tous niveaux</option>
              <option value="info">Info</option>
              <option value="warning">ing</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
          </div>

          <div className="filter-wrapper date-wrapper">
            <Calendar size={16} className="field-icon" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="premium-date-input"
            />
          </div>

          <div className="filter-wrapper date-wrapper">
            <span className="separator">à</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="premium-date-input"
            />
          </div>
        </div>
      </div>

      <div className="logs-table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Date/Heure</th>
              <th>Niveau</th>
              <th>Machine</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="time-cell">{format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}</td>
                <td>
                  <span className={`log-badge ${log.level}`}>
                    {getLevelIcon(log.level)}
                    {log.level}
                  </span>
                </td>
                <td className="device-cell">{log.deviceId}</td>
                <td className="message-cell">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && (
          <div className="empty-state-logs">
            <History size={48} />
            <p>Aucun log trouvé pour cette période.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPage;

