/*
  Módulo de la funcionalidad del mapa 3D.
  Descripción: declara e importa el componente que renderiza la vista 3D (BabylonJS).
*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Map3dContainerComponent } from './components/map3d-container.component';

@NgModule({
  declarations: [Map3dContainerComponent],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule
  ],
  exports: [Map3dContainerComponent]
})
export class Map3dFeatureModule { }