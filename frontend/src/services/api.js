import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs 401 (non autorisé)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token invalide ou expiré
      const token = localStorage.getItem('token');

      // Ne rediriger que si on a un token (sinon c'est juste une requête non authentifiée)
      if (token) {
        // Nettoyer le token invalide
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];

        // Rediriger vers la page de login seulement si on n'y est pas déjà
        // et seulement pour certaines routes (pas pour /auth/login ou /auth/register)
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' &&
          !currentPath.startsWith('/auth') &&
          currentPath !== '/register') {
          // Attendre un peu avant de rediriger pour éviter les redirections multiples
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }, 100);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

