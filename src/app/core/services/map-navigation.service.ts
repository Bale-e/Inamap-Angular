import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as BABYLON from 'babylonjs';
import { Firebase } from '../../services/firebase';
import { BuildingId, SelectedLocationInfo } from '../models/navigation.model';

@Injectable({
  providedIn: 'root'
})
export class MapNavigationService {
  private currentBuildingSubject = new BehaviorSubject<BuildingId>('A');
  public currentBuilding$ = this.currentBuildingSubject.asObservable();

  private currentFloorSubject = new BehaviorSubject<string>('Edifico A - Piso 1.obj');
  public currentFloor$ = this.currentFloorSubject.asObservable();

  private selectedLocationSubject = new BehaviorSubject<SelectedLocationInfo | null>(null);
  public selectedLocation$ = this.selectedLocationSubject.asObservable();

  private destinationsSubject = new BehaviorSubject<string[]>([]);
  public destinations$ = this.destinationsSubject.asObservable();

  private readonly mainEntranceAccess = new BABYLON.Vector3(11.22, 0.01, 0.12);

  private readonly infoDataMap: Record<string, SelectedLocationInfo> = {
    'Cuerpo13': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' },
    'Cuerpo29': { nombre: 'Sala de Tutorías 1', desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo30': { nombre: 'Sala de Tutorías 2', desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo28': { nombre: 'Sala de Tutorías 3', desc: 'Espacio adicional de tutorías con capacidad para grupos pequeños.' },
    'Cuerpo27': { nombre: 'Sala de Tutorías 4', desc: 'Sala de apoyo académico y reuniones estudiantiles.' },
    'Cuerpo20': { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' },
    'cuerpo20': { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' }
  };

  private getFloorSpecificInfo(meshName: string): SelectedLocationInfo | null {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
    const floorText = this.currentFloorSubject.value.toLowerCase();
    const isSecondFloor = floorText.includes('piso2') || floorText.includes('2');
    const isThirdFloor = floorText.includes('piso3') || floorText.includes('3');

    const overrides: Record<string, { firstFloor?: SelectedLocationInfo; secondFloor?: SelectedLocationInfo; thirdFloor?: SelectedLocationInfo }> = {
      cuerpo20: {
        firstFloor: { nombre: 'Sala A106', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A202', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A309', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo3: {
        firstFloor: { nombre: 'Sala A101', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A216', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A311', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo1: {
        secondFloor: { nombre: 'Sala A218', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A308', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo13: {
        secondFloor: { nombre: 'Sala 203', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Baño de Dama', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo10: { thirdFloor: { nombre: 'Sala A302', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo11: {
        secondFloor: { nombre: 'Sala A213', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A306', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo12: {
        secondFloor: { nombre: 'Sala A207', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A310', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo7: {
        secondFloor: { nombre: 'Sala A209', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A318', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo21: { thirdFloor: { nombre: 'Sala A301', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo23: { thirdFloor: { nombre: 'Sala A312', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo55: {
        secondFloor: { nombre: 'Sala A208', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A314', desc: 'Espacio académico del Edificio A, piso 3.' }
      },
      cuerpo19: { secondFloor: { nombre: 'Sala A205', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo18: { secondFloor: { nombre: 'Sala A215', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo2: { thirdFloor: { nombre: 'Baño de Varones', desc: 'Espacio académico del Edificio A, piso 3.' } },
      cuerpo15: { secondFloor: { nombre: 'Sala A204', desc: 'Espacio académico del Edificio A, piso 2.' } },
      cuerpo17: {
        firstFloor: { nombre: 'Sala A113', desc: 'Espacio académico del Edificio A, piso 1.' },
        secondFloor: { nombre: 'Sala A206', desc: 'Espacio académico del Edificio A, piso 2.' }
      },
      cuerpo9: {
        secondFloor: { nombre: 'Sala A2010', desc: 'Espacio académico del Edificio A, piso 2.' },
        thirdFloor: { nombre: 'Sala A311', desc: 'Espacio académico del Edificio A, piso 3.' }
      }
    };

    const override = overrides[normalizedMeshName];
    if (!override) {
      return null;
    }

    if (isThirdFloor) {
      return override.thirdFloor ?? null;
    }
    return isSecondFloor ? override.secondFloor ?? null : override.firstFloor ?? null;
  }

  constructor(private firebaseService: Firebase) {}

  public setBuilding(building: BuildingId): void {
    this.currentBuildingSubject.next(building);
  }

  public setFloor(floorModel: string): void {
    this.currentFloorSubject.next(floorModel);
  }

  public setSelectedLocation(location: SelectedLocationInfo | null): void {
    this.selectedLocationSubject.next(location);
  }

  private cachedLocations: any[] = [];

  public async getLocationInfoByMeshNameAsync(meshName: string): Promise<SelectedLocationInfo | null> {
    const normalizedMeshName = (meshName || '').replace(/\s+/g, '');
    const floorSpecificInfo = this.getFloorSpecificInfo(meshName);
    const infoDataEntry = floorSpecificInfo || this.infoDataMap[meshName] || this.infoDataMap[normalizedMeshName] || this.infoDataMap[normalizedMeshName.toLowerCase()];
    if (infoDataEntry) {
      return infoDataEntry;
    }
    const cleanName = meshName.replace(/\s+/g, '');
    const match = cleanName.match(/^cuerpo(\d+)/i);
    if (match) {
      const cuerpoNum = parseInt(match[1], 10);
      try {
        if (this.cachedLocations.length === 0) {
          this.cachedLocations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
        }
        const currentBld = this.currentBuildingSubject.value;
        const currentFloor = this.currentFloorSubject.value.toLowerCase();

        const found = this.cachedLocations.find((loc: any) => {
          const locCuerpo = loc.Cuerpo ?? loc.cuerpo;
          if (locCuerpo === cuerpoNum || parseInt(locCuerpo, 10) === cuerpoNum) {
            const locBuilding = (loc._edificioId || loc.Edificio || loc.edificio || '').toString().toLowerCase();
            const locFloor = (loc.Piso || loc.piso || '').toString().toLowerCase().replace(/\s+/g, '');
            const matchBuilding = locBuilding.includes(currentBld.toLowerCase()) || locBuilding === currentBld.toLowerCase();
            const matchFloor = currentFloor.replace(/\s+/g, '').includes(locFloor) || locFloor.includes(currentFloor.replace(/\s+/g, ''));
            return matchBuilding && matchFloor;
          }
          return false;
        });

        if (found) {
          const name = found.Nombre || found.nombre || `Cuerpo ${cuerpoNum}`;
          const tipo = found.Tipo || found.tipo || 'Espacio académico';
          const floorStr = found.Piso || found.piso || 'Piso 1';
          return {
            nombre: name,
            desc: `${tipo} — Ubicado en Edificio ${currentBld}, ${floorStr}.`,
            edificio: currentBld,
            piso: floorStr
          };
        }
      } catch (err) {
        console.warn('Error al buscar info por meshName:', err);
      }

      return {
        nombre: `Cuerpo ${match[1]}`,
        desc: `Espacio de la sede Inacap. Información e indicaciones disponibles para Cuerpo ${match[1]}.`,
        edificio: this.currentBuildingSubject.value,
        piso: this.currentFloorSubject.value
      };
    }
    return null;
  }

  public getLocationInfoByMeshName(meshName: string): SelectedLocationInfo | null {
    const floorSpecificInfo = this.getFloorSpecificInfo(meshName);
    if (floorSpecificInfo) {
      return floorSpecificInfo;
    }
    if (this.infoDataMap[meshName]) {
      return this.infoDataMap[meshName];
    }
    const cleanName = meshName.replace(/\s+/g, '');
    if (/^cuerpo/i.test(cleanName)) {
      const match = cleanName.match(/^cuerpo(\d+)/i);
      const title = match ? `Cuerpo ${match[1]}` : meshName;
      return {
        nombre: title,
        desc: `Espacio de la sede Inacap. Información e indicaciones disponibles para ${title}.`,
        edificio: this.currentBuildingSubject.value,
        piso: this.currentFloorSubject.value
      };
    }
    return null;
  }

  public async loadDestinations(): Promise<string[]> {
    try {
      const locaciones = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      this.cachedLocations = locaciones;
      const names = locaciones
        .map((loc: any) => loc.Nombre || loc.nombre)
        .filter((name: string) => typeof name === 'string' && name.trim() !== '');

      const uniqueNames = Array.from(new Set(names));
      this.destinationsSubject.next(uniqueNames as string[]);
      return uniqueNames as string[];
    } catch (error) {
      console.error('Error al cargar destinos:', error);
      return [];
    }
  }

  public async findLocationByName(destinationName: string): Promise<any | null> {
    try {
      if (this.cachedLocations.length === 0) {
        this.cachedLocations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      }
      const target = this.cachedLocations.find((loc: any) => {
        const name = (loc.Nombre || loc.nombre || '').trim().toLowerCase();
        return name === destinationName.trim().toLowerCase();
      });
      return target || null;
    } catch (err) {
      console.error('Error buscando locación:', err);
      return null;
    }
  }

  public extractVec3(obj: any): BABYLON.Vector3 | null {
    if (!obj || typeof obj !== 'object') return null;
    const nested =
      obj['Coordenadas3D'] ?? obj['Coordenadas 3D'] ??
      obj['Coordenadas'] ?? obj['coordenadas'] ??
      obj['coordinates'] ?? obj['coords'] ?? null;
    const src = nested ?? obj;

    const getField = (o: any, f: string) => {
      const k = Object.keys(o || {}).find(key => key.toLowerCase() === f.toLowerCase());
      return k ? parseFloat(o[k]) : null;
    };

    const x = getField(src, 'x');
    const y = getField(src, 'y');
    const z = getField(src, 'z');

    if (x != null && !isNaN(x) && y != null && !isNaN(y) && z != null && !isNaN(z)) {
      return new BABYLON.Vector3(x, y, z);
    }
    return null;
  }

  private parseNavPath(navPath: any): { accesos: BABYLON.Vector3[]; giros: BABYLON.Vector3[] } {
    const accesos: BABYLON.Vector3[] = [];
    const giros: BABYLON.Vector3[] = [];

    if (!navPath || typeof navPath !== 'object') return { accesos, giros };

    if (navPath.Accesos && typeof navPath.Accesos === 'object') {
      const items = Array.isArray(navPath.Accesos) ? navPath.Accesos : Object.values(navPath.Accesos);
      for (const item of items) {
        const v = this.extractVec3(item as any);
        if (v) accesos.push(v);
      }
    }

    const turnsList = navPath.Giros ?? navPath.turns ?? navPath.Turns;
    if (Array.isArray(turnsList)) {
      for (const turn of turnsList) {
        const v = this.extractVec3(turn);
        if (v) giros.push(v);
      }
    }
    return { accesos, giros };
  }

  private distSq(a: BABYLON.Vector3, b: BABYLON.Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return dx * dx + dz * dz;
  }

  private buildOptimalPath(
    entry: BABYLON.Vector3,
    accesos: BABYLON.Vector3[],
    giros: BABYLON.Vector3[],
    destination: BABYLON.Vector3
  ): BABYLON.Vector3[] {
    const route: BABYLON.Vector3[] = [new BABYLON.Vector3(entry.x, entry.y, entry.z)];
    const corridorNodes = [...accesos, ...giros];

    if (corridorNodes.length === 0) {
      route.push(new BABYLON.Vector3(destination.x, destination.y, destination.z));
      return route;
    }

    const startNode = accesos.length > 0 ? accesos[0] : giros[0];
    const remaining = corridorNodes.filter(node => node !== startNode);
    const polyline: BABYLON.Vector3[] = [startNode];
    let current = startNode;

    while (remaining.length > 0) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = this.distSq(current, remaining[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const nextNode = remaining.splice(bestIdx, 1)[0];
      polyline.push(nextNode);
      current = nextNode;
    }

    let bestPoint = polyline[0].clone();
    let minTargetDist = Infinity;
    let bestSegmentIndex = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
      const A = polyline[i];
      const B = polyline[i + 1];
      const isLastSegment = (i === polyline.length - 2);

      let projX = A.x;
      let projZ = A.z;

      if (isLastSegment) {
        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const absDx = Math.abs(dx);
        const absDz = Math.abs(dz);

        if (absDx > 0.0001 || absDz > 0.0001) {
          if (absDx > absDz) {
            const dirX = dx > 0 ? 1 : -1;
            const t = (destination.x - A.x) * dirX;
            projX = t >= 0 ? destination.x : A.x;
            projZ = A.z;
          } else {
            const dirZ = dz > 0 ? 1 : -1;
            const t = (destination.z - A.z) * dirZ;
            projZ = t >= 0 ? destination.z : A.z;
            projX = A.x;
          }
        }
      } else {
        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const lenSq = dx * dx + dz * dz;
        let t = 0;
        if (lenSq > 0.0001) {
          const dot = (destination.x - A.x) * dx + (destination.z - A.z) * dz;
          t = Math.max(0, Math.min(1, dot / lenSq));
        }
        projX = A.x + t * dx;
        projZ = A.z + t * dz;
      }

      const distSqToProj = (destination.x - projX) * (destination.x - projX) + (destination.z - projZ) * (destination.z - projZ);

      if (distSqToProj < minTargetDist) {
        minTargetDist = distSqToProj;
        bestPoint = new BABYLON.Vector3(projX, entry.y, projZ);
        bestSegmentIndex = i;
      }
    }

    for (let i = 0; i <= bestSegmentIndex; i++) {
      if (i === 0 && this.distSq(entry, polyline[0]) < 0.01) continue;
      route.push(new BABYLON.Vector3(polyline[i].x, polyline[i].y, polyline[i].z));
    }

    const lastNode = route[route.length - 1];
    if (this.distSq(lastNode, bestPoint) > 0.01) {
      route.push(bestPoint);
    }
    if (this.distSq(bestPoint, destination) > 0.01) {
      route.push(new BABYLON.Vector3(destination.x, destination.y, destination.z));
    }

    return route;
  }

  public async calculateRoute(destinationName: string): Promise<{
    coord: BABYLON.Vector3;
    routePoints: BABYLON.Vector3[];
    statusText: string;
    piso: string;
    edificio: BuildingId;
  } | null> {
    const loc = await this.findLocationByName(destinationName);
    if (!loc) {
      return null;
    }

    const coord = this.extractVec3(loc);
    if (!coord) {
      return null;
    }

    const piso = loc.Piso || loc.piso || 'Piso 1';
    const edificioField = loc._edificioNombre || loc.Edificio || loc.edificio || 'A';
    const edificio: BuildingId = /b/i.test(edificioField) ? 'B' : /s|sede/i.test(edificioField) ? 'S' : 'A';

    const navPath = await this.firebaseService.getNavigationPath(piso, edificio);
    const destination = new BABYLON.Vector3(coord.x, Math.max(coord.y, 0.05), coord.z);

    let routePoints: BABYLON.Vector3[] = [];
    if (!navPath) {
      routePoints = [this.mainEntranceAccess.clone(), destination];
    } else {
      const { accesos, giros } = this.parseNavPath(navPath);
      routePoints = this.buildOptimalPath(this.mainEntranceAccess.clone(), accesos, giros, destination);
    }

    const statusText = `${destinationName} — Edificio ${edificio} / ${piso} (Coordenadas: ${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}, ${coord.z.toFixed(2)})`;

    return {
      coord: destination,
      routePoints,
      statusText,
      piso,
      edificio
    };
  }
}
