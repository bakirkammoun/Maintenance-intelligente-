/*
 * Système de Maintenance Prédictive - ESP32
 * Capteurs: MPU6050 (vibration), DS18B20 (température), ACS712 (courant), MAX9814 (son)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <MPU6050.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// Configuration WiFi
const char* ssid = "VOTRE_SSID";
const char* password = "VOTRE_MOT_DE_PASSE";

// Configuration MQTT
const char* mqtt_server = "192.168.1.100"; // Adresse IP du broker MQTT
const int mqtt_port = 1883;
const char* mqtt_username = "admin";
const char* mqtt_password = "admin123";
const char* mqtt_client_id = "ESP32-MAINTENANCE-001";

// Device ID
const char* device_id = "ESP32-001";

// Configuration des capteurs
const int sampling_rate = 1000; // ms
const int buffer_size = 100;

// Pins
#define MPU6050_SDA 21
#define MPU6050_SCL 22
#define DS18B20_PIN 4
#define ACS712_PIN 34
#define MAX9814_PIN 35

// Objets
WiFiClient espClient;
PubSubClient client(espClient);
MPU6050 mpu;
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

// Buffer pour les mesures
struct Measurement {
  float vibration_x;
  float vibration_y;
  float vibration_z;
  float temperature;
  float current;
  float sound;
  unsigned long timestamp;
};

Measurement buffer[buffer_size];
int buffer_index = 0;
bool buffer_full = false;

// Variables pour ACS712 (calibration)
const float ACS712_SENSITIVITY = 0.066; // 30A version: 66mV/A
const float ACS712_VCC = 3.3;
const float ACS712_ADC_RESOLUTION = 4095.0;
const float ACS712_ZERO_POINT = 1.65; // 2.5V pour 5V, 1.65V pour 3.3V

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Initialisation du système de maintenance prédictive...");

  // Initialisation WiFi
  setupWiFi();

  // Initialisation MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);

  // Initialisation MPU6050
  Wire.begin(MPU6050_SDA, MPU6050_SCL);
  if (mpu.begin()) {
    Serial.println("MPU6050 initialisé");
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  } else {
    Serial.println("Erreur initialisation MPU6050");
  }

  // Initialisation DS18B20
  sensors.begin();
  Serial.println("DS18B20 initialisé");

  // Configuration ADC pour ACS712 et MAX9814
  analogReadResolution(12);
  pinMode(ACS712_PIN, INPUT);
  pinMode(MAX9814_PIN, INPUT);

  Serial.println("Système prêt!");
}

void loop() {
  // Vérifier connexion MQTT
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  // Collecte des données
  collectMeasurements();

  delay(sampling_rate);
}

void setupWiFi() {
  Serial.print("Connexion WiFi à ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connecté!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Tentative de connexion MQTT...");
    
    if (client.connect(mqtt_client_id, mqtt_username, mqtt_password)) {
      Serial.println("Connecté!");
      
      // Publier le statut
      publishStatus("online");
      
      // S'abonner aux topics de configuration
      String config_topic = "devices/" + String(device_id) + "/config";
      client.subscribe(config_topic.c_str());
    } else {
      Serial.print("Échec, rc=");
      Serial.print(client.state());
      Serial.println(" Nouvelle tentative dans 5 secondes...");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message reçu [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Traiter les messages de configuration
  if (String(topic).indexOf("/config") > 0) {
    handleConfigMessage(message);
  }
}

void handleConfigMessage(String message) {
  // Parser le JSON de configuration
  // Mettre à jour sampling_rate, buffer_size, seuils, etc.
  // TODO: Implémenter le parsing JSON
}

void collectMeasurements() {
  Measurement m;
  m.timestamp = millis();

  // Lecture MPU6050 (Vibration)
  if (mpu.begin()) {
    sensors_event_t accel, gyro, temp;
    mpu.getEvent(&accel, &gyro, &temp);
    
    m.vibration_x = accel.acceleration.x;
    m.vibration_y = accel.acceleration.y;
    m.vibration_z = accel.acceleration.z;
  }

  // Lecture DS18B20 (Température)
  sensors.requestTemperatures();
  m.temperature = sensors.getTempCByIndex(0);

  // Lecture ACS712 (Courant)
  int adc_value = analogRead(ACS712_PIN);
  float voltage = (adc_value / ACS712_ADC_RESOLUTION) * ACS712_VCC;
  float current = (voltage - ACS712_ZERO_POINT) / ACS712_SENSITIVITY;
  m.current = abs(current); // Valeur absolue

  // Lecture MAX9814 (Son)
  int sound_adc = analogRead(MAX9814_PIN);
  float sound_voltage = (sound_adc / ACS712_ADC_RESOLUTION) * ACS712_VCC;
  // Convertir en dB (approximation)
  m.sound = map(sound_voltage * 100, 0, 330, 30, 90);

  // Ajouter au buffer
  buffer[buffer_index] = m;
  buffer_index = (buffer_index + 1) % buffer_size;
  
  if (buffer_index == 0) {
    buffer_full = true;
  }

  // Publier immédiatement ou depuis le buffer
  publishMeasurement(m);

  // Si le buffer est plein, envoyer toutes les données
  if (buffer_full && buffer_index == 0) {
    publishBuffer();
  }
}

void publishMeasurement(Measurement m) {
  if (!client.connected()) {
    return;
  }

  DynamicJsonDocument doc(512);
  doc["deviceId"] = device_id;
  doc["timestamp"] = m.timestamp;

  JsonObject vibration = doc.createNestedObject("vibration");
  vibration["x"] = m.vibration_x;
  vibration["y"] = m.vibration_y;
  vibration["z"] = m.vibration_z;

  doc["temperature"] = m.temperature;
  doc["current"] = m.current;
  doc["sound"] = m.sound;

  String topic = "devices/" + String(device_id) + "/measurements";
  String payload;
  serializeJson(doc, payload);

  client.publish(topic.c_str(), payload.c_str());
}

void publishBuffer() {
  // Envoyer toutes les mesures du buffer en cas de perte réseau
  for (int i = 0; i < buffer_size; i++) {
    publishMeasurement(buffer[i]);
    delay(10);
  }
}

void publishStatus(String status) {
  DynamicJsonDocument doc(128);
  doc["deviceId"] = device_id;
  doc["status"] = status;
  doc["timestamp"] = millis();

  String topic = "devices/" + String(device_id) + "/status";
  String payload;
  serializeJson(doc, payload);

  client.publish(topic.c_str(), payload.c_str());
}

