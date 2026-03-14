import { Component, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import * as BABYLON from 'babylonjs';
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
  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;

  constructor(private el: ElementRef<HTMLElement>, private http: HttpClient) {}

  ngAfterViewInit(): void {
    this.createScene();
    this.loadPathAndRender();
    this.engine?.runRenderLoop(() => this.scene?.render());
  }

  ngOnDestroy(): void {
    this.engine?.dispose();
  }

  private createScene(): void {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.el.nativeElement.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    const camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2, Math.PI / 3, 12, new BABYLON.Vector3(0, 0, 0), this.scene);
    camera.attachControl(canvas, true);

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.8;

    this.createGround();
    this.createDefaultMarkers();
  }

  private async loadPathAndRender(): Promise<void> {
    try {
      const pathData = await this.http.get<PathData>('/assets/mock-data/path.json').toPromise();
      this.updateMarkers(pathData.startPoint, pathData.endPoint);
    } catch {
      this.createDefaultMarkers();
    }
  }

  private updateMarkers(start: {x: number; y: number; z: number}, end: {x: number; y: number; z: number}): void {
    if (!this.scene) return;
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
