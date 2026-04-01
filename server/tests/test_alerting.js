const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Device = require('../src/models/Device');
const Measurement = require('../src/models/Measurement');
const anomalyService = require('../src/services/anomalyService');
const alertService = require('../src/services/alertService');
const logger = require('../src/utils/logger');

async function testAlerting() {
    console.log('--- Test Alerting Logic ---');

    try {
        // 1. Create a dummy device if not exists
        const deviceId = 'test_device_001';
        let device = await Device.findById(deviceId);

        if (!device) {
            console.log('Creating test device...');
            await Device.create({
                deviceId,
                name: 'Test Device',
                location: 'Lab',
                type: 'motor',
                status: 'active',
                sensors: {
                    vibration: { enabled: true, threshold: 0.5 },
                    temperature: { enabled: true, threshold: 50 },
                    current: { enabled: true, threshold: 5 },
                    sound: { enabled: true, threshold: 80 }
                },
                samplingRate: 1000,
                bufferSize: 100
            });
            device = await Device.findById(deviceId);
        }

        console.log('Device thresholds:', JSON.stringify(device.sensors, null, 2));

        // 2. Create a measurement that exceeds temperature threshold
        console.log('\nSimulating measurement exceeding temperature threshold (55°C > 50°C)...');
        const measurementData = {
            deviceId,
            timestamp: new Date().toISOString(),
            temperature: 55,
            vibration: { x: 0.1, y: 0.1, z: 0.1, magnitude: 0.17 },
            current: 2,
            sound: 60
        };

        const measurement = await Measurement.create(measurementData);
        console.log('Measurement created with ID:', measurement._id);

        // 3. Run anomaly detection
        const anomaly = await anomalyService.detect(measurement, device);

        if (anomaly) {
            console.log('Anomaly detected:', anomaly.message);
            console.log('Severity:', anomaly.severity);

            // 4. Create alert
            const alert = await alertService.create(deviceId, anomaly);
            console.log('Alert created with ID:', alert._id);
            console.log('Alert message:', alert.message);
        } else {
            console.log('FAIL: No anomaly detected!');
        }

        // 5. Verify measurement was updated in DB
        const updatedMeasurement = await Measurement.findById(measurement._id);
        console.log('\nUpdated measurement in DB:');
        console.log('isAnomaly:', updatedMeasurement.isAnomaly);
        console.log('anomalyReason:', updatedMeasurement.anomalyReason);

        if (updatedMeasurement.isAnomaly && updatedMeasurement.anomalyReason.includes('Température')) {
            console.log('\nSUCCESS: Alerting flow verified!');
        } else {
            console.log('\nFAIL: Measurement not correctly updated in DB!');
        }

    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        process.exit(0);
    }
}

testAlerting();
