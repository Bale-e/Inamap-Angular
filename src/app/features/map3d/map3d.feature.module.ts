import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map3dContainerComponent } from './components/map3d-container/map3d-container.component';

@NgModule({
  declarations: [Map3dContainerComponent],
  imports: [CommonModule],
  exports: [Map3dContainerComponent]
})
export class Map3dFeatureModule { }