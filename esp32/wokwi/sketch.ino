#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <time.h>

// --- Configuration WiFi (Wokwi) ---
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// --- Configuration MQTT ---
// Utiliser un broker public pour la démo, ou votre IP locale si vous avez le Wokwi Gateway
// Ex: "test.mosquitto.org" ou "broker.hivemq.com"
const char* mqtt_server = "test.mosquitto.org"; 
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP32-Wokwi-Demo";

// --- Device ID ---
const char* device_id = "ESP32-001"; // Doit correspondre à un ID en base de données

// --- Pins Capteurs ---
#define PIN_DS18B20 4       // Température
#define PIN_CURRENT 34      // Potentiomètre simulant le courant
#define PIN_SOUND 35        // Potentiomètre simulant le son

// --- Objets ---
WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_MPU6050 mpu;
OneWire oneWire(PIN_DS18B20);
DallasTemperature sensors(&oneWire);

// --- Variables ---
unsigned long lastMsg = 0;
const long interval = 2000; // Envoi toutes les 2 secondes

void setup() {
  Serial.begin(115200);
  
  // Initialisation WiFi
  setup_wifi();
  
  // Initialisation Heure (NTP) pour le timestamp
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  
  // Initialisation MQTT
  client.setServer(mqtt_server, mqtt_port);
  
  // Initialisation MPU6050 (Vibration)
  if (!mpu.begin()) {
    Serial.println("MPU6050 introuvable! Vérifiez le câblage.");
  } else {
    Serial.println("MPU6050 trouvé!");
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  // Initialisation DS18B20 (Température)
  sensors.begin();
  
  // Pins Analogiques
  pinMode(PIN_CURRENT, INPUT);
  pinMode(PIN_SOUND, INPUT);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connexion à ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connecté");
  Serial.println("Adresse IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connexion au broker MQTT...");
    if (client.connect(mqtt_client_id)) {
      Serial.println("Connecté!");
      // On peut s'abonner à des topics ici si besoin
    } else {
      Serial.print("Échec, rc=");
      Serial.print(client.state());
      Serial.println(" Nouvelle tentative dans 5s");
      delay(5000);
    }
  }
}

// Fonction pour récupérer le timestamp ISO8601
String getISOTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "2023-01-01T00:00:00Z"; // Fallback si NTP échoue
  }
  char timeStringBuff[30];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(timeStringBuff);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    // --- Lecture des Capteurs ---
    
    // 1. Température (DS18B20)
    sensors.requestTemperatures(); 
    float temperature = sensors.getTempCByIndex(0);
    if(temperature == -127.00) temperature = 25.0; // Valeur par défaut si erreur/pas de capteur

    // 2. Vibration (MPU6050)
    sensors_event_t a, g, temp;
    float vib_x = 0, vib_y = 0, vib_z = 0;
    if (mpu.getEvent(&a, &g, &temp)) {
       vib_x = a.acceleration.x;
       vib_y = a.acceleration.y;
       vib_z = a.acceleration.z;
    } else {
       // Simulation si pas de mpu
       vib_x = (random(5, 15) / 100.0);
       vib_y = (random(5, 15) / 100.0);
       vib_z = 9.81 + (random(-20, 20) / 100.0);
    }

    // 3. Courant (Potentiomètre sur PIN_CURRENT)
    // Map la valeur 0-4095 à 0-10 Amperes (exemple)
    int currentRaw = analogRead(PIN_CURRENT);
    float current = (currentRaw / 4095.0) * 10.0; 
    if (current < 0.1) current = (random(18, 25) / 100.0); // Simulation

    // 4. Son (Potentiomètre sur PIN_SOUND)
    // Map la valeur 0-4095 à 30-100 dB
    int soundRaw = analogRead(PIN_SOUND);
    float sound = map(soundRaw, 0, 4095, 30, 100);
    if (sound < 35) sound = random(40, 60); // Simulation

    // --- Création du JSON ---
    DynamicJsonDocument doc(1024);
    
    // Structure exacte demandée par le backend
    /*
    {
      "temperature": 70-80,
      "vibration": { "x": ..., "y": ..., "z": ... },
      "current": 0.18-0.25,
      "sound": 40-60,
      "timestamp": "ISOstring"
    }
    */
    doc["temperature"] = temperature;
    
    JsonObject vibration = doc.createNestedObject("vibration");
    vibration["x"] = vib_x;
    vibration["y"] = vib_y;
    vibration["z"] = vib_z;
    
    doc["current"] = current;
    doc["sound"] = sound;
    doc["timestamp"] = getISOTime();

    char jsonBuffer[1024];
    serializeJson(doc, jsonBuffer);

    // --- Publication MQTT ---
    String topic = "devices/" + String(device_id) + "/measurements";
    Serial.print("Publication sur ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(jsonBuffer);
    
    client.publish(topic.c_str(), jsonBuffer);
  }
}
