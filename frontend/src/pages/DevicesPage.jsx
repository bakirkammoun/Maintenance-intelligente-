import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import websocket from '../services/websocket';
import { format } from 'date-fns';
import { Filter } from 'lucide-react';
import './DevicesPage.css';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', type: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchDevices();
    websocket.connect();

    const handleMeasurement = (data) => {
      setDevices(prevDevices =>
        prevDevices.map(device =>
          device.deviceId === data.deviceId
            ? {
              ...device,
              latestMeasurement: {
                vibration: data.data?.vibration?.magnitude ?? 0,
                temperature: data.data?.temperature ?? 0,
                current: data.data?.current ?? 0,
                sound: data.data?.sound ?? 0,
                timestamp: data.data?.timestamp
              }
            }
            : device
        )
      );
    };

    // Quand un nouveau device est auto-enregistré (ex: Wokwi ESP32-001), recharger la liste
    const handleDeviceRegistered = () => {
      fetchDevices();
    };

    websocket.on('measurement', handleMeasurement);
    websocket.on('device_registered', handleDeviceRegistered);

    return () => {
      websocket.off('measurement', handleMeasurement);
      websocket.off('device_registered', handleDeviceRegistered);
    };
  }, [filter]);

  const fetchDevices = async () => {
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.type) params.type = filter.type;

      const response = await api.get('/devices', { params });
      setDevices(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des devices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getStatusColor = (status) => {
    const colors = {
      active: '#27ae60',
      inactive: '#95a5a6',
      maintenance: '#f39c12',
      error: '#e74c3c',
    };
    return colors[status] || '#95a5a6';
  };

  const isDeviceOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastSeen) > fiveMinutesAgo;
  };

  // Générer des valeurs simulées stables basées sur le deviceId
  // Générer des valeurs simulées dynamiques basées sur le temps
  // Générer des valeurs simulées dynamiques basées sur le temps
  // Obtenir les heures de travail (simulées basées sur deviceId pour la stabilité)
  const getWorkingHours = (device) => {
    const seed = device.deviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const now = new Date();
    const time = now.getTime() / 1000;
    const baseHours = 1500 + (seed % 4000);
    return baseHours + (time % 3600) / 3600;
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="devices-page">
      <div className="page-header">
        <h1>Machines</h1>
        <div className="filters-container">
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="maintenance">Maintenance</option>
              <option value="error">Erreur</option>
            </select>
          </div>
          <div className="filter-group">
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="filter-select"
            >
              <option value="">Tous les types</option>
              <option value="motor">Moteur</option>
              <option value="pump">Pompe</option>
              <option value="compressor">Compresseur</option>
              <option value="fan">Ventilateur</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>
      </div>

      <div className="devices-list">
        {devices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((device) => {
          const latest = device.latestMeasurement || {};

          const vibration = latest.vibration ?? 0;
          const temperature = latest.temperature ?? 0;
          const current = latest.current ?? 0;
          const workingHours = getWorkingHours(device);


          // Utiliser les seuils configurés
          const vibThreshold = device.sensors?.vibration?.threshold || 0.2;
          const tempThreshold = device.sensors?.temperature?.threshold || 75;
          const currThreshold = device.sensors?.current?.threshold || 0.25;

          // Calcul de probabilité simplifié (le calcul complet est au backend, 
          // mais on peut l'approximer ici pour une réactivité immédiate avant le prochain fetch)
          const vibrationRisk = Math.min(Math.max(vibration / vibThreshold, 0), 1);
          const temperatureRisk = Math.min(Math.max((temperature - 40) / (tempThreshold - 40), 0), 1);
          const currentRisk = Math.min(Math.max(current / currThreshold, 0), 1);
          const hoursRisk = Math.min((workingHours - 1500) / 4000, 1);
          const totalRisk = (vibrationRisk * 0.3 + temperatureRisk * 0.3 + currentRisk * 0.2 + hoursRisk * 0.2);
          const failureProbability = Math.min(Math.max(totalRisk * 100, 0), 100);

          const getStatus = (prob) => {
            if (prob >= 80) return { label: 'CRITIQUE', color: '#EE5D50', bg: '#fee2e2' };
            if (prob >= 50) return { label: 'AVERTISSEMENT', color: '#FFB547', bg: '#fff7ed' };
            return { label: 'OPÉRATIONNEL', color: '#05CD99', bg: '#ecfdf5' };
          };
          const statusInfo = getStatus(failureProbability);

          return (
            <Link
              key={device._id}
              to={`/devices/${device.deviceId}`}
              className="device-card-robot"
            >
              <div className="device-card-header">
                <h3 className="device-name">{device.deviceId}</h3>
                <span
                  className="status-badge"
                  style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                >
                  {statusInfo.label}
                </span>
              </div>

              <div className="device-metrics-section">
                <div className="metric-row">
                  <div className="metric-box">
                    <span className="metric-label">Température</span>
                    <span className="metric-value-blue">{temperature.toFixed(1)}°C</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Vibration</span>
                    <span className="metric-value-blue">{vibration.toFixed(3)} G</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Courant</span>
                    <span className="metric-value-blue">{current.toFixed(1)} A</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Heures de travail</span>
                    <span className="metric-value-blue">{workingHours.toFixed(1)}h</span>
                  </div>
                </div>
              </div>

              <div className="failure-probability-section">
                <div className="failure-probability-header">
                  <span className="failure-label">Probabilité de panne</span>
                  <span className="failure-percentage">{failureProbability.toFixed(1)}%</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${failureProbability}%`,
                      background: failureProbability >= 80
                        ? '#EE5D50'
                        : failureProbability >= 50
                          ? '#FFB547'
                          : '#05CD99'
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {devices.length === 0 && (
        <div className="empty-state">
          <p>Aucune machine trouvée</p>
        </div>
      )}

      {devices.length > itemsPerPage && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Précédent
          </button>

          <span className="pagination-info">
            Page {currentPage} sur {Math.ceil(devices.length / itemsPerPage)}
          </span>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(devices.length / itemsPerPage), p + 1))}
            disabled={currentPage === Math.ceil(devices.length / itemsPerPage)}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;

