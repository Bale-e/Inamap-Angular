import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface NavNode{
    id: string;
    edificio: string;
    piso: string;
    tipo: 'acceso' | 'giro' | 'finPasillo' | 'destino';
    coordenadas: {x: number, y: number, z: number};
    conectaCon?: string[];
    conecta?: string[];
    desvioDesde?: string;
}

@Injectable({providedIn: 'root'})
export class NavigationService {
    private apiURL = 'http://localhost:3000';

    constructor(private http: HttpClient) {}

    getNodosPorPiso(edificio: string, piso: string): Observable<NavNode[]> {
        return this.http.get<NavNode[]>
        (`${this.apiURL}/navigation-paths/${encodeURIComponent(edificio)}/piso/${encodeURIComponent(piso)}`);
    }
}