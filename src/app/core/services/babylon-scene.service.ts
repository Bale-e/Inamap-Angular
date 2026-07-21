import { Injectable, NgZone, OnDestroy } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { dibujarFlechaGuia } from '../../services/guide-arrow.service';

export interface ScreenMarker {
  id: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
  type: 'building-b' | 'building-a' | 'sede';
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class BabylonSceneService implements OnDestroy {
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private modelRoot: BABYLON.TransformNode | null = null;
  private destinationMarker: BABYLON.TransformNode | BABYLON.Mesh | null = null;
  private guideArrowMeshes: BABYLON.AbstractMesh[] = [];

  private currentBuilding: 'A' | 'B' | 'S' = 'A';
  private currentFloorModel = 'Edifico A - Piso 1.obj';

  private onMarkersUpdatedCb?: (markers: ScreenMarker[]) => void;

  constructor(private ngZone: NgZone) {}

  public initScene(
    canvasContainer: HTMLDivElement,
    onMeshClicked?: (meshName: string, pickInfo: BABYLON.PickingInfo) => void,
    onMarkersUpdated?: (markers: ScreenMarker[]) => void
  ): void {
    this.dispose();
    this.onMarkersUpdatedCb = onMarkersUpdated;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.outline = 'none';
    canvasContainer.replaceChildren(canvas);

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.06, 0.08, 0.12, 1);

    this.setupCamera(canvas);
    this.setupLights();
    this.setupSkybox();

    this.scene.onPointerDown = (evt, pickResult) => {
      if (evt.button === 0 && pickResult.hit && pickResult.pickedMesh) {
        console.log('Mesh seleccionado:', pickResult.pickedMesh.name, 'Coordenadas:', pickResult.pickedPoint);
        if (onMeshClicked) {
          onMeshClicked(pickResult.pickedMesh.name, pickResult);
        }
      }
    };

    this.ngZone.runOutsideAngular(() => {
      this.engine?.runRenderLoop(() => {
        this.scene?.render();
        this.updateScreenMarkers();
      });
    });

    const resizeHandler = () => this.engine?.resize();
    window.addEventListener('resize', resizeHandler);
  }

  private setupCamera(canvas: HTMLCanvasElement): void {
    if (!this.scene) return;
    this.camera = new BABYLON.ArcRotateCamera(
      'camera1',
      Math.PI / 4,
      Math.PI / 3,
      25,
      new BABYLON.Vector3(0, 0, 0),
      this.scene
    );
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 120;
    this.camera.attachControl(canvas, true);
  }

