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
  private readonly thirdFloorModel = 'Edificio A - piso 3.obj';
  currentFloor = this.firstFloorModel;

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private cameraBeforeRenderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  private renderLoopFn: (() => void) | null = null;
  private orthoSize = 9;
  private searchModeEnabled = false;
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

  // Estado y marcadores para demo de ruta
  private selectionStart: BABYLON.Vector3 | null = null;
  private startMarker: BABYLON.Mesh | null = null;
  private endMarker: BABYLON.Mesh | null = null;

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
      searchPlaceBtn.disabled = this.viewMode !== '3d';
      searchPlaceBtn.textContent = this.searchModeEnabled ? 'Buscar lugar (activo)' : 'Buscar lugar';
    }
  }

  private toggleSearchMode(): void {
    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
    this.searchModeEnabled = !this.searchModeEnabled;
    if (!this.searchModeEnabled) {
      this.clearPath();
      this.clearMarkers();
    }
    this.updateBannerButtons();
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
  }

  zoomOut(): void {
    if (!this.camera) return;

    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.min(18, this.orthoSize * 1.15);
      this.updateOrthoCamera();
    } else {
      const newRadius = this.camera.radius * 1.15;
      this.camera.radius = Math.min(newRadius, this.camera.upperRadiusLimit ?? 500);
    }
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
    canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    this.camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 4, Math.PI / 4, 12, BABYLON.Vector3.Zero(), this.scene);
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.attachControl(canvas, true, false);
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.lowerRadiusLimit = 8;
    this.camera.upperRadiusLimit = 20;
    this.camera.panningSensibility = 50;
    this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
    this.camera.lowerBetaLimit = 0.01;
    this.camera.upperBetaLimit = Math.PI / 2;

    // Permitir movimiento horizontal en X solo cuando se haya hecho zoom in
    const fixedCameraY = 0;
    const maxPanX = 5;
    const minPanX = -5;
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

          // Cuando estamos en zoom máximo o cerca del default, regresar el centro a X=0.
          const upperRadiusLimit = camera.upperRadiusLimit ?? 20;
          if (camera.radius >= upperRadiusLimit) {
            if (newTarget.x !== 0) {
              newTarget.x = 0;
              modified = true;
            }
          } else {
            // Al hacer zoom in, permitir paneo horizontal limitado
            if (newTarget.x > maxPanX) {
              newTarget.x = maxPanX;
              modified = true;
            } else if (newTarget.x < minPanX) {
              newTarget.x = minPanX;
              modified = true;
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

          // --- DEMO: seleccionar punto A y punto B con dos clics para dibujar ruta ---
          if (pickResult.pickedPoint && this.searchModeEnabled) {
            this.handleMapClick(pickResult.pickedPoint);
          }
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
    groundMat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.material = groundMat;

    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    wallMat.alpha = 0.95;
    wallMat.backFaceCulling = false;

    const createWall = (name: string, width: number, height: number): BABYLON.Mesh => {
      const wall = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, this.scene!);
      wall.material = wallMat;
      wall.isPickable = false;
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

  // ── Gestión y dibujo de rutas / flechas ─────────────────
  private pathMeshes: BABYLON.AbstractMesh[] = [];

  /**
   * Dibuja una ruta poligonal y flechas orientadas entre los puntos proporcionados.
   * - `points` debe ser un array de `BABYLON.Vector3` en coordenadas del mundo de la escena.
   */
  public drawArrowPath(points: BABYLON.Vector3[], color = new BABYLON.Color3(0.05, 0.7, 0.15)): void {
    if (!this.scene) return;
    this.clearPath();

    if (!points || points.length < 2) return;

    // Línea que une los puntos
    const lines = BABYLON.MeshBuilder.CreateLines('pathLines', { points }, this.scene);
    // LinesMesh soporta propiedad `color`
    (lines as any).color = color;
    this.pathMeshes.push(lines);

    // Material para las puntas de flecha
    const arrowMat = new BABYLON.StandardMaterial('arrowMat', this.scene);
    arrowMat.diffuseColor = color;
    arrowMat.emissiveColor = color;

    // Crear una flecha (cono) para cada segmento apuntando hacia el siguiente punto
    for (let i = 0; i < points.length - 1; i++) {
      try {
        const a = points[i];
        const b = points[i + 1];
        const dir = b.subtract(a);
        const length = dir.length();
        if (length === 0) continue;

        // Posicionar la flecha en la mitad del segmento
        const mid = a.add(dir.scale(0.5));

        // Crear un cono (arrow head)
        const head = BABYLON.MeshBuilder.CreateCylinder(`arrowHead_${i}`, {
          height: Math.min(1.2, Math.max(0.4, length * 0.25)),
          diameterTop: 0,
          diameterBottom: Math.min(0.6, Math.max(0.15, length * 0.08))
        }, this.scene);
        head.material = arrowMat;
        head.position = mid;

        // Orientar el cono hacia el siguiente punto
        head.lookAt(b);
        // Ajuste: los conos se crean apuntando en +Z, rotar 90° sobre X para apuntar correctamente
        head.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2, BABYLON.Space.LOCAL);

        // Hacer que el cono no participe en picking/colisiones
        head.isPickable = false;
        head.checkCollisions = false;

        this.pathMeshes.push(head);
      } catch (e) {
        console.warn('Error creando flecha del segmento', e);
      }
    }
  }

  /** Dibuja una flecha simple entre dos puntos A y B. */
  public drawArrowBetween(a: BABYLON.Vector3, b: BABYLON.Vector3): void {
    this.drawArrowPath([a, b]);
  }

  /** Limpia/descarta la ruta y las flechas dibujadas */
  public clearPath(): void {
    if (!this.scene) return;
    while (this.pathMeshes.length > 0) {
      const m = this.pathMeshes.pop();
      try { m && m.dispose(); } catch (_) { /* ignore */ }
    }
  }

  // --- Utilities para demo de selección y marcadores ---
  private createMarker(pos: BABYLON.Vector3, color = new BABYLON.Color3(0.9, 0.2, 0.2)): BABYLON.Mesh | null {
    if (!this.scene) return null;
    const mat = new BABYLON.StandardMaterial('markerMat', this.scene);
    mat.diffuseColor = color;
    const sph = BABYLON.MeshBuilder.CreateSphere('marker', { diameter: 0.6 }, this.scene);
    sph.material = mat;
    sph.position = pos.clone();
    sph.isPickable = false;
    return sph;
  }

  private clearMarkers(): void {
    try { if (this.startMarker) { this.startMarker.dispose(); this.startMarker = null; } } catch {}
    try { if (this.endMarker) { this.endMarker.dispose(); this.endMarker = null; } } catch {}
  }

  private sampleLine(a: BABYLON.Vector3, b: BABYLON.Vector3, step = 1): BABYLON.Vector3[] {
    const dir = b.subtract(a);
    const length = dir.length();
    if (length === 0) return [a.clone()];
    const n = Math.max(1, Math.floor(length / step));
    const unit = dir.normalize();
    const pts: BABYLON.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.min(i * step, length);
      pts.push(a.add(unit.scale(t)));
    }
    // asegurar punto final exacto
    if (!pts[pts.length - 1].equals(b)) pts.push(b.clone());
    return pts;
  }

  private handleMapClick(point: BABYLON.Vector3): void {
    // Si no hay inicio, establecerlo
    if (!this.selectionStart) {
      // limpiar trazados anteriores
      this.clearPath();
      this.clearMarkers();
      this.selectionStart = point.clone();
      this.startMarker = this.createMarker(this.selectionStart, new BABYLON.Color3(0.1, 0.6, 1));
      console.log('Start seleccionada:', this.selectionStart);
      return;
    }

    // Si ya había inicio, tomar como fin y dibujar ruta
    const end = point.clone();
    this.endMarker = this.createMarker(end, new BABYLON.Color3(0.9, 0.2, 0.2));

    const pathPoints = this.sampleLine(this.selectionStart, end, 1);
    this.drawArrowPath(pathPoints);

    // reset selectionStart para la próxima demo
    this.selectionStart = null;
    console.log('Ruta dibujada entre puntos');
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