import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import websocket from '../services/websocket';
import { toast } from 'react-toastify';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import {
  Rocket,
  Square,
  BarChart3,
  RefreshCw,
  Activity,
  CheckCircle2,
  Bell,
  AlertTriangle,
  Cpu,
  Monitor,
  Clock,
  Plus,
  MoreHorizontal,
  Brain
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './DashboardPage.css';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [recentMeasurements, setRecentMeasurements] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemRunning, setSystemRunning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [failureProbabilities, setFailureProbabilities] = useState([]);
  const [lastUpdatedAlertId, setLastUpdatedAlertId] = useState(null);


  useEffect(() => {
    if (!authLoading && !user) {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
      }
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchOverview();
      fetchDevices();
      fetchFailureProbabilities();

      setupWebSocket();
    } else if (!authLoading && !user) {
      setLoading(false);
    }

    return () => {
      websocket.off('measurement', handleMeasurement);
      websocket.off('alert', handleAlert);
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedDevice) {
      const device = devices.find(d => d.deviceId === selectedDevice);
      if (device) {
        setSystemRunning(device.status === 'active');
      }

      fetchDeviceMeasurements(selectedDevice);
      fetchForecastData(selectedDevice);

      const liveInterval = setInterval(() => {
        setRecentMeasurements((prev) => {
          if (prev.length === 0) return prev;

          const last = prev[prev.length - 1];
          const now = new Date();

          const newMeasurement = {
            ...last,
            timestamp: now,
            temperature: last.temperature + (Math.random() - 0.5) * 0.2,
            vibration: Math.max(0, last.vibration + (Math.random() - 0.5) * 0.01),
            current: Math.max(0, last.current + (Math.random() - 0.5) * 0.01),
          };

          return [...prev.slice(-49), newMeasurement];
        });
      }, 2000);

      return () => clearInterval(liveInterval);
    }
  }, [selectedDevice, devices]);

  const fetchOverview = async () => {
    try {
      const response = await api.get('/dashboard/overview');
      setOverview(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFailureProbabilities = async () => {
    try {
      const response = await api.get('/dashboard/failure-probabilities');
      setFailureProbabilities(response.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des probabilités de panne:', error);
    }
  };



  const fetchForecastData = async (deviceId) => {
    try {
      const response = await api.get(`/dashboard/forecast/${deviceId}`);
      if (response.data && response.data.forecast) {
        setForecastData(response.data.forecast);
        setAiAnalysis(response.data);
      } else if (Array.isArray(response.data)) {
        // Fallback for legacy format
        setForecastData(response.data);
        setAiAnalysis(null);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des prévisions:', error);
    }
  };

  const fetchDeviceMeasurements = async (deviceId) => {
    try {
      const response = await api.get('/measurements', {
        params: {
          deviceId: deviceId,
          limit: 50
        }
      });
      if (response.data && response.data.length > 0) {
        const formattedData = response.data.map(m => ({
          timestamp: new Date(m.timestamp),
          vibration: m.vibration?.magnitude || m.vibration || 0,
          temperature: m.temperature || 0,
          current: m.current || 0,
        }));
        setRecentMeasurements(formattedData);
      } else {
        setRecentMeasurements([]);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des mesures:', error);
      setRecentMeasurements([]);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await api.get('/devices');
      setDevices(response.data);
      if (response.data.length > 0 && !selectedDevice) {
        setSelectedDevice(response.data[0].deviceId);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des devices:', error);
    }
  };


  const setupWebSocket = () => {
    websocket.connect();
    websocket.on('measurement', handleMeasurement);
    websocket.on('alert', handleAlert);
  };

  const handleAlert = (data) => {
    if (data.type === 'alert') {
      const alert = data.data;

      // Update overview stats and recent alerts
      setOverview(prev => {
        if (!prev) return prev;

        // Move to top if exists, or just add to top
        const filteredAlerts = (prev.recentAlerts || []).filter(a => a._id !== alert._id);
        const newRecentAlerts = [alert, ...filteredAlerts].slice(0, 10);

        // Update count only if it's a completely new alert
        const isNew = !prev.recentAlerts?.some(a => a._id === alert._id);

        // Visual trigger for real-time update
        setLastUpdatedAlertId(alert._id);
        setTimeout(() => setLastUpdatedAlertId(null), 2000);

        return {
          ...prev,
          openAlerts: isNew ? (prev.openAlerts || 0) + 1 : (prev.openAlerts || 0),
          recentAlerts: newRecentAlerts
        };
      });
    }
  };

  const handleMeasurement = (data) => {
    if (data.type === 'measurement' && data.data.deviceId === selectedDevice) {
      setRecentMeasurements((prev) => {
        const newData = [...prev, {
          timestamp: new Date(data.data.timestamp),
          vibration: data.data.vibration?.magnitude || data.data.vibration || 0,
          temperature: data.data.temperature || 0,
          current: data.data.current || 0,
        }];
        return newData.slice(-50);
      });
    }
  };

  const handleStartSystem = async () => {
    if (!selectedDevice) return;
    try {
      await api.put(`/devices/${selectedDevice}`, { status: 'active' });
      setSystemRunning(true);
      // Update devices list to reflect change
      setDevices(devices.map(d => d.deviceId === selectedDevice ? { ...d, status: 'active' } : d));
      // Re-fetch overview to update "Machines actives" count
      fetchOverview();
      toast.success('Machine démarrée avec succès !');
    } catch (error) {
      console.error('Erreur lors du démarrage du système:', error);
      toast.error('Erreur lors du démarrage du système');
    }
  };

  const handleStopSystem = async () => {
    if (!selectedDevice) return;
    try {
      await api.put(`/devices/${selectedDevice}`, { status: 'inactive' });
      setSystemRunning(false);
      // Update devices list
      setDevices(devices.map(d => d.deviceId === selectedDevice ? { ...d, status: 'inactive' } : d));
      fetchOverview();
      toast.success('Machine arrêtée avec succès !');
    } catch (error) {
      console.error('Erreur lors de l\'arrêt du système:', error);
      toast.error('Erreur lors de l\'arrêt du système');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedDevice) {
      toast.warning('Veuillez sélectionner une machine d\'abord.');
      return;
    }

    const device = devices.find(d => d.deviceId === selectedDevice);
    if (!device) return;

    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text('Rapport de Maintenance Prédictive - Dashboard', 105, 15, { align: 'center' });

      doc.setFontSize(12);
      doc.text(`Machine: ${device.name || device.deviceId}`, 14, 30);
      doc.text(`Statut: ${device.status === 'active' ? 'Opérationnel' : 'Arrêté'}`, 14, 37);
      doc.text(`Localisation: ${device.location || 'N/A'}`, 14, 44);
      doc.text(`Date du rapport: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 51);

      // AI Analysis
      if (aiAnalysis) {
        doc.setFontSize(16);
        doc.text('Analyse IA', 14, 65);
        doc.setFontSize(10);
        doc.text(`Santé actuelle: ${aiAnalysis.currentHealth || 0}%`, 14, 72);
        doc.text(`RUL Estimé: ${aiAnalysis.rul || 7} jours`, 14, 78);
        doc.text(`Tendance: ${aiAnalysis.trend || 'Stable'}`, 14, 84);
      }

      // Measurements Table
      const tableData = recentMeasurements.slice(0, 20).map(m => [
        format(new Date(m.timestamp), 'HH:mm:ss'),
        `${m.temperature?.toFixed(1) || 0} °C`,
        `${m.vibration?.toFixed(3) || 0} G`,
        `${m.current?.toFixed(1) || 0} A`
      ]);

      autoTable(doc, {
        startY: aiAnalysis ? 95 : 65,
        head: [['Heure', 'Température', 'Vibration', 'Courant']],
        body: tableData,
      });

      doc.save(`rapport_dashboard_${selectedDevice}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('Rapport téléchargé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      toast.error('Erreur lors de la génération du rapport');
    }
  };

  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      try {
        await api.post('/dashboard/refresh-data');
      } catch (error) {
        console.warn('Erreur lors de la génération de nouvelles données:', error);
      }

      const promises = [
        fetchOverview(),
        fetchFailureProbabilities(),
      ];

      if (selectedDevice) {
        promises.push(fetchDeviceMeasurements(selectedDevice));
        promises.push(fetchForecastData(selectedDevice));
      }

      await Promise.all(promises);
      setRefreshing(false);
    } catch (error) {
      console.error('Erreur lors de l\'actualisation des données:', error);
      setRefreshing(false);
      toast.error('Erreur lors de l\'actualisation des données');
    }
  };

  const handleChartClick = (data) => {
    const clickedDeviceId = data?.activePayload?.[0]?.payload?.deviceId || data?.activeLabel;

    if (clickedDeviceId) {
      setSelectedDevice(clickedDeviceId);
      const realtimeSection = document.querySelector('.realtime-section');
      if (realtimeSection) {
        realtimeSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleChartDoubleClick = (data) => {
    const clickedDeviceId = data?.activePayload?.[0]?.payload?.deviceId || data?.activeLabel;

    if (clickedDeviceId) {
      navigate(`/devices/${clickedDeviceId}`);
    }
  };


  if (authLoading || loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="dashboard-page">
      <div className="header-group">
        <h1>Dashboard Overview</h1>
        <p className="dashboard-subtitle">Monitoring and predictive analysis for industrial assets.</p>
      </div>

      <div className="dashboard-top-container">
        <div className="left-column-stack">
          <div className="mini-stats-row">
            <div className="stat-card total">
              <div className="stat-icon-wrapper"><Monitor size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">Machines totales</div>
                <div className="stat-value">{overview?.totalDevices || 0}</div>
              </div>
            </div>

            <div className="stat-card active">
              <div className="stat-icon-wrapper"><CheckCircle2 size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">Machines actives</div>
                <div className="stat-value">{overview?.activeDevices || 0}</div>
              </div>
            </div>

            <div className="stat-card alerts">
              <div className="stat-icon-wrapper"><Bell size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">Alertes ouvertes</div>
                <div className="stat-value">{overview?.openAlerts || 0}</div>
              </div>
            </div>

            <div className="stat-card issues">
              <div className="stat-icon-wrapper"><AlertTriangle size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">Machines inactives</div>
                <div className="stat-value">{overview?.inactiveDevices || 0}</div>
              </div>
            </div>
          </div>

          <div className="dashboard-section alerts-container">
            <div className="section-header">
              <h2>Alertes récentes</h2>
              <div className="header-actions">
                <Plus size={20} className="action-icon plus" />
                <MoreHorizontal size={20} className="action-icon more" />
              </div>
            </div>
            <div className="alerts-list">
              {overview?.recentAlerts?.length > 0 ? (
                overview.recentAlerts.slice(0, 4).map((alert) => (
                  <Link
                    key={`${alert._id}-${alert.updatedAt}`}
                    to={`/alerts`}
                    className={`alert-item-card-stack ${lastUpdatedAlertId === alert._id ? 'pulse-active' : ''}`}
                  >
                    <div className="alert-type-label">{alert.type}</div>
                    <div className="alert-machine-label">Machine: {alert.deviceId}</div>
                    <div className={`alert-severity-label ${alert.severity}`}>{alert.severity}</div>
                    <div className="alert-time-label">
                      {format(new Date(alert.updatedAt || alert.createdAt || Date.now()), 'HH:mm')}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="no-alerts">
                  <CheckCircle2 size={40} />
                  <p>Aucune alerte récente</p>
                </div>
              )}
            </div>
            <div className="view-all-wrapper">
              <Link to="/alerts" className="view-all-btn">Voir tout le rapport</Link>
            </div>
          </div>
        </div>

        <div className="control-card">
          <div className="card-header">
            <h3>System Control</h3>
            <div className="card-dots">...</div>
          </div>

          <div className="card-visual">
            <div className="half-circle">
              <div className={`visual-value ${systemRunning ? 'active' : 'inactive'}`}>
                {systemRunning ? 'Actif' : 'Arrêté'}
              </div>
              <div className="visual-label">Statut</div>
            </div>
          </div>

          <div className="dashboard-controls">
            <button className="control-btn" onClick={handleStartSystem} disabled={systemRunning}>
              <Rocket size={20} />
              <span>Démarrer</span>
            </button>
            <button className="control-btn" onClick={handleStopSystem} disabled={!systemRunning}>
              <Square size={20} />
              <span>Arrêter</span>
            </button>
            <button className="control-btn" onClick={handleGenerateReport}>
              <BarChart3 size={20} />
              <span>Rapport</span>
            </button>
            <button className="control-btn" onClick={handleRefreshData} disabled={refreshing}>
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="card-decoration">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
          </div>
        </div>
      </div>



      <div className="dashboard-content">
        <div className="dashboard-section realtime-section">
          <div className="realtime-header section-header-with-actions">
            <div className="section-title-group">
              <h2>Données capteurs</h2>
              <span className="machine-id">{selectedDevice && `Machine: ${selectedDevice}`}</span>
            </div>
            <div className="header-right-group">
              <div className="machine-selector">
                <Monitor size={16} />
                <select
                  id="machine-select"
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="machine-select-dropdown"
                >
                  {devices.map((device) => (
                    <option key={device._id} value={device.deviceId}>
                      {device.deviceId}
                    </option>
                  ))}
                </select>
              </div>
              <div className="header-actions">
                <Plus size={18} className="action-icon plus" />
                <MoreHorizontal size={18} className="action-icon more" />
              </div>
            </div>
          </div>
          <div className="chart-wrapper">
            {recentMeasurements.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={recentMeasurements} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                    stroke="#a3aed0"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#a3aed0"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#a3aed0"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow)',
                      color: 'var(--text-primary)'
                    }}
                    labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend iconType="circle" />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperature"
                    stroke="#EE5D50"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="Température (°C)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="vibration"
                    stroke="#4318FF"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="Vibration (G)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="current"
                    stroke="#05CD99"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name="Courant (A)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-chart">Chargement des données...</div>
            )}
          </div>
        </div>

        <div className="dashboard-section probability-section">
          <div className="section-header section-header-with-actions">
            <div className="title-group-ai">
              <div className="ai-title-row">
                <Brain size={24} className="ai-icon-pulse" />
                <h2>Aperçu AI : Cycle de vie (7 jours)</h2>
              </div>
              <p className="section-desc">
                Analyse prédictive basée sur les données ESP32 pour la machine {selectedDevice}.
                {aiAnalysis?.confidence && (
                  <span className="confidence-badge">
                    Confiance: {(aiAnalysis.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </p>
            </div>
            <div className="header-actions">
              <Plus size={18} className="action-icon plus" />
              <MoreHorizontal size={18} className="action-icon more" />
            </div>
          </div>

          <div className="forecast-stats-grid">
            <div className="forecast-stat-mini">
              <span className="mini-label">Santé Actuelle</span>
              <span className="mini-value">{aiAnalysis?.currentHealth ?? (forecastData.length > 0 ? forecastData[0].healthScore : 0)}%</span>
            </div>
            <div className="forecast-stat-mini">
              <span className="mini-label">Tendance</span>
              <span className={`mini-value ${(aiAnalysis?.currentHealth > (forecastData[forecastData.length - 1]?.healthScore || 0)) ? 'down' : 'up'
                }`}>
                {aiAnalysis?.currentHealth > (forecastData[forecastData.length - 1]?.healthScore || 0) ? 'Déclinaison' : 'Stable'}
              </span>
            </div>
            <div className="forecast-stat-mini">
              <span className="mini-label">RUL Estimé</span>
              <span className="mini-value">{aiAnalysis?.rul ? `${aiAnalysis.rul} Jours` : '~ 7 Jours'}</span>
            </div>
          </div>

          <div className="chart-container-ai">
            {forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={forecastData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4318FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4318FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <ReferenceLine y={20} stroke="#EE5D50" strokeDasharray="3 3" label={{ value: 'Seuil Critique', position: 'insideRight', fill: '#EE5D50', fontSize: 12 }} />
                  <XAxis
                    dataKey="dayName"
                    stroke="#a3aed0"
                    tick={{ fontSize: 13, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    stroke="#a3aed0"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow)',
                      color: 'var(--text-primary)'
                    }}
                    formatter={(value) => [`${value}%`, 'Score de Santé']}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="healthScore"
                    stroke="#4318FF"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorHealth)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading-chart">Analyse AI en cours...</div>
            )}
          </div>

          {/* New Recommendations Section */}
          <div className="ai-insights-grid">
            <div className="insight-card recommendation">
              <h3>
                <CheckCircle2 size={18} className="icon-rec" />
                Recommandation IA
              </h3>
              <ul>
                {aiAnalysis?.recommendations?.length > 0 ? (
                  aiAnalysis.recommendations.map((rec, i) => <li key={i}>{rec}</li>)
                ) : (
                  <li>Analyse en cours...</li>
                )}
              </ul>
            </div>

            {(aiAnalysis?.anomalies?.length > 0) && (
              <div className="insight-card anomalies">
                <h3>
                  <AlertTriangle size={18} className="icon-warn" />
                  Anomalies Détectées
                </h3>
                <ul>
                  {aiAnalysis.anomalies.map((anom, i) => <li key={i}>{anom}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
