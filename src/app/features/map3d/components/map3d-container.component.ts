/*
  Componente del visor 3D (Map3dContainerComponent).
  Descripción: inicializa la escena BabylonJS, carga modelos OBJ, gestiona interacción (clics, zoom,
  búsqueda de rutas) y dibuja guías/flechas basadas en datos de navegación.
*/
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { HttpClient } from '@angular/common/http';
import { Firebase } from '../../../services/firebase';
import { dibujarFlechaGuia } from '../../../services/flecha_guía';

@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('renderCanvas', { static: false })
  renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '3d';
  private readonly firstFloorModel = 'Edifico A - Piso 1.obj';
  private readonly secondFloorModel = 'Edificio A - piso 2.obj';
  private readonly thirdFloorModel = 'Edificio A - piso 3.obj';
  currentFloor = this.firstFloorModel;

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private cameraBeforeRenderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  private renderLoopFn: (() => void) | null = null;
  private orthoSize = 14;
  private readonly defaultOrthoSize = 14;
  private readonly boundaryNameRegExp = /wall|ground|floor|suelo|piso/i;
  private readonly topDownPanLimits = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
  private isTopDownView = false;
  private searchModeEnabled = false;
  private zoomOutEnabled = false;
  private bannerControlsAttached = false;
  private infoBox: HTMLDivElement | null = null;
  private floorArrow: HTMLDivElement | null = null;
  private buildingBMarker: HTMLDivElement | null = null;
  floorDialogVisible = false;
  searchQuery = '';
  destinationOptions: string[] = ['Fotocopiadora', 'Sala de Tutorías 1', 'Sala de Tutorías 2', 'Sala de Tutorías 3', 'Sala de Tutorías 4', 'Ascensor'];
  filteredDestinations: string[] = [...this.destinationOptions];
  selectedDestination: string | null = null;

  private onDocumentClick = (evt: MouseEvent): void => {
    if (this.infoBox) {
      this.infoBox.style.display = 'none';
    }
    if (this.floorArrow) {
      this.floorArrow.style.display = 'none';
    }
  };

  // Estado y marcadores para demo de ruta
  // ── Información de cada cuerpo ──────────────────────────
  // IMPORTANTE: los keys deben coincidir con mesh.name del OBJ
  // Abre la consola del navegador en modo 3D para ver los nombres reales
  private infoData: { [key: string]: { nombre: string, desc: string } } = {
    'Cuerpo13': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' },
    'Cuerpo29': { nombre: 'Sala de Tutorías 1',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo30': { nombre: 'Sala de Tutorías 2',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo28': { nombre: 'Sala de Tutorías 3',          desc: 'Espacio adicional de tutorías con capacidad para grupos pequeños.' },
    'Cuerpo27': { nombre: 'Sala de Tutorías 4',          desc: 'Sala de apoyo académico y reuniones estudiantiles.' }
  };

  // ── Cuerpos del primer piso de Edificio A que abren el diálogo de selección de piso ────
  private floorSelectionBodies = ['Cuerpo21', 'Cuerpo14', 'Cuerpo19', 'Cuerpo25', 'Cuerpo11'];

  private readonly mainEntranceAccess = new BABYLON.Vector3(11.22, 0.01, 0.12);

  constructor(private http: HttpClient, private firebaseService: Firebase) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
    this.attachBannerControls();
    this.createInfoBox();
    this.createFloorArrow();
    this.createBuildingBMarker();
    if (this.viewMode === '3d') {
      setTimeout(() => this.init3dScene(), 0);
    }
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
    if (mode === this.viewMode) return;

    if (mode === '3d') {
      this.viewMode = '3d';
      this.isTopDownView = false;
      if (!this.scene) {
        setTimeout(() => this.init3dScene(), 0);
      } else {
        this.configureCameraMode();
      }
    } else {
      this.viewMode = '2d';
      this.isTopDownView = true;
      if (!this.scene) {
        setTimeout(() => this.init3dScene(), 0);
      } else {
        this.configureCameraMode();
      }
    }

    this.updateBannerButtons();
  }

  private configureCameraMode(): void {
    if (!this.camera) return;

    if (this.isTopDownView) {
      this.camera.alpha = -Math.PI / 2;
      this.camera.beta = 0.12;
      this.camera.radius = 25;
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      this.camera.lowerAlphaLimit = this.camera.upperAlphaLimit = this.camera.alpha;
      this.camera.lowerBetaLimit = this.camera.upperBetaLimit = this.camera.beta;
    } else {
      this.camera.alpha = -Math.PI / 3;
      this.camera.beta = Math.PI / 5;
      this.camera.radius = 20;
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
      this.camera.lowerAlphaLimit = null;
      this.camera.upperAlphaLimit = null;
      this.camera.lowerBetaLimit = 0.01;
      this.camera.upperBetaLimit = Math.PI / 2;
    }

    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.updateOrthoCamera();
  }

  private attachBannerControls(): void {
    if (this.bannerControlsAttached) return;
    const view2DBtn = document.getElementById('view2DBtn');
    const view3DBtn = document.getElementById('view3DBtn');
    const searchPlaceBtn = document.getElementById('searchPlaceBtn');
    if (view2DBtn) view2DBtn.addEventListener('click', () => this.setView('2d'));
    if (view3DBtn) view3DBtn.addEventListener('click', () => this.setView('3d'));
    if (searchPlaceBtn) searchPlaceBtn.addEventListener('click', () => this.toggleSearchMode());
    this.bannerControlsAttached = true;
    this.updateBannerButtons();
  }

  private updateBannerButtons(): void {
    const view2DBtn = document.getElementById('view2DBtn') as HTMLButtonElement | null;
    const view3DBtn = document.getElementById('view3DBtn') as HTMLButtonElement | null;
    const searchPlaceBtn = document.getElementById('searchPlaceBtn') as HTMLButtonElement | null;
    if (view2DBtn) view2DBtn.disabled = this.viewMode === '2d';
    if (view3DBtn) view3DBtn.disabled = this.viewMode === '3d';
    if (searchPlaceBtn) {
      searchPlaceBtn.disabled = false;
      searchPlaceBtn.textContent = 'Buscar lugar';
    }
    this.updateZoomButtons();
  }

  private toggleSearchMode(): void {
    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
    this.searchModeEnabled = !this.searchModeEnabled;
    if (this.searchModeEnabled) {
      this.searchQuery = '';
      this.filteredDestinations = [...this.destinationOptions];
    } else {
      this.clearPath();
      this.clearMarkers();
    }
    this.updateBannerButtons();
  }

  filterSearchOptions(): void {
    const query = this.searchQuery.trim().toLowerCase();
    this.filteredDestinations = this.destinationOptions.filter(option =>
      option.toLowerCase().includes(query)
    );
  }

  selectDestination(destination: string): void {
    this.selectedDestination = destination;
    this.searchQuery = destination;
    this.searchModeEnabled = false;
    this.searchDestination(destination);
    this.updateBannerButtons();
  }

  private async searchDestination(destination: string): Promise<void> {
    const location = await this.firebaseService.getLocacionPorNombre('Edificio A', '1', destination);
    const coordinate = this.extractCoordinateFromLocation(location);
    this.clearPath();
    this.clearMarkers();
    if (coordinate) {
      if (this.scene) {
        this.pathMeshes.push(...dibujarFlechaGuia(this.scene, this.mainEntranceAccess, coordinate));
      }
      return;
    }

    console.warn(`No se encontró coordenada para destino: ${destination}`);
  }

  private extractCoordinateFromLocation(location: any): BABYLON.Vector3 | null {
    if (!location) return null;
    const coord = location.Coordenadas || location.coordenadas || location.coords || location.coordinates || location.coordenada;
    if (Array.isArray(coord) && coord.length >= 3 && coord.every((v: any) => typeof v === 'number')) {
      return new BABYLON.Vector3(coord[0], coord[1], coord[2]);
    }
    if (coord && typeof coord === 'object' && coord.x != null && coord.y != null && coord.z != null) {
      return new BABYLON.Vector3(coord.x, coord.y, coord.z);
    }
    if (location.x != null && location.y != null && location.z != null) {
      return new BABYLON.Vector3(location.x, location.y, location.z);
    }
    return null;
  }

  private canZoomOut(): boolean {
    if (!this.camera) return false;
    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      return this.orthoSize < this.defaultOrthoSize;
    }
    const upper = this.camera.upperRadiusLimit ?? 500;
    return this.camera.radius < upper;
  }

  private updateZoomButtons(): void {
    this.zoomOutEnabled = this.canZoomOut();
  }

  zoomIn(): void {
    if (!this.camera) return;

    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.max(4, this.orthoSize * 0.85);
      this.updateOrthoCamera();
    } else {
      const newRadius = this.camera.radius * 0.85;
      this.camera.radius = Math.max(newRadius, this.camera.lowerRadiusLimit ?? 1);
    }
    this.updateZoomButtons();
  }

  zoomOut(): void {
    if (!this.camera) return;

    if (!this.zoomOutEnabled) {
      return;
    }

    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.min(this.defaultOrthoSize, this.orthoSize * 1.15);
      this.updateOrthoCamera();
    } else {
      const newRadius = this.camera.radius * 1.15;
      this.camera.radius = Math.min(newRadius, this.camera.upperRadiusLimit ?? 500);
    }
    this.updateZoomButtons();
  }

  get floorActionLabel(): string {
    if (this.currentFloor === this.secondFloorModel) {
      return 'Ir al primer piso';
    }
    if (this.currentFloor === this.thirdFloorModel) {
      return 'Ir al segundo piso';
    }
    return 'Ir al segundo piso';
  }

  get floorActionIcon(): string {
    return this.currentFloor === this.firstFloorModel ? '↑' : '↓';
  }

  openFloorDialog(): void {
    this.floorDialogVisible = true;
  }

  selectFloor(floor: 'first' | 'second' | 'third'): void {
    this.floorDialogVisible = false;
    const targetFloor = floor === 'first'
      ? this.firstFloorModel
      : floor === 'second'
        ? this.secondFloorModel
        : this.thirdFloorModel;

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

    // Evitar que la rueda del ratón haga scroll en la página cuando el cursor está sobre el canvas
    const wheelHandler = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); };
    // Prevención local sobre el canvas
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    // Añadir/remover captura global cuando el ratón entra/sale del canvas para bloquear desplazamiento de la página
    canvas.addEventListener('mouseenter', () => document.addEventListener('wheel', wheelHandler, { passive: false, capture: true }));
    canvas.addEventListener('mouseleave', () => document.removeEventListener('wheel', wheelHandler, { capture: true }));

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    const initialAlpha = this.isTopDownView ? -Math.PI / 2 : -Math.PI / 3;
    const initialBeta = this.isTopDownView ? 0.12 : Math.PI / 5;
    const initialRadius = this.isTopDownView ? 25 : 20;

    this.camera = new BABYLON.ArcRotateCamera('camera', initialAlpha, initialBeta, initialRadius, BABYLON.Vector3.Zero(), this.scene);
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.attachControl(canvas, true, false);
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.lowerRadiusLimit = 12;
    this.camera.upperRadiusLimit = 30;
    this.camera.panningSensibility = 50;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new BABYLON.Vector3(0.75, 0.75, 0.75);
    this.camera.setTarget(BABYLON.Vector3.Zero());

    if (this.isTopDownView) {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      this.camera.lowerAlphaLimit = this.camera.upperAlphaLimit = this.camera.alpha;
      this.camera.lowerBetaLimit = this.camera.upperBetaLimit = this.camera.beta;
    } else {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
      this.camera.lowerBetaLimit = 0.01;
      this.camera.upperBetaLimit = Math.PI / 2;
    }

    // Permitir movimiento horizontal en X solo cuando se haya hecho zoom suficiente (>=30%)
    const fixedCameraY = 0;
    const maxPanX = 5;
    const minPanX = -5;
    const orthoMin = 6; // tamaño ortho más cercano (zoom máximo)
    const orthoMax = 14; // tamaño ortho más lejano (zoom mínimo)
    const topDownMinX = this.topDownPanLimits.minX;
    const topDownMaxX = this.topDownPanLimits.maxX;
    const topDownMinZ = this.topDownPanLimits.minZ;
    const topDownMaxZ = this.topDownPanLimits.maxZ;

    if (this.scene) {
      this.cameraBeforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
        const camera = this.camera;
        if (!camera) return;
        try {
          const target = camera.target;
          let modified = false;
          const newTarget = target.clone();

          // Mantener Y fijo siempre
          if (newTarget.y !== fixedCameraY) {
            newTarget.y = fixedCameraY;
            modified = true;
          }

          // Determinar si se permite paneo horizontal según el nivel de zoom
          let allowPan = false;
          if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
            const clamped = Math.min(Math.max(this.orthoSize, orthoMin), orthoMax);
            const zoomPercent = (orthoMax - clamped) / (orthoMax - orthoMin); // 0..1
            allowPan = zoomPercent >= 0.3; // permitir paneo a partir de 30% de zoom
          } else {
            const lower = camera.lowerRadiusLimit ?? 1;
            const upper = camera.upperRadiusLimit ?? 100;
            const clampedRad = Math.min(Math.max(camera.radius, lower), upper);
            const zoomPercent = (upper - clampedRad) / Math.max(upper - lower, 1);
            allowPan = zoomPercent >= 0.3;
          }

          if (this.isTopDownView) {
            if (newTarget.x > topDownMaxX) {
              newTarget.x = topDownMaxX;
              modified = true;
            } else if (newTarget.x < topDownMinX) {
              newTarget.x = topDownMinX;
              modified = true;
            }
            if (newTarget.z > topDownMaxZ) {
              newTarget.z = topDownMaxZ;
              modified = true;
            } else if (newTarget.z < topDownMinZ) {
              newTarget.z = topDownMinZ;
              modified = true;
            }
          } else {
            if (!allowPan) {
              // si no está permitido paneo, centrar X en 0
              if (newTarget.x !== 0) {
                newTarget.x = 0;
                modified = true;
              }
            } else {
              // limitar paneo horizontal dentro de rangos
              if (newTarget.x > maxPanX) {
                newTarget.x = maxPanX;
                modified = true;
              } else if (newTarget.x < minPanX) {
                newTarget.x = minPanX;
                modified = true;
              }
            }
          }

          if (modified) {
            camera.setTarget(newTarget);
          }
        } catch (e) {
          // ignore
        }
      });
    }

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 1.2;

    const directionalLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(5, 10, 5), this.scene);
    directionalLight.intensity = 0.8;

    this.createGround();
    this.updateOrthoCamera();
    this.updateZoomButtons();
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
    if (this.engine) {
      this.engine.resize();
      this.updateOrthoCamera();
    }
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('click', this.onDocumentClick, true);
      // remove scene observer if any
      if (this.scene && this.cameraBeforeRenderObserver) {
        try { this.scene.onBeforeRenderObservable.remove(this.cameraBeforeRenderObserver); } catch {}
        this.cameraBeforeRenderObserver = null;
      }
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

  private updateOrthoCamera(): void {
    if (!this.camera || !this.engine || this.camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) return;
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const aspect = width / Math.max(height, 1);
    const scale = this.orthoSize;
    this.camera.orthoTop = scale;
    this.camera.orthoBottom = -scale;
    this.camera.orthoRight = scale * aspect;
    this.camera.orthoLeft = -scale * aspect;
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
      // Rotar el objeto 180° en Y al cargar (mantener rotación X para orientación)
      allNodes.rotation = new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

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

        if (this.camera) {
          this.camera.setTarget(allNodes.position.clone());
        }
      }

      this.scene.render();

      // Asegurar colisiones entre cámara/texto y los cuerpos visibles
      meshes.forEach((mesh) => {
        if (mesh instanceof BABYLON.AbstractMesh) {
          mesh.checkCollisions = true;
          mesh.isPickable = true;
        }
      });

      // ── Nombres de los cuerpos en consola ─────────────────
      console.log('==== NOMBRES DE CUERPOS ====');
      meshes.forEach((mesh) => console.log('CUERPO:', mesh.name));




      // ── Click — detectar clic en cuerpo o suelo y imprimir coordenadas ──
      canvas.addEventListener('click', (evt) => {
        if (!this.scene) return;

        const hits = this.scene.multiPick(evt.clientX, evt.clientY);
        let pickResult: any = null;

        if (hits && hits.length > 0) {
          const objectHit = hits.find(hit => hit.hit && hit.pickedMesh && hit.pickedMesh.name && !this.boundaryNameRegExp.test(hit.pickedMesh.name));
          const fallbackHit = hits.find(hit => hit.hit && hit.pickedMesh && hit.pickedMesh.name);
          pickResult = objectHit || fallbackHit;
        }

        if (pickResult?.hit) {
          const meshName = pickResult.pickedMesh ? pickResult.pickedMesh.name : 'suelo';
          const isBoundary = this.boundaryNameRegExp.test(meshName);
          const target = isBoundary ? `${meshName} (límite)` : meshName;
          const coords = pickResult.pickedPoint;
          console.log(`Clic en: ${target}, Coordenadas: (${coords?.x.toFixed(2)}, ${coords?.y.toFixed(2)}, ${coords?.z.toFixed(2)})`);

          // ── Abrir diálogo de selección de piso solo en el primer piso de Edificio A
          const isFloorTrigger = pickResult.pickedMesh && this.currentFloor === this.firstFloorModel && this.floorSelectionBodies.includes(pickResult.pickedMesh.name);
          if (isFloorTrigger) {
            this.openFloorDialog();
          } else {
            this.closeFloorDialog();
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

          // --- DEMO: seleccionar punto A y punto B con dos clics para dibujar ruta ---
        }
      });

    } catch (error) {
      console.error('No se pudo cargar el modelo 3D:', error);
    }
  }

  private createGround(): void {
    if (!this.scene) return;

    const farSize = 220;
    const wallHeight = 16;
    const wallDepth = 0.5;

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: farSize, height: farSize }, this.scene);
    ground.position.y = 0.01;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    groundMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    groundMat.alpha = 0;
    groundMat.backFaceCulling = false;
    ground.material = groundMat;
    ground.checkCollisions = true;
    ground.isPickable = true;

    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    wallMat.alpha = 0;
    wallMat.backFaceCulling = false;

    const createWall = (name: string, width: number, height: number): BABYLON.Mesh => {
      const wall = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, this.scene!);
      wall.material = wallMat;
      wall.checkCollisions = true;
      wall.isPickable = true;
      return wall;
    };

    const wallDistance = farSize / 2;
    const northWall = createWall('northWall', farSize, wallHeight);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, -wallDistance);

    const southWall = createWall('southWall', farSize, wallHeight);
    southWall.position = new BABYLON.Vector3(0, wallHeight / 2, wallDistance);
    southWall.rotation = new BABYLON.Vector3(0, Math.PI, 0);

    const eastWall = createWall('eastWall', farSize, wallHeight);
    eastWall.position = new BABYLON.Vector3(wallDistance, wallHeight / 2, 0);
    eastWall.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

    const westWall = createWall('westWall', farSize, wallHeight);
    westWall.position = new BABYLON.Vector3(-wallDistance, wallHeight / 2, 0);
    westWall.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
  }

  // ── Gestión de ruta y limpieza de trazados ─────────────────
  private pathMeshes: BABYLON.AbstractMesh[] = [];

  /** Limpia/descarta la ruta y las flechas dibujadas */
  public clearPath(): void {
    if (!this.scene) return;
    while (this.pathMeshes.length > 0) {
      const m = this.pathMeshes.pop();
      try { m && m.dispose(); } catch (_) { /* ignore */ }
    }
  }

  // --- Utilities para demo de selección y marcadores ---
  private clearMarkers(): void {
    // Eliminado sistema de marcadores por selección de clic. Actualmente solo se limpian trazados.
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