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

  @ViewChild('renderCanvas', { static: false })
  renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '2d';
  private readonly firstFloorModel = 'Edifico A - Piso 1.obj';
  private readonly secondFloorModel = 'Edificio A - piso 2.obj';
  currentFloor = this.firstFloorModel;

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private renderLoopFn: (() => void) | null = null;
  private bannerControlsAttached = false;
  private infoBox: HTMLDivElement | null = null;
  private floorArrow: HTMLDivElement | null = null;
  private buildingBMarker: HTMLDivElement | null = null;
  floorDialogVisible = false;

  private onDocumentClick = (evt: MouseEvent): void => {
    if (this.infoBox) {
      this.infoBox.style.display = 'none';
    }
    if (this.floorArrow) {
      this.floorArrow.style.display = 'none';
    }
  };

  // ── Información de cada cuerpo ──────────────────────────
  // IMPORTANTE: los keys deben coincidir con mesh.name del OBJ
  // Abre la consola del navegador en modo 3D para ver los nombres reales
  private infoData: { [key: string]: { nombre: string, desc: string } } = {
    'Cuerpo3':  { nombre: 'Sala de Tutorías 2',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo14': { nombre: 'Sala de Tutorías 1',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo21': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' }
  };

  // ── Cuerpos que abren el diálogo de selección de piso ────
  private floorSelectionBodies = ['Cuerpo23', 'Cuerpo29', 'Cuerpo15', 'Cuerpo20'];

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
    this.attachBannerControls();
    this.createInfoBox();
    this.createFloorArrow();
    this.createBuildingBMarker();
  }

  // ── Crea el cuadro de info flotante ──────────────────────
  private createInfoBox(): void {
    this.infoBox = document.createElement('div');
    this.infoBox.style.cssText = `
      display: none;
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 10px 14px;
      width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      z-index: 1000;
      pointer-events: none;
    `;
    document.body.appendChild(this.infoBox);
  }

  // ── Crea la flecha para ir al piso dos ───────────────────
  private createFloorArrow(): void {
    this.floorArrow = document.createElement('div');
    this.floorArrow.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 1001;
      pointer-events: none;
    `;
    this.floorArrow.innerHTML = '→ Ir al piso dos';
    document.body.appendChild(this.floorArrow);
  }

  // ── Crea el marcador para Edificio B ─────────────────────
  private createBuildingBMarker(): void {
    this.buildingBMarker = document.createElement('div');
    this.buildingBMarker.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 999;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.buildingBMarker.innerHTML = '→ Ir al Edificio B - Piso 1';
    this.buildingBMarker.addEventListener('mouseenter', () => {
      if (this.buildingBMarker) {
        this.buildingBMarker.style.backgroundColor = 'rgba(0,0,0,0.95)';
      }
    });
    this.buildingBMarker.addEventListener('mouseleave', () => {
      if (this.buildingBMarker) {
        this.buildingBMarker.style.backgroundColor = 'rgba(0,0,0,0.8)';
      }
    });
    this.buildingBMarker.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Navegando a Edificio B - Piso 1');
    });
    document.body.appendChild(this.buildingBMarker);
  }

  private ensureLoaders(): void {
    if (!BABYLON.SceneLoader.IsPluginForExtensionAvailable('.obj')) {
      console.warn('OBJ loader no está disponible');
    } else {
      console.log('✅ OBJ Loader disponible');
    }
  }

  ngOnDestroy(): void {
    this.dispose3d();
    if (this.infoBox) {
      document.body.removeChild(this.infoBox);
      this.infoBox = null;
    }
    if (this.floorArrow) {
      document.body.removeChild(this.floorArrow);
      this.floorArrow = null;
    }
    if (this.buildingBMarker) {
      document.body.removeChild(this.buildingBMarker);
      this.buildingBMarker = null;
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
    this.updateBannerButtons();
  }

  private attachBannerControls(): void {
    if (this.bannerControlsAttached) return;
    const view2DBtn = document.getElementById('view2DBtn');
    const view3DBtn = document.getElementById('view3DBtn');
    if (view2DBtn) view2DBtn.addEventListener('click', () => this.setView('2d'));
    if (view3DBtn) view3DBtn.addEventListener('click', () => this.setView('3d'));
    this.bannerControlsAttached = true;
    this.updateBannerButtons();
  }

  private updateBannerButtons(): void {
    const view2DBtn = document.getElementById('view2DBtn') as HTMLButtonElement | null;
    const view3DBtn = document.getElementById('view3DBtn') as HTMLButtonElement | null;
    if (view2DBtn) view2DBtn.disabled = this.viewMode === '2d';
    if (view3DBtn) view3DBtn.disabled = this.viewMode === '3d';
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

  get floorActionLabel(): string {
    return this.currentFloor === this.secondFloorModel ? 'Ir al primer piso' : 'Ir al segundo piso';
  }

  get floorActionIcon(): string {
    return this.currentFloor === this.secondFloorModel ? '↓' : '↑';
  }

  openFloorDialog(): void {
    this.floorDialogVisible = true;
  }

  selectFloor(floor: 'first' | 'second'): void {
    this.floorDialogVisible = false;
    const targetFloor = floor === 'first' ? this.firstFloorModel : this.secondFloorModel;

    if (this.currentFloor !== targetFloor) {
      this.currentFloor = targetFloor;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  closeFloorDialog(): void {
    this.floorDialogVisible = false;
  }

  changeFloor(floor: string): void {
    this.currentFloor = floor;
    if (this.viewMode === '3d') this.init3dScene();
  }

  private init3dScene(): void {
    this.dispose3d();

    const canvasContainer = this.renderCanvasContainer?.nativeElement;
    if (!canvasContainer) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    this.camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 20, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 300;
    this.camera.panningSensibility = 50;

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 1.2;

    const directionalLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(5, 10, 5), this.scene);
    directionalLight.intensity = 0.8;

    this.createGround();
    this.load3dModel(canvas);

    this.renderLoopFn = () => {
      if (this.scene && this.camera) {
        this.scene.render();
        this.updateBuildingBMarkerPosition(canvas);
      }
    };

    this.engine.runRenderLoop(this.renderLoopFn);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('click', this.onDocumentClick, true);
  }

  private onResize = (): void => {
    if (this.engine) this.engine.resize();
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('click', this.onDocumentClick, true);
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    } else {
      document.removeEventListener('click', this.onDocumentClick, true);
    }
    if (this.renderCanvasContainer?.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }
  }

  private async load3dModel(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.scene) return;

    const modelRoot = '/assets/3d-models/Edificio A/';
    const modelName = this.currentFloor;

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(modelRoot),
        encodeURI(modelName),
        this.scene
      );

      const meshes = result.meshes;
      if (meshes.length === 0) return;

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      allNodes.rotation = new BABYLON.Vector3(-Math.PI / 2, 0, 0);

      meshes.forEach((mesh, index) => {
        mesh.isVisible = true;
        mesh.parent = allNodes;
        if (!mesh.material) {
          const defaultMat = new BABYLON.StandardMaterial(`mat_${index}`, this.scene!);
          defaultMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
          mesh.material = defaultMat;
        }
      });

      this.scene.render();

      const bounds = allNodes.getHierarchyBoundingVectors(true);
      const size = BABYLON.Vector3.Distance(bounds.min, bounds.max);
      const targetSize = 25;

      if (size > 0) {
        const scale = targetSize / size;
        allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);
        this.scene.render();

        const scaledBounds = allNodes.getHierarchyBoundingVectors(true);
        const centerX = (scaledBounds.min.x + scaledBounds.max.x) / 2;
        const centerZ = (scaledBounds.min.z + scaledBounds.max.z) / 2;
        allNodes.position.x = -centerX;
        allNodes.position.y = -scaledBounds.min.y;
        allNodes.position.z = -centerZ;
      }

      this.scene.render();

      // ── Nombres de los cuerpos en consola ─────────────────
      console.log('==== NOMBRES DE CUERPOS ====');
      meshes.forEach((mesh) => console.log('CUERPO:', mesh.name));



      // ── Click — detectar clic en cuerpo o suelo y imprimir coordenadas ──
      canvas.addEventListener('click', (evt) => {
        if (!this.scene) return;

        const pickResult = this.scene.pick(evt.clientX, evt.clientY);

        if (pickResult?.hit) {
          const target = pickResult.pickedMesh ? pickResult.pickedMesh.name : 'suelo';
          const coords = pickResult.pickedPoint;
          console.log(`Clic en: ${target}, Coordenadas: (${coords?.x.toFixed(2)}, ${coords?.y.toFixed(2)}, ${coords?.z.toFixed(2)})`);

          // ── Abrir diálogo de selección de piso si es uno de los cuerpos especificados ──
          if (pickResult.pickedMesh && this.floorSelectionBodies.includes(pickResult.pickedMesh.name)) {
            this.openFloorDialog();
          }

          // ── Mostrar infoBox si hay info para el mesh clicado ──
          if (pickResult.pickedMesh && this.infoBox) {
            const info = this.infoData[pickResult.pickedMesh.name];
            if (info) {
              this.infoBox.innerHTML = `
                <p style="font-weight:bold;font-size:14px;margin:0 0 4px">${info.nombre}</p>
                <p style="font-size:12px;color:#555;margin:0">${info.desc}</p>
              `;
              this.infoBox.style.display = 'block';
              this.infoBox.style.left = (evt.clientX + 15) + 'px';
              this.infoBox.style.top  = (evt.clientY + 15) + 'px';
            } else {
              this.infoBox.style.display = 'none';
            }
          } else if (this.infoBox) {
            this.infoBox.style.display = 'none';
          }
        }
      });

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

  private updateBuildingBMarkerPosition(canvas: HTMLCanvasElement): void {
    if (!this.buildingBMarker || !this.scene || !this.camera || !this.engine) return;

    // Solo mostrar el marcador si estamos en el piso 1 en vista 3D
    const isFirstFloor = this.currentFloor === this.firstFloorModel;
    if (!isFirstFloor || this.viewMode !== '3d') {
      this.buildingBMarker.style.display = 'none';
      return;
    }

    // Centro calculado de los 4 puntos:
    // (-12.42, 0.01, -0.35), (-10.62, 0.01, -0.29), (-10.69, 0.01, -2.93), (-12.31, 0.01, -2.95)
    const markerWorldPos = new BABYLON.Vector3(-11.51, 0.01, -1.63);

    try {
      // Obtener las matrices necesarias
      const viewMatrix = this.camera.getViewMatrix();
      const projectionMatrix = this.camera.getProjectionMatrix();
      
      // Crear matriz de transformación combinada (view * projection)
      const transformMatrix = viewMatrix.multiply(projectionMatrix);

      // Proyectar el punto 3D a coordenadas de pantalla
      const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());
      const screenCoords = BABYLON.Vector3.Project(
        markerWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      // Verificar si el punto está dentro de la pantalla (z > 0 significa está adelante de la cámara)
      if (screenCoords.z > 0 && screenCoords.z < 1 &&
          screenCoords.x > 0 && screenCoords.x < this.engine.getRenderWidth() &&
          screenCoords.y > 0 && screenCoords.y < this.engine.getRenderHeight()) {
        this.buildingBMarker.style.display = 'block';
        this.buildingBMarker.style.left = (screenCoords.x - 60) + 'px'; // Centrar horizontalmente
        this.buildingBMarker.style.top = (screenCoords.y - 30) + 'px';  // Posicionar arriba del marcador
      } else {
        this.buildingBMarker.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error actualizando posición del marcador:', error);
      this.buildingBMarker.style.display = 'none';
    }
  }

  toggleMarker(id: string): void {
    const card = document.getElementById(id);
    if (card) {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
  }
}