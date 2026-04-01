const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const Session = require('../../models/Session');
const { authenticate } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/register
 * Créer un nouveau compte utilisateur
 */
router.post(
  '/register',
  [
    body('username').isLength({ min: 3, max: 30 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role } = req.body;

      // Vérifier si l'utilisateur existe déjà
      // Vérifier si l'utilisateur existe déjà
      const existingUserByUsername = await User.findByUsername(username);
      const existingUserByEmail = await User.findByEmail(email);

      if (existingUserByUsername || existingUserByEmail) {
        return res.status(400).json({ error: 'Utilisateur déjà existant' });
      }

      // Créer l'utilisateur
      const user = await User.create({
        username,
        email,
        password,
        role: role || 'viewer',
      });

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement:', error);
      res.status(500).json({ error: 'Erreur serveur', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
    }
  }
);

/**
 * POST /api/auth/login
 * Connexion utilisateur
 */
router.post('/login', async (req, res) => {
  try {
    // Validation simple
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    // Trouver l'utilisateur
    let user = null;
    try {
      user = await User.findByEmail(identifier);
      if (!user) {
        user = await User.findByUsername(identifier);
      }
    } catch (userError) {
      // Si la table n'existe pas, retourner 401
      const errorMsg = (userError.message || '').toLowerCase();
      if (errorMsg.includes('no such table') || errorMsg.includes('does not exist')) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }
      // Pour d'autres erreurs, logger et retourner 401 aussi
      console.warn('Erreur lors de la recherche de l\'utilisateur:', userError.message);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier le mot de passe
    let isPasswordValid = false;
    try {
      isPasswordValid = await User.comparePassword(String(password), String(user.password));
    } catch (compareError) {
      console.warn('Erreur lors de la comparaison du mot de passe:', compareError.message);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Créer le token JWT (toujours réussi car on a une valeur par défaut)
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
    const token = jwt.sign(
      { 
        userId: String(user._id || ''), 
        username: String(user.username || 'user'), 
        role: String(user.role || 'user') 
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Créer la session (optionnel, ne bloque pas)
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await Session.create({
        userId: user._id,
        token,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        expiresAt,
      });
    } catch (sessionError) {
      // Ignorer les erreurs de session
      console.warn('Erreur session (ignorée):', sessionError.message);
    }

    // Retourner la réponse
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username || 'user',
        email: user.email || '',
        role: user.role || 'user',
      },
    });
  } catch (error) {
    // Gestion d'erreur globale - toujours retourner 401 pour les erreurs inattendues aussi
    logger.error('Erreur lors de la connexion:', error);
    console.error('Stack:', error.stack);
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion utilisateur
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await Session.deleteByToken(req.session.token);

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    logger.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/auth/me
 * Récupérer les informations de l'utilisateur connecté
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }
    
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username || 'admin',
        email: req.user.email || 'admin@example.com',
        role: req.user.role || 'admin',
      },
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération des informations utilisateur:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      details: error.message 
    });
  }
});

module.exports = router;

