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
  currentFloor = 'Edifico A - Piso 1.obj';

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private renderLoopFn: (() => void) | null = null;
  private bannerControlsAttached = false;
  private infoBox: HTMLDivElement | null = null;

  // ── Información de cada cuerpo ──────────────────────────
  // IMPORTANTE: los keys deben coincidir con mesh.name del OBJ
  // Abre la consola del navegador en modo 3D para ver los nombres reales
  private infoData: { [key: string]: { nombre: string, desc: string } } = {
    'Cuerpo3':  { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' },
    'Cuerpo14': { nombre: 'Sala de Tutorías 1',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo21': { nombre: 'Sala de Tutorías 2',          desc: 'Espacio de apoyo académico con tutores disponibles.' }
  };

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
    this.attachBannerControls();
    this.createInfoBox();
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

      // ── Hover — mostrar info al pasar el cursor ───────────
      canvas.addEventListener('mousemove', (evt) => {
        if (!this.scene || !this.infoBox) return;

        const pickResult = this.scene.pick(evt.clientX, evt.clientY);

        if (pickResult?.hit && pickResult.pickedMesh) {
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
        } else {
          this.infoBox.style.display = 'none';
        }
      });

      canvas.addEventListener('mouseleave', () => {
        if (this.infoBox) this.infoBox.style.display = 'none';
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

  toggleMarker(id: string): void {
    const card = document.getElementById(id);
    if (card) {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
  }
}