import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import websocket from '../services/websocket';
import { toast } from 'react-toastify';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import {
  Activity,
  Thermometer,
  Zap,
  Volume2,
  Brain,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './DeviceDetailPage.css';

const DeviceDetailPage = () => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(24);

  useEffect(() => {
    fetchDeviceData();
    setupWebSocket();

    return () => {
      websocket.off('measurement', handleMeasurement);
    };
  }, [deviceId, timeRange]);

  const fetchDeviceData = async () => {
    try {
      const [deviceRes, dashboardRes, forecastRes] = await Promise.all([
        api.get(`/devices/${deviceId}`),
        api.get(`/dashboard/device/${deviceId}`, {
          params: { hours: timeRange },
        }),
        api.get(`/dashboard/forecast/${deviceId}`)
      ]);

      setDevice(deviceRes.data);
      setMeasurements(dashboardRes.data.measurements || []);
      setStatistics(dashboardRes.data.statistics);

      if (forecastRes.data && forecastRes.data.forecast) {
        setForecastData(forecastRes.data.forecast);
        setAiAnalysis(forecastRes.data);
      } else if (Array.isArray(forecastRes.data)) {
        setForecastData(forecastRes.data);
        setAiAnalysis(null);
      }

    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDeviceStatus = async (newStatus) => {
    try {
      await api.put(`/devices/${deviceId}`, { status: newStatus });
      setDevice({ ...device, status: newStatus });
      toast.success(`Machine ${newStatus === 'active' ? 'démarrée' : 'arrêtée'} avec succès !`);
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Rapport de Maintenance Prédictive', 105, 15, { align: 'center' });

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

    // Last Measurements Table
    const tableData = measurements.slice(0, 15).map(m => [
      format(new Date(m.timestamp), 'HH:mm:ss'),
      `${m.temperature?.toFixed(1) || 0} °C`,
      `${m.vibration?.magnitude?.toFixed(3) || 0} G`,
      `${m.current?.toFixed(1) || 0} A`,
      `${m.sound?.toFixed(0) || 0} dB`
    ]);

    autoTable(doc, {
      startY: aiAnalysis ? 95 : 65,
      head: [['Heure', 'Température', 'Vibration', 'Courant', 'Bruit']],
      body: tableData,
    });

    doc.save(`rapport_${device.deviceId}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('Rapport téléchargé !');
  };

  const setupWebSocket = () => {
    websocket.connect();
    websocket.on('measurement', handleMeasurement);
  };

  const handleMeasurement = (data) => {
    if (data.type === 'measurement' && (data.deviceId === deviceId || data.data?.deviceId === deviceId)) {
      const measurementData = data.data || data;
      setMeasurements((prev) => [measurementData, ...prev].slice(0, 100));
    }
  };

  const chartData = measurements
    .slice()
    .reverse()
    .map((m) => ({
      timestamp: new Date(m.timestamp),
      vibration: m.vibration?.magnitude || 0,
      temperature: m.temperature || 0,
      current: m.current || 0,
      sound: m.sound || 0,
    }));

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!device) {
    return <div className="error">Device non trouvé</div>;
  }

  return (
    <div className="device-detail-page">
      {/* Header */}
      <div className="page-header-detail">
        <Link to="/devices" className="back-link">
          <ArrowLeft size={20} />
          Retour aux machines
        </Link>
        <div className="header-content">
          <div>
            <h1>{device.name || device.deviceId}</h1>
            <div className="status-row">
              <span className={`status-pill ${device.status}`}>
                {device.status === 'active' ? 'Opérationnel' : device.status}
              </span>
              <span className="last-seen">
                Dernière activité: {device.lastSeen ? format(new Date(device.lastSeen), 'dd/MM/yyyy HH:mm') : 'Jamais'}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button
              className={`control-btn start ${device.status === 'active' ? 'active-status' : ''}`}
              onClick={() => toggleDeviceStatus('active')}
              disabled={device.status === 'active'}
            >
              DÉMARRER
            </button>
            <button
              className={`control-btn stop ${device.status === 'inactive' ? 'active-status' : ''}`}
              onClick={() => toggleDeviceStatus('inactive')}
              disabled={device.status === 'inactive'}
            >
              ARRÊTER
            </button>
            <button className="control-btn report" onClick={downloadPDF}>
              RAPPORT PDF
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Stats Grid */}
      <div className="stats-cards-grid">
        <div className="detail-stat-card">
          <div className="stat-icon-bg vibration">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Vibration</span>
            <span className="value">{measurements[0]?.vibration?.magnitude?.toFixed(3) || measurements[0]?.vibration?.toFixed(3) || '0.000'} G</span>
            <span className="sub-value">Moy: {statistics?.vibration?.avg?.toFixed(3) || '0'} G</span>
          </div>
        </div>
        <div className="detail-stat-card">
          <div className="stat-icon-bg temp">
            <Thermometer size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Température</span>
            <span className="value">{measurements[0]?.temperature?.toFixed(1) || '0.0'} °C</span>
            <span className="sub-value">Moy: {statistics?.temperature?.avg?.toFixed(1) || '0'} °C</span>
          </div>
        </div>
        <div className="detail-stat-card">
          <div className="stat-icon-bg current">
            <Zap size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Courant</span>
            <span className="value">{measurements[0]?.current?.toFixed(1) || '0.0'} A</span>
            <span className="sub-value">Moy: {statistics?.current?.avg?.toFixed(1) || '0'} A</span>
          </div>
        </div>
        <div className="detail-stat-card">
          <div className="stat-icon-bg sound">
            <Volume2 size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Bruit</span>
            <span className="value">{measurements[0]?.sound?.toFixed(0) || '0'} dB</span>
            <span className="sub-value">Normal</span>
          </div>
        </div>
      </div>

      {/* AI & History Grid */}
      <div className="main-content-grid">
        {/* Left Col: AI Forecast */}
        <div className="content-col-left">
          <div className="content-card ai-card">
            <div className="card-header-row">
              <div className="title-with-icon">
                <Brain size={20} className="ai-pulse" />
                <h3>Analyse Prédictive IA</h3>
              </div>
              {aiAnalysis?.confidence && <span className="conf-badge">Confiance: {(aiAnalysis.confidence * 100).toFixed(0)}%</span>}
            </div>

            <div className="ai-summary">
              <div className="ai-metric">
                <span className="l">Santé</span>
                <span className="v">{aiAnalysis?.currentHealth || 0}%</span>
              </div>
              <div className="ai-metric">
                <span className="l">RUL Estimé</span>
                <span className="v">{aiAnalysis?.rul || 7} Jours</span>
              </div>
              <div className="ai-metric">
                <span className="l">Tendance</span>
                <span className="v trend">{aiAnalysis?.trend || 'Stable'}</span>
              </div>
            </div>

            <div className="chart-wrapper-ai">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4318FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4318FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="dayName" hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow)',
                      color: 'var(--text-primary)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <ReferenceLine y={20} stroke="#EE5D50" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="healthScore" stroke="#4318FF" fillOpacity={1} fill="url(#colorHealth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="recommendations-list">
              <h4><Clock size={16} /> Recommandations</h4>
              <ul>
                {aiAnalysis?.recommendations?.length > 0 ? (
                  aiAnalysis.recommendations.map((rec, i) => <li key={i}><CheckCircle2 size={14} /> {rec}</li>)
                ) : <li>Analyse en cours...</li>}
              </ul>
              {aiAnalysis?.anomalies?.length > 0 && (
                <div className="anomalies-box">
                  {aiAnalysis.anomalies.map((a, i) => <div key={i} className="anom"><AlertTriangle size={14} /> {a}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Historical Chart */}
        <div className="content-col-right">
          <div className="content-card history-card">
            <div className="card-header-row">
              <h3>Historique Mesures (24h)</h3>
            </div>

            <div style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVib" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12, fill: '#A3AED0' }}
                    tickFormatter={(val) => format(val, 'HH:mm')}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#A3AED0' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: 'var(--shadow)',
                      color: 'var(--text-primary)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="vibration" stackId="1" stroke="#8884d8" fill="url(#colorVib)" />
                  <Area type="monotone" dataKey="temperature" stackId="2" stroke="#82ca9d" fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailPage;

