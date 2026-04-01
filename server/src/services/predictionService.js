const logger = require('../utils/logger');
const { spawn } = require('child_process');
const path = require('path');

class PredictionService {
    /**
     * Calculates the failure probability of a device based on its latest measurement.
     * Uses weighted risk factors for vibration, temperature, current, and working hours.
     * 
     * @param {Object} device The device object containing sensor thresholds
     * @param {Object} measurement The latest measurement for the device
     * @returns {Object} { probability, label, color }
     */
    calculateFailureProbability(device, measurement) {
        if (!device) return { probability: 0, label: 'INCONNU', color: '#95a5a6' };

        // Configuration thresholds (with fallbacks)
        const vibThreshold = device.sensors?.vibration?.threshold || 0.2;
        const tempThreshold = device.sensors?.temperature?.threshold || 75;
        const currThreshold = device.sensors?.current?.threshold || 0.25;

        // Current values (with fallbacks)
        const vibration = measurement?.vibration?.magnitude || measurement?.vibration || 0;
        const temperature = measurement?.temperature || 0;
        const current = measurement?.current || 0;

        // Working hours - simulated for now as they are not in the DB schema yet, but expected by frontend
        // Using deviceId as seed for stability
        const seed = device.deviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const workingHours = 1500 + (seed % 4000);

        // Risk normalization (0-1)
        const vibrationRisk = Math.min(Math.max(vibration / vibThreshold, 0), 1);
        const temperatureRisk = Math.min(Math.max((temperature - 40) / (tempThreshold - 40), 0), 1);
        const currentRisk = Math.min(Math.max(current / currThreshold, 0), 1);
        const hoursRisk = Math.min((workingHours - 1500) / 4000, 1);

        // Weighted risk calculation
        // Weights: Vibration: 30%, Temperature: 30%, Current: 20%, Working Hours: 20%
        const totalRisk = (vibrationRisk * 0.3 + temperatureRisk * 0.3 + currentRisk * 0.2 + hoursRisk * 0.2);

        // Convert to percentage (0-100)
        let probability = Math.min(Math.max(totalRisk * 100, 0), 100);

        // Add a small stable variation based on time if needed, but for "database dynamic" 
        // we might prefer strictly derived values or just rely on measurement variations.
        // Frontend adds ±5% dynamic variation, we'll keep the core calculation pure here.

        let status;
        if (probability >= 80) {
            status = { label: 'CRITIQUE', color: '#e74c3c' };
        } else if (probability >= 50) {
            status = { label: 'AVERTISSEMENT', color: '#f39c12' };
        } else {
            status = { label: 'OPÉRATIONNEL', color: '#27ae60' };
        }

        return {
            probability: parseFloat(probability.toFixed(1)),
            ...status
        };
    }

    /**
     * Executes the Python AI model script.
     */
    async runPythonModel(data) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../scripts/ai_prediction_model.py');
            const pythonProcess = spawn('python', [scriptPath, JSON.stringify(data)]);

