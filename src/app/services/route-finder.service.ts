/*
  Buscador de rutas basado en la colección navigation_paths.
  Antes: buscador-ruta.ts  →  Renombrado a: route-finder.service.ts
  Esta utilidad construye una ruta en base a los datos de navegación disponibles,
  partiendo siempre desde un punto de inicio y avanzando hacia un punto final.
*/

export interface NavigationPath {
  id?: string;
  building?: string;
  floor?: string;
  piso?: string;
  accesses?: Record<string, number[][]>;
  turns?: number[][];
  pois?: Record<string, number[]>;
  [key: string]: any;
}

export interface RouteResult {
  startName: string;
  endName: string;
  startPathId?: string;
  endPathId?: string;
  coordinates: number[][];
}

const DEFAULT_START_NAME = 'MainEntrance';

function getAccessCoordinate(path: NavigationPath, pointName: string): number[] | null {
  const access = path.accesses?.[pointName];
  if (Array.isArray(access) && access.length > 0 && Array.isArray(access[0]) && access[0].length >= 3) {
    return access[0].slice(0, 3);
  }
  return null;
}

function getPoiCoordinate(path: NavigationPath, pointName: string): number[] | null {
  const poi = path.pois?.[pointName];
  if (Array.isArray(poi) && poi.length >= 3) {
    return poi.slice(0, 3);
  }
  return null;
}

function getPointCoordinate(path: NavigationPath, pointName: string): number[] | null {
  return getAccessCoordinate(path, pointName) || getPoiCoordinate(path, pointName) || null;
}

function getPathTurnCoordinates(path: NavigationPath): number[][] {
  if (!Array.isArray(path.turns)) return [];
  return path.turns
    .filter(turn => Array.isArray(turn) && turn.length >= 3)
    .map(turn => turn.slice(0, 3));
}

function getFirstAccessCoordinate(path: NavigationPath): number[] | null {
  if (!path.accesses) return null;
  for (const key of Object.keys(path.accesses)) {
    const coord = getAccessCoordinate(path, key);
    if (coord) return coord;
  }
  return null;
}

function findCommonAccess(pathA: NavigationPath, pathB: NavigationPath): { name: string; coordinate: number[] } | null {
  if (!pathA.accesses || !pathB.accesses) return null;
  for (const key of Object.keys(pathA.accesses)) {
    if (key in pathB.accesses) {
      const coord = getAccessCoordinate(pathA, key);
      if (coord) {
        return { name: key, coordinate: coord };
      }
    }
  }
  return null;
}

function normalizeRoute(coordinates: number[][]): number[][] {
  const normalized: number[][] = [];
  let last: string | null = null;
  for (const coord of coordinates) {
    const key = coord.slice(0, 3).join(',');
    if (key !== last) {
      normalized.push(coord.slice(0, 3));
      last = key;
    }
  }
  return normalized;
}

export function construirRutaDesdeNavigationPaths(
  navigationPaths: NavigationPath[],
  destinationName: string,
  startName: string = DEFAULT_START_NAME
): RouteResult | null {
  if (!Array.isArray(navigationPaths) || navigationPaths.length === 0) {
    return null;
  }

  const startPath = navigationPaths.find(path => !!getPointCoordinate(path, startName));
  const endPath = navigationPaths.find(path => !!getPointCoordinate(path, destinationName));

  if (!startPath || !endPath) {
    return null;
  }

  const startCoord = getPointCoordinate(startPath, startName);
  const endCoord = getPointCoordinate(endPath, destinationName);
  if (!startCoord || !endCoord) {
    return null;
  }

  const startTurns = getPathTurnCoordinates(startPath);
  const endTurns = getPathTurnCoordinates(endPath);
  const route: number[][] = [startCoord];

  if (startPath === endPath) {
    route.push(...startTurns);
    route.push(endCoord);
  } else {
    const commonAccess = findCommonAccess(startPath, endPath);
    if (commonAccess) {
      route.push(...startTurns, commonAccess.coordinate, ...endTurns, endCoord);
    } else {
      const transitionCoord = getFirstAccessCoordinate(endPath) || endCoord;
      route.push(...startTurns, transitionCoord, ...endTurns, endCoord);
    }
  }

  return {
    startName,
    endName: destinationName,
    startPathId: startPath.id,
    endPathId: endPath.id,
    coordinates: normalizeRoute(route)
  };
}
