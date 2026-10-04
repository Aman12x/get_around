import * as THREE from 'three';
import { DioramaView } from './diorama';
import { GlobeView } from './globe';

export type ViewName = 'globe' | 'diorama';

/** Owns the single WebGL renderer and switches between the globe and the country diorama. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly globe: GlobeView;
  readonly diorama: DioramaView;
  private view: ViewName = 'globe';
  private timer = new THREE.Timer();

  constructor(canvas: HTMLCanvasElement, labelLayer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.globe = new GlobeView(canvas, labelLayer);
    this.diorama = new DioramaView(canvas);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  get current(): ViewName {
    return this.view;
  }

  setView(v: ViewName): void {
    this.view = v;
    this.globe.setVisible(v === 'globe');
    this.diorama.setActive(v === 'diorama');
    document.body.dataset.view = v;
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.globe.resize(w, h);
    this.diorama.resize(w, h);
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    if (this.view === 'globe') {
      this.globe.update(dt, t);
      this.renderer.render(this.globe.scene, this.globe.camera);
    } else {
      this.diorama.update(dt, t);
      this.renderer.render(this.diorama.scene, this.diorama.camera);
    }
  }
}
