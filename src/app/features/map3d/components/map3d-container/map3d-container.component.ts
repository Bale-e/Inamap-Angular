import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
// Importar loaders específicos
import * as BabylonLoaders from 'babylonjs-loaders';
import { HttpClient } from '@angular/common/http';

interface PathData {
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
}

@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false }) renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '2d';
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private renderLoopFn: (() => void) | null = null;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    // Forzar registro de loaders OBJ y MTL
    this.ensureLoaders();
  }

  private ensureLoaders(): void {
    // Acceder al plugin OBJ desde babylonjs-loaders
    try {
      const OBJLoader = (BabylonLoaders as any).OBJFileLoader;
      if (OBJLoader && !BABYLON.SceneLoader.IsPluginForExtensionAvailable('.obj')) {
        BABYLON.SceneLoader.RegisterPlugin(new OBJLoader());
      }
    } catch (e) {
      console.warn('No se pudo registrar OBJ loader manualmente:', e);
    }
  }

  ngOnDestroy(): void {
    this.dispose3d();
  }

  setView(mode: '2d' | '3d'): void {
    if (this.viewMode === mode) {
      return;
    }

    if (mode === '3d') {
      this.viewMode = '3d';
      setTimeout(() => this.init3dScene(), 0);
    } else {
      this.dispose3d();
      this.viewMode = '2d';
    }
  }

  private init3dScene(): void {
    this.dispose3d();

    const canvasContainer = this.renderCanvasContainer?.nativeElement;
    if (!canvasContainer) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    this.camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2, Math.PI / 3, 20, new BABYLON.Vector3(0, 0, 0), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.wheelDeltaPercentage = 0.01;

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 1.2;
    
    // Luz direccional adicional para mejor definición
    const directionalLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(5, 10, 5), this.scene);
    directionalLight.intensity = 0.8;

    this.createGround();
    this.loadPathAndRender();
    this.load3dModel();

    this.renderLoopFn = () => {
      if (this.scene) {
        this.scene.render();
      }
    };

    this.engine.runRenderLoop(this.renderLoopFn);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.engine) {
      this.engine.resize();
    }
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    }

    if (this.renderCanvasContainer && this.renderCanvasContainer.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }
  }

  private async loadPathAndRender(): Promise<void> {
    try {
      const pathData = await this.http.get<PathData>('/assets/mock-data/path.json').toPromise();
      if (pathData?.startPoint && pathData?.endPoint) {
        this.updateMarkers(pathData.startPoint, pathData.endPoint);
      } else {
        this.createDefaultMarkers();
      }
    } catch {
      this.createDefaultMarkers();
    }
  }

  private async load3dModel(): Promise<void> {
    if (!this.scene) {
      return;
    }

    const modelRoot = '/assets/3d-models/';
    const modelName = 'Edificio-a.obj';

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', modelRoot, modelName, this.scene);
      console.log('Import result:', result);
      
      // Usar todos los meshes sin filtrar estrictamente el tipo
      const meshes = result.meshes;
      console.log('Modelo 3D (OBJ) cargado:', { meshesCount: meshes.length, meshNames: meshes.map(m => m.name) });

      if (meshes.length === 0) {
        console.warn('No se encontraron mallas en el modelo. Punto de prueba: crear cubo visible.');
        const debugCube = BABYLON.MeshBuilder.CreateBox('debugCube', { size: 2 }, this.scene);
        debugCube.position = new BABYLON.Vector3(0, 1, 0);
        const debugMat = new BABYLON.StandardMaterial('debugMat', this.scene);
        debugMat.diffuseColor = new BABYLON.Color3(1, 0, 1);
        debugCube.material = debugMat;
        return;
      }

      let combinedMin: BABYLON.Vector3 | null = null;
      let combinedMax: BABYLON.Vector3 | null = null;
      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      let meshesProcessed = 0;

      meshes.forEach((mesh, index) => {
        // Procesar TODOS los meshes sin filtro de tipo
        if (mesh && typeof mesh === 'object') {
          mesh.isVisible = true;
          mesh.parent = allNodes;
          
          if (mesh.checkCollisions !== undefined) {
            mesh.checkCollisions = true;
          }
          
          meshesProcessed++;
          
          // Si el mesh no tiene material, asignarle uno por defecto
          if (!mesh.material) {
            try {
              const defaultMat = new BABYLON.StandardMaterial(`mat_${index}`, this.scene!);
              defaultMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
              defaultMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.4);
              defaultMat.specularPower = 16;
              mesh.material = defaultMat;
            } catch (e) {
              console.warn(`No se pudo asignar material a mesh ${index}`);
            }
          }
          
          console.log(`Mesh[${index}]`, {
            name: mesh.name || 'unnamed',
            type: mesh.constructor?.name,
            isVisible: mesh.isVisible,
            hasMaterial: !!mesh.material
          });

          // Obtener bounding info para calcular escalado
          try {
            if (mesh.getBoundingInfo && typeof mesh.getBoundingInfo === 'function') {
              const boundingInfo = mesh.getBoundingInfo();
              if (boundingInfo && boundingInfo.boundingBox) {
                const bb = boundingInfo.boundingBox;
                if (!combinedMin || !combinedMax) {
                  combinedMin = bb.minimum.clone();
                  combinedMax = bb.maximum.clone();
                } else {
                  combinedMin = new BABYLON.Vector3(
                    Math.min(combinedMin.x, bb.minimum.x),
                    Math.min(combinedMin.y, bb.minimum.y),
                    Math.min(combinedMin.z, bb.minimum.z)
                  );
                  combinedMax = new BABYLON.Vector3(
                    Math.max(combinedMax.x, bb.maximum.x),
                    Math.max(combinedMax.y, bb.maximum.y),
                    Math.max(combinedMax.z, bb.maximum.z)
                  );
                }
              }
            }
          } catch (e) {
            console.warn(`Error getting bounding info for mesh ${index}:`, e);
          }
        }
      });

      console.log(`Meshes processed: ${meshesProcessed}`, { combinedMin, combinedMax });

      // Scale model to reasonable viewing size
      if (combinedMin && combinedMax) {
        const min = combinedMin as BABYLON.Vector3;
        const max = combinedMax as BABYLON.Vector3;
        const size = BABYLON.Vector3.Distance(min, max);
        const targetSize = 25; // Increased from 15 for better visibility
        
        console.log('Model bounds - Min:', min, 'Max:', max, 'Distance:', size);
        
        if (size > 0) {
          const scale = targetSize / size;
          allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);
          console.log('Escalando modelo - Factor:', scale, 'Tamaño original:', size, 'Tamaño destino:', targetSize);
          
          // Calcular bounds escalados
          const scaledMin = new BABYLON.Vector3(
            min.x * scale,
            min.y * scale,
            min.z * scale
          );
          const scaledMax = new BABYLON.Vector3(
            max.x * scale,
            max.y * scale,
            max.z * scale
          );
          
          // Centrar el modelo: en Y colocar el punto mínimo en el suelo (Y=0)
          // En X y Z centrar en el origen
          const centerX = (scaledMin.x + scaledMax.x) / 2;
          const centerZ = (scaledMin.z + scaledMax.z) / 2;
          
          allNodes.position.x = -centerX; // Centrar en X
          allNodes.position.y = -scaledMin.y; // Colocar el mínimo en Y=0
          allNodes.position.z = -centerZ; // Centrar en Z
          
          console.log('Posición del modelo:', { x: allNodes.position.x, y: allNodes.position.y, z: allNodes.position.z });
          
          // Actualizar bounds después del scaling y posicionamiento
          combinedMin = scaledMin.add(allNodes.position);
          combinedMax = scaledMax.add(allNodes.position);
        }
      } else {
        console.warn('No se pudieron calcular los bounds del modelo. Usando escala predeterminada.');
        allNodes.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
      }

      if (this.camera) {
        if (combinedMin && combinedMax) {
          const min = combinedMin as BABYLON.Vector3;
          const max = combinedMax as BABYLON.Vector3;
          const center = BABYLON.Vector3.Center(min, max);
          const size = BABYLON.Vector3.Distance(min, max);
          this.camera.target = center;
          this.camera.radius = Math.max(size * 1.5, 20);
          this.camera.lowerRadiusLimit = 1;
          this.camera.upperRadiusLimit = Math.max(size * 10, 200);
          
          console.log('Cámara posicionada en:', { center, radius: this.camera.radius });
        } else {
          this.camera.target = new BABYLON.Vector3(0, 0, 0);
          this.camera.radius = 30;
        }
      }
    } catch (error) {
      console.error('No se pudo cargar el modelo 3D:', error);
    }
  }

  private updateMarkers(start: {x: number; y: number; z: number}, end: {x: number; y: number; z: number}): void {
    if (!this.scene) return;

    const existingStart = this.scene.getMeshByName('startMarker');
    const existingEnd = this.scene.getMeshByName('endMarker');
    if (existingStart) {
      existingStart.dispose();
    }
    if (existingEnd) {
      existingEnd.dispose();
    }

    const startSphere = BABYLON.MeshBuilder.CreateSphere('startMarker', { diameter: 0.6 }, this.scene);
    startSphere.position = new BABYLON.Vector3(start.x, start.y, start.z);
    const startMat = new BABYLON.StandardMaterial('startMat', this.scene);
    startMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
    startSphere.material = startMat;

    const endSphere = BABYLON.MeshBuilder.CreateSphere('endMarker', { diameter: 0.6 }, this.scene);
    endSphere.position = new BABYLON.Vector3(end.x, end.y, end.z);
    const endMat = new BABYLON.StandardMaterial('endMat', this.scene);
    endMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
    endSphere.material = endMat;
  }

  private createGround(): void {
    if (!this.scene) return;
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, this.scene);
    ground.position.y = 0.01;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    ground.material = groundMat;
  }

  private createDefaultMarkers(): void {
    if (!this.scene) return;
    this.updateMarkers({ x: -3, y: 0, z: -2 }, { x: 3, y: 0, z: 2 });
  }
}
