from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
import numpy as np
from urllib.parse import urlparse
import re

app = Flask(__name__)
model = load_model('models/phishing_detector_model.keras')

def extract_features(url):
    try:
        parsed = urlparse(url)
        domain_length = len(parsed.hostname or "")
        special_char_ratio = len(re.findall(r'[^a-zA-Z0-9-.]', url)) / len(url)
        tld = parsed.hostname.split('.')[-1] if parsed.hostname else ''
        tld_type = 0 if tld in ['com', 'org', 'net'] else 1 if tld in ['cn', 'gov', 'edu'] else 2
        path_depth = len([p for p in parsed.path.split('/') if p])
        has_port = 1 if parsed.port else 0
        is_https = 1 if parsed.scheme == 'https' else 0

        return np.array([[domain_length / 100,
                          special_char_ratio * 10,
                          tld_type / 2,
                          path_depth / 5,
                          has_port,
                          1 - is_https]])
    except:
        return np.array([[1.0, 0.5, 1.0, 0.0, 0, 1]])

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    url = data.get('url')
    features = extract_features(url)
    prediction = model.predict(features)[0][0]
    return jsonify({
        'confidence': float(prediction),
        'is_phishing': prediction > 0.68
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
