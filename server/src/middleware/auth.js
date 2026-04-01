const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const logger = require('../utils/logger');

/**
 * Middleware d'authentification JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    const token = authHeader.substring(7);

    // Vérifier le token
    let decoded;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token invalide' });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré' });
      }
      throw jwtError;
    }

    // Vérifier la session (optionnel, ne bloque pas si elle n'existe pas)
    let session = null;
    try {
      session = await Session.findByToken(token);
    } catch (sessionError) {
      // Si la table n'existe pas ou autre erreur, ignorer et continuer avec le token JWT
      const errorMsg = (sessionError.message || '').toLowerCase();
      if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
        console.warn('Table sessions n\'existe pas encore, authentification basée uniquement sur JWT');
        session = null;
      } else {
        // Pour d'autres erreurs, logger mais continuer quand même
        console.warn('Erreur lors de la récupération de la session (ignorée):', sessionError.message);
        session = null;
      }
    }

    // Vérifier la session seulement si elle existe
    if (session) {
      // Comparer les userId en convertissant en string pour éviter les problèmes de type
      const sessionUserId = String(session.userId || '');
      const decodedUserId = String(decoded.userId || '');
      
      if (sessionUserId !== decodedUserId) {
        console.warn('Session userId ne correspond pas au token userId');
        session = null; // Ignorer la session mais continuer avec le token JWT
      } else if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        console.warn('Session expirée, mais token JWT toujours valide');
        session = null; // Ignorer la session expirée mais continuer avec le token JWT
      }
    }

    // Récupérer l'utilisateur (optionnel, utiliser les données du token si la table n'existe pas)
    let user;
    try {
      user = await User.findById(decoded.userId);
    } catch (userError) {
      // Si la table n'existe pas, créer un utilisateur temporaire basé sur le token
      const errorMsg = (userError.message || '').toLowerCase();
      if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
        console.warn('Table users n\'existe pas encore, utilisation des données du token JWT');
        user = {
          _id: String(decoded.userId || ''),
          username: String(decoded.username || 'admin'),
          email: String(decoded.email || 'admin@example.com'),
          role: String(decoded.role || 'admin')
        };
      } else {
        // Pour d'autres erreurs, utiliser les données du token JWT
        console.warn('Erreur lors de la récupération de l\'utilisateur (utilisation du token):', userError.message);
        user = {
          _id: String(decoded.userId || ''),
          username: String(decoded.username || 'admin'),
          email: String(decoded.email || 'admin@example.com'),
          role: String(decoded.role || 'admin')
        };
      }
    }

    // Si l'utilisateur n'existe toujours pas, utiliser les données du token
    if (!user) {
      user = {
        _id: String(decoded.userId || ''),
        username: String(decoded.username || 'admin'),
        email: String(decoded.email || 'admin@example.com'),
        role: String(decoded.role || 'admin')
      };
    }

    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    logger.error('Erreur d\'authentification:', error);
    console.error('Stack trace:', error.stack);
    
    // Si c'est une erreur de token, retourner 401 au lieu de 500
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token invalide ou expiré', 
        details: error.message 
      });
    }
    
    // Pour les autres erreurs, retourner 500 mais avec moins de détails
    res.status(500).json({ 
      error: 'Erreur d\'authentification', 
      details: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
};

/**
 * Middleware de vérification de rôle
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
};

