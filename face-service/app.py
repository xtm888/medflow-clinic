"""
Face Recognition Microservice for MedFlow EMR

Uses DeepFace for cross-platform compatibility (no dlib segfaults on Apple Silicon).

Features:
- Patient photo enrollment during registration
- Duplicate patient detection via face matching
- Identity verification when accessing patient records
"""

import os
import base64
import logging
from io import BytesIO
from datetime import datetime

import numpy as np
from PIL import Image
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(','))

# Configuration
FACE_MATCH_THRESHOLD = float(os.getenv('FACE_MATCH_THRESHOLD', '0.4'))  # Lower is more similar for cosine
MAX_IMAGE_SIZE = int(os.getenv('MAX_IMAGE_SIZE', '10485760'))  # 10MB

# Lazy load DeepFace to speed up startup
_deepface = None
_model_warmed = False

def get_deepface():
    """Lazy load DeepFace module."""
    global _deepface
    if _deepface is None:
        logger.info("Loading DeepFace (first request may be slow)...")
        from deepface import DeepFace
        _deepface = DeepFace
        logger.info("DeepFace loaded successfully")
    return _deepface


def warm_up_model():
    """Pre-load the Facenet model to avoid first-request delay."""
    global _model_warmed
    if _model_warmed:
        return

    try:
        logger.info("Warming up Facenet model (this may take 10-30 seconds)...")
        DeepFace = get_deepface()

        # Build the model by calling it with a dummy operation
        # This forces TensorFlow to load the Facenet weights into memory
        DeepFace.build_model('Facenet')

        _model_warmed = True
        logger.info("✅ Facenet model warmed up and ready!")
    except Exception as e:
        logger.error(f"Failed to warm up model: {e}")
        # Don't fail startup, just log the error


def decode_base64_image(base64_string):
    """Decode a base64 image string to numpy array for OpenCV."""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        image_data = base64.b64decode(base64_string)
        image = Image.open(BytesIO(image_data))

        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Convert to numpy array (OpenCV format)
        img_array = np.array(image)
        # Convert RGB to BGR for OpenCV
        img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        return img_array
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        raise ValueError(f"Invalid image data: {e}")


def resize_image_if_needed(image, max_dimension=800):
    """Resize large images to improve processing speed."""
    height, width = image.shape[:2]
    if max(width, height) > max_dimension:
        ratio = max_dimension / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        image = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)
    return image


def encoding_to_json(encoding):
    """Convert numpy encoding to JSON-serializable list."""
    if isinstance(encoding, np.ndarray):
        return encoding.tolist()
    return list(encoding)


def json_to_encoding(encoding_list):
    """Convert JSON list back to numpy array."""
    return np.array(encoding_list)


