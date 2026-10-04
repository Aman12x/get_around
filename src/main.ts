import './style.css';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (!webglAvailable()) {
  root.innerHTML = '<p class="no-webgl">Get Around needs WebGL. Please try a recent version of Chrome, Edge, Firefox or Safari.</p>';
} else {
  // The 3D engine loads as a separate chunk; the boot screen in index.html shows meanwhile.
  import('./ui/app')
    .then(({ App }) => {
      const app = new App(root);
      // Handy for poking at the game from the browser console during development.
      if (import.meta.env.DEV) Object.assign(window, { app });
    })
    .catch(() => {
      root.innerHTML = '<p class="no-webgl">Couldn’t load the game. Check your connection and refresh.</p>';
    });
}
