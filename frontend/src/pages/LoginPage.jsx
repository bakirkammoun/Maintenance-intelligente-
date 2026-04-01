import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Lock, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
import './LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      toast.success('Connexion réussie');
      navigate('/');
    } else {
      toast.error(result.error || 'Erreur de connexion');
    }

    setLoading(false);
  };

  return (
    <div className="login-split-page">
      <div className="login-brand-side">
        <div className="brand-content">
          <div className="brand-logo-circle">
            <Zap size={40} className="brand-icon" />
          </div>
          <h1>Veltrix <span className="light-text">Admin</span></h1>
          <p>Maintenance Prédictive & Monitoring Industriel</p>

          <div className="brand-features">
            <div className="feature-item">
              <ShieldCheck size={20} /> Surveillance 24/7
            </div>
            <div className="feature-item">
              <Zap size={20} /> Analyses AI Temps Réel
            </div>
          </div>
        </div>
        <div className="brand-decoration">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-card-container">
          <div className="form-header">
            <h2>Connexion</h2>
            <p>Entrez vos identifiants pour accéder au tableau de bord.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-premium">
            <div className="input-group-premium">
              <label htmlFor="username">Email / Utilisateur</label>
              <div className="input-wrapper">
                <User size={20} className="input-icon" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="input-group-premium">
              <label htmlFor="password">Mot de passe</label>
              <div className="input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" /> Se souvenir de moi
              </label>
              <a href="#" className="forgot-password"></a>
            </div>

            <button type="submit" className="login-btn-premium" disabled={loading}>
              {loading ? 'Connexion...' : (
                <>
                  Se Connecter <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            © 2026 Veltrix Industry. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

