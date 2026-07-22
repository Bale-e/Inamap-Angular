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

      allNodes.rotation = isSede
        ? new BABYLON.Vector3(0, -Math.PI / 2, 0)
        : new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

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

    // Proyecta un punto local, ajustando su Y al suelo real mediante raycast hacia abajo
    const projectPointOnGround = (
      localX: number,
      localZ: number,
      heightOffset = 0.05
    ): { x: number; y: number; visible: boolean } => {
      const localPos = new BABYLON.Vector3(localX, 0, localZ);

      const worldPos = this.modelRoot
        ? BABYLON.Vector3.TransformCoordinates(localPos, this.modelRoot.getWorldMatrix())
        : localPos;

      let groundY = worldPos.y;
      try {
        const rayOrigin = new BABYLON.Vector3(worldPos.x, 50, worldPos.z);
        const ray = new BABYLON.Ray(rayOrigin, BABYLON.Vector3.Down(), 200);
        const pickInfo = this.scene ? this.scene.pickWithRay(ray) : null;
        if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
          groundY = pickInfo.pickedPoint.y;
        }
      } catch (e) {
        // si falla el raycast, mantener worldPos.y como fallback
      }

      const adjustedWorldPos = new BABYLON.Vector3(worldPos.x, groundY + heightOffset, worldPos.z);

      const screenCoords = BABYLON.Vector3.Project(
        adjustedWorldPos,
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
      const proj = projectPointOnGround(11.07, 1.13);
      markers.push({
        id: 'marker-building-b',
        label: '→ Ir al Edificio B',
        x: proj.x,
        y: proj.y,
        visible: proj.visible,
        type: 'building-b'
      });

      if (this.currentFloorModel.includes('Piso 1')) {
        // Usar X/Z de Cuerpo45 como referencia, apoyada en el suelo real
        const proj2 = projectPointOnGround(0.9066183246636239, 6.24408551363563);
        markers.push({
          id: 'marker-sede',
          label: '→ Ir al mapa principal',
          x: proj2.x,
          y: proj2.y,
          visible: proj2.visible,
          type: 'sede'
        });
      }
    }

    // Marcador Edificio A (desde Edificio B)
    if (this.currentBuilding === 'B') {
      const proj = projectPointOnGround(-0.55, 11.23);
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

    const color = new BABYLON.Color3(0.95, 0.08, 0.08);

    // El último punto es la posición 3D real del destino en espacio mundo (ej: x=33.35, z=0.50 para A204)
    const destWorld = points[points.length - 1].clone();

    // En Edificio A (Piso 2 y Piso 3), el pasillo central está en Z = 6.05
    // Las salas superiores están en Z ~ 0.50 y las inferiores en Z ~ 11.60
    // La entrada/escaleras está en X = 11.60
    const startX = 11.60;
    const corridorZ = 6.05;
    const heightY = destWorld.y || 1.00;

    const startPoint = new BABYLON.Vector3(startX, heightY, corridorZ);
    const corridorWaypoint = new BABYLON.Vector3(destWorld.x, heightY, corridorZ);
    const finalDestPoint = destWorld;

    // Crear la ruta de 3 puntos: Inicio Pasillo -> Waypoint Pasillo Frente a la Sala -> Entrada Sala
    const worldPoints: BABYLON.Vector3[] = [
      startPoint,
      corridorWaypoint,
      finalDestPoint
    ];

    const totalSegments = worldPoints.length - 1;

    const drawSegment = (i: number) => {
      if (!this.scene) return;
      const worldFrom = worldPoints[i];
      const worldTo = worldPoints[i + 1];

      const meshes = dibujarFlechaGuia(this.scene, worldFrom, worldTo, color);
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
    // position ya viene en coordenadas mundo (world space) reales del 3D viewport.
    // Se asigna directamente sin emparentar a modelRoot para evitar rotaciones duplicadas.
    marker.position = new BABYLON.Vector3(position.x, Math.max(position.y, 0.05), position.z);

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

  public focusOnMesh(meshName: string, targetRadius = 6, durationMs = 700): void {
    if (!this.camera || !this.scene) return;

    const targetMesh = this.scene.getMeshByName(meshName);
    if (!targetMesh) return;

    targetMesh.computeWorldMatrix(true);
    targetMesh.refreshBoundingInfo({});
    const boundingInfo = targetMesh.getBoundingInfo();
    const targetPosition = boundingInfo.boundingBox.centerWorld.clone();

    const startTarget = this.camera.target.clone();
    const startRadius = this.camera.radius;
    const startTime = performance.now();

    const animateStep = () => {
      if (!this.camera) return;
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out

      const newTarget = BABYLON.Vector3.Lerp(startTarget, targetPosition, eased);
      this.camera.target = newTarget;
      this.camera.radius = startRadius + (targetRadius - startRadius) * eased;
    };

    requestAnimationFrame(animateStep);
  }

  public getMeshWorldPosition(locName: string, cuerpoId?: string): BABYLON.Vector3 | null {
    if (!this.scene) return null;

    const findMeshCI = (name: string): BABYLON.AbstractMesh | null => {
      if (!name || !this.scene) return null;
      let mesh = this.scene.getMeshByName(name);
      if (mesh) return mesh;
      const lower = name.toLowerCase();
      const norm = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      return this.scene.meshes.find(m => {
        const mName = (m.name || '').toLowerCase();
        const mNorm = mName.replace(/[^a-z0-9]/gi, '');
        return mName === lower || mNorm === norm;
      }) ?? null;
    };

    // 1. Buscar por cuerpoId explícito (ej. cuerpo15 o Cuerpo15)
    let targetMesh = cuerpoId ? findMeshCI(cuerpoId) : null;

    // 2. Si no se encontró por cuerpoId, buscar por locName
    if (!targetMesh && locName) {
      targetMesh = findMeshCI(locName);

      // 3. Fallbacks para nombres clave como 'ConectorEdificioB', 'Escaleras', 'Acceso'
      if (!targetMesh) {
        const normLoc = locName.toLowerCase();
        if (normLoc.includes('conector') || normLoc.includes('acceso') || normLoc.includes('escalera') || normLoc.includes('main')) {
          targetMesh = findMeshCI('cuerpo3') || findMeshCI('cuerpo1') || findMeshCI('cuerpo13');
        }
      }
    }

    if (!targetMesh) return null;

    targetMesh.computeWorldMatrix(true);
    targetMesh.refreshBoundingInfo({});
    return targetMesh.getBoundingInfo().boundingBox.centerWorld.clone();
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
