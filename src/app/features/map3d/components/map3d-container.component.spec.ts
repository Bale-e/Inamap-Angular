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

  it('should populate search suggestions from Firestore location names', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: async () => [
        { Nombre: 'Biblioteca' },
        { nombre: 'Sala de Tutorías 1' }
      ]
    } as unknown as Firebase;

    const component = new Map3dContainerComponent(
      firebaseService,
      { run: (fn: () => unknown) => fn() } as NgZone,
      { detectChanges: () => undefined } as ChangeDetectorRef
    );

    const suggestionsPanel = {
      style: { display: 'none' },
      innerHTML: '',
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    } as unknown as HTMLDivElement;

    (component as any).searchInputElement = { parentElement: { appendChild: () => undefined } } as HTMLInputElement;
    (component as any).searchSuggestionsPanel = suggestionsPanel;
    (component as any).searchQuery = 'b';

    await (component as any).loadLocationOptions();

    expect(component.destinationOptions).toEqual(['Biblioteca', 'Sala de Tutorías 1']);
    expect(component.filteredDestinations).toEqual(['Biblioteca', 'Sala de Tutorías 1']);
    expect(suggestionsPanel.innerHTML).toContain('Biblioteca');
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
