const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const deviceRoutes = require('./devices');
const measurementRoutes = require('./measurements');
const alertRoutes = require('./alerts');
const dashboardRoutes = require('./dashboard');

router.use('/auth', authRoutes);
router.use('/devices', deviceRoutes);
router.use('/measurements', measurementRoutes);
router.use('/alerts', alertRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;

