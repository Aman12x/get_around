import './style.css';
import { App } from './ui/app';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (webglAvailable()) {
  const app = new App(root);
  // Handy for poking at the game from the browser console during development.
  if (import.meta.env.DEV) Object.assign(window, { app });
} else {
  root.innerHTML = '<p class="no-webgl">Get Around needs WebGL. Please try a recent version of Chrome, Edge, Firefox or Safari.</p>';
}
