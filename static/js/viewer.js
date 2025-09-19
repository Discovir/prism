/**
 * OBJ 3D Viewer using Three.js
 * Handles loading and displaying OBJ files in the browser
 */
class OBJViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.wireframeMode = false;
        this.originalMaterials = [];
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Container not found for 3D viewer');
            return;
        }

        // Clear container
        this.container.innerHTML = '';

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c2c2c);

        // Camera setup
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting setup
        this.setupLighting();

        // Controls setup (manual implementation since OrbitControls isn't available)
        this.setupControls();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start render loop
        this.animate();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Additional fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-10, -10, -5);
        this.scene.add(fillLight);
    }

    setupControls() {
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const canvas = this.renderer.domElement;

        // Mouse controls
        canvas.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;

            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;

            targetX += deltaX * 0.01;
            targetY += deltaY * 0.01;

            mouseX = event.clientX;
            mouseY = event.clientY;
        });

        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
            isMouseDown = false;
            canvas.style.cursor = 'grab';
        });

        // Touch controls for mobile
        canvas.addEventListener('touchstart', (event) => {
            if (event.touches.length === 1) {
                isMouseDown = true;
                mouseX = event.touches[0].clientX;
                mouseY = event.touches[0].clientY;
            }
            event.preventDefault();
        });

        canvas.addEventListener('touchmove', (event) => {
            if (!isMouseDown || event.touches.length !== 1) return;

            const deltaX = event.touches[0].clientX - mouseX;
            const deltaY = event.touches[0].clientY - mouseY;

            targetX += deltaX * 0.01;
            targetY += deltaY * 0.01;

            mouseX = event.touches[0].clientX;
            mouseY = event.touches[0].clientY;
            
            event.preventDefault();
        });

        canvas.addEventListener('touchend', () => {
            isMouseDown = false;
        });

        // Zoom with mouse wheel
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const delta = event.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(delta);
        });

        // Apply smooth rotation
        const updateRotation = () => {
            if (this.model) {
                this.model.rotation.x += (targetY - this.model.rotation.x) * 0.1;
                this.model.rotation.y += (targetX - this.model.rotation.y) * 0.1;
            }
        };

        this.updateRotation = updateRotation;
        canvas.style.cursor = 'grab';
    }

    loadOBJFromString(objString) {
        try {
            // Parse OBJ string manually (simple parser for basic OBJ files)
            const geometry = this.parseOBJ(objString);
            
            // Create material
            const material = new THREE.MeshLambertMaterial({
                color: 0x8B7355, // Archaeological brown color
                side: THREE.DoubleSide
            });

            // Clear previous model
            if (this.model) {
                this.scene.remove(this.model);
            }

            // Create mesh
            this.model = new THREE.Mesh(geometry, material);
            this.originalMaterials = [material];
            
            // Center and scale the model
            this.centerAndScaleModel();
            
            // Add to scene
            this.scene.add(this.model);
            
            console.log('OBJ model loaded successfully');
        } catch (error) {
            console.error('Error loading OBJ:', error);
            this.showError('Failed to load 3D model');
        }
    }

    parseOBJ(objString) {
        const vertices = [];
        const faces = [];
        const lines = objString.split('\n');

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('v ')) {
                // Vertex
                const parts = line.split(/\s+/);
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);
                vertices.push(x, y, z);
            } else if (line.startsWith('f ')) {
                // Face
                const parts = line.split(/\s+/).slice(1);
                if (parts.length >= 3) {
                    // Convert to triangles (assuming faces are triangles or quads)
                    const indices = parts.map(part => {
                        const vertexIndex = parseInt(part.split('/')[0]) - 1;
                        return vertexIndex;
                    });
                    
                    // Add triangle(s)
                    faces.push(indices[0], indices[1], indices[2]);
                    
                    // If quad, add second triangle
                    if (indices.length === 4) {
                        faces.push(indices[0], indices[2], indices[3]);
                    }
                }
            }
        }

        // Create Three.js geometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        if (faces.length > 0) {
            geometry.setIndex(faces);
        }
        
        geometry.computeVertexNormals();
        return geometry;
    }

    centerAndScaleModel() {
        if (!this.model) return;

        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model
        this.model.position.sub(center);

        // Scale to fit in viewport
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = 2 / maxDim;
            this.model.scale.setScalar(scale);
        }
    }

    showError(message) {
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; text-align: center; flex-direction: column;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <div>${message}</div>
            </div>
        `;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update rotation if controls are active
        if (this.updateRotation) {
            this.updateRotation();
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    resetView() {
        if (this.model) {
            this.model.rotation.set(0, 0, 0);
        }
        this.camera.position.set(0, 0, 5);
    }

    toggleWireframe() {
        if (!this.model || !this.originalMaterials.length) return;

        this.wireframeMode = !this.wireframeMode;

        if (this.wireframeMode) {
            // Switch to wireframe
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true
            });
            this.model.material = wireframeMaterial;
        } else {
            // Switch back to original material
            this.model.material = this.originalMaterials[0];
        }
    }

    dispose() {
        // Clean up resources
        if (this.model) {
            this.scene.remove(this.model);
            if (this.model.geometry) this.model.geometry.dispose();
            if (this.model.material) {
                if (Array.isArray(this.model.material)) {
                    this.model.material.forEach(material => material.dispose());
                } else {
                    this.model.material.dispose();
                }
            }
        }

        if (this.renderer) {
            this.renderer.dispose();
        }

        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OBJViewer;
}