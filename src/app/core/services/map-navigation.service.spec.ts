import { MapNavigationService } from './map-navigation.service';
import { Firebase } from '../../services/firebase';

describe('MapNavigationService', () => {
  it('should override the room label for Cuerpo20 on building A first floor', async () => {
    const firebaseService = {
      getLocacionesDeTodosLosEdificios: jasmine.createSpy().and.resolveTo([
        {
          Nombre: 'Sala A309',
          Cuerpo: 20,
          Edificio: 'A',
          Piso: 'Piso 1'
        }
      ])
    } as unknown as Firebase;

    const service = new MapNavigationService(firebaseService);
    service.setBuilding('A');
    service.setFloor('Edifico A - Piso 1.obj');

    const info = await service.getLocationInfoByMeshNameAsync('cuerpo20');

    expect(info?.nombre).toBe('Sala A106');
  });
});
