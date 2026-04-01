# Code ESP32 pour Maintenance Prédictive

## Capteurs utilisés

- **MPU6050** : Capteur de vibration (IMU) - I2C
- **DS18B20** : Capteur de température - OneWire
- **ACS712** : Capteur de courant - Analogique
- **MAX9814** : Microphone pour détection sonore - Analogique

## Bibliothèques requises

Installer via Arduino IDE Library Manager :

1. **WiFi** (incluse)
2. **PubSubClient** par Nick O'Leary
3. **MPU6050** par Adafruit
4. **OneWire** par Paul Stoffregen
5. **DallasTemperature** par Miles Burton
6. **ArduinoJson** par Benoit Blanchon

## Configuration

1. Modifier les constantes dans `main.ino` :
   - `ssid` et `password` : Credentials WiFi
   - `mqtt_server` : Adresse IP du broker MQTT
   - `mqtt_username` et `mqtt_password` : Credentials MQTT
   - `device_id` : Identifiant unique du device

2. Connecter les capteurs :
   - MPU6050 : SDA → GPIO 21, SCL → GPIO 22
   - DS18B20 : Data → GPIO 4 (avec résistance pull-up 4.7kΩ)
   - ACS712 : Out → GPIO 34
   - MAX9814 : Out → GPIO 35

3. Uploader le code sur l'ESP32

## Format des données MQTT

### Topic: `devices/{deviceId}/measurements`

```json
{
  "deviceId": "ESP32-001",
  "timestamp": 1234567890,
  "vibration": {
    "x": 0.5,
    "y": -0.3,
    "z": 9.8
  },
  "temperature": 25.5,
  "current": 2.3,
  "sound": 65.2
}
```

### Topic: `devices/{deviceId}/status`

```json
{
  "deviceId": "ESP32-001",
  "status": "online",
  "timestamp": 1234567890
}
```

## Bufferisation

Le système utilise un buffer circulaire pour stocker les mesures en cas de perte de connexion réseau. Les données sont renvoyées automatiquement une fois la connexion rétablie.