def cosine_distance(emb1, emb2):
    """Calculate cosine distance between two embeddings."""
    emb1 = np.array(emb1)
    emb2 = np.array(emb2)
    dot = np.dot(emb1, emb2)
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0:
        return 1.0
    similarity = dot / (norm1 * norm2)
    return 1 - similarity  # Convert similarity to distance


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'face-recognition',
        'version': '2.0.0',
        'backend': 'DeepFace',
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/api/face/detect', methods=['POST'])
def detect_faces():
    """Detect faces in an image using OpenCV."""
    try:
        data = request.get_json()

        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        # Decode and process image
        image = decode_base64_image(data['image'])
        image = resize_image_if_needed(image)

        # Use OpenCV's face detector (faster than DeepFace for just detection)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        face_locations = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        faces = []
        for (x, y, w, h) in face_locations:
            faces.append({
                'left': int(x),
                'top': int(y),
                'right': int(x + w),
                'bottom': int(y + h),
                'width': int(w),
                'height': int(h)
            })

        return jsonify({
            'success': True,
            'faceCount': len(faces),
            'faces': faces,
            'message': f"{len(faces)} face(s) detected"
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error detecting faces: {e}")
        return jsonify({'success': False, 'error': 'Face detection failed'}), 500


@app.route('/api/face/encode', methods=['POST'])
def encode_face():
    """Generate face encoding from an image using DeepFace."""
    try:
        data = request.get_json()

        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        DeepFace = get_deepface()

        # Decode and process image
        image = decode_base64_image(data['image'])
        image = resize_image_if_needed(image)

        # Generate embedding using DeepFace
        try:
            embeddings = DeepFace.represent(
                img_path=image,
                model_name='Facenet',
                enforce_detection=True,
                detector_backend='opencv'
            )
        except ValueError as e:
            if 'Face could not be detected' in str(e):
                return jsonify({
                    'success': False,
                    'error': 'No face detected in the image',
                    'suggestion': 'Please ensure the face is clearly visible, well-lit, and facing the camera'
                }), 400
            raise

        if len(embeddings) == 0:
            return jsonify({
                'success': False,
                'error': 'Could not generate face encoding'
            }), 400

        if len(embeddings) > 1:
            return jsonify({
                'success': False,
                'error': 'Multiple faces detected',
                'faceCount': len(embeddings),
                'suggestion': 'Please ensure only one person is in the frame'
            }), 400

        embedding = embeddings[0]['embedding']
        face_region = embeddings[0].get('facial_area', {})

        return jsonify({
            'success': True,
            'encoding': encoding_to_json(embedding),
            'faceLocation': {
                'top': face_region.get('y', 0),
                'right': face_region.get('x', 0) + face_region.get('w', 0),
                'bottom': face_region.get('y', 0) + face_region.get('h', 0),
                'left': face_region.get('x', 0)
            },
            'message': 'Face encoding generated successfully'
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error encoding face: {e}")
        return jsonify({'success': False, 'error': f'Face encoding failed: {str(e)}'}), 500


@app.route('/api/face/verify', methods=['POST'])
def verify_identity():
    """Verify a live photo against a stored patient encoding."""
    try:
        data = request.get_json()

        if not data or 'liveImage' not in data:
            return jsonify({'success': False, 'error': 'No live image provided'}), 400

        if 'storedEncoding' not in data:
            return jsonify({'success': False, 'error': 'No stored encoding provided'}), 400

        DeepFace = get_deepface()
        threshold = data.get('tolerance', FACE_MATCH_THRESHOLD)

        # Process live image
        image = decode_base64_image(data['liveImage'])
        image = resize_image_if_needed(image)

        # Generate embedding for live image
        try:
            embeddings = DeepFace.represent(
                img_path=image,
                model_name='Facenet',
                enforce_detection=True,
                detector_backend='opencv'
            )
        except ValueError as e:
            if 'Face could not be detected' in str(e):
                return jsonify({
                    'success': False,
                    'verified': False,
                    'error': 'No face detected in live image',
                    'suggestion': 'Please position your face in front of the camera'
                }), 400
            raise

        if len(embeddings) == 0:
            return jsonify({
                'success': False,
                'verified': False,
                'error': 'Could not process face'
            }), 400

        if len(embeddings) > 1:
            return jsonify({
                'success': False,
                'verified': False,
                'error': 'Multiple faces detected',
                'suggestion': 'Please ensure only the patient is in frame'
            }), 400

        live_encoding = embeddings[0]['embedding']
        stored_encoding = json_to_encoding(data['storedEncoding'])

        # Compare encodings using cosine distance
        distance = cosine_distance(live_encoding, stored_encoding)
        is_match = distance <= threshold
        # Confidence = similarity percentage (1 - distance)
        confidence = max(0, 1 - distance)

        return jsonify({
            'success': True,
            'verified': bool(is_match),
            'confidence': round(float(confidence), 4),
            'distance': round(float(distance), 4),
            'patientId': data.get('patientId'),
            'message': 'Identity verified successfully' if is_match else 'Identity verification failed',
            'timestamp': datetime.utcnow().isoformat()
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error verifying identity: {e}")
        return jsonify({'success': False, 'error': f'Identity verification failed: {str(e)}'}), 500


@app.route('/api/face/batch-compare', methods=['POST'])
def batch_compare():
    """
    Compare a new face against all patients in a batch.
    Used for duplicate detection during registration.
    """
    try:
        data = request.get_json()

        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        DeepFace = get_deepface()
        threshold = data.get('tolerance', FACE_MATCH_THRESHOLD)
        existing_patients = data.get('existingPatients', [])

        # Process the new image
        image = decode_base64_image(data['image'])
        image = resize_image_if_needed(image)

        # Generate embedding for new face
        try:
            embeddings = DeepFace.represent(
                img_path=image,
                model_name='Facenet',
                enforce_detection=True,
                detector_backend='opencv'
            )
        except ValueError as e:
            if 'Face could not be detected' in str(e):
                return jsonify({
                    'success': False,
                    'error': 'No face detected',
                    'suggestion': 'Please capture a clear photo with the face visible'
                }), 400
            raise

        if len(embeddings) == 0:
            return jsonify({
                'success': False,
                'error': 'Could not generate face encoding'
            }), 400

        if len(embeddings) > 1:
            return jsonify({
                'success': False,
                'error': 'Multiple faces detected',
                'faceCount': len(embeddings),
                'suggestion': 'Only one person should be in the photo'
            }), 400

        new_encoding = embeddings[0]['embedding']
        face_region = embeddings[0].get('facial_area', {})

        # Compare against all existing patients
        potential_duplicates = []

        for patient in existing_patients:
            if 'encoding' not in patient or not patient['encoding']:
                continue

            stored_encoding = json_to_encoding(patient['encoding'])
            distance = cosine_distance(new_encoding, stored_encoding)

            # Include matches and near-matches (within 1.5x threshold for review)
            if distance <= threshold * 1.5:
                # Confidence = similarity percentage (cosine similarity = 1 - cosine distance)
                # Distance 0.0 = 100% similar, Distance 0.4 = 60% similar, Distance 1.0 = 0% similar
                confidence = max(0, 1 - distance)
                is_definite_match = bool(distance <= threshold)

                potential_duplicates.append({
                    'patientId': patient.get('patientId'),
                    'name': patient.get('name'),
                    'dateOfBirth': patient.get('dateOfBirth'),
                    'phone': patient.get('phone'),
                    'photoUrl': patient.get('photoUrl'),
                    'distance': round(float(distance), 4),
                    'confidence': round(float(confidence), 4),
                    'isDefiniteMatch': is_definite_match,
                    'matchLevel': 'high' if distance <= threshold * 0.7 else 'medium' if distance <= threshold else 'low'
                })

        # Sort by distance (most similar first)
        potential_duplicates.sort(key=lambda x: x['distance'])

        # Determine overall status
        has_definite_duplicates = bool(any(d['isDefiniteMatch'] for d in potential_duplicates))
        has_possible_duplicates = bool(len(potential_duplicates) > 0)

        return jsonify({
            'success': True,
            'newEncoding': encoding_to_json(new_encoding),
            'faceLocation': {
                'top': face_region.get('y', 0),
                'right': face_region.get('x', 0) + face_region.get('w', 0),
                'bottom': face_region.get('y', 0) + face_region.get('h', 0),
                'left': face_region.get('x', 0)
            },
            'potentialDuplicates': potential_duplicates,
            'hasDefiniteDuplicates': has_definite_duplicates,
            'hasPossibleDuplicates': has_possible_duplicates,
            'duplicateCount': len(potential_duplicates),
            'totalCompared': len(existing_patients),
            'bestMatch': potential_duplicates[0] if potential_duplicates else None,
            'tolerance': threshold,
            'message': (
                'Potential duplicate patients found!' if has_definite_duplicates
                else 'Possible matches found for review' if has_possible_duplicates
                else 'No duplicates detected'
            )
        })

    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in batch compare: {e}")
        return jsonify({'success': False, 'error': f'Batch comparison failed: {str(e)}'}), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'success': False,
        'error': 'Image too large',
        'maxSize': MAX_IMAGE_SIZE
    }), 413


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    port = int(os.getenv('FACE_SERVICE_PORT', 5002))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    skip_warmup = os.getenv('SKIP_MODEL_WARMUP', 'false').lower() == 'true'

    logger.info(f"Starting Face Recognition Service on port {port}")
    logger.info(f"Face match threshold: {FACE_MATCH_THRESHOLD}")
    logger.info("Backend: DeepFace (cross-platform, no dlib)")

    # Pre-warm the model unless explicitly skipped (for faster dev restarts)
    if not skip_warmup and not debug:
        warm_up_model()
    else:
        logger.info("Skipping model warmup (will load on first request)")

    app.run(host='0.0.0.0', port=port, debug=debug)
