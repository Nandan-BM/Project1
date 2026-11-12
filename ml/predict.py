
import joblib
from pathlib import Path

# Load the trained model
MODEL_PATH = Path(__file__).with_name("url_model.joblib")
model = joblib.load(MODEL_PATH)


def predict_url(url):
    prediction = model.predict([url])[0]
    probabilities = model.predict_proba([url])[0]

    confidence = round(max(probabilities) * 100, 2)

    if prediction == 1:
        result = "Phishing"
    else:
        result = "Legitimate"

    return {
        "url": url,
        "prediction": result,
        "confidence": confidence
    }
