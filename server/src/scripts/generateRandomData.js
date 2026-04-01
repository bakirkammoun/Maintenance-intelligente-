const connectDb = require('../config/db');
const Device = require('../models/Device');
const Measurement = require('../models/Measurement');
const Alert = require('../models/Alert');

// Fonction pour générer un nombre aléatoire entre min et max
function random(min, max) {
  return Math.random() * (max - min) + min;
}

// Fonction pour générer un nombre aléatoire entier
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fonction pour générer une date aléatoire dans les dernières N heures
function randomDate(hoursAgo = 24) {
  const now = new Date();
  const hoursAgoMs = hoursAgo * 60 * 60 * 1000;
  const randomMs = Math.random() * hoursAgoMs;
  return new Date(now.getTime() - randomMs);
}

async function generateRandomData() {
  const db = connectDb();

  try {
    console.log('🚀 Début de la génération de données aléatoires...\n');

    // 1. Créer des devices aléatoires
    const deviceTypes = ['motor', 'pump', 'compressor', 'fan', 'generator'];
    const locations = [
      'Usine A - Ligne 1',
      'Usine A - Ligne 2',
      'Usine B - Station 3',
      'Usine B - Station 4',
      'Usine C - Salle des Machines',
      'Usine C - Zone Production',
      'Entrepôt Principal',
      'Laboratoire Qualité'
    ];
    const statuses = ['active', 'active', 'active', 'inactive']; // Plus d'actifs que d'inactifs

    const devices = [];
    const numDevices = 8;

    console.log(`📱 Création de ${numDevices} devices...`);
    for (let i = 1; i <= numDevices; i++) {
      const deviceId = i === 1 ? 'device_001' : `device_${String(i).padStart(3, '0')}`;
      const type = i === 1 ? 'motor' : deviceTypes[randomInt(0, deviceTypes.length - 1)];
      const location = i === 1 ? 'Ligne de Production 1' : locations[randomInt(0, locations.length - 1)];
      const status = 'active';

      const deviceData = {
        deviceId,
        name: i === 1 ? 'Moteur Principal' : `${type.charAt(0).toUpperCase() + type.slice(1)} ${i}`,
        location,
        type,
        status,
        sensors: {
          vibration: {
            enabled: true,
            threshold: 0.20 // Seuil standard
          },
          temperature: {
            enabled: true,
            threshold: 75.0 // Seuil standard
          },
          current: {
            enabled: true,
            threshold: 0.25 // Seuil standard
          },
          sound: {
            enabled: true,
            threshold: 90.0
          }
        },
        samplingRate: 1000,
        bufferSize: 100
      };

      try {
        // Vérifier si le device existe déjà
        const existing = await Device.findById(deviceId);
        if (!existing) {
          await Device.create(deviceData);
          devices.push(deviceId);
          console.log(`  ✓ Device créé: ${deviceId} (${type})`);
        } else {
          devices.push(deviceId);
          console.log(`  - Device existe déjà: ${deviceId}`);
        }
      } catch (error) {
        console.error(`  ✗ Erreur lors de la création du device ${deviceId}:`, error.message);
      }
    }

    // 2. Générer des measurements aléatoires pour chaque device
    console.log(`\n📊 Génération de measurements...`);
    const numMeasurementsPerDevice = 200;
    let totalMeasurements = 0;

    // Sélectionner aléatoirement 1 ou 2 devices critiques
    const numCritical = randomInt(1, 2);
    const criticalDeviceIndices = new Set();
    while (criticalDeviceIndices.size < numCritical) {
      criticalDeviceIndices.add(randomInt(0, devices.length - 1));
    }
    const criticalDevices = Array.from(criticalDeviceIndices).map(i => devices[i]);
    console.log(`⚠️ Devices critiques sélectionnés aléatoirement: ${criticalDevices.join(', ')}`);

    for (const deviceId of devices) {
      const isCritical = criticalDevices.includes(deviceId);

      for (let i = 0; i < numMeasurementsPerDevice; i++) {
        const timestamp = randomDate(48); // Dernières 48 heures

        // Générer des valeurs aléatoires avec variation réaliste (Aligné sur le Frontend)
        let vibrationX, vibrationY, vibrationZ, temperature, current, sound;

        if (isCritical) {
          // Cas critique pour dépasser 75% de probabilité de panne
          vibrationX = random(0.12, 0.15);
          vibrationY = random(0.12, 0.15);
          vibrationZ = random(0.12, 0.15);
          temperature = random(85, 90); // Très chaud
          current = random(0.35, 0.45); // Courant élevé
          sound = random(90, 100);
        } else {
          // Cas normal
          vibrationX = random(0.06, 0.08);
          vibrationY = random(0.06, 0.08);
          vibrationZ = random(0.06, 0.08);
          temperature = random(72, 75);
          current = random(0.18, 0.22);
          sound = random(60, 80);
        }

        const vibrationMagnitude = Math.sqrt(vibrationX ** 2 + vibrationY ** 2 + vibrationZ ** 2);

        // Déterminer si c'est une anomalie (10% de chance)
        const isAnomaly = Math.random() < 0.1;
        let anomalyReason = null;

        if (isAnomaly) {
          const reasons = [
            'Vibration élevée détectée',
            'Température anormale',
            'Courant excessif',
            'Niveau sonore critique',
            'Combinaison de paramètres anormaux'
          ];
          anomalyReason = reasons[randomInt(0, reasons.length - 1)];
        }

        try {
          await Measurement.create({
            deviceId,
            timestamp: timestamp.toISOString(),
            vibration: {
              x: vibrationX,
              y: vibrationY,
              z: vibrationZ,
              magnitude: vibrationMagnitude
            },
            temperature,
            current,
            sound,
            isAnomaly,
            anomalyReason,
            processed: Math.random() < 0.7 // 70% des mesures sont traitées
          });
          totalMeasurements++;
        } catch (error) {
          console.error(`  ✗ Erreur lors de la création de measurement:`, error.message);
        }
      }
      console.log(`  ✓ ${numMeasurementsPerDevice} measurements créées pour ${deviceId}`);
    }

    // 3. Générer des alertes cohérentes avec l'état des devices
    console.log(`\n🚨 Génération d'alertes...`);
    const alertTypes = ['vibration', 'temperature', 'current', 'sound', 'maintenance'];
    const alertStatuses = ['open', 'open', 'open', 'acknowledged', 'resolved'];
    const numAlerts = 30;

    for (let i = 0; i < numAlerts; i++) {
      // Choisir un device
      // 50% de chance de choisir un device critique pour générer des alertes pertinentes
      let deviceId;
      if (Math.random() < 0.5 && criticalDevices.length > 0) {
        deviceId = criticalDevices[randomInt(0, criticalDevices.length - 1)];
      } else {
        deviceId = devices[randomInt(0, devices.length - 1)];
      }

      const isCriticalDevice = criticalDevices.includes(deviceId);
      let severity;

      // La sévérité dépend de si le device est critique ou non
      if (isCriticalDevice) {
        // Les devices critiques ont surtout des alertes High/Critical
        severity = Math.random() < 0.8 ? (Math.random() < 0.6 ? 'critical' : 'high') : 'medium';
      } else {
        // Les devices normaux ont surtout des alertes Low/Medium
        severity = Math.random() < 0.8 ? (Math.random() < 0.6 ? 'low' : 'medium') : 'high';
      }

      const type = alertTypes[randomInt(0, alertTypes.length - 1)];
      const status = alertStatuses[randomInt(0, alertStatuses.length - 1)];

      const messages = {
        vibration: 'Vibration anormale détectée',
        temperature: 'Température critique',
        current: 'Courant électrique anormal',
        sound: 'Niveau sonore élevé',
        maintenance: 'Maintenance préventive requise'
      };

      const createdAt = randomDate(72);

      try {
        // Générer une valeur cohérente avec la sévérité
        let value, threshold;

        if (type === 'temperature') {
          threshold = random(75, 76);
          if (severity === 'critical') value = random(85, 95);
          else if (severity === 'high') value = random(80, 85);
          else value = random(76, 80);
        } else {
          threshold = random(0.22, 0.23);
          if (severity === 'critical') value = random(0.35, 0.45);
          else if (severity === 'high') value = random(0.28, 0.35);
          else value = random(0.23, 0.28);
        }

        await Alert.create({
          deviceId,
          severity,
          type,
          message: messages[type] || 'Alerte système',
          value,
          threshold,
          threshold: type === 'temperature' ? random(75, 76) : random(0.22, 0.23),
          status
        });
      } catch (error) {
        console.error(`  ✗ Erreur lors de la création d'alerte:`, error.message);
      }
    }
    console.log(`  ✓ ${numAlerts} alertes créées`);

    console.log(`\n✅ Génération terminée avec succès!`);
    console.log(`   - ${devices.length} devices`);
    console.log(`   - ${totalMeasurements} measurements`);
    console.log(`   - ${numAlerts} alertes`);

  } catch (error) {
    console.error('❌ Erreur lors de la génération de données:', error);
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  generateRandomData()
    .then(() => {
      console.log('\n🎉 Toutes les données ont été générées avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = generateRandomData;
