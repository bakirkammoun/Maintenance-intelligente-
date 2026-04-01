# Simulation Wokwi pour Projet de Maintenance

Ce dossier contient les fichiers nécessaires pour simuler votre projet ESP32 sur [Wokwi](https://wokwi.com).

## Comment utiliser

1. **Option 1 (Recommandée - VS Code)** :
   - Installez l'extension "Wokwi Simulator" dans VS Code.
   - Ouvrez le fichier `diagram.json` dans VS Code.
   - Cliquez sur le bouton "Start Simulation" (lecture) qui apparaît.

2. **Option 2 (Navigateur Web)** :
   - Allez sur [wokwi.com](https://wokwi.com/projects/new/esp32).
   - Copiez le contenu de `sketch.ino` dans l'onglet "sketch.ino".
   - Copiez le contenu de `diagram.json` dans l'onglet "diagram.json".
   - Ajoutez les bibliothèques suivantes dans l'onglet "Library Manager" (ou `libraries.txt`):
     - `WiFi`
     - `PubSubClient`
     - `ArduinoJson`
     - `Adafruit MPU6050`
     - `Adafruit Unified Sensor`
     - `DallasTemperature`
     - `OneWire`

## Configuration MQTT
Par défaut, le code utilise le broker public `test.mosquitto.org` pour que la simulation fonctionne immédiatement.

Si vous voulez connecter la simulation à votre **serveur local** (backend Node.js), vous devez :
1. Installer et configurer [Wokwi IoT Gateway](https://docs.wokwi.com/guides/esp32-wifi#networking).
2. Changer la ligne `const char* mqtt_server = "test.mosquitto.org";` par l'adresse IP de votre PC (ex: `192.168.1.X`) dans `sketch.ino`.
   
## Capteurs simulés
- **Température** : Capteur DS18B20 (Pin D4)
- **Vibration** : Accéléromètre MPU6050 (I2C: D21/D22)
- **Courant** : Simulé par un Potentiomètre (Pin D34)
- **Son** : Simulé par un Potentiomètre (Pin D35)
