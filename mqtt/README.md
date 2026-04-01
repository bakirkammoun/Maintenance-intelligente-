# Configuration MQTT (Mosquitto)

## Installation

### Via Docker (recommandé)
Le fichier `docker-compose.yml` à la racine du projet configure automatiquement Mosquitto.

### Installation manuelle

```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# Créer le fichier de mots de passe
mosquitto_passwd -c /etc/mosquitto/passwd admin
```

## Configuration

1. Copier `mosquitto.conf` dans le répertoire de configuration de Mosquitto
2. Créer le fichier `passwd` avec les utilisateurs :
   ```bash
   mosquitto_passwd -c passwd admin
   ```
   Entrer le mot de passe : `admin123`

3. Démarrer Mosquitto :
   ```bash
   mosquitto -c mosquitto.conf
   ```

## Topics utilisés

- `devices/{deviceId}/measurements` : Mesures des capteurs
- `devices/{deviceId}/status` : Statut des devices
- `devices/{deviceId}/config` : Configuration des devices

## Sécurité

- Authentification par mot de passe requise
- TLS recommandé pour la production (voir documentation Mosquitto)

