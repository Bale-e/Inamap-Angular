import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Map3dContainerComponent } from './map3d-container.component';
import { Firebase } from '../../../services/firebase';

describe('Map3dContainerComponent search autocomplete', () => {
  it('should update datalist suggestions from matching locations', () => {
    const component = new Map3dContainerComponent(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    component.destinationOptions = ['Biblioteca', 'Sala de Tutorías 1', 'Recepción'];
    component.handleSearchInput('tut');

    expect(component.searchQuery).toBe('tut');
    expect(component.filteredDestinations).toEqual(['Sala de Tutorías 1']);
  });
});

describe('Map3dContainerComponent building A transition marker', () => {
  it('should return the expected marker data for each building B floor', () => {
    const component = new Map3dContainerComponent(
      {} as Firebase,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    (component as any).currentBuilding = 'B';
    (component as any).currentFloor = (component as any).buildingBThirdFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al Edificio A - Piso 3',
      position: { x: -0.49, y: 0.01, z: -11.40 }
    });

    (component as any).currentFloor = (component as any).buildingBSecondFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al Edificio A - Piso 2',
      position: { x: -4.43, y: 0.01, z: -3.25 }
    });

    (component as any).currentFloor = (component as any).buildingBFirstFloorModel;
    expect(component.getBuildingATransitionMarkerState()).toEqual({
      label: 'Ir al mapa principal',
      position: { x: 12.18, y: 0.01, z: -0.23 }
    });
  });
});
