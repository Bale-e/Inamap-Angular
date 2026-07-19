/*
  Componente del visor 3D (Map3dContainerComponent).
  Descripción: inicializa la escena BabylonJS, carga modelos OBJ, gestiona interacción (clics, zoom,
  búsqueda de rutas) y dibuja guías/flechas basadas en datos de navegación.
*/
import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { HttpClient } from '@angular/common/http';
import { Firebase } from '../../../services/firebase';
import { dibujarFlechaGuia } from '../../../services/flecha_guía';



@Component({
  selector: 'app-map3d',
  templateUrl: './map3d-container.component.html',
  styleUrls: ['./map3d-container.component.scss']
})
export class Map3dContainerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('renderCanvas', { static: false })
  renderCanvasContainer!: ElementRef<HTMLDivElement>;

  viewMode: '2d' | '3d' = '3d';
  private readonly firstFloorModel = 'Edifico A - Piso 1.obj';
  private readonly secondFloorModel = 'Edificio A - piso 2.obj';
  private readonly thirdFloorModel = 'Edificio A - piso 3.obj';
  private readonly buildingBFirstFloorModel = 'Edificio B - Piso 1.obj';
  private readonly buildingBSecondFloorModel = 'Edificio B - Piso 2.obj';
  private readonly buildingBThirdFloorModel = 'Edificio B - Piso 3.obj';
  currentFloor = this.firstFloorModel;
  private currentBuilding: 'A' | 'B' = 'A';

  private engine: BABYLON.Engine | null = null;
  private scene: BABYLON.Scene | null = null;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private cameraBeforeRenderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  private renderLoopFn: (() => void) | null = null;
  private orthoSize = 14;
  private modelRoot: BABYLON.TransformNode | null = null;
  private readonly defaultOrthoSize = 14;
  private readonly boundaryNameRegExp = /wall|ground|floor|suelo|piso/i;
  private readonly topDownPanLimits = { minX: -14, maxX: 14, minZ: -14, maxZ: 14 };
  private isTopDownView = false;
  zoomOutEnabled = false;
  private bannerControlsAttached = false;
  private searchInputElement: HTMLInputElement | null = null;
  private searchSuggestionsPanel: HTMLDivElement | null = null;
  public cuerpo23HintVisible = false;
  public cuerpo23HintX = 0;
  public cuerpo23HintY = 0;
  private infoBox: HTMLDivElement | null = null;
  private floorArrow: HTMLDivElement | null = null;
  private buildingBMarker: HTMLDivElement | null = null;
  private buildingAMarker: HTMLDivElement | null = null;
  private mainMapMarker: HTMLDivElement | null = null;
  private drawerOverlay: HTMLDivElement | null = null;
  private sideDrawer: HTMLDivElement | null = null;
  private drawerOpen = false;
  private detailPanelOverlay: HTMLDivElement | null = null;
  private detailPanel: HTMLDivElement | null = null;
  private detailPanelOpen = false;
  private servicesList: string[] = ['Cafetería', 'Biblioteca', 'Recepción', 'Baños', 'Sala de Profesores', 'Soporte Técnico', 'Tienda'];
  floorDialogVisible = false;
  searchQuery = '';
  destinationOptions: string[] = [];
  filteredDestinations: string[] = [];
  selectedDestination: string | null = null;
  public destinationCoordinatesText = '';
  private destinationMarker: BABYLON.Mesh | null = null;

  private onDocumentClick = (evt: MouseEvent): void => {
    const target = evt.target as Node | null;
    if (target && (this.searchInputElement?.contains(target) || this.searchSuggestionsPanel?.contains(target))) {
      return;
    }

    if (this.infoBox) {
      this.infoBox.style.display = 'none';
    }
    if (this.floorArrow) {
      this.floorArrow.style.display = 'none';
    }
    this.closeDetailPanel();
    this.hideSearchSuggestions();
  };

  // Estado y marcadores para demo de ruta
  // ── Información de cada cuerpo ──────────────────────────
  // IMPORTANTE: los keys deben coincidir con mesh.name del OBJ
  // Abre la consola del navegador en modo 3D para ver los nombres reales
  private infoData: { [key: string]: { nombre: string, desc: string } } = {
    'Cuerpo13': { nombre: 'Fotocopiadora y Suministros', desc: 'Servicio de fotocopiado y venta de materiales para estudiantes.' },
    'Cuerpo29': { nombre: 'Sala de Tutorías 1',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo30': { nombre: 'Sala de Tutorías 2',          desc: 'Espacio de apoyo académico con tutores disponibles.' },
    'Cuerpo28': { nombre: 'Sala de Tutorías 3',          desc: 'Espacio adicional de tutorías con capacidad para grupos pequeños.' },
    'Cuerpo27': { nombre: 'Sala de Tutorías 4',          desc: 'Sala de apoyo académico y reuniones estudiantiles.' }
  };

  private readonly mainEntranceAccess = new BABYLON.Vector3(11.22, 0.01, 0.12);

  constructor(
    private firebaseService: Firebase,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef
  ) {}

  ngAfterViewInit(): void {
    this.ensureLoaders();
    this.attachBannerControls();
    this.createInfoBox();
    this.createFloorArrow();
    this.createBuildingBMarker();
    this.createBuildingAMarker();
    this.createMainMapMarker();
    this.createDetailPanel();
    this.createDrawerElements();
    this.attachDrawerControls();
    this.loadLocationOptions().catch((error) => console.error('Error cargando locaciones:', error));
    if (this.viewMode === '3d') {
      setTimeout(() => this.init3dScene(), 0);
    }
  }

  // ── Crea el cuadro de info flotante ──────────────────────
  private createInfoBox(): void {
    this.infoBox = document.createElement('div');
    this.infoBox.style.cssText = `
      display: none;
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 10px 14px;
      width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
      z-index: 1000;
      pointer-events: none;
    `;
    document.body.appendChild(this.infoBox);
  }

  // ── Crea la flecha para ir al piso dos ───────────────────
  private createFloorArrow(): void {
    this.floorArrow = document.createElement('div');
    this.floorArrow.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 1001;
      pointer-events: none;
    `;
    this.floorArrow.innerHTML = '→ Ir al piso dos';
    document.body.appendChild(this.floorArrow);
  }

  // ── Crea el marcador para Edificio B (desde Edificio A) ─────────────────────
  private createBuildingBMarker(): void {
    this.buildingBMarker = document.createElement('div');
    this.buildingBMarker.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 999;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.buildingBMarker.innerHTML = '→ Ir al Edificio B - Piso 1';
    this.buildingBMarker.addEventListener('mouseenter', () => {
      if (this.buildingBMarker) {
        this.buildingBMarker.style.backgroundColor = 'rgba(0,0,0,0.95)';
      }
    });
    this.buildingBMarker.addEventListener('mouseleave', () => {
      if (this.buildingBMarker) {
        this.buildingBMarker.style.backgroundColor = 'rgba(0,0,0,0.8)';
      }
    });
    this.buildingBMarker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleBuildingBMarkerClick();
    });
    document.body.appendChild(this.buildingBMarker);
  }

  // ── Crea el marcador para Edificio A (desde Edificio B) ─────────────────────
  private createBuildingAMarker(): void {
    this.buildingAMarker = document.createElement('div');
    this.buildingAMarker.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 999;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.buildingAMarker.innerHTML = '→ Ir al mapa principal';
    this.buildingAMarker.addEventListener('mouseenter', () => {
      if (this.buildingAMarker) {
        this.buildingAMarker.style.backgroundColor = 'rgba(0,0,0,0.95)';
      }
    });
    this.buildingAMarker.addEventListener('mouseleave', () => {
      if (this.buildingAMarker) {
        this.buildingAMarker.style.backgroundColor = 'rgba(0,0,0,0.8)';
      }
    });
    this.buildingAMarker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleBuildingAMarkerClick();
    });
    document.body.appendChild(this.buildingAMarker);
  }

  private createMainMapMarker(): void {
    this.mainMapMarker = document.createElement('div');
    this.mainMapMarker.style.cssText = `
      display: none;
      position: fixed;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 999;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    this.mainMapMarker.innerHTML = '→ Ir al mapa principal';
    this.mainMapMarker.addEventListener('mouseenter', () => {
      if (this.mainMapMarker) {
        this.mainMapMarker.style.backgroundColor = 'rgba(0,0,0,0.95)';
      }
    });
    this.mainMapMarker.addEventListener('mouseleave', () => {
      if (this.mainMapMarker) {
        this.mainMapMarker.style.backgroundColor = 'rgba(0,0,0,0.8)';
      }
    });
    this.mainMapMarker.addEventListener('click', (e) => {
      e.stopPropagation();
      // Intención futura: navegar al mapa principal si está implementado.
    });
    document.body.appendChild(this.mainMapMarker);
  }

  // ── Crea un panel flotante tipo drawer para información del cuerpo 9 ───────
  private createDetailPanel(): void {
    this.detailPanelOverlay = document.createElement('div');
    this.detailPanelOverlay.className = 'detail-panel-overlay';
    this.detailPanelOverlay.style.display = 'none';

    this.detailPanel = document.createElement('div');
    this.detailPanel.className = 'detail-panel';

    const inner = document.createElement('div');
    inner.className = 'detail-panel__inner';

    const header = document.createElement('div');
    header.className = 'detail-panel__header';
    const title = document.createElement('h3');
    title.className = 'detail-panel__title';
    title.textContent = 'Información';
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'detail-panel__body';
    body.innerHTML = `
      <p class="detail-panel__eyebrow">Piso 1 · Cuerpo 9</p>
      <p class="detail-panel__text">Aquí puedes mostrar información adicional, accesos o indicaciones para este espacio.</p>
    `;

    inner.appendChild(header);
    inner.appendChild(body);
    this.detailPanel.appendChild(inner);
    this.detailPanel.addEventListener('click', (e) => e.stopPropagation());
    this.detailPanelOverlay.addEventListener('click', () => this.closeDetailPanel());

    document.body.appendChild(this.detailPanelOverlay);
    document.body.appendChild(this.detailPanel);
  }

  private formatBodyPanelTitle(meshName: string): string {
    const normalizedMeshName = meshName.replace(/\s+/g, '').toLowerCase();
    const match = normalizedMeshName.match(/^cuerpo(\d+)$/i);
    return match ? `Cuerpo ${match[1]}` : 'Información';
  }

  private openDetailPanel(title: string, content: string): void {
    if (!this.detailPanelOverlay || !this.detailPanel) return;

    const titleEl = this.detailPanel.querySelector('.detail-panel__title') as HTMLElement | null;
    const bodyEl = this.detailPanel.querySelector('.detail-panel__body') as HTMLElement | null;
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;

    this.detailPanelOpen = true;
    this.detailPanelOverlay.style.display = 'block';
    this.detailPanelOverlay.classList.add('open');
    this.detailPanel.classList.add('open');
  }

  private closeDetailPanel(): void {
    this.detailPanelOpen = false;
    if (this.detailPanelOverlay) {
      this.detailPanelOverlay.style.display = 'none';
      this.detailPanelOverlay.classList.remove('open');
    }
    if (this.detailPanel) {
      this.detailPanel.classList.remove('open');
    }
  }

  // ── Crea elementos del drawer (overlay + panel lateral) ─────────────────
  private createDrawerElements(): void {
    // Overlay
    this.drawerOverlay = document.createElement('div');
    this.drawerOverlay.className = 'drawer-overlay';
    this.drawerOverlay.style.display = 'none';

    // Side drawer
    this.sideDrawer = document.createElement('div');
    this.sideDrawer.className = 'side-drawer';

    const inner = document.createElement('div');
    inner.className = 'side-drawer__inner';

    // Header
    const header = document.createElement('div');
    header.className = 'side-drawer__header';
    const title = document.createElement('h3');
    title.textContent = 'A dónde desea ir';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'side-drawer__close';
    closeBtn.setAttribute('aria-label', 'Cerrar menú');
    closeBtn.innerHTML = '✕';
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.attachDrawerDrag(header);

    // Content (two columns)
    const content = document.createElement('div');
    content.className = 'side-drawer__content';

    const colServices = document.createElement('div');
    colServices.className = 'drawer-column';
    const colServicesTitle = document.createElement('h4');
    colServicesTitle.textContent = 'Servicios';
    const servicesListEl = document.createElement('div');
    servicesListEl.className = 'drawer-list services-list';

    // Duplicate items to enable smooth looping scroll (virtual loop)
    const buildServiceItems = () => {
      servicesListEl.innerHTML = '';
      const items = [...this.servicesList];
      items.forEach((s) => {
        const btn = document.createElement('button');
        btn.className = 'drawer-item';
        btn.textContent = s;
        btn.addEventListener('click', (e) => { e.stopPropagation(); });
        servicesListEl.appendChild(btn);
      });
    };
    buildServiceItems();

    colServices.appendChild(colServicesTitle);
    colServices.appendChild(servicesListEl);

    const colPlaces = document.createElement('div');
    colPlaces.className = 'drawer-column';
    const colPlacesTitle = document.createElement('h4');
    colPlacesTitle.textContent = 'Lugares';
    const placesListEl = document.createElement('div');
    placesListEl.className = 'drawer-list places-list';

    const buildPlacesItems = () => {
      placesListEl.innerHTML = '';
      const items = [...(this.destinationOptions || [])];
      items.forEach((p) => {
        const btn = document.createElement('button');
        btn.className = 'drawer-item';
        btn.textContent = p;
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.selectDestination(p); this.toggleDrawer(false); });
        placesListEl.appendChild(btn);
      });
    };
    buildPlacesItems();

    colPlaces.appendChild(colPlacesTitle);
    colPlaces.appendChild(placesListEl);

    content.appendChild(colServices);
    content.appendChild(colPlaces);

    inner.appendChild(header);
    inner.appendChild(content);
    this.sideDrawer.appendChild(inner);

    // Prevent clicks inside drawer from closing when overlay has handler
    this.sideDrawer.addEventListener('click', (e) => e.stopPropagation());

    document.body.appendChild(this.drawerOverlay);
    document.body.appendChild(this.sideDrawer);

    // close button
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDrawer(false); });
    // overlay click closes drawer
    this.drawerOverlay.addEventListener('click', () => this.toggleDrawer(false));

  }

  private attachDrawerDrag(dragHandle: HTMLElement): void {
    if (!this.sideDrawer) return;

    let startY = 0;
    let startTop = 0;
    let dragging = false;

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !this.sideDrawer) return;
      const currentY = event.clientY;
      const deltaY = currentY - startY;
      const newTop = Math.min(Math.max(startTop + deltaY, 20), window.innerHeight - this.sideDrawer.offsetHeight - 20);
      this.sideDrawer.style.top = `${newTop}px`;
      this.sideDrawer.style.transform = 'translate(0, 0) scale(1)';
    };

    const onPointerUp = () => {
      dragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    dragHandle.style.cursor = 'grab';
    dragHandle.addEventListener('pointerdown', (event) => {
      if (!this.sideDrawer) return;
      event.preventDefault();
      dragging = true;
      startY = event.clientY;
      startTop = this.sideDrawer.getBoundingClientRect().top;
      dragHandle.style.cursor = 'grabbing';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // Implements a simple looping scroll by adjusting scrollTop when reaching near ends
  private attachDrawerControls(): void {
    const hamb = document.getElementById('hamburgerMenuBtn');
    if (hamb) {
      hamb.addEventListener('click', (e) => { e.stopPropagation(); this.toggleDrawer(!this.drawerOpen); });
    }
  }

  private toggleDrawer(open?: boolean): void {
    const shouldOpen = typeof open === 'boolean' ? open : !this.drawerOpen;
    this.drawerOpen = shouldOpen;
    if (this.drawerOverlay) {
      this.drawerOverlay.style.display = shouldOpen ? 'block' : 'none';
      if (shouldOpen) this.drawerOverlay.classList.add('open'); else this.drawerOverlay.classList.remove('open');
    }
    if (this.sideDrawer) {
      if (shouldOpen) this.sideDrawer.classList.add('open'); else this.sideDrawer.classList.remove('open');
    }
  }

  private ensureLoaders(): void {
    if (!BABYLON.SceneLoader.IsPluginForExtensionAvailable('.obj')) {
      console.warn('OBJ loader no está disponible');
    }
  }

  ngOnDestroy(): void {
    this.dispose3d();
    if (this.infoBox) {
      document.body.removeChild(this.infoBox);
      this.infoBox = null;
    }
    if (this.detailPanelOverlay) {
      document.body.removeChild(this.detailPanelOverlay);
      this.detailPanelOverlay = null;
    }
    if (this.detailPanel) {
      document.body.removeChild(this.detailPanel);
      this.detailPanel = null;
    }
    if (this.floorArrow) {
      document.body.removeChild(this.floorArrow);
      this.floorArrow = null;
    }
    if (this.buildingBMarker) {
      document.body.removeChild(this.buildingBMarker);
      this.buildingBMarker = null;
    }
    if (this.buildingAMarker) {
      document.body.removeChild(this.buildingAMarker);
      this.buildingAMarker = null;
    }
  }

  setView(mode: '2d' | '3d'): void {
    if (mode === this.viewMode) return;

    if (mode === '3d') {
      this.viewMode = '3d';
      this.isTopDownView = false;
      if (!this.scene) {
        setTimeout(() => this.init3dScene(), 0);
      } else {
        this.configureCameraMode();
      }
    } else {
      this.viewMode = '2d';
      this.isTopDownView = true;
      if (!this.scene) {
        setTimeout(() => this.init3dScene(), 0);
      } else {
        this.configureCameraMode();
      }
    }

    this.updateBannerButtons();
  }

  private configureCameraMode(): void {
    if (!this.camera) return;

    // Resetear zoom al cambiar de vista
    this.orthoSize = this.defaultOrthoSize;

    if (this.isTopDownView) {
      this.camera.alpha = -Math.PI / 2;
      this.camera.beta = 0.12;
      this.camera.radius = 35;
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      this.camera.lowerAlphaLimit = this.camera.upperAlphaLimit = this.camera.alpha;
      this.camera.lowerBetaLimit = this.camera.upperBetaLimit = this.camera.beta;
    } else {
      this.camera.alpha = -Math.PI / 3;
      this.camera.beta = Math.PI / 5;
      this.camera.radius = 30;
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
      this.camera.lowerAlphaLimit = null;
      this.camera.upperAlphaLimit = null;
      this.camera.lowerBetaLimit = 0.05;
      this.camera.upperBetaLimit = Math.PI / 2 - 0.05;
    }

    // Apuntar a la posición del modelo, o al origen si no existe aún
    const targetPos = this.modelRoot?.position?.clone() || BABYLON.Vector3.Zero();
    this.camera.setTarget(targetPos);
    this.updateOrthoCamera();
    this.updateSceneAppearance();
  }

  private attachBannerControls(): void {
    if (this.bannerControlsAttached) return;
    const searchPlaceInput = document.getElementById('searchPlaceInput') as HTMLInputElement | null;
    if (searchPlaceInput) {
      this.searchInputElement = searchPlaceInput;
      this.createSearchSuggestionsPanel();

      searchPlaceInput.addEventListener('focus', () => this.ngZone.run(() => {
        this.searchQuery = searchPlaceInput.value;
        this.handleSearchInput(searchPlaceInput.value);
        this.updateSearchSuggestionsVisibility();
      }));
      searchPlaceInput.addEventListener('input', () => this.ngZone.run(() => {
        this.searchQuery = searchPlaceInput.value;
        this.handleSearchInput(searchPlaceInput.value);
        this.updateSearchSuggestionsVisibility();
        this.cd.detectChanges();
      }));
      searchPlaceInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 150);
      });
      searchPlaceInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = searchPlaceInput.value.trim();
          if (value) {
            this.ngZone.run(() => this.selectDestination(value));
          }
        }
      });
    }
    this.bannerControlsAttached = true;
    this.updateBannerButtons();
  }

  private updateBannerButtons(): void {
    const searchPlaceInput = document.getElementById('searchPlaceInput') as HTMLInputElement | null;
    if (searchPlaceInput) {
      searchPlaceInput.disabled = false;
      searchPlaceInput.placeholder = this.destinationOptions.length > 0 ? 'Buscar destino' : 'Cargando ubicaciones...';
    }
    this.updateZoomButtons();
  }

  handleSearchInput(query: string): void {
    this.searchQuery = query;
    const normalizedQuery = this.normalizeText(query);
    this.filteredDestinations = this.destinationOptions.filter(option =>
      this.normalizeText(option).includes(normalizedQuery)
    );
    this.renderSearchSuggestions();
  }

  private createSearchSuggestionsPanel(): void {
    if (!this.searchInputElement || this.searchSuggestionsPanel) {
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'search-suggestions-panel';
    panel.style.display = 'none';
    panel.addEventListener('mousedown', (event) => event.preventDefault());
    this.searchSuggestionsPanel = panel;

    const wrapper = this.searchInputElement.parentElement;
    if (wrapper) {
      wrapper.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  private updateSearchSuggestionsVisibility(): void {
    if (!this.searchSuggestionsPanel) return;
    const query = this.searchQuery.trim();
    const hasMatches = this.filteredDestinations.length > 0;
    this.searchSuggestionsPanel.style.display = hasMatches ? 'block' : 'none';
    this.renderSearchSuggestions();
  }

  private renderSearchSuggestions(): void {
    if (!this.searchSuggestionsPanel) return;

    const maxItems = 8;
    const items = this.filteredDestinations.slice(0, maxItems);
    this.searchSuggestionsPanel.innerHTML = items.map(option =>
      `<button type="button" class="search-suggestion-item" data-value="${option.replace(/"/g, '&quot;')}">${option}</button>`
    ).join('');

    const buttons = Array.from(this.searchSuggestionsPanel.querySelectorAll('button.search-suggestion-item'));
    buttons.forEach(button => {
      button.removeEventListener('click', this.onSuggestionClick as any);
      button.addEventListener('click', this.onSuggestionClick as any);
    });
  }

  private onSuggestionClick = (event: MouseEvent): void => {
    const target = event.currentTarget as HTMLElement | null;
    if (!target || !this.searchInputElement) return;
    const value = target.getAttribute('data-value')?.trim();
    if (!value) return;
    this.searchInputElement.value = value;
    this.searchQuery = value;
    this.filteredDestinations = [value];
    this.hideSearchSuggestions();
    this.selectDestination(value);
  };

  private hideSearchSuggestions(): void {
    if (this.searchSuggestionsPanel) {
      this.searchSuggestionsPanel.style.display = 'none';
    }
  }

  selectDestination(destination: string): void {
    this.selectedDestination = destination;
    this.searchQuery = destination;
    if (this.searchInputElement) {
      this.searchInputElement.value = destination;
    }
    this.hideSearchSuggestions();
    this.searchDestination(destination);
    this.updateBannerButtons();
  }

  private extractLocationName(location: any): string {
    const candidates = [
      this.getObjectFieldIgnoreCase(location, 'Nombre'),
      this.getObjectFieldIgnoreCase(location, 'nombre'),
      this.getObjectFieldIgnoreCase(location, 'name'),
      this.getObjectFieldIgnoreCase(location, 'DisplayName'),
      this.getObjectFieldIgnoreCase(location, 'displayName'),
      this.getObjectFieldIgnoreCase(location, 'title'),
      this.getObjectFieldIgnoreCase(location, 'titulo'),
      this.getObjectFieldIgnoreCase(location, 'id')
    ];

    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) {
        continue;
      }

      const value = candidate.toString().trim();
      if (value.length > 0) {
        return value;
      }
    }

    // Fallback: cualquier campo string que no sea metadata de colección.
    const ignoredKeys = new Set([
      '_coleccion',
      'coleccion',
      '_edificioid',
      '_edificionombre',
      'edificio',
      'coordenadas',
      'coordenadas 3d',
      'coordinates',
      'coords',
      'coordenada',
      'x',
      'y',
      'z',
      'piso',
      'tipo',
      'descripcion',
      'descripción'
    ]);

    for (const key of Object.keys(location || {})) {
      const normalizedKey = key?.toString().trim().toLowerCase();
      if (!normalizedKey || ignoredKeys.has(normalizedKey)) {
        continue;
      }

      const candidate = location[key];
      if (typeof candidate === 'string') {
        const value = candidate.trim();
        if (value.length > 0) {
          return value;
        }
      }
    }

    return '';
  }

  private normalizeText(text: any): string {
    if (text === undefined || text === null) {
      return '';
    }

    return text.toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  private getObjectFieldIgnoreCase(obj: any, fieldName: string): any {
    if (!obj || typeof obj !== 'object') return undefined;
    const target = fieldName?.toString().trim().toLowerCase();
    const key = Object.keys(obj).find(k => k?.toString().trim().toLowerCase() === target);
    return key ? obj[key] : undefined;
  }

  private getCurrentFloorName(): string {
    const normalized = this.currentFloor.toLowerCase();
    if (normalized.includes('piso 1')) {
      return 'Piso 1';
    }
    if (normalized.includes('piso 2')) {
      return 'Piso 2';
    }
    if (normalized.includes('piso 3')) {
      return 'Piso 3';
    }
    return 'Piso 1';
  }

  private matchLocationBuilding(location: any, building: 'A' | 'B'): boolean {
    const edificioField = this.getObjectFieldIgnoreCase(location, '_edificioNombre') ||
                         this.getObjectFieldIgnoreCase(location, 'edificio') ||
                         this.getObjectFieldIgnoreCase(location, 'building') ||
                         this.getObjectFieldIgnoreCase(location, '_edificioId');
    const edificioValue = (edificioField ?? '').toString().trim().toLowerCase();
    const target = `edificio ${building.toLowerCase()}`;
    return edificioValue === building.toLowerCase() || edificioValue === target || edificioValue.includes(target);
  }

  private getLocationFloor(location: any): string {
    const pisoField = this.getObjectFieldIgnoreCase(location, 'piso') ||
                      this.getObjectFieldIgnoreCase(location, 'Piso');
    const pisoValue = (pisoField ?? '').toString().trim();
    if (pisoValue.length === 0) {
      return 'Piso desconocido';
    }
    return pisoValue;
  }

  private getLocationBuildingText(location: any): string {
    const edificioField = this.getObjectFieldIgnoreCase(location, '_edificioNombre') ||
                         this.getObjectFieldIgnoreCase(location, 'edificio') ||
                         this.getObjectFieldIgnoreCase(location, 'building') ||
                         this.getObjectFieldIgnoreCase(location, '_edificioId');
    const edificioValue = (edificioField ?? '').toString().trim();
    return edificioValue.length > 0 ? edificioValue : 'Edificio desconocido';
  }

  private getLocationSearchValues(location: any): string[] {
    const candidates: string[] = [];
    const name = this.extractLocationName(location);
    if (name) {
      candidates.push(name);
    }

    const extraFields = [
      this.getObjectFieldIgnoreCase(location, 'Nombre'),
      this.getObjectFieldIgnoreCase(location, 'nombre'),
      this.getObjectFieldIgnoreCase(location, 'name'),
      this.getObjectFieldIgnoreCase(location, 'DisplayName'),
      this.getObjectFieldIgnoreCase(location, 'displayName'),
      this.getObjectFieldIgnoreCase(location, 'title'),
      this.getObjectFieldIgnoreCase(location, 'titulo'),
      this.getObjectFieldIgnoreCase(location, 'id'),
      this.getObjectFieldIgnoreCase(location, '_id'),
      this.getObjectFieldIgnoreCase(location, '_edificioNombre'),
      this.getObjectFieldIgnoreCase(location, 'edificio')
    ];

    for (const field of extraFields) {
      if (field && typeof field === 'string') {
        candidates.push(field.trim());
      }
    }

    for (const value of Object.values(location || {})) {
      if (typeof value === 'string') {
        candidates.push(value.trim());
      }
    }

    return Array.from(new Set(candidates.filter(v => v.length > 0)));
  }

  private async searchDestination(destination: string): Promise<void> {
    const locations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
    const normalizedSearch = this.normalizeText(destination);
    const targetBuilding = this.currentBuilding;

    const matches = locations.filter((loc: any) => {
      const searchValues = this.getLocationSearchValues(loc).map(v => this.normalizeText(v));
      return searchValues.some(value =>
        value === normalizedSearch ||
        value.includes(normalizedSearch) ||
        normalizedSearch.includes(value)
      );
    });

    const preferred = matches.find((loc: any) => this.matchLocationBuilding(loc, targetBuilding));
    const location = preferred || matches[0] || null;

    const coordinate = this.extractCoordinateFromLocation(location);
    this.clearPath();
    this.clearMarkers();

    if (coordinate) {
      const locationBuilding = this.getLocationBuildingText(location);
      const locationFloor = this.getLocationFloor(location);
      const coordsText = `Coordenadas 3D: (${coordinate.x.toFixed(2)}, ${coordinate.y.toFixed(2)}, ${coordinate.z.toFixed(2)})`;
      this.destinationCoordinatesText = `${destination} — ${locationBuilding} / ${locationFloor}: ${coordsText}`;
      this.showDestinationMarker(coordinate);
      const ruta = await this.buildRoute(coordinate, locationFloor);
      this.drawRoute(ruta);
      return;
    }

    this.destinationCoordinatesText = `No se encontró la locación '${destination}'.`;
    console.warn(`No se encontró coordenada para destino: ${destination}`);
  }

  private showDestinationMarker(coordinate: BABYLON.Vector3): void {
    if (!this.scene) return;
    this.clearDestinationMarker();

    try {
      const marker = BABYLON.MeshBuilder.CreateSphere('destinationMarker', { diameter: 0.35 }, this.scene);
      marker.position = coordinate.clone();
      marker.isPickable = false;
      marker.renderingGroupId = 1;

      const material = new BABYLON.StandardMaterial('destinationMarkerMat', this.scene);
      material.diffuseColor = new BABYLON.Color3(0.05, 0.75, 0.95);
      material.emissiveColor = new BABYLON.Color3(0.2, 0.95, 1);
      material.alpha = 0.9;
      marker.material = material;

      this.destinationMarker = marker;
    } catch (error) {
      console.warn('No se pudo crear el marcador de destino:', error);
    }
  }

  private extractCoordinateFromLocation(location: any): BABYLON.Vector3 | null {
    if (!location) return null;

    const coord = this.getObjectFieldIgnoreCase(location, 'Coordenadas3D') ||
                  this.getObjectFieldIgnoreCase(location, 'Coordenadas 3D') ||
                  this.getObjectFieldIgnoreCase(location, 'Coordenadas') ||
                  this.getObjectFieldIgnoreCase(location, 'coordenadas') ||
                  this.getObjectFieldIgnoreCase(location, 'coordinates') ||
                  this.getObjectFieldIgnoreCase(location, 'coords') ||
                  this.getObjectFieldIgnoreCase(location, 'coordenada');

    if (Array.isArray(coord) && coord.length >= 3 && coord.every((v: any) => typeof v === 'number')) {
      return new BABYLON.Vector3(coord[0], coord[1], coord[2]);
    }

    if (coord && typeof coord === 'object') {
      const x = this.getObjectFieldIgnoreCase(coord, 'x');
      const y = this.getObjectFieldIgnoreCase(coord, 'y');
      const z = this.getObjectFieldIgnoreCase(coord, 'z');
      if (x != null && y != null && z != null && [x, y, z].every((v: any) => typeof v === 'number')) {
        return new BABYLON.Vector3(x, y, z);
      }
    }

    const x = this.getObjectFieldIgnoreCase(location, 'x');
    const y = this.getObjectFieldIgnoreCase(location, 'y');
    const z = this.getObjectFieldIgnoreCase(location, 'z');
    if (x != null && y != null && z != null && [x, y, z].every((v: any) => typeof v === 'number')) {
      return new BABYLON.Vector3(x, y, z);
    }

    return null;
  }

  private async loadLocationOptions(): Promise<void> {
    try {
      const locations = await this.firebaseService.getLocacionesDeTodosLosEdificios();
      const options = locations
        .map((loc: any) => this.extractLocationName(loc))
        .filter((name: string) => name.length > 0);

      this.destinationOptions = Array.from(new Set(options));
      this.filteredDestinations = [...this.destinationOptions];
      this.handleSearchInput(this.searchQuery);
      this.cd.detectChanges();
    } catch (error) {
      console.error('No se pudieron cargar las locaciones desde Firebase:', error);
    }
  }

  private updateSceneAppearance(): void {
    if (!this.scene) return;
    if (this.isTopDownView) {
      this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.08, 1);
      this.scene.environmentIntensity = 0.25;
    } else {
      this.scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);
      this.scene.environmentIntensity = 0.15;
    }
  }

  private canZoomOut(): boolean {
    if (!this.camera) return false;
    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      return this.orthoSize < this.defaultOrthoSize;
    }
    const upper = this.camera.upperRadiusLimit ?? 500;
    return this.camera.radius < upper;
  }

  private updateZoomButtons(): void {
    this.zoomOutEnabled = this.canZoomOut();
  }

  zoomIn(): void {
    if (!this.camera) return;

    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.max(4, this.orthoSize * 0.85);
      this.updateOrthoCamera();
    } else {
      const newRadius = this.camera.radius * 0.85;
      this.camera.radius = Math.max(newRadius, this.camera.lowerRadiusLimit ?? 1);
    }
    this.updateZoomButtons();
  }

  zoomOut(): void {
    if (!this.camera) return;

    if (!this.zoomOutEnabled) {
      return;
    }

    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
      this.orthoSize = Math.min(this.defaultOrthoSize, this.orthoSize * 1.15);
      this.updateOrthoCamera();
    } else {
      const newRadius = this.camera.radius * 1.15;
      this.camera.radius = Math.min(newRadius, this.camera.upperRadiusLimit ?? 500);
    }
    this.updateZoomButtons();
  }

  get floorActionLabel(): string {
    // Edificio A
    if (this.currentBuilding === 'A') {
      if (this.currentFloor === this.secondFloorModel) {
        return 'Ir al primer piso';
      }
      if (this.currentFloor === this.thirdFloorModel) {
        return 'Ir al segundo piso';
      }
    }
    // Edificio B
    if (this.currentBuilding === 'B') {
      if (this.currentFloor === this.buildingBSecondFloorModel) {
        return 'Ir al primer piso';
      }
      if (this.currentFloor === this.buildingBThirdFloorModel) {
        return 'Ir al segundo piso';
      }
    }
    return 'Ir al segundo piso';
  }

  get floorActionIcon(): string {
    const isFirstFloor = (this.currentBuilding === 'A' && this.currentFloor === this.firstFloorModel) ||
                         (this.currentBuilding === 'B' && this.currentFloor === this.buildingBFirstFloorModel);
    return isFirstFloor ? '↑' : '↓';
  }

  openFloorDialog(): void {
    this.floorDialogVisible = true;
  }

  selectFloor(floor: 'first' | 'second' | 'third'): void {
    this.floorDialogVisible = false;
    let targetFloor: string;

    if (this.currentBuilding === 'A') {
      targetFloor = floor === 'first'
        ? this.firstFloorModel
        : floor === 'second'
          ? this.secondFloorModel
          : this.thirdFloorModel;
    } else {
      targetFloor = floor === 'first'
        ? this.buildingBFirstFloorModel
        : floor === 'second'
          ? this.buildingBSecondFloorModel
          : this.buildingBThirdFloorModel;
    }

    if (this.currentFloor !== targetFloor) {
      this.currentFloor = targetFloor;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  closeFloorDialog(): void {
    this.floorDialogVisible = false;
  }

  private handleBuildingBMarkerClick(): void {
    if (this.currentFloor === this.secondFloorModel) {
      this.goToBuildingBSecondFloor();
    } else if (this.currentFloor === this.thirdFloorModel) {
      this.goToBuildingBThirdFloor();
    } else {
      this.goToBuildingBFirstFloor();
    }
  }

  public isFloorSelectionTrigger(meshName: string | null | undefined): boolean {
    const normalizedMeshName = meshName?.replace(/\s+/g, '').toLowerCase();
    if (!normalizedMeshName) {
      return false;
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.firstFloorModel) {
      return ['cuerpo21', 'cuerpo14'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.secondFloorModel) {
      return ['cuerpo23', 'cuerpo26', 'cuerpo8', 'cuerpo25', 'cuerpo30'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'A' && this.currentFloor === this.thirdFloorModel) {
      return ['cuerpo6', 'cuerpo45', 'cuerpo26', 'cuerpo39'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'B' && this.currentFloor === this.buildingBSecondFloorModel) {
      return ['cuerpo9'].includes(normalizedMeshName);
    }

    if (this.currentBuilding === 'B' && this.currentFloor === this.buildingBFirstFloorModel) {
      return ['cuerpo0'].includes(normalizedMeshName);
    }

    return false;
  }

  private goToBuildingBFirstFloor(): void {
    this.currentBuilding = 'B';
    if (this.currentFloor !== this.buildingBFirstFloorModel) {
      this.currentFloor = this.buildingBFirstFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private goToBuildingBSecondFloor(): void {
    this.currentBuilding = 'B';
    if (this.currentFloor !== this.buildingBSecondFloorModel) {
      this.currentFloor = this.buildingBSecondFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private goToBuildingBThirdFloor(): void {
    this.currentBuilding = 'B';
    if (this.currentFloor !== this.buildingBThirdFloorModel) {
      this.currentFloor = this.buildingBThirdFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private goToBuildingAFirstFloor(): void {
    this.currentBuilding = 'A';
    if (this.currentFloor !== this.firstFloorModel) {
      this.currentFloor = this.firstFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private goToBuildingASecondFloor(): void {
    this.currentBuilding = 'A';
    if (this.currentFloor !== this.secondFloorModel) {
      this.currentFloor = this.secondFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private goToBuildingAThirdFloor(): void {
    this.currentBuilding = 'A';
    if (this.currentFloor !== this.thirdFloorModel) {
      this.currentFloor = this.thirdFloorModel;
      if (this.viewMode === '3d') {
        this.init3dScene();
      }
    }

    if (this.viewMode !== '3d') {
      this.setView('3d');
    }
  }

  private handleBuildingAMarkerClick(): void {
    if (this.currentFloor === this.buildingBThirdFloorModel) {
      this.goToBuildingAThirdFloor();
    } else if (this.currentFloor === this.buildingBSecondFloorModel) {
      this.goToBuildingASecondFloor();
    } else {
      this.goToBuildingAFirstFloor();
    }
  }

  public getBuildingATransitionMarkerState(): { label: string; position: { x: number; y: number; z: number } } | null {
    if (this.currentBuilding !== 'B') {
      return null;
    }

    if (this.currentFloor === this.buildingBThirdFloorModel) {
      return {
        label: 'Ir al Edificio A - Piso 3',
        position: { x: -0.49, y: 0.01, z: -11.40 }
      };
    }

    if (this.currentFloor === this.buildingBSecondFloorModel) {
      return {
        label: 'Ir al Edificio A - Piso 2',
        position: { x: -4.43, y: 0.01, z: -3.25 }
      };
    }

    if (this.currentFloor === this.buildingBFirstFloorModel) {
      return {
        label: 'Ir al mapa principal',
        position: { x: 12.18, y: 0.01, z: -0.23 }
      };
    }

    return null;
  }

  changeFloor(floor: string): void {
    this.currentFloor = floor;
    if (this.viewMode === '3d') this.init3dScene();
  }

  private init3dScene(): void {
    this.dispose3d();

    const canvasContainer = this.renderCanvasContainer?.nativeElement;
    if (!canvasContainer) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'babylon-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Evitar que la rueda del ratón haga scroll en la página, y usarla para hacer zoom real (orthoSize)
    canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.zoomIn();
      } else if (e.deltaY > 0) {
        this.zoomOut();
      }
    }, { passive: false });

    canvasContainer.innerHTML = '';
    canvasContainer.appendChild(canvas);

    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.1, 1);

    // Resetear orthoSize al inicializar escena
    this.orthoSize = this.defaultOrthoSize;

    const initialAlpha = this.isTopDownView ? -Math.PI / 2 : -Math.PI / 3;
    const initialBeta = this.isTopDownView ? 0.12 : Math.PI / 5;
    // iniciar un 30% más cerca para una vista inicial más próxima
    const initialRadius = (this.isTopDownView ? 30 : 28) * 0.7;

    this.camera = new BABYLON.ArcRotateCamera('camera', initialAlpha, initialBeta, initialRadius, BABYLON.Vector3.Zero(), this.scene);
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.attachControl(canvas, false, false);
    this.camera.wheelDeltaPercentage = 0.01;
    // permitir acercarse más (valor mínimo reducido) para respetar el zoom inicial
    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 150;
    this.camera.panningSensibility = 50;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new BABYLON.Vector3(0.75, 0.75, 0.75);
    this.camera.setTarget(BABYLON.Vector3.Zero());

    if (this.isTopDownView) {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
      this.camera.lowerAlphaLimit = this.camera.upperAlphaLimit = this.camera.alpha;
      this.camera.lowerBetaLimit = this.camera.upperBetaLimit = this.camera.beta;
    } else {
      this.camera.panningAxis = new BABYLON.Vector3(1, 0, 0);
      // límites más estrictos para evitar que la cámara mire por debajo del suelo
      this.camera.lowerBetaLimit = 0.05;
      this.camera.upperBetaLimit = Math.PI / 2 - 0.05;
    }

    // Permitir movimiento horizontal en X solo cuando se haya hecho zoom suficiente (>=30%)
    const fixedCameraY = 0;
    const maxPanX = 5;
    const minPanX = -5;
    const orthoMin = 2; // tamaño ortho más cercano (zoom máximo)
    const orthoMax = 60; // tamaño ortho más lejano (zoom mínimo)
    const topDownMinX = this.topDownPanLimits.minX;
    const topDownMaxX = this.topDownPanLimits.maxX;
    const topDownMinZ = this.topDownPanLimits.minZ;
    const topDownMaxZ = this.topDownPanLimits.maxZ;

    if (this.scene) {
      this.cameraBeforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
        const camera = this.camera;
        if (!camera) return;
        try {
          const target = camera.target;
          let modified = false;
          const newTarget = target.clone();

          // Mantener Y fijo siempre
          if (newTarget.y !== fixedCameraY) {
            newTarget.y = fixedCameraY;
            modified = true;
          }

          // Determinar si se permite paneo horizontal según el nivel de zoom
          let allowPan = false;
          if (camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA) {
            const clamped = Math.min(Math.max(this.orthoSize, orthoMin), orthoMax);
            const zoomPercent = (orthoMax - clamped) / (orthoMax - orthoMin); // 0..1
            allowPan = zoomPercent >= 0.3; // permitir paneo a partir de 30% de zoom
          } else {
            const lower = camera.lowerRadiusLimit ?? 1;
            const upper = camera.upperRadiusLimit ?? 100;
            const clampedRad = Math.min(Math.max(camera.radius, lower), upper);
            const zoomPercent = (upper - clampedRad) / Math.max(upper - lower, 1);
            allowPan = zoomPercent >= 0.3;
          }

          if (this.isTopDownView) {
            if (newTarget.x > topDownMaxX) {
              newTarget.x = topDownMaxX;
              modified = true;
            } else if (newTarget.x < topDownMinX) {
              newTarget.x = topDownMinX;
              modified = true;
            }
            if (newTarget.z > topDownMaxZ) {
              newTarget.z = topDownMaxZ;
              modified = true;
            } else if (newTarget.z < topDownMinZ) {
              newTarget.z = topDownMinZ;
              modified = true;
            }
          } else {
            if (!allowPan) {
              // si no está permitido paneo, centrar X en 0
              if (newTarget.x !== 0) {
                newTarget.x = 0;
                modified = true;
              }
            } else {
              // limitar paneo horizontal dentro de rangos
              if (newTarget.x > maxPanX) {
                newTarget.x = maxPanX;
                modified = true;
              } else if (newTarget.x < minPanX) {
                newTarget.x = minPanX;
                modified = true;
              }
            }
          }

          if (modified) {
            camera.setTarget(newTarget);
          }

          // Evitar que la cámara cruce por debajo del eje de suelo al rotar.
          // Calculamos la altura Y de la cámara a partir del target, radius y beta
          try {
            const minCameraY = 1.5; // distancia mínima segura sobre el suelo (ajustada)
            const camTarget = camera.target;
            const camRadius = camera.radius || 1;
            const camBeta = camera.beta || 0.001;
            const camY = camTarget.y + camRadius * Math.cos(camBeta);

            if (camY < minCameraY) {
              // calcular beta máximo que mantiene camY >= minCameraY
              const ratio = (minCameraY - camTarget.y) / Math.max(0.0001, camRadius);
              const clampedRatio = Math.min(1, Math.max(-1, ratio));
              const allowedBeta = Math.acos(clampedRatio);
              // dejar un pequeño margen para evitar oscilaciones
              const safeAllowedBeta = Math.max(0.05, allowedBeta - 0.03);
              // limitar beta para que la cámara no mire tan bajo
              camera.upperBetaLimit = Math.min(camera.upperBetaLimit ?? Math.PI / 2 - 0.001, safeAllowedBeta);
              const lowerB = camera.lowerBetaLimit ?? 0.01;
              camera.beta = Math.min(Math.max(camera.beta, lowerB), camera.upperBetaLimit);

              // si tras limitar beta la cámara aún queda por debajo, ajustar radius como último recurso
              const camYAfter = camTarget.y + (camera.radius || camRadius) * Math.cos(camera.beta || camBeta);
              if (camYAfter < minCameraY) {
                const neededRadius = Math.abs((minCameraY - camTarget.y) / Math.max(0.0001, Math.cos(camera.beta || camBeta)));
                camera.radius = Math.max(camera.radius || camRadius, neededRadius, this.camera?.lowerRadiusLimit ?? 1);
              }
            }
          } catch (err) {
            // ignore
          }
        } catch (e) {
          // ignore
        }
      });
    }

    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.45;
    light.diffuse = new BABYLON.Color3(0.65, 0.65, 0.7);
    light.groundColor = new BABYLON.Color3(0.06, 0.06, 0.07);

    const directionalLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-0.5, -1, -0.5), this.scene);
    directionalLight.position = new BABYLON.Vector3(8, 10, 8);
    directionalLight.intensity = 0.8;
    directionalLight.diffuse = new BABYLON.Color3(0.85, 0.85, 0.85);
    directionalLight.specular = new BABYLON.Color3(0.03, 0.03, 0.03);
    directionalLight.shadowEnabled = false;

    this.scene.ambientColor = new BABYLON.Color3(0.01, 0.01, 0.01);
    this.scene.environmentIntensity = 0.04;
    this.scene.imageProcessingConfiguration.contrast = 1.3;
    this.scene.imageProcessingConfiguration.exposure = 0.55;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = false;

    this.createGround();
    this.updateOrthoCamera();
    this.updateZoomButtons();
    this.load3dModel(canvas);

    this.renderLoopFn = () => {
      if (this.scene && this.camera) {
        // Mantener la cámara siempre centrada en el modelo mientras rote
        try {
          if (this.modelRoot) {
            this.camera.setTarget(this.modelRoot.position.clone());
          }
        } catch (e) {
          // ignore
        }

        this.scene.render();
        this.updateBuildingBMarkerPosition(canvas);
      }
    };

    this.engine.runRenderLoop(this.renderLoopFn);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('click', this.onDocumentClick, true);
  }

  private onResize = (): void => {
    if (this.engine) {
      this.engine.resize();
      this.updateOrthoCamera();
    }
  };

  private dispose3d(): void {
    if (this.engine) {
      window.removeEventListener('resize', this.onResize);
      document.removeEventListener('click', this.onDocumentClick, true);
      // remove scene observer if any
      if (this.scene && this.cameraBeforeRenderObserver) {
        try { this.scene.onBeforeRenderObservable.remove(this.cameraBeforeRenderObserver); } catch {}
        this.cameraBeforeRenderObserver = null;
      }
      this.engine.stopRenderLoop();
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    } else {
      document.removeEventListener('click', this.onDocumentClick, true);
    }
    if (this.renderCanvasContainer?.nativeElement) {
      this.renderCanvasContainer.nativeElement.innerHTML = '';
    }
  }

  private updateOrthoCamera(): void {
    if (!this.camera || !this.engine || this.camera.mode !== BABYLON.Camera.ORTHOGRAPHIC_CAMERA) return;
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const aspect = width / Math.max(height, 1);
    const scale = this.orthoSize;
    this.camera.orthoTop = scale;
    this.camera.orthoBottom = -scale;
    this.camera.orthoRight = scale * aspect;
    this.camera.orthoLeft = -scale * aspect;
  }

  private async load3dModel(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.scene) return;

    const modelName = this.currentFloor;
    const isBuildingB = [this.buildingBFirstFloorModel, this.buildingBSecondFloorModel, this.buildingBThirdFloorModel].includes(modelName);
    const modelRoot = isBuildingB
      ? '/assets/3d-models/Edificio B/'
      : '/assets/3d-models/Edificio A/';

    // Actualizar el edificio actual
    this.currentBuilding = isBuildingB ? 'B' : 'A';

    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        encodeURI(modelRoot),
        encodeURI(modelName),
        this.scene
      );

      const meshes = result.meshes;
      if (meshes.length === 0) return;

      const allNodes = new BABYLON.TransformNode('modelRoot', this.scene);
      // guardar referencia para centrar la cámara mientras el modelo rote
      this.modelRoot = allNodes;
      // Rotar el objeto 180° en Y al cargar (mantener rotación X para orientación)
      allNodes.rotation = new BABYLON.Vector3(-Math.PI / 2, Math.PI, 0);

      meshes.forEach((mesh, index) => {
        mesh.isVisible = true;
        mesh.parent = allNodes;
        if (!mesh.material) {
          const defaultMat = new BABYLON.StandardMaterial(`mat_${index}`, this.scene!);
          defaultMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
          mesh.material = defaultMat;
        }
      });

      this.scene.render();

      const bounds = allNodes.getHierarchyBoundingVectors(true);
      const size = BABYLON.Vector3.Distance(bounds.min, bounds.max);
      const targetSize = 25;

      if (size > 0) {
        const scale = targetSize / size;
        allNodes.scaling = new BABYLON.Vector3(scale, scale, scale);
        this.scene.render();

        const scaledBounds = allNodes.getHierarchyBoundingVectors(true);
        const centerX = (scaledBounds.min.x + scaledBounds.max.x) / 2;
        const centerZ = (scaledBounds.min.z + scaledBounds.max.z) / 2;
        allNodes.position.x = -centerX;
        allNodes.position.y = -scaledBounds.min.y;
        allNodes.position.z = -centerZ;

        if (this.camera) {
          this.camera.setTarget(allNodes.position.clone());
          // Actualizar la vista ortográfica después de posicionar el modelo
          this.updateOrthoCamera();
        }
      }

      this.scene.render();

      // Asegurar colisiones entre cámara/texto y los cuerpos visibles
      meshes.forEach((mesh) => {
        if (mesh instanceof BABYLON.AbstractMesh) {
          mesh.checkCollisions = true;
          mesh.isPickable = true;

          const material: any = mesh.material;
          if (material) {
            material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            if ('specularColor' in material) {
              material.specularColor = new BABYLON.Color3(0.03, 0.03, 0.03);
            }
            if ('ambientColor' in material) {
              material.ambientColor = new BABYLON.Color3(0.04, 0.04, 0.04);
            }
            if ('metallic' in material) {
              material.metallic = 0;
            }
            if ('roughness' in material) {
              material.roughness = Math.min(1, Math.max(material.roughness ?? 1, 0.85));
            }
            if ('specularPower' in material) {
              material.specularPower = 8;
            }
          }
        }
      });

      // ── Nombres de los cuerpos en consola ─────────────────
      console.log('==== NOMBRES DE CUERPOS ====');
      meshes.forEach((mesh) => console.log('CUERPO:', mesh.name));




      // ── Click — detectar clic en cuerpo o suelo y imprimir coordenadas ──
      canvas.addEventListener('click', (evt) => {
        if (!this.scene) return;

        const rect = canvas.getBoundingClientRect();
        const pickX = evt.clientX - rect.left;
        const pickY = evt.clientY - rect.top;

        const hits = this.scene.multiPick(pickX, pickY);
        let pickResult: any = null;

        if (hits && hits.length > 0) {
          const objectHit = hits.find(hit => hit.hit && hit.pickedMesh && !this.boundaryNameRegExp.test(hit.pickedMesh.name || ''));
          const fallbackHit = hits.find(hit => hit.hit && hit.pickedMesh);
          pickResult = objectHit || fallbackHit;
        }

        if (pickResult?.hit) {
          const meshName = pickResult.pickedMesh ? pickResult.pickedMesh.name || 'cuerpo' : 'suelo';
          const normalizedMeshName = (meshName || '').replace(/\s+/g, '').toLowerCase();
          const isFloorTrigger = pickResult.pickedMesh && this.isFloorSelectionTrigger(pickResult.pickedMesh.name);
          const excludedFirstFloorDetailBodies = ['cuerpo14', 'cuerpo21', 'cuerpo19', 'cuerpo25', 'cuerpo45'];
          const excludedSecondFloorDetailBodies = ['cuerpo23', 'cuerpo8', 'cuerpo25', 'cuerpo30', 'cuerpo41'];
          const excludedBuildingBFirstFloorDetailBodies = ['cuerpo0'];
          const excludedBuildingBSecondFloorDetailBodies = ['cuerpo0'];
          const excludedBuildingBThirdFloorDetailBodies = ['cuerpo0'];
          const isFirstFloorBodyDetailTrigger = (this.currentFloor === this.firstFloorModel || this.currentFloor === this.buildingBFirstFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !excludedFirstFloorDetailBodies.includes(normalizedMeshName)
            && !(this.currentFloor === this.buildingBFirstFloorModel && excludedBuildingBFirstFloorDetailBodies.includes(normalizedMeshName));
          const isSecondFloorBodyDetailTrigger = (this.currentFloor === this.secondFloorModel || this.currentFloor === this.buildingBSecondFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !excludedSecondFloorDetailBodies.includes(normalizedMeshName)
            && !(this.currentFloor === this.buildingBSecondFloorModel && excludedBuildingBSecondFloorDetailBodies.includes(normalizedMeshName));
          const isThirdFloorBodyDetailTrigger = (this.currentFloor === this.thirdFloorModel || this.currentFloor === this.buildingBThirdFloorModel)
            && /^cuerpo/i.test(normalizedMeshName)
            && !(this.currentFloor === this.buildingBThirdFloorModel && excludedBuildingBThirdFloorDetailBodies.includes(normalizedMeshName));

          if (isFirstFloorBodyDetailTrigger) {
            this.closeFloorDialog();
            this.openDetailPanel(
              this.formatBodyPanelTitle(normalizedMeshName),
              `<div class="detail-panel__body-content">
                <p class="detail-panel__eyebrow">Piso 1 · Acceso</p>
                <p class="detail-panel__text">Este espacio puede mostrar información, indicaciones o accesos rápidos para ${this.formatBodyPanelTitle(normalizedMeshName)}.</p>
              </div>`
            );
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else if (isSecondFloorBodyDetailTrigger) {
            this.closeFloorDialog();
            this.openDetailPanel(
              this.formatBodyPanelTitle(normalizedMeshName),
              `<div class="detail-panel__body-content">
                <p class="detail-panel__eyebrow">Piso 2 · Acceso</p>
                <p class="detail-panel__text">Este espacio puede mostrar información, indicaciones o accesos rápidos para ${this.formatBodyPanelTitle(normalizedMeshName)}.</p>
              </div>`
            );
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else if (isThirdFloorBodyDetailTrigger) {
            this.closeFloorDialog();
            this.openDetailPanel(
              this.formatBodyPanelTitle(normalizedMeshName),
              `<div class="detail-panel__body-content">
                <p class="detail-panel__eyebrow">Piso 3 · Acceso</p>
                <p class="detail-panel__text">Este espacio puede mostrar información, indicaciones o accesos rápidos para ${this.formatBodyPanelTitle(normalizedMeshName)}.</p>
              </div>`
            );
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else if (isFloorTrigger) {
            this.openFloorDialog();
            if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          } else {
            this.closeFloorDialog();

            // ── Mostrar infoBox si hay info para el mesh clicado ──
            if (pickResult.pickedMesh && this.infoBox) {
              const info = this.infoData[pickResult.pickedMesh.name];
              if (info) {
                this.infoBox.innerHTML = `
                  <p style="font-weight:bold;font-size:14px;margin:0 0 4px">${info.nombre}</p>
                  <p style="font-size:12px;color:#555;margin:0">${info.desc}</p>
                `;
                this.infoBox.style.display = 'block';
                this.infoBox.style.left = (evt.clientX + 15) + 'px';
                this.infoBox.style.top  = (evt.clientY + 15) + 'px';
              } else {
                this.infoBox.style.display = 'none';
              }
            } else if (this.infoBox) {
              this.infoBox.style.display = 'none';
            }
          }

          // --- DEMO: seleccionar punto A y punto B con dos clics para dibujar ruta ---
        }
      });

    } catch (error) {
      console.error('No se pudo cargar el modelo 3D:', error);
    }
  }

  private createGround(): void {
    if (!this.scene) return;

    const farSize = 220;
    const wallHeight = 16;
    const wallDepth = 0.5;

    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: farSize, height: farSize }, this.scene);
    ground.position.y = 0.01;
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.38, 0.38, 0.38);
    groundMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    groundMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    groundMat.alpha = 1;
    groundMat.backFaceCulling = true;
    ground.material = groundMat;
    ground.checkCollisions = true;
    ground.isPickable = true;

    const wallMat = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
    wallMat.alpha = 0;
    wallMat.backFaceCulling = false;

    const createWall = (name: string, width: number, height: number): BABYLON.Mesh => {
      const wall = BABYLON.MeshBuilder.CreatePlane(name, { width, height }, this.scene!);
      wall.material = wallMat;
      wall.checkCollisions = true;
      wall.isPickable = true;
      return wall;
    };

    const wallDistance = farSize / 2;
    const northWall = createWall('northWall', farSize, wallHeight);
    northWall.position = new BABYLON.Vector3(0, wallHeight / 2, -wallDistance);

    const southWall = createWall('southWall', farSize, wallHeight);
    southWall.position = new BABYLON.Vector3(0, wallHeight / 2, wallDistance);
    southWall.rotation = new BABYLON.Vector3(0, Math.PI, 0);

    const eastWall = createWall('eastWall', farSize, wallHeight);
    eastWall.position = new BABYLON.Vector3(wallDistance, wallHeight / 2, 0);
    eastWall.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);

    const westWall = createWall('westWall', farSize, wallHeight);
    westWall.position = new BABYLON.Vector3(-wallDistance, wallHeight / 2, 0);
    westWall.rotation = new BABYLON.Vector3(0, -Math.PI / 2, 0);
  }

  // ── Gestión de ruta y limpieza de trazados ─────────────────
  private pathMeshes: BABYLON.AbstractMesh[] = [];

  /** Limpia/descarta la ruta y las flechas dibujadas */
  public clearPath(): void {
    if (!this.scene) return;
    while (this.pathMeshes.length > 0) {
      const m = this.pathMeshes.pop();
      try { m && m.dispose(); } catch (_) { /* ignore */ }
    }
  }

  // --- Utilities para demo de selección y marcadores ---
  private clearDestinationMarker(): void {
    if (!this.scene || !this.destinationMarker) return;

    try {
      this.destinationMarker.dispose();
    } catch (_) {
      // ignore disposal errors
    }

    this.destinationMarker = null;
  }

  private clearMarkers(): void {
    this.clearDestinationMarker();
  }

  private updateBuildingBMarkerPosition(canvas: HTMLCanvasElement): void {
    if (!this.scene || !this.camera || !this.engine) return;

    // Actualizar marcador de Edificio B (desde Edificio A)
    this.updateBuildingBMarkerVisibility(canvas);
    
    // Actualizar marcador de Edificio A (desde Edificio B)
    this.updateBuildingAMarkerVisibility(canvas);
    // Actualizar cartel de mapa principal en Edificio A piso 1
    this.updateMainMapMarkerVisibility(canvas);
  }

  private updateBuildingBMarkerVisibility(canvas: HTMLCanvasElement): void {
    if (!this.buildingBMarker || !this.scene || !this.camera || !this.engine) return;

    // El marcador solo aparece en el Edificio A, en los pisos 1, 2 y 3
    const isInBuildingA = this.currentBuilding === 'A';
    const isRelevantFloor = this.currentFloor === this.firstFloorModel || 
                            this.currentFloor === this.secondFloorModel || 
                            this.currentFloor === this.thirdFloorModel;

    if (!isInBuildingA || !isRelevantFloor || this.viewMode !== '3d') {
      this.buildingBMarker.style.display = 'none';
      return;
    }

    // Actualizar el texto del marcador según el piso
    if (this.currentFloor === this.firstFloorModel) {
      this.buildingBMarker.innerHTML = '→ Ir al Edificio B - Piso 1';
    } else if (this.currentFloor === this.secondFloorModel) {
      this.buildingBMarker.innerHTML = '→ Ir al Edificio B - Piso 2';
    } else if (this.currentFloor === this.thirdFloorModel) {
      this.buildingBMarker.innerHTML = '→ Ir al Edificio B - Piso 3';
    }

    const markerWorldPos = new BABYLON.Vector3(11.07, 0.05, 1.13);

    try {
      // Obtener las matrices necesarias
      const viewMatrix = this.camera.getViewMatrix();
      const projectionMatrix = this.camera.getProjectionMatrix();
      
      // Crear matriz de transformación combinada (view * projection)
      const transformMatrix = viewMatrix.multiply(projectionMatrix);

      // Proyectar el punto 3D a coordenadas de pantalla
      const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());
      const screenCoords = BABYLON.Vector3.Project(
        markerWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      // Verificar si el punto está dentro de la pantalla (z > 0 significa está adelante de la cámara)
      if (screenCoords.z > 0 && screenCoords.z < 1 &&
          screenCoords.x > 0 && screenCoords.x < this.engine.getRenderWidth() &&
          screenCoords.y > 0 && screenCoords.y < this.engine.getRenderHeight()) {
        this.buildingBMarker.style.display = 'block';
        this.buildingBMarker.style.left = (screenCoords.x - 60) + 'px'; // Centrar horizontalmente
        this.buildingBMarker.style.top = (screenCoords.y - 30) + 'px';  // Posicionar arriba del marcador
      } else {
        this.buildingBMarker.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error actualizando posición del marcador de Edificio B:', error);
      this.buildingBMarker.style.display = 'none';
    }
  }

  private updateBuildingAMarkerVisibility(canvas: HTMLCanvasElement): void {
    if (!this.buildingAMarker || !this.scene || !this.camera || !this.engine) return;

    const markerState = this.getBuildingATransitionMarkerState();
    const isInBuildingB = this.currentBuilding === 'B' && markerState !== null;

    if (!isInBuildingB || this.viewMode !== '3d') {
      this.buildingAMarker.style.display = 'none';
      return;
    }

    this.buildingAMarker.innerHTML = `→ ${markerState.label}`;

    const markerWorldPos = new BABYLON.Vector3(markerState.position.x, markerState.position.y, markerState.position.z);

    try {
      // Obtener las matrices necesarias
      const viewMatrix = this.camera.getViewMatrix();
      const projectionMatrix = this.camera.getProjectionMatrix();
      
      // Crear matriz de transformación combinada (view * projection)
      const transformMatrix = viewMatrix.multiply(projectionMatrix);

      // Proyectar el punto 3D a coordenadas de pantalla
      const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());
      const screenCoords = BABYLON.Vector3.Project(
        markerWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      // Verificar si el punto está dentro de la pantalla (z > 0 significa está adelante de la cámara)
      if (screenCoords.z > 0 && screenCoords.z < 1 &&
          screenCoords.x > 0 && screenCoords.x < this.engine.getRenderWidth() &&
          screenCoords.y > 0 && screenCoords.y < this.engine.getRenderHeight()) {
        this.buildingAMarker.style.display = 'block';
        this.buildingAMarker.style.left = (screenCoords.x - 60) + 'px'; // Centrar horizontalmente
        this.buildingAMarker.style.top = (screenCoords.y - 30) + 'px';  // Posicionar arriba del marcador
      } else {
        this.buildingAMarker.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error actualizando posición del marcador de Edificio A:', error);
      this.buildingAMarker.style.display = 'none';
    }
  }

  private updateMainMapMarkerVisibility(canvas: HTMLCanvasElement): void {
    if (!this.mainMapMarker || !this.scene || !this.camera || !this.engine) return;

    const isInBuildingAFirstFloor = this.currentBuilding === 'A' && this.currentFloor === this.firstFloorModel;

    if (!isInBuildingAFirstFloor || this.viewMode !== '3d') {
      this.mainMapMarker.style.display = 'none';
      return;
    }

    const markerWorldPos = new BABYLON.Vector3(-9.41, 0.01, -4.88);

    try {
      const viewMatrix = this.camera.getViewMatrix();
      const projectionMatrix = this.camera.getProjectionMatrix();
      const transformMatrix = viewMatrix.multiply(projectionMatrix);
      const viewport = new BABYLON.Viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());
      const screenCoords = BABYLON.Vector3.Project(
        markerWorldPos,
        BABYLON.Matrix.Identity(),
        transformMatrix,
        viewport
      );

      if (screenCoords.z > 0 && screenCoords.z < 1 &&
          screenCoords.x > 0 && screenCoords.x < this.engine.getRenderWidth() &&
          screenCoords.y > 0 && screenCoords.y < this.engine.getRenderHeight()) {
        this.mainMapMarker.style.display = 'block';
        this.mainMapMarker.style.left = (screenCoords.x - 60) + 'px';
        this.mainMapMarker.style.top = (screenCoords.y - 30) + 'px';
      } else {
        this.mainMapMarker.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error actualizando posición del cartel de mapa principal:', error);
      this.mainMapMarker.style.display = 'none';
    }
  }

  toggleMarker(id: string): void {
    const card = document.getElementById(id);
    if (card) {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
  }

  private async buildRoute(destino: { x: number, y: number, z: number }, piso: string): Promise<{ x: number, y: number, z: number }[]> {
    const navPath = await this.firebaseService.getNavigationPath(piso);
    const puntos: { x: number, y: number, z: number }[] = [this.mainEntranceAccess];

    const pathPoints = this.extractNavigationPathCoordinates(navPath);
    if (pathPoints.length > 0) {
      puntos.push(...pathPoints);
    }

    puntos.push(destino);
    return puntos;
  }

  private extractNavigationPathCoordinates(navPath: any): { x: number, y: number, z: number }[] {
    if (!navPath || typeof navPath !== 'object') {
      return [];
    }

    const coordinates: { x: number, y: number, z: number }[] = [];
    const addPoint = (point: any) => {
      const coordinate = this.extractCoordinateFromLocation(point);
      if (coordinate) {
        coordinates.push({ x: coordinate.x, y: coordinate.y, z: coordinate.z });
      }
    };

    const parsePointCandidate = (candidate: any) => {
      if (!candidate || typeof candidate !== 'object') {
        return;
      }

      if (candidate['Coordenadas3D'] || candidate['Coordenadas 3D']) {
        addPoint(candidate['Coordenadas3D'] ?? candidate['Coordenadas 3D']);
        return;
      }

      if (candidate['Coordenadas'] || candidate['coordinates'] || candidate['coords']) {
        addPoint(candidate['Coordenadas'] ?? candidate['coordinates'] ?? candidate['coords']);
        return;
      }

      if (Object.keys(candidate).some(key => /coordenadas?/i.test(key))) {
        addPoint(candidate);
        return;
      }

      Object.values(candidate).forEach(value => addPoint(value));
    };

    if (Array.isArray(navPath.Accesos) || typeof navPath.Accesos === 'object') {
      const accesos = navPath.Accesos;
      if (Array.isArray(accesos)) {
        accesos.forEach((item: any) => parsePointCandidate(item));
      } else {
        Object.values(accesos).forEach((item: any) => parsePointCandidate(item));
      }
    }

    if (Array.isArray(navPath.Conexiones)) {
      navPath.Conexiones.forEach((item: any) => parsePointCandidate(item));
    }

    if (Array.isArray(navPath.Giros)) {
      navPath.Giros.forEach((giro: any) => parsePointCandidate(giro));
    }

    if (Array.isArray(navPath.Turns) || Array.isArray(navPath.turns)) {
      const turns = navPath.Turns ?? navPath.turns;
      turns.forEach((turn: any) => parsePointCandidate(turn));
    }

    if (coordinates.length === 0) {
      for (const key of Object.keys(navPath)) {
        const value = navPath[key];
        if (Array.isArray(value)) {
          value.forEach((item: any) => parsePointCandidate(item));
        } else if (typeof value === 'object') {
          parsePointCandidate(value);
        }
      }
    }

    return coordinates;
  }

  private drawRoute(puntos: { x: number, y: number, z: number }[]): void {
  if (!this.scene) return;
  for (let i = 0; i < puntos.length - 1; i++) {
    const from = new BABYLON.Vector3(puntos[i].x, puntos[i].y, puntos[i].z);
    const to   = new BABYLON.Vector3(puntos[i + 1].x, puntos[i + 1].y, puntos[i + 1].z);
    this.pathMeshes.push(...dibujarFlechaGuia(this.scene, from, to));
  }
}
}