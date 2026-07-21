/**
 * Servicio de acceso a la API REST del backend (Express/Firestore).
 * Encapsulado como Injectable de Angular con compatibilidad para llamadas standalone.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const BASE_URL = environment.apiUrl;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  getEdificios(): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/edificios`);
  }

  getEdificio(id: string): Observable<any> {
    return this.http.get<any>(`${BASE_URL}/edificios/${id}`);
  }

  getEdificioPorNombre(nombre: string): Observable<any> {
    return this.http.get<any>(`${BASE_URL}/edificios/nombre/${encodeURIComponent(nombre)}`);
  }

  getLocaciones(edificioId: string): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/edificios/${edificioId}/locaciones`);
  }

  getLocacionesPorPiso(edificioId: string, piso: string): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/edificios/${edificioId}/locaciones/piso/${encodeURIComponent(piso)}`);
  }

  getLocacionesPorTipo(edificioId: string, tipo: string): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/edificios/${edificioId}/locaciones/tipo/${encodeURIComponent(tipo)}`);
  }

  getLocacionPorNombre(edificioId: string, nombre: string): Observable<any> {
    return this.http.get<any>(`${BASE_URL}/edificios/${edificioId}/locaciones/nombre/${encodeURIComponent(nombre)}`);
  }

  getLocacionPorNombreGlobal(nombre: string): Observable<any> {
    return this.http.get<any>(`${BASE_URL}/locaciones/${encodeURIComponent(nombre)}`);
  }

  getNavigationPaths(): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/navigation-paths`);
  }

  getNavigationPathPorPiso(piso: string): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/navigation-paths/piso/${encodeURIComponent(piso)}`);
  }

  getRutas(): Observable<any[]> {
    return this.http.get<any[]>(`${BASE_URL}/rutas`);
  }
}

// ── Exportaciones standalone para retrocompatibilidad ──────────────
export async function getEdificios() {
  const res = await fetch(`${BASE_URL}/edificios`);
  if (!res.ok) throw new Error('Error al obtener edificios desde la API');
  return res.json();
}

export async function getEdificio(id: string) {
  const res = await fetch(`${BASE_URL}/edificios/${id}`);
  if (!res.ok) throw new Error('Error al buscar edificio desde la API');
  return res.json();
}

export async function getEdificioPorNombre(nombre: string) {
  const res = await fetch(`${BASE_URL}/edificios/nombre/${encodeURIComponent(nombre)}`);
  if (!res.ok) throw new Error('Error al buscar edificio por nombre desde la API');
  return res.json();
}

export async function getLocaciones(edificioId: string) {
  const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones`);
  if (!res.ok) throw new Error('Error al obtener locaciones desde la API');
  return res.json();
}

export async function getLocacionesPorPiso(edificioId: string, piso: string) {
  const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/piso/${encodeURIComponent(piso)}`);
  if (!res.ok) throw new Error('Error al obtener locaciones por piso desde la API');
  return res.json();
}

export async function getLocacionesPorTipo(edificioId: string, tipo: string) {
  const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/tipo/${encodeURIComponent(tipo)}`);
  if (!res.ok) throw new Error('Error al obtener locaciones por tipo desde la API');
  return res.json();
}

export async function getLocacionPorNombre(edificioId: string, nombre: string) {
  const res = await fetch(`${BASE_URL}/edificios/${edificioId}/locaciones/nombre/${encodeURIComponent(nombre)}`);
  if (!res.ok) throw new Error('Error al buscar locación desde la API');
  return res.json();
}

export async function getLocacionPorNombreGlobal(nombre: string) {
  const res = await fetch(`${BASE_URL}/locaciones/${encodeURIComponent(nombre)}`);
  if (!res.ok) throw new Error('Error al buscar locación por nombre desde la API');
  return res.json();
}

export async function getNavigationPaths() {
  const res = await fetch(`${BASE_URL}/navigation-paths`);
  if (!res.ok) throw new Error('Error al obtener navigation-paths desde la API');
  return res.json();
}

export async function getNavigationPathPorPiso(piso: string) {
  const res = await fetch(`${BASE_URL}/navigation-paths/piso/${encodeURIComponent(piso)}`);
  if (!res.ok) throw new Error('Error al obtener navigation-path desde la API');
  return res.json();
}

export async function getRutas() {
  const res = await fetch(`${BASE_URL}/rutas`);
  if (!res.ok) throw new Error('Error al obtener rutas desde la API');
  return res.json();
}