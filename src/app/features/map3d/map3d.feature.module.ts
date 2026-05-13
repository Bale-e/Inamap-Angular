import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Map3dContainerComponent } from './components/map3d-container.component';

@NgModule({
  declarations: [Map3dContainerComponent],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  exports: [Map3dContainerComponent]
})
export class Map3dFeatureModule { }