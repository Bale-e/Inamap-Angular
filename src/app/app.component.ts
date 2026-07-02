/**
 * Componente raíz de la aplicación.
 * Descripción: inicia servicios esenciales y monta la vista principal que contiene el mapa 3D/2D.
 */
import { Component, OnInit } from '@angular/core';
import { Firebase } from './services/firebase';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(private firebaseService: Firebase) {}

  async ngOnInit() {
    await this.firebaseService.getEdificios();
  }
}