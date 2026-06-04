/*
  Componente del visor 3D (Map3dContainerComponent).
  Descripción: inicializa la escena BabylonJS, carga modelos OBJ, gestiona interacción (clics, zoom,
  búsqueda de rutas) y dibuja guías/flechas basadas en datos de navegación.
*/
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
    'Cuerpo29': { nombre: 'Sala de Tutorías 1',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo13': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' }
  };

  // ── Cuerpos que abren el diálogo de selección de piso ────
  private floorSelectionBodies = ['Cuerpo23', 'Cuerpo14', 'Cuerpo19', 'Cuerpo25', 'Cuerpo30', 'Cuerpo28', 'Cuerpo8'];

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

  // ── Crea la flecha para ir a selección de piso ───────────────────
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
    this.floorArrow.innerHTML = '→ Ir al piso';
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
      const floorLabel = this.currentFloor === this.secondFloorModel ? '2'
        : this.currentFloor === this.thirdFloorModel ? '3'
        : '1';
      console.log(`Navegando a Edificio B - Piso ${floorLabel}`);
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
      return 'Ir al primer piso';
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

    // Permitir movimiento horizontal en X solo cuando se haya hecho zoom suficiente (>=30%)
    const fixedCameraY = 0;
    const maxPanX = 5;
    const minPanX = -5;
    const orthoMin = 4; // tamaño ortho más cercano (zoom máximo)
    const orthoMax = 18; // tamaño ortho más lejano (zoom mínimo)

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

      // Dibujar un ejemplo de NavPath para pruebas usando datos reales + inventados
      try {
        const example = this.createExampleNavPathForEdificioAFirstFloor();
        // start desde 'B' (pasillo central que conecta con Edificio B) y target 'Elevator'
        this.drawFromNavPath(example, 'B', 'Elevator');
      } catch (e) {
        console.warn('No se pudo generar el NavPath de ejemplo:', e);
      }



      // ── Click — detectar clic en cuerpo o suelo y imprimir coordenadas ──
      canvas.addEventListener('click', (evt) => {
        if (!this.scene) return;

        const pickResult = this.scene.pick(evt.clientX, evt.clientY);

        if (pickResult?.hit) {
          const target = pickResult.pickedMesh ? pickResult.pickedMesh.name : 'suelo';
          const coords = pickResult.pickedPoint;
          console.log(`Clic en: ${target}, Coordenadas: (${coords?.x.toFixed(2)}, ${coords?.y.toFixed(2)}, ${coords?.z.toFixed(2)})`);

          // ── Abrir diálogo de selección de piso si es uno de los cuerpos especificados ──
          const shouldOpenFloorDialog = pickResult.pickedMesh && this.floorSelectionBodies.includes(pickResult.pickedMesh.name) &&
            !(this.currentFloor === this.secondFloorModel &&
              (pickResult.pickedMesh.name === 'Cuerpo14' || pickResult.pickedMesh.name === 'Cuerpo19'));

          if (shouldOpenFloorDialog) {
            this.openFloorDialog();
          }

          const hideFloor2Tags = pickResult.pickedMesh?.name &&
            this.currentFloor === this.secondFloorModel &&
            (pickResult.pickedMesh.name === 'Cuerpo29' || pickResult.pickedMesh.name === 'Cuerpo13');

          if (hideFloor2Tags) {
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else if (pickResult.pickedMesh && this.infoBox) {
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

  /** Construye un objeto navPath de ejemplo para el primer piso del Edificio A. */
  private createExampleNavPathForEdificioAFirstFloor(): any {
    // Coordenadas aproximadas (x, y, z) en el espacio de la escena — mezclamos puntos reales conocidos
    // con puntos inventados para probar el sistema.
    return {
      building: 'Edificio A',
      floor: 'first',
      accesses: {
        // Punto B: acceso al pasillo central hacia Edificio B
        'B': [[-11.51, 0.01, -1.63]],
        // Salidas a la izquierda/derecha del pasillo central
        'C': [[-13.0, 0.01, -0.5]],
        'D': [[-10.0, 0.01, -0.5]],
        // Entrada principal al edificio A (conecta al mapa principal)
        'MainEntrance': [[-5.0, 0.01, 2.0]]
      },
      // Puntos donde el pasillo principal dobla (se usan para trazar la guía)
      turns: [
        [-11.51, 0.01, -1.63], // inicio pasillo (B)
        [-11.51, 0.01, -3.0],  // tramo hacia el final (frente al ascensor)
        [-11.51, 0.01, -5.0]
      ],
      // Puntos de interés (salas, baños, ascensor, escaleras)
      pois: {
        'Elevator': [-11.51, 0.01, -5.5],
        'BathroomWomen': [-10.5, 0.01, -2.8],
        'Room101': [-12.2, 0.01, -1.2]
      }
    };
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

  // ── Nuevas utilidades para dibujar rutas a partir de documentos "navigation paths" ──
  private coordToVec3(coord: number[] | undefined): BABYLON.Vector3 | null {
    if (!coord || coord.length < 3) return null;
    return new BABYLON.Vector3(coord[0], coord[1], coord[2]);
  }

  private distancePointToSegment(p: BABYLON.Vector3, a: BABYLON.Vector3, b: BABYLON.Vector3): number {
    const ab = b.subtract(a);
    const ap = p.subtract(a);
    const abLen2 = ab.lengthSquared();
    if (abLen2 === 0) return ap.length();
    const t = Math.max(0, Math.min(1, BABYLON.Vector3.Dot(ap, ab) / abLen2));
    const proj = a.add(ab.scale(t));
    return p.subtract(proj).length();
  }

  /**
   * Dibuja una ruta basada en la estructura de un documento "navPath".
   * navPath: { building, floor, accesses: {name:[[x,y,z],...]}, turns:[[x,y,z],...], pois: {name:[x,y,z]} }
   * startAccessName: clave dentro de accesses para punto de inicio (opcional)
   * targetPoiName: clave dentro de pois que indica destino final (opcional)
   */
  public drawFromNavPath(navPath: any, startAccessName?: string, targetPoiName?: string): void {
    if (!this.scene || !navPath) return;

    const accesses = navPath.accesses || {};
    const turns = Array.isArray(navPath.turns) ? navPath.turns : [];
    const pois = navPath.pois || {};

    // Convertir turns a Vector3
    const turnVecs: BABYLON.Vector3[] = turns.map((c: number[]) => this.coordToVec3(c)).filter(Boolean) as BABYLON.Vector3[];

    // Obtener coords de accesses: elegir la primera coordenada disponible por acceso
    const accessEntries: { name: string; coord: BABYLON.Vector3 }[] = Object.keys(accesses).map(k => {
      const arr = Array.isArray(accesses[k]) ? accesses[k] : [];
      const coord = this.coordToVec3(arr[0]);
      return { name: k, coord };
    }).filter(x => x.coord) as { name: string; coord: BABYLON.Vector3 }[];

    // Determinar punto de inicio
    let startPoint: BABYLON.Vector3 | null = null;
    if (startAccessName && accesses[startAccessName] && accesses[startAccessName].length > 0) {
      startPoint = this.coordToVec3(accesses[startAccessName][0]);
    } else if (accessEntries.length > 0) {
      startPoint = accessEntries[0].coord.clone();
    }

    // Determinar target POI
    let targetPoi: BABYLON.Vector3 | null = null;
    if (targetPoiName && pois[targetPoiName]) {
      targetPoi = this.coordToVec3(pois[targetPoiName]);
    }

    // Construir polyline: start -> turns -> nearest access to target (si existe) o el resto de accesses
    const path: BABYLON.Vector3[] = [];
    if (startPoint) path.push(startPoint.clone());
    // agregar turns
    for (const t of turnVecs) path.push(t.clone());

    // Si hay targetPoi, elegir el access más cercano a targetPoi como posible final
    if (targetPoi && accessEntries.length > 0) {
      let best = accessEntries[0];
      let bestDist = this.distancePointToSegment(targetPoi, accessEntries[0].coord, accessEntries[0].coord);
      for (const a of accessEntries) {
        const d = targetPoi.subtract(a.coord).length();
        if (d < bestDist) { best = a; bestDist = d; }
      }
      path.push(best.coord.clone());
    } else {
      // si no hay target, agregar los demás accesses en orden
      for (const a of accessEntries) {
        // evitar duplicar el inicio
        if (!startPoint || !a.coord.equals(startPoint)) path.push(a.coord.clone());
      }
    }

    // Ahora recorrer segmentos y, si encontramos que el targetPoi está suficientemente cerca de algún segmento,
    // desviar hacia ese POI y terminar la ruta allí.
    if (targetPoi) {
      const finalPath: BABYLON.Vector3[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        finalPath.push(a.clone());
        const dist = this.distancePointToSegment(targetPoi, a, b);
        const THRESH = 1.2; // umbral de intersección en unidades del mundo
        if (dist <= THRESH) {
          // insertar proyección aproximada como punto de giro hacia el POI
          // calcular proyección t
          const ab = b.subtract(a);
          const ap = targetPoi.subtract(a);
          const t = Math.max(0, Math.min(1, BABYLON.Vector3.Dot(ap, ab) / Math.max(ab.lengthSquared(), 1e-6)));
          const proj = a.add(ab.scale(t));
          finalPath.push(proj);
          finalPath.push(targetPoi.clone());
          // terminar ruta
          this.drawArrowPath(finalPath);
          return;
        }
      }
      // si no se desvió hacia POI, añadir último punto y dibujar todo
      finalPath.push(path[path.length - 1].clone());
      this.drawArrowPath(finalPath);
      return;
    }

    // Si no hay POI objetivo, dibujar la polyline tal cual
    this.drawArrowPath(path);
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

    const isVisibleFloor = this.currentFloor === this.firstFloorModel || this.currentFloor === this.secondFloorModel;
    if (!isVisibleFloor || this.viewMode !== '3d') {
      this.buildingBMarker.style.display = 'none';
      return;
    }

    const floorLabel = this.currentFloor === this.secondFloorModel ? '2' : '1';
    this.buildingBMarker.innerHTML = `→ Ir al Edificio B - Piso ${floorLabel}`;

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