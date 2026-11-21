/* Uma passada de luz sobre a superfície, com uma malha que se apaga atrás dela. */
export function createModelScan({ THREE, mesh, render, onComplete, compact = false }) {
  const duration = compact ? 1850 : 2150;
  mesh.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const uniforms = {
    uSweep: { value: -0.06 },
    uBottom: { value: bounds.min.y },
    uHeight: { value: height },
    uLine: { value: new THREE.Color('#ffce9d') },
    uGrid: { value: new THREE.Color('#53220d') }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vNormal;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uSweep, uBottom, uHeight;
      uniform vec3 uLine, uGrid;
      varying vec3 vWorld;
      varying vec3 vNormal;

      float gridLine(vec2 coordinates) {
        vec2 width = max(fwidth(coordinates), vec2(0.001));
        vec2 distanceToLine = abs(fract(coordinates + 0.5) - 0.5) / width;
        return 1.0 - smoothstep(0.32, 1.05, min(distanceToLine.x, distanceToLine.y));
      }

      void main() {
        float layer = (vWorld.y - uBottom) / uHeight;
        float distanceBehind = uSweep - layer;
        float bandWidth = max(fwidth(layer), 0.0035);
        float line = 1.0 - smoothstep(bandWidth, bandWidth * 2.4, abs(distanceBehind));
        float halo = 1.0 - smoothstep(0.006, 0.052, abs(distanceBehind));
        float tail = smoothstep(0.005, 0.045, distanceBehind)
                   * (1.0 - smoothstep(0.07, 0.23, distanceBehind));

        vec3 coordinates = vWorld * (14.0 / uHeight);
        vec3 weights = pow(abs(normalize(vNormal)), vec3(4.0));
        weights /= weights.x + weights.y + weights.z;
        float grid = dot(weights, vec3(gridLine(coordinates.yz),
                                      gridLine(coordinates.xz),
                                      gridLine(coordinates.xy)));

        float lightAlpha = 0.82 * line + 0.21 * halo;
        float gridAlpha = 0.56 * tail * grid;
        float alpha = max(lightAlpha, gridAlpha);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(mix(uGrid, uLine, lightAlpha / max(lightAlpha + gridAlpha, 0.001)), min(alpha, 1.0));
        #include <colorspace_fragment>
      }
    `
  });

  // A sobreposição compartilha a geometria e acompanha o movimento da peça.
  const overlay = new THREE.Mesh(mesh.geometry, material);
  mesh.add(overlay);

  let frame = null;
  let startTime = null;
  let lastFrame = -Infinity;
  let disposed = false;
  const frameInterval = compact ? 1000 / 30 : 0;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frame !== null) cancelAnimationFrame(frame);
    overlay.removeFromParent();
    material.dispose();
  };

  const tick = (now) => {
    if (disposed) return;
    if (startTime === null) startTime = now;
    const progress = (now - startTime) / duration;
    if (progress >= 1) {
      onComplete();
      return;
    }
    if (now - lastFrame >= frameInterval) {
      lastFrame = now;
      uniforms.uSweep.value = -0.06 + progress * 1.3;
      try {
        render();
      } catch (error) {
        console.warn('Digitalização interrompida:', error);
        onComplete();
        return;
      }
    }
    frame = requestAnimationFrame(tick);
  };

  return {
    dispose,
    start() {
      if (!disposed && frame === null) frame = requestAnimationFrame(tick);
    }
  };
}
