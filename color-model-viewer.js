const viewer = document.querySelector('[data-color-model-viewer]');

if (viewer) {
  const canvas = viewer.querySelector('.material-model-canvas');
  const message = viewer.querySelector('.material-model-loading');
  const hint = viewer.querySelector('.material-model-hint');
  const motionToggle = viewer.querySelector('.model-motion-toggle');

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
    model.position.copy(center).multiplyScalar(-modelScale);
    model.traverse((part) => {
      if (!part.isMesh) return;
      const faceMaterials = Array.isArray(part.material) ? part.material : [part.material];
      faceMaterials.forEach((material) => {
        material.side = THREE.DoubleSide;
      });
    });
    const modelRoot = new THREE.Group();
    modelRoot.add(model);
    scene.add(modelRoot);

    const presentationDirection = new THREE.Vector3(0.55, 0.38, 1.4).normalize();
    const radius = size.length() * modelScale / 2;
    camera.position.copy(presentationDirection);

    // A mesma sensibilidade e velocidade do visualizador Fusion 360 do início.
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.7;
    controls.autoRotateSpeed = 1.15;
    canvas.style.touchAction = 'pan-y pinch-zoom';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const touchInput = window.matchMedia('(pointer: coarse)');
    const compactViewer = window.matchMedia('(max-width: 800px), (pointer: coarse)');
    const idleDelay = 5000;
    const returnDuration = 850;
    let visible = typeof IntersectionObserver !== 'function';
    let dragging = false;
    let pausedByUser = false;
    let idleTimer;
    let frameId = null;
    let lastRotationTime = null;
    let returnMotion = null;

    const render = () => renderer.render(scene, camera);

    const canAnimate = () => visible && !document.hidden && !reducedMotion.matches;

    const setPresentation = () => {
      const distance = camera.position.length();
      camera.position.copy(presentationDirection).multiplyScalar(distance);
      modelRoot.quaternion.identity();
      controls.update(0);
      render();
    };

    const syncAnimation = () => {
      if (!canAnimate() || (!controls.autoRotate && !returnMotion)) {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        lastRotationTime = null;
        return;
      }

      if (frameId === null) frameId = requestAnimationFrame(animate);
    };

    const direction = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const identity = new THREE.Quaternion();

    function animate(time) {
      frameId = null;
      if (!canAnimate()) return;

      if (returnMotion) {
        const progress = THREE.MathUtils.clamp((time - returnMotion.startedAt) / returnDuration, 0, 1);
        const eased = 1 - (1 - progress) ** 3;
        const distance = camera.position.length();
        rotation.slerpQuaternions(identity, returnMotion.directionRotation, eased);
        direction.copy(returnMotion.startDirection).applyQuaternion(rotation);
        camera.position.copy(direction).multiplyScalar(distance);
        modelRoot.quaternion.slerpQuaternions(returnMotion.startOrientation, identity, eased);
        controls.update(0);
        render();
        if (progress === 1) {
          returnMotion = null;
          controls.autoRotate = true;
        }
      } else if (controls.autoRotate) {
        const elapsed = lastRotationTime === null ? Infinity : time - lastRotationTime;
        const interval = compactViewer.matches || navigator.connection?.saveData ? 1000 / 30 : 0;
        if (elapsed >= interval - 0.5) {
          controls.update(lastRotationTime === null ? 0 : Math.min(elapsed / 1000, 0.1));
          lastRotationTime = time;
          render();
        }
      }
      syncAnimation();
    }

    const stopRotation = () => {
      clearTimeout(idleTimer);
      returnMotion = null;
      controls.autoRotate = false;
      syncAnimation();
    };

    const scheduleReturn = () => {
      clearTimeout(idleTimer);
      if (dragging || pausedByUser || reducedMotion.matches) return;

      idleTimer = setTimeout(() => {
        if (canAnimate()) {
          const startDirection = camera.position.clone().normalize();
          returnMotion = {
            startedAt: performance.now(),
            startDirection,
            directionRotation: new THREE.Quaternion().setFromUnitVectors(startDirection, presentationDirection),
            startOrientation: modelRoot.quaternion.clone(),
          };
        } else {
          setPresentation();
          controls.autoRotate = true;
        }
        syncAnimation();
      }, idleDelay);
    };

    controls.addEventListener('change', () => {
      if (!controls.autoRotate && !returnMotion) render();
    });
    controls.addEventListener('start', () => {
      dragging = true;
      stopRotation();
    });
    const finishDrag = () => {
      if (!dragging) return;
      dragging = false;
      scheduleReturn();
    };
    controls.addEventListener('end', finishDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    window.addEventListener('blur', finishDrag);

    const keyboardAxes = {
      ArrowLeft: new THREE.Vector3(0, -1, 0),
      ArrowRight: new THREE.Vector3(0, 1, 0),
      ArrowUp: new THREE.Vector3(-1, 0, 0),
      ArrowDown: new THREE.Vector3(1, 0, 0),
    };
    viewer.addEventListener('keydown', (event) => {
      if (event.target !== viewer || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!Object.hasOwn(keyboardAxes, event.key)) return;

      event.preventDefault();
      stopRotation();
      rotation.setFromAxisAngle(keyboardAxes[event.key], 0.12);
      modelRoot.quaternion.premultiply(rotation).normalize();
      render();
      scheduleReturn();
    });

    const updateToggle = () => {
      motionToggle.disabled = reducedMotion.matches;
      motionToggle.setAttribute('aria-pressed', String(pausedByUser));
      motionToggle.textContent = reducedMotion.matches
        ? 'Movimento reduzido ativo'
        : pausedByUser ? 'Retomar rotação' : 'Pausar rotação';
    };
    motionToggle.addEventListener('click', () => {
      pausedByUser = !pausedByUser;
      stopRotation();
      controls.autoRotate = !pausedByUser && !dragging;
      updateToggle();
      syncAnimation();
    });
    reducedMotion.addEventListener('change', () => {
      stopRotation();
      controls.autoRotate = !reducedMotion.matches && !pausedByUser && !dragging;
      updateToggle();
      syncAnimation();
    });

    const updateHint = () => {
      hint.textContent = touchInput.matches
        ? 'Arraste para os lados para girar · Role na vertical'
        : 'Arraste ou use as setas para girar';
    };
    touchInput.addEventListener('change', updateHint);
    updateHint();

    const syncVisibility = () => {
      if ((!visible || document.hidden) && returnMotion) {
        returnMotion = null;
        setPresentation();
        controls.autoRotate = true;
      }
      syncAnimation();
    };
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncVisibility();
      }).observe(viewer);
    }
    document.addEventListener('visibilitychange', syncVisibility);

    const resize = () => {
      const { clientWidth: width, clientHeight: height } = viewer;
      if (!width || !height) return;

      camera.aspect = width / height;
      // Enquadra a esfera do modelo para evitar cortes durante o giro.
      const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
      const limitingHalfFov = Math.max(Math.min(verticalHalfFov, horizontalHalfFov), 0.01);
      const distance = (radius * 1.08) / Math.sin(limitingHalfFov);
      camera.position.setLength(distance);
      camera.far = distance + radius * 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      controls.update(0);
      render();
    };
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(resize).observe(viewer);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    viewer.classList.add('is-loaded');
    viewer.tabIndex = 0;
    motionToggle.hidden = false;
    updateToggle();
    controls.autoRotate = !reducedMotion.matches;
    syncAnimation();
  } catch (error) {
    console.error('Falha no visualizador do modelo colorido:', error);
    if (message) message.textContent = 'Não foi possível carregar o modelo 3D.';
    viewer.classList.add('is-error');
  }
}