            let resultData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                resultData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script exited with code ${code}: ${errorData}`));
                } else {
                    try {
                        const parsed = JSON.parse(resultData);
                        if (parsed.error) {
                            reject(new Error(parsed.error));
                        } else {
                            resolve(parsed);
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse Python output: ${e.message}`));
                    }
                }
            });

            // Timeout to prevent hanging
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Python script timed out'));
            }, 3000);
        });
    }

    /**
     * Generates a 7-day health life overview for a device using a multi-factor degradation model.
     * Uses Python AI model if available, falls back to JS logic.
     * 
     * @param {Object} device The device object
     * @param {Object} latestMeasurement The latest measurement
     * @returns {Object} { forecast: Array, rul: Number, status: String, healthScore: Number }
     */
    async get7DayForecast(device, latestMeasurement) {
        if (!device) return { forecast: [], rul: 0, status: 'unknown', healthScore: 0 };

        const basePrediction = this.calculateFailureProbability(device, latestMeasurement);
        const baseProbability = basePrediction.probability;
        const currentHealth = 100 - baseProbability;

        // payload for Python model
        const payload = {
            current_health: currentHealth,
            vibration: latestMeasurement?.vibration?.magnitude || latestMeasurement?.vibration || 0,
            temperature: latestMeasurement?.temperature || 0,
            current: latestMeasurement?.current || 0,
            working_hours: 1500 + (device.deviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 4000) // Simulation
        };

        try {
            // Try Python Model
            const result = await this.runPythonModel(payload);

            // Enhance result with day names which might be missing/english in python script if not careful, 
            // but the script does return dates. We'll map them to be safe or use what's returned.
            // The script returns "date" (YYYY-MM-DD). We need "dayName".
            const enhancedForecast = result.forecast.map(day => ({
                ...day,
                dayName: formatDayName(new Date(day.date))
            }));

            return {
                forecast: enhancedForecast,
                rul: result.rul,
                currentHealth: parseFloat(currentHealth.toFixed(1)),
                status: basePrediction.label,
                color: basePrediction.color,
                analysisType: result.analysis_type,
                recommendations: result.recommendations || [],
                anomalies: result.anomalies || [],
                confidence: result.confidence || 0.85
            };
        } catch (error) {
            // console.warn('AI Model unavailable, using JS Fallback:', error.message);
            // Fallback to JS Logic (Original + Improvements)

            // Advanced Degradation Model (Exponential/Linear Hybrid)
            const vibFactor = payload.vibration / (device.sensors?.vibration?.threshold || 0.2);
            const tempFactor = (payload.temperature - 40) / (device.sensors?.temperature?.threshold - 40 || 35); // Adjusted for typical temp
            const currFactor = payload.current / (device.sensors?.current?.threshold || 0.25);

            const stressMultiplier = Math.max(vibFactor, tempFactor, currFactor, 0.1);

            const forecast = [];
            const now = new Date();
            const machineSeed = device.deviceId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

            for (let i = 0; i < 7; i++) {
                const date = new Date(now);
                date.setDate(now.getDate() + i);

                const k = (stressMultiplier * 0.05) + (machineSeed % 10) / 1000;
                let healthScore = currentHealth * Math.exp(-k * i) + (Math.random() * 2 - 1);
                healthScore = Math.min(Math.max(healthScore, 0), 100);

                forecast.push({
                    date: date.toISOString().split('T')[0],
                    dayName: formatDayName(date),
                    healthScore: parseFloat(healthScore.toFixed(1)),
                    stress: parseFloat((stressMultiplier * (1 + i * 0.05)).toFixed(2))
                });
            }

            const rul = stressMultiplier > 0.8 ? Math.max(1, Math.round(15 / stressMultiplier)) : Math.round(45 / (stressMultiplier + 0.1));

            return {
                forecast,
                rul,
                currentHealth: parseFloat(currentHealth.toFixed(1)),
                status: basePrediction.label,
                color: basePrediction.color,
                analysisType: 'HEURISTIC_FALLBACK',
                recommendations: ['Vérification standard recommandée'],
                anomalies: [],
                confidence: 0.70
            };
        }
    }

    /**
     * Gets forecasts for all devices in the fleet.
     */
    async getFleetForecast(devices, MeasurementModel) {
        return await Promise.all(devices.map(async (device) => {
            const latestMeasurements = await MeasurementModel.getRecentMeasurements(device.deviceId, 1);
            const latestMeasurement = latestMeasurements && latestMeasurements.length > 0 ? latestMeasurements[0] : null;
            const data = await this.get7DayForecast(device, latestMeasurement);
            return {
                deviceId: device.deviceId,
                name: device.name || device.deviceId,
                ...data
            };
        }));
    }
}

/**
 * Helper to get French day names
 */
function formatDayName(date) {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[date.getDay()];
}

module.exports = new PredictionService();
