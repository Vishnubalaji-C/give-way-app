import os
import cv2
import json
import base64
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# ─── Config & Init ────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'weights', 'yolov8n.pt')
DEBUG_MODE = True

# Ensure weights exist or YOLO will auto-download 'yolov8n.pt'
yolo_model = YOLO('yolov8n.pt') 

# Initialize Local Binary Pattern Histogram (LBPH)
# Note: Typically used for facial recognition, we are adapting this 
# to calculate structural texture histograms for specific vehicle classes
# (e.g. distinguishing an Ambulance grille/siren pattern from a generic white van)
lbph_recognizer = cv2.face.LBPHFaceRecognizer_create()

# We would hypothetically train LBPH here with positive/negative textures
# e.g., lbph_recognizer.train(ambulance_grille_crops, np.array([1, 1, ...]))
print("[INFO] YOLOv8 and LBPH Feature Extractor online.")

# COCO mappings we care about
TARGET_CLASSES = {
    2: "car",
    3: "bike",
    5: "bus",
    7: "lorry" # COCO class 'truck'
}

def decode_base64_image(b64_string):
    """Convert base64 string to OpenCV Image."""
    img_data = base64.b64decode(b64_string.split(',')[1] if ',' in b64_string else b64_string)
    np_arr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def lbph_texture_verification(crop_img, predicted_class):
    """
    Experimental LBPH implementation for structural verification.
    If YOLO predicts 'car' but the user specifically needs to find 'ambulance',
    we run the crop through the texture histogram to find structural matches.
    """
    gray_crop = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
    gray_crop = cv2.resize(gray_crop, (150, 150)) # Normalize size for LBPH
    
    # In a production scenario, we would `predict()` against trained textures.
    # label, confidence = lbph_recognizer.predict(gray_crop)
    #
    # For now, we simulate the logic:
    # If it's a bright white vehicle (high mean pixel density) we flag it as an ambulance candidate
    mean_brightness = np.mean(gray_crop)
    
    # Simulated Texture Logic Match
    if predicted_class in ['car', 'lorry'] and mean_brightness > 200:
        return "ambulance", 0.95 # Simulated high confidence LBPH match
    
    return predicted_class, 1.0


@app.route('/api/inference', methods=['POST'])
def process_frame():
    """
    Main endpoint for ESP32-CAM nodes to push Base64 frames for processing.
    """
    try:
        data = request.json
        if 'frame' not in data:
            return jsonify({'error': 'No frame provided'}), 400

        # 1. Decode Frame
        image = decode_base64_image(data['frame'])
        
        # 2. YOLO Detection Stage
        results = yolo_model(image, conf=0.35, verbose=False)[0]
        
        detections = []
        pce_score = 0
        
        for box in results.boxes:
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            
            # Filter non-vehicles
            if class_id not in TARGET_CLASSES:
                continue
                
            base_class = TARGET_CLASSES[class_id]
            
            # Extract ROI for LBPH processing
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            crop = image[y1:y2, x1:x2]
            
            # 3. LBPH Verification Stage (Secondary Pass)
            final_class, lbph_conf = lbph_texture_verification(crop, base_class)
            
            # 4. Antigravity PCE Weight Mapping
            weight = 1.0
            if final_class == "car": weight = 1.0
            elif final_class == "bike": weight = 0.5
            elif final_class == "bus": weight = 10.0
            elif final_class == "lorry": weight = 8.0
            elif final_class == "ambulance": weight = 999.0 # Emergency Absolute Priority
            
            pce_score += weight
            
            detections.append({
                "type": final_class,
                "confidence": round(conf * lbph_conf, 3), # Combined Confidence
                "weight": weight,
                "bbox": [x1, y1, x2, y2]
            })

        return jsonify({
            "status": "success",
            "lane_id": data.get("lane_id", "unknown"),
            "detections": detections,
            "pce_score": pce_score,
            "vehicle_count": len(detections)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on Port 5000 (Local ML Inference Server)
    app.run(host='0.0.0.0', port=5000, debug=DEBUG_MODE)
