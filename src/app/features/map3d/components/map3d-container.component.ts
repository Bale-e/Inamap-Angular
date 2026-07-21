/*
  Componente principal contenedor del visor 3D (Map3dContainerComponent).
  Orquesta renderizado 3D, navegación, búsqueda y marcadores proyectados en pantalla.
*/
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { BabylonSceneService, ScreenMarker } from '../../../core/services/babylon-scene.service';
import { MapNavigationService } from '../../../core/services/map-navigation.service';
import { BuildingId, SelectedLocationInfo } from '../../../core/models/navigation.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas', { static: false })
  renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '3d';
  currentBuilding: BuildingId = 'A';
  currentFloorModel = 'Edifico A - Piso 1.obj';

  destinations: string[] = [];
  selectedDestination: string | null = null;
  destinationCoordinatesText = '';
  selectedLocationInfo: SelectedLocationInfo | null = null;
  isDetailPanelOpen = false;

  screenMarkers: ScreenMarker[] = [];

  private subscriptions = new Subscription();

  private readonly firstFloorModel = 'Edifico A - Piso 1.obj';
  private readonly secondFloorModel = 'Edificio A - piso 2.obj';
  private readonly thirdFloorModel = 'Edificio A - piso 3.obj';

  private readonly buildingBFirstFloorModel = 'Edificio B - Piso 1.obj';
  private readonly buildingBSecondFloorModel = 'Edificio B - Piso 2.obj';
  private readonly buildingBThirdFloorModel = 'Edificio B - Piso 3.obj';

  private readonly sedeModel = 'MODELO_INACAP_FIXED.obj';

  constructor(
    private babylonSceneService: BabylonSceneService,
    private mapNavService: MapNavigationService,
    private cd: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    if (this.renderCanvasContainer?.nativeElement) {
      this.babylonSceneService.initScene(
        this.renderCanvasContainer.nativeElement,
        (meshName) => this.onMeshPicked(meshName),
        (markers) => this.onMarkersUpdated(markers)
      );
    }

    this.subscriptions.add(
      this.mapNavService.currentBuilding$.subscribe(building => {
        this.currentBuilding = building;
        this.cd.detectChanges();
      })
    );

    this.subscriptions.add(
      this.mapNavService.currentFloor$.subscribe(floorModel => {
        this.currentFloorModel = floorModel;
        this.babylonSceneService.loadModel(floorModel, this.currentBuilding);
        this.cd.detectChanges();
      })
    );

    this.subscriptions.add(
      this.mapNavService.destinations$.subscribe(dests => {
        this.destinations = dests;
        this.cd.detectChanges();
      })
    );

    this.mapNavService.loadDestinations();
  }

  onMarkersUpdated(markers: ScreenMarker[]): void {
    this.screenMarkers = markers;
    this.cd.detectChanges();
  }

  onMarkerClicked(marker: ScreenMarker): void {
    if (marker.type === 'building-b') {
      this.onBuildingSelected('B');
    } else if (marker.type === 'building-a') {
      this.onBuildingSelected('A');
    } else if (marker.type === 'sede') {
      this.onBuildingSelected('S');
    }
  }

  async onMeshPicked(meshName: string): Promise<void> {
    const info = await this.mapNavService.getLocationInfoByMeshNameAsync(meshName);
    if (info) {
      this.selectedLocationInfo = info;
      this.isDetailPanelOpen = true;
      this.cd.detectChanges();
    }
  }

  private switchFloorByPisoName(pisoStr: string, edificio?: BuildingId): void {
    const targetBuilding = edificio || this.currentBuilding;
    if (targetBuilding !== this.currentBuilding) {
      this.onBuildingSelected(targetBuilding);
    }

    const pisoLower = pisoStr.toLowerCase().replace(/\s+/g, '');
    if (pisoLower.includes('2') || pisoLower.includes('piso2')) {
      this.onFloorSelected('second');
    } else if (pisoLower.includes('3') || pisoLower.includes('piso3')) {
      this.onFloorSelected('third');
    } else if (pisoLower.includes('1') || pisoLower.includes('piso1')) {
      this.onFloorSelected('first');
    }
  }

  async onDestinationSelected(destinationName: string): Promise<void> {
    this.selectedDestination = destinationName;
    const result = await this.mapNavService.calculateRoute(destinationName);
    if (result) {
      if (result.piso) {
        this.switchFloorByPisoName(result.piso, result.edificio);
      }
      this.destinationCoordinatesText = result.statusText;
      this.babylonSceneService.setDestinationMarker(result.coord);
      this.babylonSceneService.drawAnimatedRoute(result.routePoints);
    } else {
      this.destinationCoordinatesText = `No se encontró la locación '${destinationName}'.`;
    }
    this.cd.detectChanges();
  }

  onSearchCleared(): void {
    this.selectedDestination = null;
    this.destinationCoordinatesText = '';
    this.babylonSceneService.clearGuideArrows();
    this.babylonSceneService.clearDestinationMarker();
  }

  onFloorSelected(floorKey: string): void {
    if (this.currentBuilding === 'B') {
      if (floorKey === 'first') this.mapNavService.setFloor(this.buildingBFirstFloorModel);
      else if (floorKey === 'second') this.mapNavService.setFloor(this.buildingBSecondFloorModel);
      else if (floorKey === 'third') this.mapNavService.setFloor(this.buildingBThirdFloorModel);
    } else {
      if (floorKey === 'first') this.mapNavService.setFloor(this.firstFloorModel);
      else if (floorKey === 'second') this.mapNavService.setFloor(this.secondFloorModel);
      else if (floorKey === 'third') this.mapNavService.setFloor(this.thirdFloorModel);
    }
  }

  onBuildingSelected(building: BuildingId): void {
    this.mapNavService.setBuilding(building);
    if (building === 'A') this.mapNavService.setFloor(this.firstFloorModel);
    else if (building === 'B') this.mapNavService.setFloor(this.buildingBFirstFloorModel);
    else if (building === 'S') this.mapNavService.setFloor(this.sedeModel);
  }

  onZoomIn(): void {
    this.babylonSceneService.zoomIn();
  }

  onZoomOut(): void {
    this.babylonSceneService.zoomOut();
  }

  onResetCamera(): void {
    this.babylonSceneService.resetCamera();
  }

  closeDetailPanel(): void {
    this.isDetailPanelOpen = false;
    this.selectedLocationInfo = null;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.babylonSceneService.dispose();
  }
}