  private setupLights(): void {
    if (!this.scene) return;
    const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemiLight.intensity = 0.95;

    const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -2, -1), this.scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.7;
  }

  private setupSkybox(): void {
    if (!this.scene) return;
    const skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, this.scene);
    const skyboxMaterial = new BABYLON.StandardMaterial('skyBoxMat', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.emissiveColor = new BABYLON.Color3(0.06, 0.08, 0.12);
    skybox.material = skyboxMaterial;
  }

  public async loadModel(modelName: string, building: 'A' | 'B' | 'S' | boolean = 'A'): Promise<void> {
    if (!this.scene) return;

    const buildingId: 'A' | 'B' | 'S' = typeof building === 'boolean' ? (building ? 'B' : 'A') : building;
    this.currentFloorModel = modelName;
    this.currentBuilding = buildingId;

    if (this.modelRoot) {
      this.modelRoot.dispose();
      this.modelRoot = null;
    }

    this.clearGuideArrows();
    this.clearDestinationMarker();

    const isSede = buildingId === 'S' || modelName === 'MODELO_INACAP_FIXED.obj';
    const isBuildingB = buildingId === 'B' || modelName.includes('Edificio B');
    
    const rootUrl = isSede
      ? '/assets/3d-models/sede/'
      : isBuildingB
        ? '/assets/3d-models/Edificio B/'
        : '/assets/3d-models/Edificio A/';

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(rootUrl),
        encodeURI(modelName),
        this.scene
      );

      if (result.meshes.length === 0) return;

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      this.modelRoot = allNodes;

      allNodes.rotation = new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

      if (isBuildingB) {
        allNodes.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
      }

      result.meshes.forEach((mesh, index) => {
        mesh.isVisible = true;
        mesh.parent = allNodes;
        mesh.isPickable = true;
        mesh.checkCollisions = true;

        if (!mesh.material) {
          const defaultMat = new BABYLON.StandardMaterial(`defaultMat_${index}`, this.scene!);
          defaultMat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.9);
          mesh.material = defaultMat;
        }
      });

      if (this.camera && this.modelRoot) {
        this.camera.setTarget(this.modelRoot.position.clone());
      }
    } catch (err) {
      console.error(`Error al cargar modelo 3D (${rootUrl}${modelName}):`, err);
    }
  }

  private updateScreenMarkers(): void {
    if (!this.scene || !this.camera || !this.engine || !this.onMarkersUpdatedCb) return;

    const markers: ScreenMarker[] = [];
    const viewMatrix = this.camera.getViewMatrix();
    const projectionMatrix = this.camera.getProjectionMatrix();
    const transformMatrix = viewMatrix.multiply(projectionMatrix);
    const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());

    const projectPoint = (localPos: BABYLON.Vector3): { x: number; y: number; visible: boolean } => {
      let finalWorldPos = localPos;
      if (this.modelRoot) {
        this.modelRoot.computeWorldMatrix(true);
        finalWorldPos = BABYLON.Vector3.TransformCoordinates(localPos, this.modelRoot.getWorldMatrix());
      }
      const screenCoords = BABYLON.Vector3.Project(
        finalWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );
      const isVisible =
        screenCoords.z > 0 &&
        screenCoords.z < 1 &&
        screenCoords.x > 0 &&
        screenCoords.x < this.engine!.getRenderWidth() &&
        screenCoords.y > 0 &&
        screenCoords.y < this.engine!.getRenderHeight();

      return { x: screenCoords.x, y: screenCoords.y, visible: isVisible };
    };

    // Marcador Edificio B (desde Edificio A)
    if (this.currentBuilding === 'A') {
      const pos = new BABYLON.Vector3(11.07, 0.05, 1.13);
      const proj = projectPoint(pos);
      markers.push({
        id: 'marker-building-b',
        label: '→ Ir al Edificio B',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-b'
      });

      if (this.currentFloorModel.includes('Piso 1')) {
        const sedePos = new BABYLON.Vector3(-9.41, 0.01, -4.88);
        const sedeProj = projectPoint(sedePos);
        markers.push({
          id: 'marker-sede',
          label: '→ Ir al mapa principal',
          x: sedeProj.x,
          y: sedeProj.y,
          visible: sedeProj.visible,
          type: 'sede'
        });
      }
    }

    // Marcador Edificio A (desde Edificio B)
    if (this.currentBuilding === 'B') {
      const pos = new BABYLON.Vector3(-0.55, 0.05, 11.23);
      const proj = projectPoint(pos);
      markers.push({
        id: 'marker-building-a',
        label: '← Volver al Edificio A',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-a'
      });
    }

    this.onMarkersUpdatedCb(markers);
  }

  public drawAnimatedRoute(points: BABYLON.Vector3[]): void {
    if (!this.scene || points.length < 2) return;
    this.clearGuideArrows();

    const totalSegments = points.length - 1;
    const color = new BABYLON.Color3(0.95, 0.08, 0.08);

    const drawSegment = (i: number) => {
      if (!this.scene) return;
      const from = points[i];
      const to = points[i + 1];
      const meshes = dibujarFlechaGuia(this.scene, from, to, color);
      if (this.modelRoot) {
        meshes.forEach(m => {
          m.parent = this.modelRoot;
        });
      }
      this.guideArrowMeshes.push(...meshes);

      if (i + 1 < totalSegments) {
        setTimeout(() => drawSegment(i + 1), 400);
      }
    };

    drawSegment(0);
  }

  public clearGuideArrows(): void {
    this.guideArrowMeshes.forEach(mesh => mesh.dispose());
    this.guideArrowMeshes = [];
  }

  public setDestinationMarker(position: BABYLON.Vector3): void {
    if (!this.scene) return;
    this.clearDestinationMarker();

    const marker = new BABYLON.TransformNode('destinationMarker', this.scene);
    marker.position = new BABYLON.Vector3(position.x, Math.max(position.y, 0.05), position.z);
    if (this.modelRoot) {
      marker.parent = this.modelRoot;
    }

    const material = new BABYLON.StandardMaterial('destMat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0.95, 0.05, 0.05);
    material.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);

    const sphere = BABYLON.MeshBuilder.CreateSphere('destSphere', { diameter: 0.6 }, this.scene);
    sphere.position.y = 1.2;
    sphere.material = material;
    sphere.parent = marker;

    const cone = BABYLON.MeshBuilder.CreateCylinder('destCone', {
      height: 0.9,
      diameterTop: 0.6,
      diameterBottom: 0
    }, this.scene);
    cone.position.y = 0.45;
    cone.material = material;
    cone.parent = marker;

    this.destinationMarker = marker;
  }

  public clearDestinationMarker(): void {
    if (this.destinationMarker) {
      this.destinationMarker.dispose();
      this.destinationMarker = null;
    }
  }

  public zoomIn(): void {
    if (!this.camera) return;
    this.camera.radius = Math.max(4, this.camera.radius - 3);
  }

  public zoomOut(): void {
    if (!this.camera) return;
    this.camera.radius = Math.min(80, this.camera.radius + 3);
  }

  public resetCamera(): void {
    if (!this.camera) return;
    this.camera.target = new BABYLON.Vector3(0, 0, 0);
    this.camera.alpha = Math.PI / 4;
    this.camera.beta = Math.PI / 3;
    this.camera.radius = 25;
  }

  public dispose(): void {
    if (this.engine) {
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
    }
    this.scene = null;
    this.camera = null;
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
