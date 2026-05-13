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

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private renderLoopFn: (() => void) | null = null;

  constructor(private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
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
  }

  setView(mode: '2d' | '3d'): void {

    if (this.viewMode === mode) return;

    if (mode === '3d') {

      this.viewMode = '3d';

      setTimeout(() => {
        this.init3dScene();
      }, 0);

    } else {

      this.dispose3d();
      this.viewMode = '2d';

    }

  }

  zoomIn(): void {

    if (this.camera) {

      const newRadius = this.camera.radius * 0.85;

      this.camera.radius = Math.max(
        newRadius,
        this.camera.lowerRadiusLimit ?? 1
      );

    }

  }

  zoomOut(): void {

    if (this.camera) {

      const newRadius = this.camera.radius * 1.15;

      this.camera.radius = Math.min(
        newRadius,
        this.camera.upperRadiusLimit ?? 500
      );

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

    canvas.addEventListener(
      'wheel',
      (e) => e.preventDefault(),
      { passive: false }
    );

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);

    this.scene = new BABYLON.Scene(this.engine);

    this.scene.clearColor = new BABYLON.Color4(
      0.1,
      0.1,
      0.1,
      1
    );

    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3,
      20,
      BABYLON.Vector3.Zero(),
      this.scene
    );

    this.camera.attachControl(canvas, true);

    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 300;
    this.camera.panningSensibility = 50;

    const light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );

    light.intensity = 1.2;

    const directionalLight = new BABYLON.PointLight(
      'pointLight',
      new BABYLON.Vector3(5, 10, 5),
      this.scene
    );

    directionalLight.intensity = 0.8;

    this.createGround();

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

    if (this.renderCanvasContainer?.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }

  }

  private async load3dModel(): Promise<void> {

    if (!this.scene) return;

    const modelRoot = '/assets/3d-models/Edificio A/';
    const modelName = 'Edifico A - Piso 1.obj';

    try {

      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        modelRoot,
        modelName,
        this.scene
      );

      const meshes = result.meshes;

      if (meshes.length === 0) {

        console.warn('No se encontraron mallas');

        return;

      }

      const allNodes = new BABYLON.TransformNode(
        'modelRoot',
        this.scene
      );

      allNodes.rotation = new BABYLON.Vector3(
        -Math.PI / 2,
        0,
        0
      );

      meshes.forEach((mesh, index) => {

        mesh.isVisible = true;

        mesh.parent = allNodes;

        if (!mesh.material) {

          const defaultMat = new BABYLON.StandardMaterial(
            `mat_${index}`,
            this.scene!
          );

          defaultMat.diffuseColor = new BABYLON.Color3(
            0.9,
            0.9,
            0.9
          );

          mesh.material = defaultMat;

        }

      });

      this.scene.render();

      const bounds = allNodes.getHierarchyBoundingVectors(true);

      const min = bounds.min;
      const max = bounds.max;

      const size = BABYLON.Vector3.Distance(min, max);

      const targetSize = 25;

      if (size > 0) {

        const scale = targetSize / size;

        allNodes.scaling = new BABYLON.Vector3(
          scale,
          scale,
          scale
        );

        this.scene.render();

        const scaledBounds =
          allNodes.getHierarchyBoundingVectors(true);

        const scaledMin = scaledBounds.min;
        const scaledMax = scaledBounds.max;

        const centerX =
          (scaledMin.x + scaledMax.x) / 2;

        const centerZ =
          (scaledMin.z + scaledMax.z) / 2;

        allNodes.position.x = -centerX;
        allNodes.position.y = -scaledMin.y;
        allNodes.position.z = -centerZ;

      }

      this.scene.render();

      console.log('==========================');
      console.log('OBJETOS DETECTADOS');
      console.log('==========================');

      meshes.forEach((mesh) => {

        const pos = mesh.getBoundingInfo().boundingBox.centerWorld;

        console.log('OBJETO:', mesh.name);

        console.log(
          'X:',
          pos.x.toFixed(2),
          'Y:',
          pos.y.toFixed(2),
          'Z:',
          pos.z.toFixed(2)
        );

      });

      // ==========================
      // CLICK EN OBJETOS
      // ==========================

      this.scene.onPointerDown = (evt, pickResult) => {

        if (pickResult.hit && pickResult.pickedMesh) {

          const mesh = pickResult.pickedMesh;

          const pos =
            mesh.getBoundingInfo().boundingBox.centerWorld;

          console.log('======================');
          console.log('CLICK EN:', mesh.name);

          console.log(
            'X:',
            pos.x.toFixed(2)
          );

          console.log(
            'Y:',
            pos.y.toFixed(2)
          );

          console.log(
            'Z:',
            pos.z.toFixed(2)
          );

          console.log('======================');

        }

      };

    } catch (error) {

      console.error(
        'No se pudo cargar el modelo 3D:',
        error
      );

    }

  }

  private createGround(): void {

    if (!this.scene) return;

    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      {
        width: 100,
        height: 100
      },
      this.scene
    );

    ground.position.y = 0.01;

    const groundMat = new BABYLON.StandardMaterial(
      'groundMat',
      this.scene
    );

    groundMat.diffuseColor = new BABYLON.Color3(
      0.18,
      0.18,
      0.18
    );

    ground.material = groundMat;

  }

}