from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
import os
import subprocess
import time
import traceback

app = Flask(__name__)
CORS(app)

# Paths
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
MOOON_PATH = "/home/joe/Downloads/mooon"  # Update this path
TEST_SCRIPT = os.path.join(MOOON_PATH, "test.py")  # Path to test.py script
VIS_SCRIPT = os.path.join(MOOON_PATH, "process_3d.py")  # Path to process_3d.py script
MODEL_DIR = os.path.join(MOOON_PATH, "models")  # Path to models directory
OBJ_OUTPUT_DIR = os.path.join(MOOON_PATH, "obj_files")  # Path where .obj files will be saved

# Ensure required directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OBJ_OUTPUT_DIR, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        # Save the uploaded image with timestamp
        timestamp = int(time.time())
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
        file.save(file_path)
        
        # Run point cloud generation (test.py)
        model_size = "l"
        cmd = ["python3", TEST_SCRIPT, file_path, "1", model_size, MODEL_DIR]
        print(f"Executing: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error in test.py: {result.stderr}")
            return jsonify({
                "error": "Point cloud generation failed!", 
                "details": result.stderr
            }), 500
        
        return jsonify({
            "message": "File processed successfully!", 
            "filename": safe_filename
        })
        
    except Exception as e:
        print("Exception in upload_file:", traceback.format_exc())
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

@app.route('/generate-obj/<filename>', methods=['POST'])
def generate_obj(filename):
    try:
        # Paths
        input_image_path = os.path.join(UPLOAD_FOLDER, filename)
        obj_filename = f"{os.path.splitext(filename)[0]}.obj"
        output_obj_path = os.path.join(OBJ_OUTPUT_DIR, obj_filename)
        
        # Parameters for process_3d.py
        quality_factor = "1"
        model_size = "l"
        
        # Run process_3d.py with correct arguments
        cmd = [
            "python3", VIS_SCRIPT, input_image_path, quality_factor, model_size, MODEL_DIR, output_obj_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            return jsonify({
                "error": "OBJ generation failed!", 
                "details": result.stderr
            }), 500

        # Check if the output OBJ file was created
        if not os.path.exists(output_obj_path):
            return jsonify({
                "error": "Failed to generate OBJ file. File not found."
            }), 500

        # ✅ Return the OBJ file directly after generation
        return send_file(
            output_obj_path,
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=obj_filename
        )
        
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
