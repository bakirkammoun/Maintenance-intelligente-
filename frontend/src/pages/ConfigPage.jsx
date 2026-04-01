import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import {
  Settings,
  Save,
  Activity,
  Thermometer,
  Zap,
  Volume2,
  Sliders,
  Monitor
} from 'lucide-react';
import './ConfigPage.css';

const ConfigPage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    samplingRate: 1000,
    bufferSize: 100,
    sensors: {
      vibration: { enabled: true, threshold: 0.2 },
      temperature: { enabled: true, threshold: 75 },
      current: { enabled: true, threshold: 0.25 },
      sound: { enabled: true, threshold: 90 },
    },
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      setFormData({
        samplingRate: selectedDevice.samplingRate || 1000,
        bufferSize: selectedDevice.bufferSize || 100,
        sensors: selectedDevice.sensors || formData.sensors,
      });
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const response = await api.get('/devices');
      setDevices(response.data);
      if (response.data.length > 0 && !selectedDevice) {
        setSelectedDevice(response.data[0]);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDevice) return;

    try {
      await api.put(`/devices/${selectedDevice.deviceId}`, formData);
      toast.success('Configuration sauvegardée');
      fetchDevices();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(error);
    }
  };

  const updateSensorThreshold = (sensor, field, value) => {
    setFormData({
      ...formData,
      sensors: {
        ...formData.sensors,
        [sensor]: {
          ...formData.sensors[sensor],
          [field]: field === 'enabled' ? value : parseFloat(value),
        },
      },
    });
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="config-page">
      <div className="header-group">
        <h1>Configuration Système</h1>
        <p className="dashboard-subtitle">Gérez les paramètres d'acquisition et les seuils d'alerte de vos machines.</p>
      </div>

      <div className="config-grid-layout">
        <div className="sidebar-section">
          <div className="config-card device-select-card">
            <h3>Sélection Machine</h3>
            <div className="machine-selector-config">
              <Monitor size={18} />
              <select
                value={selectedDevice?.deviceId || ''}
                onChange={(e) => {
                  const device = devices.find((d) => d.deviceId === e.target.value);
                  setSelectedDevice(device);
                }}
                className="machine-select-dropdown-config"
              >
                {devices.map((device) => (
                  <option key={device._id} value={device.deviceId}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedDevice && (
              <div className="device-mini-info">
                <span className="label">ID:</span> <span className="val">{selectedDevice.deviceId}</span>
                <span className="label">Type:</span> <span className="val">{selectedDevice.type}</span>
              </div>
            )}
          </div>

          <div className="config-card general-settings-card">
            <h3><Sliders size={20} /> Général</h3>
            {selectedDevice && (
              <div className="inputs-vertical">
                <div className="input-group">
                  <label>Fréquence d'échantillonnage (ms)</label>
                  <input
                    type="number"
                    min="100"
                    max="60000"
                    value={formData.samplingRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        samplingRate: parseInt(e.target.value),
                      })
                    }
                    className="premium-input"
                  />
                </div>
                <div className="input-group">
                  <label>Taille du buffer</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={formData.bufferSize}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bufferSize: parseInt(e.target.value),
                      })
                    }
                    className="premium-input"
                  />
                </div>
              </div>
            )}
          </div>

          <button onClick={handleSubmit} className="btn-save-all">
            <Save size={18} /> Sauvegarder
          </button>
        </div>

        <div className="sensors-section">
          {selectedDevice && (
            <div className="sensors-grid">
              {Object.entries(formData.sensors).map(([sensor, config]) => (
                <div key={sensor} className={`sensor-card ${config.enabled ? 'active' : ''}`}>
                  <div className="sensor-card-header">
                    <div className={`sensor-icon-bg ${sensor}`}>
                      {sensor === 'vibration' && <Activity size={24} />}
                      {sensor === 'temperature' && <Thermometer size={24} />}
                      {sensor === 'current' && <Zap size={24} />}
                      {sensor === 'sound' && <Volume2 size={24} />}
                    </div>
                    <div className="sensor-title">
                      <h4>{sensor.charAt(0).toUpperCase() + sensor.slice(1)}</h4>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => updateSensorThreshold(sensor, 'enabled', e.target.checked)}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  </div>

                  {config.enabled && (
                    <div className="sensor-body">
                      <label>Seuil d'alerte</label>
                      <div className="input-with-unit">
                        <input
                          type="number"
                          step="0.1"
                          value={config.threshold}
                          onChange={(e) => updateSensorThreshold(sensor, 'threshold', e.target.value)}
                          className="premium-input-small"
                        />
                        <span className="unit-badge">
                          {sensor === 'temperature' ? '°C' : sensor === 'current' ? 'A' : sensor === 'sound' ? 'dB' : 'G'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;

