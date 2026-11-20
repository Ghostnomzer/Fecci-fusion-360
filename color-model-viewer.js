const viewer = document.querySelector('[data-color-model-viewer]');

if (viewer) {
  const canvas = viewer.querySelector('.material-model-canvas');
  const message = viewer.querySelector('.material-model-loading');

  try {
    const [THREE, { OrbitControls }, { OBJLoader }, { MTLLoader }] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/OBJLoader.js'),
      import('three/addons/loaders/MTLLoader.js')
    ]);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x33333a, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xff8752, 1.1);
    fillLight.position.set(-4, 1, -3);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    const base = new URL('./assets/modelos/', import.meta.url);
    const materialLoader = new MTLLoader();
    materialLoader.setPath(base.href);
    const materials = await new Promise((resolve, reject) => {
      materialLoader.load('COLORIDO.mtl', resolve, undefined, reject);
    });
    materials.preload();

    const objectLoader = new OBJLoader();
    objectLoader.setMaterials(materials);
    objectLoader.setPath(base.href);
    const model = await new Promise((resolve, reject) => {
      objectLoader.load('COLORIDO.obj?v=2', resolve, undefined, reject);
    });

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(largest) || largest <= 0) {
      throw new Error('O modelo não possui dimensões válidas.');
    }

    const modelScale = 1.7 / largest;
    model.scale.setScalar(modelScale);
    model.traverse((part) => {
      if (!part.isMesh) return;
      const faceMaterials = Array.isArray(part.material) ? part.material : [part.material];
      faceMaterials.forEach((material) => {
        material.side = THREE.DoubleSide;
      });
    });
    scene.add(model);

    const target = center.multiplyScalar(modelScale);
    const halfSize = size.multiplyScalar(modelScale / 2);
    const radius = halfSize.length();
    const direction = new THREE.Vector3(0.55, 0.38, 1.4).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    const corners = [];
    for (const x of [-halfSize.x, halfSize.x]) {
      for (const y of [-halfSize.y, halfSize.y]) {
        for (const z of [-halfSize.z, halfSize.z]) {
          corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    controls.target.copy(target);
    controls.minDistance = radius * 1.05;

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = viewer;
      if (!width || !height) return;

      camera.aspect = width / height;
      // Inclui a profundidade de cada canto na perspectiva e deixa margem.
      const verticalSlope = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.86;
      const horizontalSlope = verticalSlope * camera.aspect;
      const distance = Math.max(controls.minDistance, ...corners.map(corner => (
        corner.dot(direction) + Math.max(
          Math.abs(corner.dot(right)) / horizontalSlope,
          Math.abs(corner.dot(up)) / verticalSlope
        )
      )));
      controls.maxDistance = Math.max(radius * 12, distance * 2);
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.far = controls.maxDistance + radius;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      controls.update();
    };
    new ResizeObserver(resize).observe(viewer);
    resize();

    viewer.classList.add('is-loaded');
    viewer.setAttribute('tabindex', '0');

    let frameId;
    const render = () => {
      frameId = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
      } else {
        render();
      }
    });
  } catch (error) {
    console.error('Falha no visualizador do modelo colorido:', error);
    if (message) message.textContent = 'Não foi possível carregar o modelo 3D.';
    viewer.classList.add('is-error');
  }
}
