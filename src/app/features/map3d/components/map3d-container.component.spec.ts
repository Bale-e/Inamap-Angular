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
