import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false }) renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '2d';
  cuerpo23HintVisible = false;
  cuerpo23HintX = 0;
  cuerpo23HintY = 0;
  private cuerpo23HintTimer: any = null;
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private renderLoopFn: (() => void) | null = null;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
  }

  private ensureLoaders(): void {
    // Los loaders se registran automáticamente al importar 'babylonjs-loaders'
    // Verificar que el plugin OBJ esté disponible
    if (!BABYLON.SceneLoader.IsPluginForExtensionAvailable('.obj')) {
      console.warn('OBJ loader no está disponible');
    } else {
      console.log('✅ OBJ Loader disponible');
    }
  }

  ngOnDestroy(): void {
    this.dispose3d();
    if (this.cuerpo23HintTimer) {
      clearTimeout(this.cuerpo23HintTimer);
    }
  }

  setView(mode: '2d' | '3d'): void {
    if (this.viewMode === mode) return;

    if (mode === '3d') {
      this.viewMode = '3d';
      setTimeout(() => this.init3dScene(), 0);
    } else {
      this.dispose3d();
      this.viewMode = '2d';
    }
  }

  zoomIn(): void {
    if (this.camera) {
      const newRadius = this.camera.radius * 0.85;
      this.camera.radius = Math.max(newRadius, this.camera.lowerRadiusLimit ?? 1);
    }
  }

  zoomOut(): void {
    if (this.camera) {
      const newRadius = this.camera.radius * 1.15;
      this.camera.radius = Math.min(newRadius, this.camera.upperRadiusLimit ?? 500);
    }
  }

  private showCuerpo23Hint(clientX: number, clientY: number): void {
    this.cuerpo23HintX = clientX;
    this.cuerpo23HintY = clientY - 16;
    this.cuerpo23HintVisible = true;

    if (this.cuerpo23HintTimer) {
      clearTimeout(this.cuerpo23HintTimer);
    }

    this.cuerpo23HintTimer = setTimeout(() => {
      this.cuerpo23HintVisible = false;
      this.cuerpo23HintTimer = null;
    }, 2800);
  }

  private hideCuerpo23Hint(): void {
    this.cuerpo23HintVisible = false;
    if (this.cuerpo23HintTimer) {
      clearTimeout(this.cuerpo23HintTimer);
      this.cuerpo23HintTimer = null;
    }
  }

  private init3dScene(): void {
    this.dispose3d();

    const canvasContainer = this.renderCanvasContainer?.nativeElement;
    if (!canvasContainer) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    //canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    // ✅ CAMBIO: target temporal en Zero(), se actualizará tras cargar el modelo
    this.camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 20, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(canvas, false);
    this.camera.inputs.attached.mousewheel?.attachControl();
    this.camera.wheelDeltaPercentage = 0.02;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 300;
    this.camera.panningSensibility = 50;

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 1.2;

    const directionalLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(5, 10, 5), this.scene);
    directionalLight.intensity = 0.8;

    this.createGround();
    this.load3dModel();

    this.renderLoopFn = () => {
      if (this.scene) this.scene.render();
    };

    this.engine.runRenderLoop(this.renderLoopFn);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.engine) this.engine.resize();
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    }

    if (this.renderCanvasContainer?.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }
  }

  private async load3dModel(): Promise<void> {
    if (!this.scene) return;

    const modelRoot = '/assets/3d-models/Edificio%20A/';
    const modelName = 'Piso 1.obj';

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', encodeURI(modelRoot), encodeURI(modelName), this.scene);
      const meshes = result.meshes;

      if (meshes.length === 0) {
        console.warn('No se encontraron mallas en el modelo.');
        const debugCube = BABYLON.MeshBuilder.CreateBox('debugCube', { size: 2 }, this.scene);
        debugCube.position = new BABYLON.Vector3(0, 1, 0);
        const debugMat = new BABYLON.StandardMaterial('debugMat', this.scene);
        debugMat.diffuseColor = new BABYLON.Color3(1, 0, 1);
        debugCube.material = debugMat;
        return;
      }

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      allNodes.rotation = new BABYLON.Vector3(-Math.PI / 2, 0, 0);

      meshes.forEach((mesh, index) => {
        if (mesh && typeof mesh === 'object') {
          mesh.isVisible = true;
          mesh.parent = allNodes;

          if (mesh.checkCollisions !== undefined) mesh.checkCollisions = true;

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
        }
      });

      // ✅ CAMBIO CLAVE: forzar un render para que Babylon actualice
      // las matrices del mundo DESPUÉS de aplicar la rotación
      this.scene.render();

      // ✅ CAMBIO CLAVE: calcular bounds en espacio MUNDO (world space)
      // usando getHierarchyBoundingVectors que respeta transformaciones del padre
      const { min, max } = allNodes.getHierarchyBoundingVectors(true);

      const size = BABYLON.Vector3.Distance(min, max);
      const targetSize = 25;

      if (size > 0) {
        const scale = targetSize / size;
        allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);

        // ✅ CAMBIO: re-calcular bounds tras aplicar la escala
        this.scene.render();
        const scaledBounds = allNodes.getHierarchyBoundingVectors(true);
        const scaledMin = scaledBounds.min;
        const scaledMax = scaledBounds.max;

        // ✅ CAMBIO: centrar el nodo en X/Z y apoyarlo en Y=0
        const centerX = (scaledMin.x + scaledMax.x) / 2;
        const centerZ = (scaledMin.z + scaledMax.z) / 2;
        allNodes.position.x = -centerX;
        allNodes.position.y = -scaledMin.y;
        allNodes.position.z = -centerZ;

        // ✅ CAMBIO: un render más para actualizar posición final
        this.scene.render();
        const finalBounds = allNodes.getHierarchyBoundingVectors(true);
        const finalMin = finalBounds.min;
        const finalMax = finalBounds.max;

        // ✅ CAMBIO: apuntar cámara al centro REAL del modelo en mundo
        if (this.camera) {
          const worldCenter = BABYLON.Vector3.Center(finalMin, finalMax);
          const worldSize = BABYLON.Vector3.Distance(finalMin, finalMax);

          // El target es el centro horizontal del modelo, a media altura
          this.camera.target = new BABYLON.Vector3(
            worldCenter.x,
            worldCenter.y,
            worldCenter.z
          );
          this.camera.radius = Math.max(worldSize * 1.2, 20);
          this.camera.lowerRadiusLimit = 1;
          this.camera.upperRadiusLimit = Math.max(worldSize * 10, 200);
        }

      } else {
        console.warn('No se pudieron calcular los bounds. Usando escala predeterminada.');
        allNodes.scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
      }

      this.scene.onPointerDown = (evt, pickResult) => {
        if (pickResult.hit && pickResult.pickedMesh?.name === 'Cuerpo23') {
          const native = evt as any;
          const button = native.button ?? native.srcEvent?.button;
          if (button === 0) {
            const clientX = native.clientX ?? native.srcEvent?.clientX ?? 0;
            const clientY = native.clientY ?? native.srcEvent?.clientY ?? 0;
            this.showCuerpo23Hint(clientX, clientY);
          }
        } else {
          this.hideCuerpo23Hint();
        }
      };

    } catch (error) {
      console.error('No se pudo cargar el modelo 3D:', error);
    }
  }

  private createGround(): void {
    if (!this.scene) return;
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    ground.position.y = 0.01;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    ground.material = groundMat;
  }
  toggleMarker(id: string) {
  const card = document.getElementById(id);
  if (card) {
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  }
}
}