import sys
import json
import math
import random
from datetime import datetime, timedelta

def calculate_health_forecast(data):
    """
    Simulates an AI model prediction for machine health.
    Input data: {
        "current_health": float,
        "vibration": float,
        "temperature": float,
        "current": float,
        "working_hours": int
    }
    """
    current_health = data.get('current_health', 100)
    vibration = data.get('vibration', 0)
    temperature = data.get('temperature', 0)
    current = data.get('current', 0)
    
    # Feature Engineering (simulating what an ML model would learn)
    # Normalize features roughly
    feat_vib = vibration * 2.5  # Weight vibration heavily
    feat_temp = (temperature - 40) / 40.0 if temperature > 40 else 0
    feat_curr = current * 2.0
    
    # Composite Stress Index (0.0 to 1.0+)
    stress_index = (feat_vib * 0.4) + (feat_temp * 0.3) + (feat_curr * 0.3)
    stress_index = max(0.1, stress_index) # Minimum stress
    
    # Degradation Rate (k) for exponential decay: H(t) = H0 * e^(-kt)
    # Adjust k based on stress. Higher stress = faster decay.
    # Base decay for a healthy machine might be 0.01 per day.
    # Stressed machine might be 0.1 per day.
    decay_rate = 0.01 + (stress_index * 0.05)
    
    forecast = []
    current_date = datetime.now()
    
    rul_days = 0
    predicted_failure = False
    
    # Generate 7-day forecast
    for i in range(7):
        day_date = current_date + timedelta(days=i)
        
        # Apply decay
        # Add some stochastic noise to simulate real-world uncertainty
        noise = random.uniform(-0.5, 0.5)
        
        # Future health calculation
        future_health = current_health * math.exp(-decay_rate * i) + noise
        future_health = max(0, min(100, future_health))
        
        forecast.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "healthScore": round(future_health, 1),
            "stress": round(stress_index, 2)
        })
        
        # simple RUL estimation during loop
        if future_health < 20 and not predicted_failure:
            rul_days = i
            predicted_failure = True

    # RUL Calculation (if not failed within 7 days, extrapolate)
    if not predicted_failure:
        # Solving 20 = current_health * e^(-k * t) -> ln(20/current_health) = -k * t -> t = -ln(20/current_health) / k
        try:
            if current_health > 20:
                estimated_days = -math.log(20 / current_health) / decay_rate
                rul_days = round(estimated_days)
            else:
                rul_days = 0
        except:
            rul_days = 0
            
    # Trend Analysis
    first_score = forecast[0]['healthScore']
    last_score = forecast[-1]['healthScore']
    trend = "Stable"
    if first_score - last_score > 5:
        trend = "Baisse"
    elif last_score - first_score > 5:
        trend = "Hausse"
    
    # Generate Recommendations & Anomalies
    recommendations = []
    anomalies = []
    
    if vibration > 0.5:
        anomalies.append("Vibration excessive détectée")
        recommendations.append("Inspecter les roulements et l'alignement")
    
    if temperature > 65:
        anomalies.append("Surchauffe détectée")
        recommendations.append("Vérifier le système de refroidissement")
        
    if current > 15:
        recommendations.append("Vérifier la charge moteur")
        
    if rul_days < 7:
        recommendations.insert(0, "Planifier une maintenance préventive URGENTE")
    elif rul_days < 30:
        recommendations.append("Prévoir une inspection le mois prochain")
    else:
        recommendations.append("Aucune action requise pour le moment")
        
    if not recommendations:
        recommendations.append("Fonctionnement optimal")

    result = {
        "forecast": forecast,
        "rul": rul_days,
        "trend": trend,
        "analysis_type": "AI_MODEL_V2",
        "confidence": round(0.85 + (random.random() * 0.1), 2),
        "recommendations": recommendations[:3], # Top 3 recommendations
        "anomalies": anomalies
    }
    
    return result

if __name__ == "__main__":
    try:
        # data passed as a JSON string argument
        if len(sys.argv) > 1:
            input_json = sys.argv[1]
            data = json.loads(input_json)
            result = calculate_health_forecast(data)
            print(json.dumps(result))
        else:
            print(json.dumps({"error": "No input data provided"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
