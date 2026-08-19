import * as D from "three";
import { GLTFLoader as O0 } from "three/examples/jsm/loaders/GLTFLoader.js";
import { jsx as Y0 } from "react/jsx-runtime";
import { forwardRef as L0, useRef as s0, useImperativeHandle as f0, useEffect as V0 } from "react";
const U0 = { scale: {}, scaleX: {}, scaleY: {}, rotation: {}, pivotX: {}, pivotY: {} };
let DA = { ...U0 };
function X0(l) {
  Object.assign(DA.scale, l.scale ?? {}), Object.assign(DA.scaleX, l.scaleX ?? {}), Object.assign(DA.scaleY, l.scaleY ?? {}), Object.assign(DA.rotation, l.rotation ?? {}), Object.assign(DA.pivotX, l.pivotX ?? {}), Object.assign(DA.pivotY, l.pivotY ?? {});
}
function nA() {
  return DA;
}
function EA(l, A) {
  return nA().scale[l] ?? A;
}
function t0(l, A) {
  return nA().scaleX[l] ?? A;
}
function I0(l, A) {
  return nA().scaleY[l] ?? A;
}
function xA(l, A) {
  return nA().rotation[l] ?? A;
}
function WA(l, A) {
  return nA().pivotX[l] ?? A;
}
function SA(l, A) {
  return nA().pivotY[l] ?? A;
}
const E0 = {
  scale: {
    "body-bobycloud": 1.2,
    "body-body-ballgreenpeach": 3.2,
    "body-body-blobf": 3,
    "body-body-daisy": 3.7,
    "body-body-drip": 1.2,
    "body-body-flower": 3.5,
    "body-body-ghost": 3.9,
    "body-body-star": 3.2,
    "arms-arm-bloop": 2.4,
    "ear-ear-bear": 2.2,
    "mouth-mouth-happy": 3.3,
    "mouth-mouth-chomp": 2.6,
    "mouth-mouth-open": 3.7,
    "mouth-mouth-smirk": 5,
    "mouth-mouth-tongueout": 3.5,
    "mouth-mouth-wavy": 4.3,
    "mouth-mouth-flat": 5,
    "mouth-mouth-help": 3.2,
    "sclera-sclera-default": 2.2,
    "legs-leg-drip": 2,
    "accessory-spots": 1.8,
    "custom-part-1775251940610": 3.2,
    "custom-part-1775511692443": 3.3,
    "eyelid-eyelid-squint": 3.3,
    "spec-spec-three": 0.9,
    "arms-arm-drip": 1.5,
    "custom-part-1775878914660": 0.5,
    "pupil-pupil-round": 0.6,
    "custom-part-1776134942723": 0.6,
    "body-ball": 0.8,
    "arms-pillr": 0.6,
    "sclera-round": 0.6,
    "legs-drip": 0.7,
    "arms-dripr": 0.7,
    "spec-one": 0.5,
    "body-round": 0.3,
    "pupil-round": 0.9,
    "body-circ": 1.1,
    "body-clouda": 0.8,
    "legs-sitshoe": 0.8
  },
  scaleX: {
    "eyelid-eyelid-squint": 1.2,
    "custom-part-1775511692443": 1.2
  },
  scaleY: {},
  rotation: {
    "arms-arm-bloop": -87,
    "custom-part-1775251940610": -148,
    "mouth-mouth-chomp": 0,
    "arms-arm-greendrip": 79,
    "arms-arm-hand": 180,
    "arms-arm-naked": 180,
    "arms-arm-thumb": 180,
    "arms-arm-drip": -36,
    "ear-bear": -1,
    "legs-sitshoe": -25
  },
  pivotX: {
    "arms-arm-thumb": 68,
    "arms-arm-hand": 66,
    "legs-leg-black": 24,
    "arms-arm-greendrip": 4,
    "custom-part-1775539873004": 48,
    "arms-arm-bloop": -19,
    "arms-arm-drip": -57,
    "arms-arm-naked": 27,
    "ear-ear-bear": 15,
    "arms-pillr": -186,
    "arms-dripr": -146.4,
    "ear-bear": 71.2,
    "legs-drip": 8.7,
    "ear-rounder": 0,
    "ear-drop": 24.75,
    "legs-piller": 0,
    "body-dill": 0,
    "arms-piller": -145.5,
    "paint-dots": 0,
    "eyelid-squint": 0,
    "body-superdrip": 0,
    "body-bloop": 0,
    "body-carrot": 22.950000000000003,
    "body-proof": 0,
    "body-derp-copy": 0,
    "body-cloud": 0,
    "body-star": 0,
    "accessory-dark-circ": 0,
    "body-exportball": 0
  },
  pivotY: {
    "legs-leg-foothoof": 110,
    "legs-leg-drip": 52,
    "arms-arm-greendrip": 53,
    "legs-leg-black": 67,
    "legs-leg-dino": 45,
    "arms-arm-bloop": -47,
    "arms-arm-drip": 32,
    "ear-ear-bear": -16,
    "body-body-drip": -99,
    "legs-pill": -300,
    "legs-drop": 294,
    "legs-drip": 175.45,
    "arms-dripr": 79.2,
    "ear-bear": -84.55,
    "ear-rounder": -142.1,
    "ear-drop": -181.5,
    "body-blob": -68.2,
    "body-drip": -223,
    "horns-hornb": -66,
    "body-eggnew": -216,
    "body-superdrip": -212.15596330275227,
    "legs-piller": 138,
    "body-dill": -261,
    "arms-piller": 0,
    "paint-dots": 0,
    "eyelid-squint": 0,
    "body-bloop": 0,
    "body-carrot": -40.5,
    "body-proof": 0,
    "body-derp-copy": 0,
    "body-cloud": 0,
    "body-star": 0,
    "accessory-dark-circ": 0,
    "body-exportball": 0
  }
};
X0(E0);
const x0 = {
  light1On: !0,
  light2On: !0,
  light1Brightness: 1.5,
  light2Brightness: 0.8,
  ambientBrightness: 0.3,
  ambientColor: "#ffffff",
  scleraBrightness: 0.5,
  teethBrightness: 0,
  specBrightness: 1,
  light1Color: "#ffffff",
  light2Color: "#ffffff",
  shadowsEnabled: !0,
  light1Bias: -7e-3,
  light1NormalBias: 2,
  light2Bias: -7e-3,
  light2NormalBias: 2
};
class W0 {
  renderer;
  scene;
  camera;
  dirLight1;
  dirLight2;
  fillLight;
  shadowCatcher;
  _boundsFrame;
  _frustum;
  _initialFrustum;
  _cameraDist;
  _angle = 0;
  _scleraBrightness = 0.5;
  _teethBrightness = 0;
  _specBrightness = 1;
  _wireframe = !1;
  _panX = 0;
  _panY = 0;
  _width = 0;
  _height = 0;
  // Pixelation post step (route A): render the scene into a low-res target,
  // then upscale to the canvas with nearest filtering for crisp blocky pixels.
  _pixelate = !1;
  _pixelSize = 1;
  _pixelTarget = null;
  _pixelThumbTarget = null;
  _pixelScene = null;
  _pixelCamera = null;
  _pixelMesh = null;
  constructor(A, i, s, e) {
    const t = e?.frustum ?? 500, a = e?.cameraDist ?? 1e3, I = e?.cameraFar ?? 2e3, c = e?.shadowCameraSize ?? 600;
    this._frustum = t, this._initialFrustum = t, this._cameraDist = a, this.renderer = new D.WebGLRenderer({
      canvas: A,
      antialias: !0,
      alpha: !0,
      preserveDrawingBuffer: !0,
      stencil: !0
    }), this.renderer.setSize(i, s), this.renderer.setPixelRatio(window.devicePixelRatio), this._width = i, this._height = s, this.renderer.shadowMap.enabled = !0, this.renderer.shadowMap.type = D.PCFSoftShadowMap, this.renderer.autoClearStencil = !0, this.scene = new D.Scene();
    const g = i / s;
    this.camera = new D.OrthographicCamera(
      -t * g,
      t * g,
      t,
      -t,
      1,
      I
    ), this.camera.position.set(0, 0, a), this.camera.lookAt(0, 0, 0), this.dirLight1 = new D.DirectionalLight(16777215, 1.5), this.dirLight1.position.set(300, 300, 500), this.dirLight1.target.position.set(0, 0, 0), this.dirLight1.castShadow = !0, this.dirLight1.shadow.mapSize.width = 2048, this.dirLight1.shadow.mapSize.height = 2048, this.dirLight1.shadow.radius = 8, this.dirLight1.shadow.bias = -7e-3, this.dirLight1.shadow.normalBias = 2, this.dirLight1.shadow.camera.near = 1, this.dirLight1.shadow.camera.far = I, this.dirLight1.shadow.camera.left = -c, this.dirLight1.shadow.camera.right = c, this.dirLight1.shadow.camera.top = c, this.dirLight1.shadow.camera.bottom = -c, this.scene.add(this.dirLight1), this.scene.add(this.dirLight1.target), this.dirLight2 = new D.DirectionalLight(16777215, 0.8), this.dirLight2.position.set(-200, -200, 400), this.dirLight2.target.position.set(0, 0, 0), this.dirLight2.castShadow = !0, this.dirLight2.shadow.mapSize.width = 2048, this.dirLight2.shadow.mapSize.height = 2048, this.dirLight2.shadow.radius = 8, this.dirLight2.shadow.bias = -7e-3, this.dirLight2.shadow.normalBias = 2, this.dirLight2.shadow.camera.near = 1, this.dirLight2.shadow.camera.far = I, this.dirLight2.shadow.camera.left = -c, this.dirLight2.shadow.camera.right = c, this.dirLight2.shadow.camera.top = c, this.dirLight2.shadow.camera.bottom = -c, this.scene.add(this.dirLight2), this.scene.add(this.dirLight2.target), this.fillLight = new D.DirectionalLight(16777215, 0.3), this.fillLight.position.copy(this.camera.position), this.fillLight.target.position.set(0, 0, 0), this.fillLight.castShadow = !1, this.scene.add(this.fillLight), this.scene.add(this.fillLight.target), this.shadowCatcher = new D.Mesh(
      new D.PlaneGeometry(3e3, 3e3),
      new D.ShadowMaterial({ opacity: 0.3, transparent: !0 })
    ), this.shadowCatcher.name = "_shadowCatcher", this.shadowCatcher.position.set(0, 0, -2), this.shadowCatcher.receiveShadow = !0, this.shadowCatcher.castShadow = !1, this.scene.add(this.shadowCatcher), this._boundsFrame = new D.LineLoop(
      this._buildBoundsGeometry(i, s),
      new D.LineBasicMaterial({ color: 16738740, depthTest: !1 })
    ), this._boundsFrame.name = "_boundsFrame", this._boundsFrame.renderOrder = 998, this._boundsFrame.visible = e?.showBounds ?? !0, this._boundsFrame.userData.editorOverlay = !0, this.scene.add(this._boundsFrame);
  }
  _buildBoundsGeometry(A, i) {
    const s = this._initialFrustum;
    return new D.BufferGeometry().setFromPoints([
      new D.Vector3(-s, -s, -0.5),
      new D.Vector3(s, -s, -0.5),
      new D.Vector3(s, s, -0.5),
      new D.Vector3(-s, s, -0.5)
    ]);
  }
  applyLighting(A) {
    this.dirLight1.visible = A.light1On, this.dirLight1.intensity = A.light1Brightness, this.dirLight1.color.set(A.light1Color), this.dirLight1.shadow.bias = A.light1Bias, this.dirLight1.shadow.normalBias = A.light1NormalBias, this.dirLight2.visible = A.light2On, this.dirLight2.intensity = A.light2Brightness, this.dirLight2.color.set(A.light2Color), this.dirLight2.shadow.bias = A.light2Bias, this.dirLight2.shadow.normalBias = A.light2NormalBias, this.fillLight.intensity = A.ambientBrightness, A.ambientColor && this.fillLight.color.set(A.ambientColor), this._scleraBrightness = A.scleraBrightness ?? 0.5, this.applyScleraBrightness(), this._teethBrightness = A.teethBrightness ?? 0, this.applyTeethBrightness(), this._specBrightness = A.specBrightness ?? 1, this.applySpecBrightness(), this.dirLight1.castShadow = A.shadowsEnabled && A.light1On, this.dirLight2.castShadow = A.shadowsEnabled && A.light2On, this.renderer.shadowMap.enabled = A.shadowsEnabled, this.renderer.shadowMap.needsUpdate = !0;
  }
  /** Re-apply stored sclera brightness to all tagged sclera materials. Call
   *  after new sclera parts are added to the scene. */
  applyScleraBrightness() {
    const A = this._scleraBrightness;
    this.scene.traverse((i) => {
      if (!(i instanceof D.Mesh)) return;
      const s = i.material;
      s && "emissive" in s && s.userData?.isSclera && (s.emissive.set(16777215), s.emissiveIntensity = A);
    });
  }
  /** Re-apply stored teeth brightness to all tagged teeth materials (those
   *  tagged via `userData.isTeeth` by applyTeethTag). Call after new mouth
   *  parts are added to the scene. */
  applyTeethBrightness() {
    const A = this._teethBrightness;
    this.scene.traverse((i) => {
      if (!(i instanceof D.Mesh)) return;
      const s = (e) => {
        !("emissive" in e) || !e.userData?.isTeeth || (e.emissive.set(16777215), e.emissiveIntensity = A);
      };
      Array.isArray(i.material) ? i.material.forEach(s) : i.material && s(i.material);
    });
  }
  /** Re-apply stored spec brightness to all spec materials (those tagged via
   *  `userData.specMask` by applySpecRendering). Call after new spec parts
   *  are added to the scene. */
  applySpecBrightness() {
    const A = this._specBrightness;
    this.scene.traverse((i) => {
      if (!(i instanceof D.Mesh)) return;
      const s = (e) => {
        !("emissive" in e) || !e.userData?.specMask || (e.emissive.set(16777215), e.emissiveIntensity = A);
      };
      Array.isArray(i.material) ? i.material.forEach(s) : i.material && s(i.material);
    });
  }
  /** Toggle wireframe rendering for all part meshes. State is stored so newly
   *  loaded parts pick it up via applyWireframe(). */
  setWireframe(A) {
    this._wireframe = A, this.applyWireframe();
  }
  get wireframe() {
    return this._wireframe;
  }
  /** Re-apply the stored wireframe state to all part meshes. Call after new
   *  parts are added to the scene. Skips scene scaffolding (shadow catcher,
   *  bounds frame, outlines — all named with a leading underscore). */
  applyWireframe() {
    const A = this._wireframe;
    this.scene.traverse((i) => {
      if (!(i instanceof D.Mesh) || i.name.startsWith("_")) return;
      const s = (e) => {
        "wireframe" in e && (e.wireframe = A);
      };
      Array.isArray(i.material) ? i.material.forEach(s) : i.material && s(i.material);
    });
  }
  resize(A, i) {
    const s = A / i, e = this._frustum;
    this.camera.left = -e * s, this.camera.right = e * s, this.camera.top = e, this.camera.bottom = -e, this.camera.updateProjectionMatrix(), this.renderer.setSize(A, i), this._width = A, this._height = i, this._pixelate && this._pixelSize > 1 && this._resizePixelTarget(), this._boundsFrame.geometry.dispose(), this._boundsFrame.geometry = this._buildBoundsGeometry(A, i);
  }
  // Convert screen pixel to world coordinates (ortho)
  screenToWorld(A, i, s, e) {
    return new D.Vector3(
      A / s * 2 - 1,
      -(i / e) * 2 + 1,
      0
    ).unproject(this.camera);
  }
  _updateCameraTransform() {
    const A = this._angle * Math.PI / 180;
    this.camera.position.set(
      Math.sin(A) * this._cameraDist + this._panX,
      this._panY,
      Math.cos(A) * this._cameraDist
    ), this.camera.lookAt(this._panX, this._panY, 0), this.camera.updateProjectionMatrix(), this.fillLight.position.copy(this.camera.position);
  }
  // Orbit camera around the pan target at given angle (degrees).
  setCameraAngle(A) {
    this._angle = A, this._updateCameraTransform();
  }
  setCameraDolly(A) {
    this._frustum = A;
    const i = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom);
    this.camera.left = -A * i, this.camera.right = A * i, this.camera.top = A, this.camera.bottom = -A, this.camera.updateProjectionMatrix();
  }
  // Pan the camera so it looks at world point (x, y).
  setCameraPan(A, i) {
    this._panX = A, this._panY = i, this._updateCameraTransform();
  }
  get frustum() {
    return this._frustum;
  }
  get panX() {
    return this._panX;
  }
  get panY() {
    return this._panY;
  }
  resetCamera() {
    this._frustum = this._initialFrustum, this._angle = 0, this._panX = 0, this._panY = 0, this._updateCameraTransform(), this.setCameraDolly(this._initialFrustum);
  }
  /**
   * Toggle pixelation and set the block size (CSS px per pixel; 1 = off-ish).
   * When on, render() draws the scene into a low-res target and upscales it
   * with nearest filtering. The target carries depth + stencil so the mascot's
   * stencil-based eye/clip rendering still works, and alpha so the transparent
   * background is preserved.
   */
  setPixelation(A, i) {
    this._pixelate = A, this._pixelSize = Math.max(1, Math.round(i)), A && this._pixelSize > 1 ? this._ensurePixelTarget() : this._disposePixelTarget();
  }
  _ensurePixelTarget() {
    if (!this._pixelScene) {
      this._pixelScene = new D.Scene(), this._pixelCamera = new D.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const A = new D.MeshBasicMaterial({
        transparent: !0,
        depthTest: !1,
        depthWrite: !1,
        toneMapped: !1
      });
      A.blending = D.NoBlending, this._pixelMesh = new D.Mesh(new D.PlaneGeometry(2, 2), A), this._pixelMesh.frustumCulled = !1, this._pixelScene.add(this._pixelMesh);
    }
    this._resizePixelTarget();
  }
  _resizePixelTarget() {
    const A = Math.max(1, Math.floor(this._width / this._pixelSize)), i = Math.max(1, Math.floor(this._height / this._pixelSize));
    this._pixelTarget ? this._pixelTarget.setSize(A, i) : (this._pixelTarget = new D.WebGLRenderTarget(A, i, {
      minFilter: D.NearestFilter,
      magFilter: D.NearestFilter,
      depthBuffer: !0,
      stencilBuffer: !0
    }), this._pixelTarget.texture.generateMipmaps = !1), this._pixelMesh && (this._pixelMesh.material.map = this._pixelTarget.texture);
  }
  _disposePixelTarget() {
    this._pixelTarget?.dispose(), this._pixelTarget = null, this._pixelThumbTarget?.dispose(), this._pixelThumbTarget = null, this._pixelMesh && (this._pixelMesh.material.map = null);
  }
  render() {
    if (this._pixelate && this._pixelSize > 1 && this._pixelTarget && this._pixelScene && this._pixelCamera) {
      this.renderer.setRenderTarget(this._pixelTarget), this.renderer.render(this.scene, this.camera), this.renderer.setRenderTarget(null), this.renderer.render(this._pixelScene, this._pixelCamera);
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }
  // Renders a square thumbnail of the scene into the bottom-right corner of the canvas.
  // cssW/cssH are the canvas CSS dimensions; thumbPx is the thumbnail side length in CSS px.
  // Editor overlays (objects tagged userData.editorOverlay) are hidden during the render.
  renderThumbnail(A, i, s) {
    const { left: t, right: a, top: I, bottom: c } = this.camera, g = this._frustum;
    this.camera.left = -g, this.camera.right = g, this.camera.top = g, this.camera.bottom = -g, this.camera.updateProjectionMatrix();
    const r = [];
    this.scene.traverse((n) => {
      n.userData.editorOverlay && n.visible && (r.push(n), n.visible = !1);
    });
    const o = A - s - 10;
    if (this._pixelate && this._pixelSize > 1 && this._pixelScene && this._pixelCamera && this._pixelMesh) {
      const n = Math.max(1, Math.floor(s / this._pixelSize));
      this._pixelThumbTarget ? this._pixelThumbTarget.setSize(n, n) : (this._pixelThumbTarget = new D.WebGLRenderTarget(n, n, {
        minFilter: D.NearestFilter,
        magFilter: D.NearestFilter,
        depthBuffer: !0,
        stencilBuffer: !0
      }), this._pixelThumbTarget.texture.generateMipmaps = !1), this.renderer.setRenderTarget(this._pixelThumbTarget), this.renderer.render(this.scene, this.camera), this.renderer.setRenderTarget(null);
      const m = this._pixelMesh.material;
      m.map = this._pixelThumbTarget.texture, this.renderer.setScissorTest(!0), this.renderer.setScissor(o, 10, s, s), this.renderer.setViewport(o, 10, s, s), this.renderer.render(this._pixelScene, this._pixelCamera), m.map = this._pixelTarget?.texture ?? null;
    } else
      this.renderer.setScissorTest(!0), this.renderer.setScissor(o, 10, s, s), this.renderer.setViewport(o, 10, s, s), this.renderer.render(this.scene, this.camera);
    for (const n of r) n.visible = !0;
    this.camera.left = t, this.camera.right = a, this.camera.top = I, this.camera.bottom = c, this.camera.updateProjectionMatrix(), this.renderer.setScissorTest(!1), this.renderer.setViewport(0, 0, A, i);
  }
  dispose() {
    this._disposePixelTarget(), this._pixelMesh?.geometry.dispose(), this._pixelMesh && this._pixelMesh.material.dispose(), this.renderer.dispose(), this.scene.traverse((A) => {
      A instanceof D.Mesh && (A.geometry.dispose(), Array.isArray(A.material) ? A.material.forEach((i) => i.dispose()) : A.material.dispose());
    });
  }
}
class P0 {
  loader;
  cache;
  constructor() {
    this.loader = new O0(), this.cache = /* @__PURE__ */ new Map();
  }
  cloneWithOwnMaterials(A) {
    const i = A.clone();
    return i.traverse((s) => {
      s instanceof D.Mesh && (s.material = s.material.clone());
    }), i;
  }
  async loadPart(A) {
    if (this.cache.has(A.glbPath))
      return this.cloneWithOwnMaterials(this.cache.get(A.glbPath));
    const s = (await this.loader.loadAsync(A.glbPath)).scene;
    return s.traverse((e) => {
      if (e instanceof D.Mesh)
        if (e.castShadow = !0, e.receiveShadow = !0, e.material instanceof D.MeshBasicMaterial) {
          const t = e.material;
          e.material = new D.MeshStandardMaterial({
            color: t.color,
            map: t.map,
            side: t.side || D.DoubleSide,
            transparent: t.transparent,
            opacity: t.opacity,
            roughness: 0.8,
            metalness: 0
          }), t.dispose();
        } else e.material instanceof D.MeshStandardMaterial && (e.material.side = D.DoubleSide);
    }), this.cache.set(A.glbPath, s), this.cloneWithOwnMaterials(s);
  }
}
const JA = new P0(), a0 = /* @__PURE__ */ new Map(), uA = 256;
function l0(l) {
  const A = l.replace("#", "").padEnd(6, "0").slice(0, 6), i = parseInt(A.slice(0, 2), 16), s = parseInt(A.slice(2, 4), 16), e = parseInt(A.slice(4, 6), 16);
  return [Number.isFinite(i) ? i : 0, Number.isFinite(s) ? s : 0, Number.isFinite(e) ? e : 0];
}
function S0(l) {
  if (!l.startColor || !l.endColor) return null;
  const A = l.centerX ?? 0.5, i = l.centerY ?? 0.5;
  return `proc:${l.startColor}:${l.endColor}:${l.angle}:${A}:${i}`;
}
function RA(l) {
  const A = S0(l);
  if (!A) return null;
  const i = a0.get(A);
  if (i) return i;
  const [s, e, t] = l0(l.startColor), [a, I, c] = l0(l.endColor), g = new Uint8Array(uA * 4);
  for (let y = 0; y < uA; y++) {
    const M = y / (uA - 1), d = y * 4;
    g[d] = Math.round(s + (a - s) * M), g[d + 1] = Math.round(e + (I - e) * M), g[d + 2] = Math.round(t + (c - t) * M), g[d + 3] = 255;
  }
  const r = new D.DataTexture(g, 1, uA, D.RGBAFormat, D.UnsignedByteType);
  r.wrapS = D.ClampToEdgeWrapping, r.wrapT = D.ClampToEdgeWrapping, r.minFilter = D.LinearFilter, r.magFilter = D.LinearFilter, r.generateMipmaps = !1;
  const o = l.centerX ?? 0.5, n = l.centerY ?? 0.5, m = l.angle * Math.PI / 180;
  return r.center.set(o, n), r.rotation = Math.PI / 2 - m, r.offset.set(0.5 - o, 0), r.needsUpdate = !0, a0.set(A, r), r;
}
function d0(l, A = "XY") {
  const i = l.getAttribute("position");
  if (!i) return;
  l.computeBoundingBox();
  const s = l.boundingBox, e = new D.Vector3();
  s.getSize(e);
  const t = e.x || 1, a = e.y || 1, I = e.z || 1, c = new Float32Array(i.count * 2);
  for (let g = 0; g < i.count; g++) {
    let r, o;
    A === "XZ" ? (r = (i.getX(g) - s.min.x) / t, o = (i.getZ(g) - s.min.z) / I) : A === "YZ" ? (r = (i.getZ(g) - s.min.z) / I, o = (i.getY(g) - s.min.y) / a) : (r = (i.getX(g) - s.min.x) / t, o = (i.getY(g) - s.min.y) / a), c[g * 2] = r, c[g * 2 + 1] = o;
  }
  l.setAttribute("uv", new D.BufferAttribute(c, 2));
}
const G0 = {
  foot: 15,
  legs: 15,
  ear: 10,
  body: 10,
  eye: 10,
  nose: 10,
  mouth: 10,
  accessory: 10
};
function v0(l) {
  return G0[l] ?? 10;
}
const R0 = [
  { id: "accessory-dark-circ", category: "accessory", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC0DQAAhAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYWNjZXNzb3J5LWRhcmstY2lyYyIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbOSwwLDAsMCwwLDEuMjAwMDAwMDAwMDAwMDAwMiwwLDAsMCwwLDMsMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDQ5IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wNDkifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjE4MTJ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDc2MDYwNDczOTE4OTE0OCww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", import.meta.url).href },
  { id: "arms-dripr", category: "arms", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADQDwAASAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYXJtcy1kcmlwciIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbMi40LDAsMCwwLDAsMi40LDAsMCwwLDAsMi40LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTAwOCIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDA4In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4MTIsImJ5dGVMZW5ndGgiOjM0NH1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyMTU2fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjE4NTU4ODAwMjIwNDg5NTAyLDAsMC4wODc3NjA4NjU2ODgzMjM5N10sIm1pbiI6Wy0wLjE4NTU4Nzg4Mjk5NTYwNTQ3LDAsLTAuMDg3NzYwODY1Njg4MzIzOTddLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMSwxXSwibWluIjpbMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsIm1heCI6WzQ3XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MSwiYmFzZUNvbG9yVGV4dHVyZSI6eyJpbmRleCI6MCwidGV4Q29vcmQiOjAsImV4dGVuc2lvbnMiOnsiS0hSX3RleHR1cmVfdHJhbnNmb3JtIjp7InJvdGF0aW9uIjoxLjU3MDc5NjMyNjc5NDg5NjZ9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDMiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWV9fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX1dLCJpbWFnZXMiOlt7Im1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwiYnVmZmVyVmlldyI6NH1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09P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", import.meta.url).href },
  { id: "body-cloud", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAgNAAA2AcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1jbG91ZCIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbNCwwLDAsMCwwLDQsMCwwLDAsMCw0LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0NSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ1In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6MzQ1NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjozNDU2LCJieXRlTGVuZ3RoIjozNDU2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjY5MTIsImJ5dGVMZW5ndGgiOjIzMDQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo5MjE2LCJieXRlTGVuZ3RoIjoxNzE2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTA5MzIsImJ5dGVMZW5ndGgiOjM3Nn1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxMTMwOH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyODgsIm1heCI6WzAuMjA3OTM0NzA3NDAzMTgyOTgsMCwwLjIwMDg3NTA0Mzg2OTAxODU1XSwibWluIjpbLTAuMjA3OTM0NjkyNTAyMDIxOCwwLC0wLjIwMDg3NTA0Mzg2OTAxODU1XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyODgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI4OCwibWF4IjpbMSwxXSwibWluIjpbMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50Ijo4NTgsIm1heCI6WzI4N10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjAsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6LTAuMDE3NDUzMjkyNTE5OTQzMzJ9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMTQiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWUsImxheWVyT3BhY2l0eSI6MSwic291cmNlR3JhZGllbnQiOnsic3RhcnRDb2xvciI6IiNjMWZkZmYiLCJlbmRDb2xvciI6IiM3YzQxYWQiLCJhbmdsZSI6OTEsImNlbnRlclgiOjAuNSwiY2VudGVyWSI6MC41LCJwcm9qZWN0aW9uQXhpcyI6IlhaIn19fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEs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AAAAAHCVOb48o6W9AAAAAIigOr4gFpy9AAAAAAhbO77copK9AAAAAIjGO770V4m9AAAAAKDkO77qQ4C9AAAAAOi2O76E6m69AAAAAPg+O74A9V29AAAAAGR+Or4AAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAADQJsI+IXBJPYW5xT4QGC09sqvJPto3Ej3H9s0+YgDyPDGU0j47Q8M8YH3XPqSZmDzDq9w+X8lkPMgY4j6ACyI8373nPqV30zt2lO0+cHRyO/2V8z4Tkds64rv5PoWh3zmT//8+AAAAAKMhAz+Fod85ljQGPxOR2zpaNQk/cHRyO6ggDD+ld9M7OPMOP4ALIjzBqRE/X8lkPPpAFD+kmZg8nLUWPztDwzxfBBk/YgDyPPopGz/aNxI9JSMdPxAYLT2Z7B4/IXBJPWZbIT+FLz89y+cjPyCyNz1tjSY/+gczPe5HKT/HQDE98RIsP2hsMj0a6i4/uZo2PQ3JMT+Z2z09a6s0P+c+SD3ajDc/gNRVPftoOj9CrGY9czs9Pw3Wej3i/z8/8zCJPV6oQj8VepY9/ShFP+z8pD1ugEc/Ppe0PV6tST/SJsU9e65LP4GJ1j10gk0/Jp3oPfcnTz+HP/s9s51QPz8nBz5W4lE/89MQPoz0Uj/ClBo+BtNTP5pYJD5zfFQ/VA4uPtfpVj/VszA+wlpZP50tND7uyls/anY4PhY2Xj/0iD0+9JdgP+VfQz5C7GI///VJPrkuZT/sRVE+FFtnP21KWT4ObWk/Lv5hPl9gaz/uW2s+wTBtP2RedT7x2W4/HgCAPpxScD/3iIU+LJVxP9stiz6eonI/E+aQPvJ7cz/kqJY+IiJ0P5htnD4ulnQ/eCuiPhHZdD/K2ac+y+t0P9hvrT5Xz3Q/6uSyPrSEdD9GMLg+4Ax0PzVJvT7XaHM//SbCPlAudT/kucU+UNx2PzesyT7Lb3g/ZPfNPrfleT/dlNI+CTt7Pw9+1z63bHw/cazcPrZ3fT9yGeI+/Fh+P32+5z59DX8/BpXtPjCSfz9/lvM+CuR/P1W8+T4AAIA/9v//Pgvkfz/oIQM/MZJ/P+o0Bj9+DX8/tzUJP/1Yfj8KIQw/t3d9P5vzDj+4bHw/IqoRPwo7ez9YQRQ/uOV5P/a1Fj/Mb3g/tQQZP1Lcdj9NKhs/US51P3YjHT/XaHM/6eweP+AMdD+2WyE/tIR0Px7oIz9Xz3Q/wo0mP8vrdD9GSCk/Edl0P00TLD8ulnQ/d+ouPyIidD9oyTE/8ntzP8SrND+eonI/Ko03PyyVcT8+aTo/nFJwP6Q7PT/x2W4//v8/P8IwbT98qEI/YGBrPyApRT8PbWk/loBHPxVbZz+OrUk/ui5lP7OuSz9D7GI/tYJNP/WXYD9AKE8/FzZePwOeUD/vyls/quJRP8NaWT/j9FI/2OlWP13TUz9zfFQ/xXxUPwjTUz846lY/jfRSPyxbWT9X4lE/WstbP7SdUD9/Nl4/+SdPP1WYYD91gk0/l+xiP3yuSz8CL2U/X61JP09bZz9vgEc/O21pP/4oRT+AYGs/X6hCP9owbT/i/z8/BdpuP3E7PT/FUnA/+mg6P2WVcT/ZjDc/5KJyP2qrND9AfHM/DMkxP3YidD8Z6i4/hZZ0P/ASLD9r2XQ/7UcpPyfsdD9sjSY/tc90P8rnIz8VhXQ/ZVshP0UNdD+Z7B4/RGlzPyUjHT/BLnU/+ikbP77cdj9fBBk/MnB4P5y1Fj8U5nk/+kAUP1k7ez/BqRE/+Gx8PzjzDj/od30/qCAMPyBZfj9aNQk/lA1/P5Y0Bj88kn8/oyEDPw7kfz+T//8+AACAP+C7+T4N5H8/+5XzPjuSfz90lO0+kw1/P9295z4eWX4/xhjiPud3fT/Bq9w+92x8P1591z5YO3s/L5TSPhPmeT/F9s0+MXB4P7CryT693HY/g7nFPsAudT/QJsI+RGlzPwZJvT5GDXQ/EjC4PhaFdD+v5LI+ts90P5ZvrT4o7HQ/gtmnPm3ZdD8qK6I+hpZ0P0ltnD53InQ/maiWPkF8cz/S5ZA+5aJyP68tiz5mlXE/6IiFPsZScD82AIA+BdpuP3dedT7aMG0/51trPoBgaz8J/mE+O21pPydKWT5PW2c/kEVRPgIvZT+O9Uk+l+xiP2xfQz5VmGA/dIg9Pn82Xj/2dTg+WstbPzotND4sW1k/i7MwPjjqVj8yDi4+xXxUP0NYJD5d01M/RJQaPuP0Uj9V0xA+quJRP4UmBz4DnlA/5T37PUAoTz9km+g9tYJNP7iH1j2zrks/GiXFPY6tST+tlbQ9loBHP6L7pD0gKUU/L3mWPXyoQj+DMIk9/v8/P87Uej2kOz0/iqpmPT5pOj9N0lU9Ko03P088SD3EqzQ/otg9PWjJMT90lzY9d+ouP9hoMj1NEyw/+zwxPUZIKT8NBDM9wo0mPxauNz0e6CM/Tis/PbZbIT/Qa0k96eweP1gULT11Ix0/tTQSPUwqGz8b+/E8tAQZPwQ/wzz1tRY/S5aYPFdBFD+CxGQ8IaoRP/gHIjyZ8w4/enPTOwghDD+PcHI7tTUJP1mO2zrnNAY/75vfOeYhAz8AAAAA9v//Pu+b3zlQvPk+WY7bOnqW8z6PcHI7AZXtPnpz0zt4vuc++AciPG0Z4j6CxGQ8bKzcPkuWmDwKftc+BD/DPNiU0j4b+/E8X/fNPrU0Ej0zrMk+WBQtPd+5xT7Qa0k9/SbCPk4rPz01Sb0+Fq43PUYwuD4NBDM96uSyPvs8MT3Yb60+2GgyPcrZpz50lzY9eCuiPqLYPT2YbZw+TzxIPeSolj5N0lU9E+aQPoqqZj3bLYs+ztR6PfeIhT6DMIk9HgCAPjR5lj1kXnU+ovukPe5baz6tlbQ9Lv5hPholxT1tSlk+vIfWPexFUT5pm+g9//VJPuo9+z3lX0M+hyYHPvSIPT5V0xA+anY4PkeUGj6dLTQ+Q1gkPtWzMD4yDi4+VA4uPoazMD6QWCQ+NS00PriUGj7xdTg+6dMQPnKIPT41Jwc+aV9DPnM/+z2L9Uk+Ep3oPY5FUT5tidY9JUpZPr4mxT0G/mE+Kpe0PeRbaz7Y/KQ9dF51PgF6lj02AIA+8zCJPeeIhT5c1no9ri2LPpKsZj3R5ZA+z9RVPZiolj42P0g9SG2cPunbPT0pK6I+CZs2PYHZpz64bDI9lW+tPhdBMT2u5LI+SQgzPREwuD5wsjc9BUm9PtQvPz0LAA0ADAAKAA0ACwAKAA4ADQAJAA4ACgAJAA8ADgAIAA8ACQAIABAADwAHABAACAAHABEAEAAGABEABwAGABIAEQAFABIABgAFABMAEgAEABMABQAEABQAEwADABQABAADABUAFAACABUAAwACABYAFQABABYAAgABABcAFgAAABcAAQAAABgAFwAbAB0AHAAbAR0BHAEbAB4AHQAaAR0BGwEaAB4AGwAaAR4BHQEaAB8AHgAZAR4BGgEZAB8AGgAZAR8BHgEZACAAHwAYAR8BGQEYACAAGQAYAQAAHwEYACEAIAAXAQAAGAEXARgAAAAXASEAGAAXASIAIQAWASIAFwEWASMAIgAVASMAFgEVASQAIwAUASQAFQETASQAFAETASUAJAASASUAEwESASYAJQARASYAEgERAScAJgAQAScAEQEQASgAJwAPASgAEAEPASkAKAAOASkADwEOASoAKQANASoADgENASsAKgAMASsADQEMASwAKwALASwADAELAS0ALAAKAS0ACwEKAS4ALQAJAS4ACgEJAS8ALgAIAS8ACQEIATAALwAHATAACAEHATEAMAAGATEABwEGATIAMQAFATIABgEFATMAMgAEATMABQEEATQAMwADATQABAEDATUANAACATUAAwECATYANQABATYAAgEBATcANgAAATcAAQEAATgANwD/ADgAAAH/ADkAOAD+ADkA/wD+ADoAOQD9ADoA/gD9ADsAOgD8ADsA/QD8ADwAOwD7ADwA/AD7AD0APAD6AD0A+wD6AD4APQD5AD4A+gD5AD8APgD4AD8A+QD4AEAAPwD3AEAA+AD3AEEAQAD2AEEA9wD2AEIAQQD1AEIA9gD1AEMAQgD0AEMA9QD0AEQAQwDzAEQA9ADzAEUARADyAEUA8wDyAEYARQDxAEYA8gDxAEcARgDwAEcA8QDwAEgARwDvAEgA8ADvAEkASADuAEkA7wDuAEoASQDtAEoA7gDtAEsASgDsAEsA7QDsAEwASwDrAEwA7ADrAE0ATADqAE0A6wDqAE4ATQDpAE4A6gDpAE8ATgDoAE8A6QDoAFAATwDnAFAA6ADnAFEAUADmAFEA5wDmAFIAUQDlAFIA5gDlAFMAUgDkAFMA5QDkAFQAUwDjAFQA5ADjAFUAVADiAFUA4wDiAFYAVQDhAFYA4gDhAFcAVgDgAFcA4QDgAFgAVwDfAFgA4ADfAFkAWADeAFkA3wDeAFoAWQDdAFoA3gDdAFsAWgDcAFsA3QDcAFwAWwDbAFwA3ADbAF0AXADaAF0A2wDaAF4AXQDZAF4A2gDZAF8AXgDYAF8A2QDYAGAAXwDXAGAA2ADXAGEAYADWAGEA1wDWAGIAYQDVAGIA1gDVAGMAYgDUAGMA1QDUAGQAYwDTAGQA1ADTAGUAZADSAGUA0wDSAGYAZQDRAGYA0gDRAGcAZgDQAGcA0QDQAGgAZwDPAGgA0ADPAGkAaADOAGkAzwDOAGoAaQDNAGoAzgDNAGsAagDMAGsAzQDMAGwAawDLAGwAzADLAG0AbADKAG0AywDKAG4AbQDJAG4AygDJAG8AbgDIAG8AyQDIAHAAbwDHAHAAyADHAHEAcADGAHEAxwDGAHIAcQDFAHIAxgDFAHMAcgDEAHMAxQDEAHQAcwDDAHQAxADDAHUAdADCAHUAwwDCAHYAdQDBAHYAwgDBAHcAdgDAAHcAwQDAAHgAdwC/AHgAwAC/AHkAeAC+AHkAvwC+AHoAeQC9AHoAvgC9AHsAegC8AHsAvQC8AHwAewC7AHwAvAC7AH0AfAC6AH0AuwC6AH4AfQC5AH4AugC5AH8AfgC4AH8AuQC4AIAAfwC3AIAAuAC3AIEAgAC2AIEAtwC2AIIAgQC1AIIAtgC1AIMAggC0AIMAtQC0AIQAgwCzAIQAtACzAIUAhACzAIYAhQCyAIYAswCyAIcAhgCxAIcAsgCxAIgAhwCwAKgAsQCoAJAAsQCQAIgAsQCwAKkAqACnAJAAqACnAJEAkACPAIgAkACPAIkAiACvAKkAsACOAIkAjwCvAKoAqQCOAIoAiQCuAKoArwCNAIoAjgCuAKsAqgCNAIsAigCtAKsArgCMAIsAjQCtAKwAqwCmAJEApwCmAJIAkQClAJIApgClAJMAkgCkAJMApQCkAJQAkwCjAJQApACjAJUAlACiAJUAowCiAJYAlQChAJYAogChAJcAlgCgAJcAoQCgAJgAlwCfAJgAoACfAJkAmACeAJkAnwCeAJoAmQCdAJoAngCdAJsAmgCcAJsAnQCJUE5HDQoaCgAAAA1JSERSAAAAAQAAAQAIBgAAAHI+HJgAAAABc1JHQgCuzhzpAAAARGVYSWZNTQAqAAAACAABh2kABAAAAAEAAAAaAAAAAAADoAEAAwAAAAEAAQAAoAIABAAAAAEAAAABoAMABAAAAAEAAAEAAAAAAA8eZ+sAAADiSURBVDgRlZJRDsMwCENR73+pHaxiGAgF0mTZx6pC8cPWoM/NfBETXSxPe9OSWErpR2989V6U0FLVinTu1ZE3vMt05R6Pr2GN4fQpjWwOivuGt7I69V7hNbyVCS/D56jIBvdpW/AO8GmbvFryHyjg+/9rDgDQ5eaghlnhZRayop3wM8plRbvpDbxlq+fTt8FLQ7msbpOZ+VixyBLpsDwavp3AdGELp+YA1h78Acpl6lQNIZsar+7XeJtDDl0eZTK+RSVyaN97I7kGTNsC77KRw+eixJz8/r4mKHARDe+owtviv1UuV3f3k7naAAAAAElFTkSuQmCC", import.meta.url).href },
  { id: "body-derp-copy", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABUEAAA+AcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1kZXJwLWNvcHkiLCJjaGlsZHJlbiI6WzFdfSx7Im1hdHJpeCI6Wy0wLjExMzQ0MDY0MTg0MjM0MjE1LDYuNDk5MDEwMDE4NTE2NTQzLDAsMCwtNC45OTkyMzg0NzU3ODE5NTYsLTAuMDg3MjYyMDMyMTg2NDE3MDQsMCwwLDAsMCw1LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTgxMiwiYnl0ZUxlbmd0aCI6MzAwfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIxMTJ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDg2MTI2NTgwODM0Mzg4NzMsMCwwLjEyOTMyNzE5MjkwMjU2NV0sIm1pbiI6Wy0wLjA4NjEyNjU4MDgzNDM4ODczLDAsLTAuMTI5MzI3MTkyOTAyNTY1XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTM4LCJtYXgiOls0N10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjAsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6MS41NzA3OTYzMjY3OTQ4OTY2fX19fSwiZG91YmxlU2lkZWQiOnRydWUsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFkaWVudCI6dHJ1ZSwibGF5ZXJPcGFjaXR5IjoxLCJzb3VyY2VHcmFkaWVudCI6eyJzdGFydENvbG9yIjoiI0U4RDVCNSIsImVuZENvbG9yIjoiIzY4NDEyYiIsImFuZ2xlIjowLCJjZW50ZXJYIjowLjUsImNlbnRlclkiOjAuNSwicHJvamVjdGlvbkF4aXMiOiJYWiJ9fX1dLCJ0ZXh0dXJlcyI6W3sic2FtcGxlciI6MCwic291cmNlIjowfV0sInNhbXBsZXJzIjpbeyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcyOSwid3JhcFMiOjMzMDcxLCJ3cmFwVCI6MzMwNzF9XSwiaW1hZ2VzIjpbeyJtaW1lVHlwZSI6ImltYWdlL3BuZyIsImJ1ZmZlclZpZXciOjR9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImV4dGVuc2lvbnNVc2VkIjpbIktIUl90ZXh0dXJlX3RyYW5zZm9ybSJdfSBACAAAQklOAAB5gboAAAAAWW4EvlDwBjwAAAAAO9oCvrh0kjwAAAAABhz8vWj24jwAAAAAssHsvbiKGT0AAAAAxlPYvQh1QD0AAAAAkoC/vUhGZT0AAAAAYvaivUqFgz0AAAAAhmODvQhnkj0AAAAAnOxCvWzOnj0AAAAAGHT3vIhBqD0AAAAA4C9KvGpGrj0AAAAAAAi6OyJjsD0AAAAAgKDAPBCurj0AAAAADnsgPc7AqT0AAAAATmJcPUjmoT0AAAAA5eKJPWxplz0AAAAApzKjPSiVij0AAAAAUgC6PdBodz0AAAAAyyvOPTAkVj0AAAAA95TfPUzyMT0AAAAAvBvuPQBpCz0AAAAA/5/5PUg8xjwAAAAA0gABPlCeZjwAAAAASpADPoCyeTsAAAAAWW4EPtBz2LsAAAAANJMDPmRvjLwAAAAAyAsBPlQm4rwAAAAAOs75PYrTGr0AAAAAcmjuPXqrQr0AAAAAQgTgPaTNZ70AAAAAur/OPVi2hL0AAAAA5bi6PaRdk70AAAAA0A2kPQp2n70AAAAAiNyKPd+YqL0AAAAANIZePXZfrr0AAAAAJr8iPSJjsL0AAAAAAEDFPG6Qrr0AAAAAQOvMO1BRqb0AAAAA0D5AvET7oL0AAAAAsCfyvMXjlb0AAAAAjBtAvVBgiL0AAAAArOmBvcKMcb0AAAAA5HOhvejWTr0AAAAAsAK+vQpKKb0AAAAAVuzWvSCRAb0AAAAAFofrvUSusLwAAAAANin7vSAcObwAAAAAf5QCvgAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAFwQ/T4AAAAAfz0MP0FMwzvkkRo/AzfFPOIsKT8WUlk9+bU3P8akuz2u1EU/g88NPoUwUz/4+kQ+/3BfP+UBgT6jPWo/hMyhPvE9cz/fNMQ+bhl6P3+S5z6dd34/dJ4FPwAAgD/RRRc/1MJ+Px3HJj+QL3s/pkA1P5N8dT/pokI/PeBtP2LeTj/tkGQ/juNZPwHFWT/pomM/2bJNP+4MbD/VkEA/GhJzP1SVMj/oong/tPYjP9avfD9W6xQ/Xyl/P5ipBT8AAIA/n13sPjAsfz94C80+brp8P7zxrT5AuXg/cKWPPiw3cz8sd2U+t0JsP2KSLz5n6mM/DY39PcE8Wj89e6g9TEhPP8OGRD2NG0M/BOa0PArFNT/6Grs7SFMnPwAAAADO1Bc/cFapO4AwBj/8KqQ8/MXoPobfMj2hfMU+MtSZPfsooz7CR+g9G2+CPhZtIT4X5kc+ls1TPrmxED6fJoU+axLBPfb5oT6/0mI9veS/Pgbi0zzlat4+mP/kOy8AAQAAAC8AAgABAC4AAgAvAC4AAwACAC0AAwAuAC0ABAADACwABAAtACwABQAEACsABQAsACsABgAFACoABgArACoABwAGACkABwAqACkACAAHACgACAApACgACQAIACcACQAoACcACgAJACYACgAnACYACwAKACUACwAmACUADAALACQADAAlACQADQAMACMADQAkACMADgANACIADgAjACIADwAOACEADwAiACEAEAAPACAAEAAhACAAEQAQAB8AEQAgAB8AEgARAB4AEgAfAB4AEwASAB0AEwAeAB0AFAATABwAFAAdABwAFQAUABsAFQAcABsAFgAVABoAFgAbABoAFwAWABkAFwAaABkAGAAXAIlQTkcNChoKAAAADUlIRFIAAAABAAABAAgGAAAAcj4cmAAAAAFzUkdCAK7OHOkAAABEZVhJZk1NACoAAAAIAAGHaQAEAAAAAQAAABoAAAAAAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAAGgAwAEAAAAAQAAAQAAAAAADx5n6wAAAJVJREFUOBG9k9ENgDAIREn3X8dR3MEt8AgfCIHa1ka/SIC+uyPSdR7cmJka4etULF2SuVDpLhoo5JWkkhE0ZddXurvGVS0JzRQE2kMB1tRHqSC4VJpl0OXWCt65doVUgXDNh4zMJW4+5pwPcrc738edc+65C4njARDdP1Mmnt7cKygvHRNPuL84X+M+nHu/A4mr82/cGxwfoeEgfZUnAAAAAElFTkSuQmCCAA==", import.meta.url).href },
  { id: "body-dill", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACMEQAAfAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1kaWxsIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOlsxLjk5ODQwMTQ0NDMyNTI4MThlLTE1LC05LDAsMCw5LDEuOTk4NDAxNDQ0MzI1MjgxOGUtMTUsMCwwLDAsMCw5LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTAwNiIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDA2In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NzIwLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjcyMCwiYnl0ZUxlbmd0aCI6NzIwLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE0NDAsImJ5dGVMZW5ndGgiOjQ4MCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE5MjAsImJ5dGVMZW5ndGgiOjI4NCwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjIyMDQsImJ5dGVMZW5ndGgiOjM0NH1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyNTQ4fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYwLCJtYXgiOlswLjA4NDY2ODM5NzkwMzQ0MjM4LDAsMC4wNDIzMjUyNTgyNTUwMDQ4OF0sIm1pbiI6Wy0wLjA4NDY2ODM5NzkwMzQ0MjM4LDAsLTAuMDQyMzI1MjU4MjU1MDA0ODhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYwLCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsLTEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NjAsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTQxLCJtYXgiOls1OV0sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjAsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6LTEuMzQzOTAzNTI0MDM1NjM0fX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlLCJsYXllck9wYWNpdHkiOjF9fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX1dLCJpbWFnZXMiOlt7Im1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwiYnVmZmVyVmlldyI6NH1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjMsIm1hdGVyaWFsIjowfV19XSwiZXh0ZW5zaW9uc1VzZWQiOlsiS0hSX3RleHR1cmVfdHJhbnNmb3JtIl19IPQJAABCSU4AoGYtvQAAAABAXS09oGYtvQAAAABAXS094OpEvQAAAADQxys9oGatPQAAAABAXS09oGatPQAAAABAXS09oGatPQAAAABAXS09oGatPQAAAABAXS09oGatPQAAAABAXS09UCojvQAAAABAXS09UCojvQAAAABAXS09AN4GvQAAAABAXS09AD24vAAAAABAXS09AD24vAAAAABAXS09QCIavAAAAABAXS09ADiyOwAAAABAXS09ADiyOwAAAABAXS09wGatPAAAAABAXS09wGatPAAAAABAXS09wB8XPQAAAABAXS09wB8XPQAAAABAXS09UO9TPQAAAABAXS09UO9TPQAAAABAXS09oMKEPQAAAABAXS09YCKaPQAAAABAXS09gEioPQAAAABAXS09wOpEvQAAAADAxyu9oGatPQAAAABAXS294HlbvQAAAADIKie9wN5wvQAAAABQux+9MHKCvQAAAABorhW92KqLvQAAAAAYOQm90P6TvQAAAADQIPW8kFObvQAAAADQ0tO8kI6hvQAAAABA8q68SJWmvQAAAAAw6Ya8OE2qvQAAAACAQzi82JusvQAAAAAAGLy7oGatvQAAAAAAAACA6JusvQAAAACAGLw7SE2qvQAAAADAQzg8WJWmvQAAAABQ6YY8oI6hvQAAAABg8q48oFObvQAAAADw0tM84P6TvQAAAADwIPU86KqLvQAAAAAoOQk9QHKCvQAAAAB4rhU94N5wvQAAAABgux89AHpbvQAAAADYKic9gEioPQAAAABAXS29YCKaPQAAAABAXS29mMKEPQAAAABAXS29QO9TPQAAAABAXS29sB8XPQAAAABAXS29oGatPAAAAABAXS29gDeyOwAAAABAXS29gCIavAAAAABAXS29ID24vAAAAABAXS29EN4GvQAAAABAXS29YCojvQAAAABAXS29oGYtvQAAAABAXS29AAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgD8AAAAA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", import.meta.url).href },
  { id: "body-eggnew", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC8DwAAPAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1lZ2duZXciLCJjaGlsZHJlbiI6WzFdfSx7Im1hdHJpeCI6WzYuNSwwLDAsMCwwLDYuNSwwLDAsMCwwLDYuNSwwLDAsMCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlIn0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4MTIsImJ5dGVMZW5ndGgiOjMzNn1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyMTQ4fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA4NjEyNjU4MDgzNDM4ODczLDAsMC4xMjkzMjcxOTI5MDI1NjVdLCJtaW4iOlstMC4wODYxMjY1ODA4MzQzODg3MywwLC0wLjEyOTMyNzE5MjkwMjU2NV0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOjAuMDE3NDUzMjkyNTE5OTQzMDk4fX19fSwiZG91YmxlU2lkZWQiOnRydWUsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFkaWVudCI6dHJ1ZSwibGF5ZXJPcGFjaXR5IjoxfX1dLCJ0ZXh0dXJlcyI6W3sic2FtcGxlciI6MCwic291cmNlIjowfV0sInNhbXBsZXJzIjpbeyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcyOSwid3JhcFMiOjMzMDcxLCJ3cmFwVCI6MzMwNzF9XSwiaW1hZ2VzIjpbeyJtaW1lVHlwZSI6ImltYWdlL3BuZyIsImJ1ZmZlclZpZXciOjR9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJp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", import.meta.url).href },
  { id: "body-exportball", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB4EAAA2AcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1leHBvcnRiYWxsIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOls4LjYsMCwwLDAsMCw4LjYsMCwwLDAsMCw4LjYsMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDQ5IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wNDkifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTgxMiwiYnl0ZUxlbmd0aCI6MzY4fV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIxODB9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDc2MDYwNDczOTE4OTE0OCwwLDAuMDc2MDQ0MzgwNjY0ODI1NDRdLCJtaW4iOlstMC4wNzYwNjA0MTQzMTQyNzAwMiwwLC0wLjA3NjA0NDM4MDY2NDgyNTQ0XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTM4LCJtYXgiOls0N10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjAsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6MC4wMzQ5MDY1ODUwMzk4ODY2NH19fX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAxNiIsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFkaWVudCI6dHJ1ZSwibGF5ZXJPcGFjaXR5IjoxLCJzb3VyY2VHcmFkaWVudCI6eyJzdGFydENvbG9yIjoiI2MxZmRmZiIsImVuZENvbG9yIjoiI2UwNTc2YSIsImFuZ2xlIjo4OCwiY2VudGVyWCI6MC41LCJjZW50ZXJZIjowLjUsInByb2plY3Rpb25BeGlzIjoiWFoifX19XSwidGV4dHVyZXMiOlt7InNhbXBsZXIiOjAsInNvdXJjZSI6MH1dLCJzYW1wbGVycyI6W3sibWFnRmlsdGVyIjo5NzI5LCJtaW5GaWx0ZXIiOjk3MjksIndyYXBTIjozMzA3MSwi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DgAIAA8ACQAIABAADwAHABAACAAHABEAEAAGABEABwAGABIAEQAFABIABgAFABMAEgAEABMABQAEABQAEwADABQABAADABUAFAACABUAAwACABYAFQABABYAAgABABcAFgAAABcAAQAAABgAFwAvABgAAAAvABkAGAAuABkALwAuABoAGQAtABoALgAtABsAGgAsABsALQAsABwAGwArABwALAArAB0AHAAqAB0AKwAqAB4AHQApAB4AKgApAB8AHgAoAB8AKQAoACAAHwAnACAAKAAnACEAIAAmACEAJwAmACIAIQAlACIAJgAlACMAIgAkACMAJQCJUE5HDQoaCgAAAA1JSERSAAAAAQAAAQAIBgAAAHI+HJgAAAABc1JHQgCuzhzpAAAARGVYSWZNTQAqAAAACAABh2kABAAAAAEAAAAaAAAAAAADoAEAAwAAAAEAAQAAoAIABAAAAAEAAAABoAMABAAAAAEAAAEAAAAAAA8eZ+sAAADZSURBVDgRlZJREsQgCEOx979UD7bjiigEEHe2X23BZ0Kg99P7Q73TQ+NZb328NeJ/s8CfJJ/aos2rLxcCtB0p8w53tsmVXpDeNlSoltHyJ9SdRdRWAGYqv9NWqwQFqJiB5tIWm4E+U7qlWQA/oDqh1FdAZYhxBbxSgGZBIemp9Aw1BYxnKExcFOxCgGLShTRJRpVKFFdbEVqdXZMspJlS6QOKnvDbhEl7M7ACu5CgRQA1FATZxAtplzXL4aWkFRrGrrYuO6lneVbn9eEWReH65IL5kLXwASjlC4NjP64V42+IAAAAAElFTkSuQmCCAA==", import.meta.url).href },
  { id: "body-plainball", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADUDwAATAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1wbGFpbmJhbGwiLCJjaGlsZHJlbiI6WzFdfSx7Im1hdHJpeCI6WzcuNiwwLDAsMCwwLDcuNiwwLDAsMCwwLDcuNiwwLDAsMCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwNDkiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjA0OSJ9LCJtZXNoIjowfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMTUyLCJieXRlTGVuZ3RoIjozODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNTM2LCJieXRlTGVuZ3RoIjoyNzYsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxODEyLCJieXRlTGVuZ3RoIjozNDR9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MjE1Nn1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMC4wNzYwNjA0NzM5MTg5MTQ4LDAsMC4wNzYwNDQzODA2NjQ4MjU0NF0sIm1pbiI6Wy0wLjA3NjA2MDQxNDMxNDI3MDAyLDAsLTAuMDc2MDQ0MzgwNjY0ODI1NDRdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMSwxXSwibWluIjpbMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsIm1heCI6WzQ3XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MSwiYmFzZUNvbG9yVGV4dHVyZSI6eyJpbmRleCI6MCwidGV4Q29vcmQiOjAsImV4dGVuc2lvbnMiOnsiS0hSX3RleHR1cmVfdHJhbnNmb3JtIjp7InJvdGF0aW9uIjowLjAzNDkwNjU4NTAzOTg4NjY0fX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE2IiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlfX1dLCJ0ZXh0dXJlcyI6W3sic2FtcGxlciI6MCwic291cmNlIjowfV0sInNhbXBsZXJzIjpbeyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcyOSwid3JhcFMiOjMzMDcxLCJ3cmFwVCI6MzMwNzF9XSwiaW1hZ2VzIjpbeyJtaW1lVHlwZSI6ImltYWdlL3BuZyIsImJ1ZmZlclZpZXciOjR9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRF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", import.meta.url).href },
  { id: "body-roundbee", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADIDwAASAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1yb3VuZGJlZSIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbNy43LDAsMCwwLDAsNy43LDAsMCwwLDAsNy43LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4MTIsImJ5dGVMZW5ndGgiOjMzNn1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyMTQ4fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4MjU0NF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOi0wLjY4MDY3ODQwODI3Nzc4ODR9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMTYiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWV9fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX1dLCJpbWFnZXMiOlt7Im1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwiYnVmZmVyVmlldyI6NH1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVY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", import.meta.url).href },
  { id: "body-squirc", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC0AAAAmAAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1zcXVpcmMifV19IAAAAABCSU4A", import.meta.url).href },
  { id: "body-star", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABAJgAAaAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1zdGFyIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOls2LjgsMCwwLDAsMCw2LjgsMCwwLDAsMCw2LjgsMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDM3IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMzcifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjoyNDEyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjI0MTIsImJ5dGVMZW5ndGgiOjI0MTIsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NDgyNCwiYnl0ZUxlbmd0aCI6MTYwOCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjY0MzIsImJ5dGVMZW5ndGgiOjExNjQsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo3NTk2LCJieXRlTGVuZ3RoIjoyNzJ9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6Nzg2OH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyMDEsIm1heCI6WzAuMTA0MTAwODIzNDAyNDA0NzksMCwwLjEwMDk1Mzc4NzU2NTIzMTMyXSwibWluIjpbLTAuMTA0MTAwODgzMDA3MDQ5NTYsMCwtMC4xMDA5NTM3ODAxMTQ2NTA3M10sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MjAxLCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyMDEsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6NTgyLCJtYXgiOlsyMDBdLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MH19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMTEiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWUsImxheWVyT3BhY2l0eSI6MSwic291cmNlR3JhZGllbnQiOnsic3RhcnRDb2xvciI6IiNmZWNkZmEiLCJlbmRDb2xvciI6IiM3YzQxYWQiLCJhbmdsZSI6OTAsImNlbnRlclgiOjAuNSwiY2VudGVyWSI6MC41LCJwcm9qZWN0aW9uQXhpcyI6IlhaIn19fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX1dLCJpbWFnZXMiOlt7Im1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwiYnVmZmVyVmlldyI6NH1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjMsIm1hdGVyaWFsIjowfV19XX28HgAAQklOAIBS8rwAAAAAu7+zvaBX4rwAAAAA/eO3vYBW4jwAAAAA/eO3vYBS8jwAAAAAu7+zvQDK9bwAAAAA7ciyvQDK9TwAAAAA7ciyvcBf/7wAAAAAkx6wvcBf/zwAAAAAkx6wvUDtBr0AAAAAyxesvUDtBj0AAAAAyxesvXAAEL0AAAAArwunvXAAED0AAAAArwunveBMGr0AAAAAW1GhveBMGj0AAAAAW1GhvfA1Jb0AAAAA6z+bvfA1JT0AAAAA6z+bvQAfML0AAAAAey6VvQAfMD0AAAAAey6VvXBrOr0AAAAAJ3SPvXBrOj0AAAAAJ3SPvaB+Q70AAAAAC2iKvaB+Qz0AAAAAC2iKvQC8Sr0AAAAAQ2GGvQC8Sj0AAAAAQ2GGveCGT70AAAAA6baDveCGTz0AAAAA6baDvaBCUb0AAAAAG8CCvaBCUT0AAAAAG8CCvWChU70AAAAAYTmCvSjapD0AAAAAJgNQvbAuWr0AAAAA8cSAvYAUZL0AAAAApiR9vaB8cL0AAAAAIqJ3vQCRfr0AAAAAcmFxvcC9hr0AAAAAqsFqvQAzjr0AAAAA4iFkvTA9lb0AAAAAMuFdvUBxm70AAAAArl5YvShkoL0AAAAAcvlTvdCqo70AAAAAkhBRvSjapL0AAAAAJgNQvRAHqr0AAAAACvlKvbgGqj0AAAAACvlKvSj7rr0AAAAA/kBFvaD6rj0AAAAA/kBFvfCys70AAAAA7uI+vUiysz0AAAAA7uI+vdAquL0AAAAAwuY3vSAquD0AAAAAwuY3vUBfvL0AAAAAZlQwvZhevD0AAAAAZlQwvbBMwL0AAAAAvjMovRhMwD0AAAAAvjMovYjvw70AAAAAtowfvRDvwz0AAAAAtowfvUBEx70AAAAANmcWvehDxz0AAAAANmcWvUhHyr0AAAAAKssMvRBHyj0AAAAAKssMvRD1zL0AAAAAdsACvfD0zD0AAAAAdsACvQhKz70AAAAADJ7wvPhJzz0AAAAADJ7wvKBC0b0AAAAAjP3avKBC0T0AAAAAjP3avAjY0r0AAAAAfNzEvADY0j0AAAAAfNzEvNAG1L0AAAAAlHuuvMgG1D0AAAAAlHuuvJDP1L0AAAAABPCXvIjP1D0AAAAABPCXvNgy1b0AAAAA/E6BvNAy1T0AAAAA/E6BvDgx1b0AAAAAaFtVvDAx1T0AAAAAaFtVvEDL1L0AAAAAyEIovDjL1D0AAAAAyEIovIAB1L0AAAAA8Pz2u3gB1D0AAAAA8Pz2u4jU0r0AAAAA0HGeu4DU0j0AAAAA0HGeu+hE0b0AAAAA4HEOu+BE0T0AAAAA4HEOuyhTz70AAAAAAI3lOSBTzz0AAAAAAI3lOeD/zL0AAAAAYN1DO9j/zD0AAAAAYN1DO5hLyr0AAAAA0DOzO5hLyj0AAAAA0DOzOxBMqb0AAAAAanMIPVilyT0AAAAAoCfFO7jZxz0AAAAAsMn2O2gjxT0AAAAAAOIgPBC9wT0AAAAAOOBPPGDhvT0AAAAAQJqCPAjLuT0AAAAA6NmePLC0tT0AAAAAkBm7PADZsT0AAAAAtMPVPKhyrj0AAAAA0ELtPFi8qz0AAAAAsgAAPbjwqT0AAAAA9DQGPZBKqT0AAAAAanMIPagpqb0AAAAAhgcLPRB3oj0AAAAAXcCFPYDKqL0AAAAAjCgSPcg6qL0AAAAAfu0cPaCGp70AAAAAYm0qPSi6pr0AAAAAPL85PZDhpb0AAAAAEvpJPfgIpb0AAAAA6DRaPYA8pL0AAAAAwoZpPViIo70AAAAApgZ3PaD4or0AAAAAzOWAPXiZor0AAAAATnaEPRB3or0AAAAAXcCFPeCqob0AAAAARnOLPeCqoT0AAAAARnOLPWh6oD0AAAAALQuRPWh6oL0AAAAALguRPUjonj0AAAAAc4OWPVDonr0AAAAAdIOWPTj3nD0AAAAAdtebPUD3nL0AAAAAeNebPdipmj0AAAAAlgKhPeCpmr0AAAAAmAKhPdgCmD0AAAAAMgCmPeACmL0AAAAANACmPeAElT0AAAAAqsuqPegElb0AAAAAqsuqPaCykT0AAAAAWmCvPaiykb0AAAAAXGCvPcAOjj0AAAAApbmzPcgOjr0AAAAAprmzPegbij0AAAAA6NK3PfAbir0AAAAA6dK3PcDchT0AAAAAgqe7Pcjchb0AAAAAhKe7PQBUgT0AAAAA1TK/PQBUgT0AAAAA1TK/PQBUgT0AAAAA1TK/PQBUgb0AAAAA1TK/PQBUgb0AAAAA1TK/PQBUgb0AAAAA1TK/PSAceb0AAAAADGrCPQAAAAAAAAAA1TK/PQAAAAAAAAAA1TK/PRDiAL0AAAAANfXMPQBQIjoAAAAAJHi/PUAceT0AAAAACmrCPQDBGDsAAAAAwDfAPQAboTsAAAAANVnBPUCoBTwAAAAAC8TCPcAybz0AAAAAqUTFPQDsQTwAAAAAzV/EPSDigDwAAAAABhTGPeD1ZD0AAAAAk8HHPUDOoDwAAAAAPsjHPRBwWj0AAAAArN/JPSDwvjwAAAAAAGTJPYB92TwAAAAA1s7KPcCrTz0AAAAA1Z3LPSCs7jwAAAAASvDLPVCzRD0AAAAA8vrMPcCx/DwAAAAA56/MPRDiAD0AAAAANfXMPWA4DD0AAAAAyfXNPTCROT0AAAAA5vXNPQCZFz0AAAAAoY7OPdBPLj0AAAAAko3OPaD5Ij0AAAAA28DOPaAyb70AAAAAqkTFPcD1ZL0AAAAAlMHHPfBvWr0AAAAArd/JPaCrT70AAAAA1p3LPTCzRL0AAAAA9PrMPUA4DL0AAAAAyvXNPRCROb0AAAAA5/XNPeCYF70AAAAAoo7OPbBPLr0AAAAAlI3OPYD5Ir0AAAAA3MDOPWBV0TwAAAAAe7e7vaBX0bwAAAAAe7e7veBivzwAAAAABTi/vQBmv7wAAAAABTi/vYCSrDwAAAAAb2PCvUCWrLwAAAAAb2PCvcD3mDwAAAAAizfFveD7mLwAAAAAizfFvSCmhDwAAAAAK7LHvWCqhLwAAAAAK7LHvUBiXzwAAAAAI9HJvYBqX7wAAAAAI9HJvYBYNDwAAAAARZLLvQBgNLwAAAAARZLLvQBWCDwAAAAAY/PMvUBcCLwAAAAAY/PMvYADtzsAAAAAT/LNvYAMt7sAAAAAT/LNvQALODsAAAAA24zOvQAUOLsAAAAA24zOvQAAAAAAAAAA28DOvQAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/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", import.meta.url).href },
  { id: "body-superdrip", category: "body", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABAEAAA2AcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYm9keS1zdXBlcmRyaXAiLCJjaGlsZHJlbiI6WzFdfSx7Im1hdHJpeCI6WzI1LDAsMCwwLDAsMjUsMCwwLDAsMCwyNSwwLDAsMCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMTEiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAxMSJ9LCJtZXNoIjowfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMTUyLCJieXRlTGVuZ3RoIjozODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNTM2LCJieXRlTGVuZ3RoIjoyNzYsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxODEyLCJieXRlTGVuZ3RoIjozMTJ9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MjEyNH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMC4wMTk0NjEwOTUzMzMwOTkzNjUsMCwwLjAyODk3NDQ3MzQ3NjQwOTkxMl0sIm1pbiI6Wy0wLjAxOTQ2MDk3NjEyMzgwOTgxNCwwLC0wLjAyODk3NDQ0MzY3NDA4NzUyNF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOjAuMjc5MjUyNjgwMzE5MDkyNjd9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDMiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWUsImxheWVyT3BhY2l0eSI6MSwic291cmNlR3JhZGllbnQiOnsic3RhcnRDb2xvciI6IiNjMWZkZmYiLCJlbmRDb2xvciI6IiM1M2EwZmYiLCJhbmdsZSI6NzQsImNlbnRlclgiOjAuNSwiY2VudGVyWSI6MC41LCJwcm9qZWN0aW9uQXhpcyI6IlhaIn19fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEs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", import.meta.url).href },
  { id: "brows-flat", category: "brows", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC8BgAAFAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiYnJvd3MtZmxhdCIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbNSwwLDAsMCwwLDEuMiwwLDAsMCwwLDEsMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDU1IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wNTUifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo0OCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo0OCwiYnl0ZUxlbmd0aCI6NDgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6OTYsImJ5dGVMZW5ndGgiOjMyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTI4LCJieXRlTGVuZ3RoIjoxMiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxNDB9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NCwibWF4IjpbMC4wNDQwMjc1NjY5MDk3OTAwNCwwLDAuMDQ0MDE4MjY4NTg1MjA1MDhdLCJtaW4iOlstMC4wNDQwMjc1NjY5MDk3OTAwNCwwLC0wLjA0NDAxODI2ODU4NTIwNTA4XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjYsIm1heCI6WzNdLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJiYXNlQ29sb3JGYWN0b3IiOlswLjAxMDMyOTgyMzAyNjM2NDU0OCwwLjAxMDMyOTgyMzAyNjM2NDU0OCwwLjAxMDMyOTgyMzAyNjM2NDU0OCwxXSwibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAxNiIsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFkaWVudCI6ZmFsc2V9fV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3sibW9kZSI6NCwiYXR0cmlidXRlcyI6eyJQT1NJVElPTiI6MCwiTk9STUFMIjoxLCJURVhDT09SRF8wIjoyfSwiaW5kaWNlcyI6MywibWF0ZXJpYWwiOjB9XX1dfYwAAABCSU4AQFY0vQAAAACATDS9QFY0vQAAAACATDQ9QFY0PQAAAACATDS9QFY0PQAAAACATDQ9AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAACAPwAAgD8AAAAAAACAPwAAgD8BAAIAAAABAAMAAgA=", import.meta.url).href },
  { id: "ear-drop", category: "ear", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACAEwAAEAoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiZWFyLWRyb3AiLCJjaGlsZHJlbiI6WzEsM119LHsibWF0cml4IjpbLTE4LDIuMjA0MzY0MjM4NDY1MjM2ZS0xNSwwLDAsLTIuMjA0MzY0MjM4NDY1MjM2ZS0xNSwtMTgsMCwwLDAsMCwxOCwwLDAsLTAuMjQzNjQ5Mzk2Mzc4MjY5NjYsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDExIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMTEifSwibWVzaCI6MH0seyJtYXRyaXgiOlstMTUsMS44MzY5NzAxOTg3MjEwM2UtMTUsMCwwLC0xLjgzNjk3MDE5ODcyMTAzZS0xNSwtMTUsMCwwLDAsMCwxNSwwLDAsMC4yNDM2NDkzOTYzNzgyNjk2Niw0LDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzRdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMTEiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAxMSJ9LCJtZXNoIjoxfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMTUyLCJieXRlTGVuZ3RoIjozODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNTM2LCJieXRlTGVuZ3RoIjoyNzYsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxODEyLCJieXRlTGVuZ3RoIjo1NzZ9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MjM4OH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMC4wMTk0NjEwOTUzMzMwOTkzNjUsMCwwLjAyODk3NDQ3MzQ3NjQwOTkxMl0sIm1pbiI6Wy0wLjAxOTQ2MDk3NjEyMzgwOTgxNCwwLC0wLjAyODk3NDQ0MzY3NDA4NzUyNF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOi0zLjUwODExMTc5NjUwODYwMTd9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDMiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWV9fSx7InBick1ldGFsbGljUm91Z2huZXNzIjp7ImJhc2VDb2xvckZhY3RvciI6WzAuOTkxMTAyMDk3MTEzNjI1NywwLjYxMDQ5NTU3MDgwMDE3MTYsMC45NTU5NzMzNTMyNDgyODY2LDFdLCJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxfSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50IjpmYWxzZX19XSwidGV4dHVyZXMiOlt7InNhbXBsZXIiOjAsInNvdXJjZSI6MH1dLCJzYW1wbGVycyI6W3sibWFnRmlsdGVyIjo5NzI5LCJtaW5GaWx0ZXIiOjk3MjksIndyYXBTIjozMzA3MSwid3JhcFQiOjMzMDcxfV0sImltYWdlcyI6W3sibWltZVR5cGUiOiJpbWFnZS9wbmciLCJidWZmZXJWaWV3Ijo0fV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3sibW9kZSI6NCwiYXR0cmlidXRlcyI6eyJQT1NJVElPTiI6MCwiTk9STUFMIjoxLCJURVhDT09SRF8wIjoyfSwiaW5kaWNlcyI6MywibWF0ZXJpYWwiOjB9XX0seyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MX1dfV0sImV4dGVuc2lvbnNVc2VkIjpbIktIUl90ZXh0dXJlX3RyYW5zZm9ybSJdfSAgIFQJAABCSU4AAF3DuwAAAADQW+28ALdkuwAAAACw3ty8ANRWugAAAADglci8ACIBOwAAAAAwHLG8gFKdOwAAAACADJe8ANX4OwAAAABAA3a8wEEoPAAAAADgLDu8AOVQPAAAAAAAl/27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", import.meta.url).href },
  { id: "ear-rounder", category: "ear", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABAEgAAtAkAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiZWFyLXJvdW5kZXIiLCJjaGlsZHJlbiI6WzEsM119LHsibWF0cml4IjpbNCwwLDAsMCwwLDQsMCwwLDAsMCw0LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjB9LHsibWF0cml4IjpbMy4zLDAsMCwwLDAsMy4zLDAsMCwwLDAsMy4zLDAsMCwwLDEsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbNF19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjF9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4MTIsImJ5dGVMZW5ndGgiOjM0OH1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyMTYwfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4MjU0NF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOi0zLjE0MTU5MjY1MzU4OTc5M319fX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAxNiIsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFk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", import.meta.url).href },
  { id: "eyelid-closed", category: "eyelid", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAEFgAAsA8AAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiZXllbGlkLWNsb3NlZCIsImNoaWxkcmVuIjpbMSwzLDVdfSx7Im1hdHJpeCI6WzYuNjYxMzM4MTQ3NzUwOTM5ZS0xNiwtMywwLDAsMyw2LjY2MTMzODE0Nzc1MDkzOWUtMTYsMCwwLDAsMCwzLDAsLTAuNzU3MjUxODQ0Mzk5NzMxNCw1MC44NjM3MjQwMTA3MzEwNTUsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAxIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDEifSwibWVzaCI6MH0seyJtYXRyaXgiOlstNi42NjEzMzgxNDc3NTA5MzllLTE2LDMsMCwwLC0zLC02LjY2MTMzODE0Nzc1MDkzOWUtMTYsMCwwLDAsMCwzLDAsLTAuODY0MDY0NTk1OTA4Nzg1NiwtNTAuNjE2MzI4MTc3Mzk3NzMsMiwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOls0XX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAxIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDEifSwibWVzaCI6MX0seyJtYXRyaXgiOls2LDAsMCwwLDAsMC40LDAsMCwwLDAsMSwwLDEuNjIxMzE2NDQwMzA4NTE3NiwtMC4yNDczOTU4MzMzMzMzMjYyNCwzLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzZdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwNTUiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjA1NSJ9LCJtZXNoIjoyfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjMwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjozMDAsImJ5dGVMZW5ndGgiOjMwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo2MDAsImJ5dGVMZW5ndGgiOjIwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjgwMCwiYnl0ZUxlbmd0aCI6MTQwLCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6OTQwLCJieXRlTGVuZ3RoIjo0OCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo5ODgsImJ5dGVMZW5ndGgiOjQ4LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjEwMzYsImJ5dGVMZW5ndGgiOjMyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTA2OCwiYnl0ZUxlbmd0aCI6MTIsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMDgwLCJieXRlTGVuZ3RoIjo1MTJ9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTU5Mn1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyNSwibWF4IjpbMC4wNDIzMzQxOTg5NTE3MjExOSwwLDAuMDg0NjUwNTE2NTEwMDA5NzddLCJtaW4iOlstMC4wNDIzMzQxOTg5NTE3MjExOSwwLC0wLjA4NDY1MDUxNjUxMDAwOTc3XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyNSwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MjUsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6NjksIm1heCI6WzI0XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifSx7ImJ1ZmZlclZpZXciOjQsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0LCJtYXgiOlswLjA0NDAyNzU2NjkwOTc5MDA0LDAsMC4wNDQwMTgyNjg1ODUyMDUwOF0sIm1pbiI6Wy0wLjA0NDAyNzU2NjkwOTc5MDA0LDAsLTAuMDQ0MDE4MjY4NTg1MjA1MDhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQsIm1heCI6WzAuOTk5Nzg4ODIwNzQzNTYwOCwxXSwibWluIjpbOS4xMTQ3NzgyNjU0ODQzNDdlLTksMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3Ijo3LCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6NiwibWF4IjpbM10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjAsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6MS41NzA3OTYzMjY3OTQ4OTY2fX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlfX0seyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOjEuNTcwNzk2MzI2Nzk0ODk2Nn19fX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAwMSIsImV4dHJhcyI6eyJzb3VyY2VIYXNHcmFkaWVudCI6dHJ1ZX19LHsicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC4wMTAzMjk4MjMwMjYzNjQ1NDgsMC4wMTAzMjk4MjMwMjYzNjQ1NDgsMC4wMTAzMjk4MjMwMjYzNjQ1NDgsMV0sIm1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjF9LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMTYiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWV9fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBU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", import.meta.url).href },
  { id: "eyelid-squint", category: "eyelid", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAQEwAAAAwAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiZXllbGlkLXNxdWludCIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOls0Ljc5NjE2MzQ2NjM4MDY3N2UtMTYsLTIuMTYsMCwwLDIuNyw1Ljk5NTIwNDMzMjk3NTg0NmUtMTYsMCwwLDAsMCwyLjcsMCwwLjEyMTgyNDY5ODE4OTEzNDgsNTgsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAxIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDEifSwibWVzaCI6MH0seyJtYXRyaXgiOls0Ljc5NjE2MzQ2NjM4MDY3N2UtMTYsMi4xNiwwLDAsLTIuNyw1Ljk5NTIwNDMzMjk3NTg0NmUtMTYsMCwwLDAsMCwyLjcsMCwtMC4xMjE4MjQ2OTgxODkxMzQ4LC01OCwyLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzRdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMDEiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAwMSJ9LCJtZXNoIjoxfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjMwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjozMDAsImJ5dGVMZW5ndGgiOjMwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo2MDAsImJ5dGVMZW5ndGgiOjIwMCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjgwMCwiYnl0ZUxlbmd0aCI6MTQwLCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6OTQwLCJieXRlTGVuZ3RoIjo0MjB9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMzYwLCJieXRlTGVuZ3RoIjo0MjB9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTc4MH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyNSwibWF4IjpbMC4wNDIzMzQxOTg5NTE3MjExOSwwLDAuMDg0NjUwNTE2NTEwMDA5NzddLCJtaW4iOlstMC4wNDIzMzQxOTg5NTE3MjExOSwwLC0wLjA4NDY1MDUxNjUxMDAwOTc3XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyNSwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MjUsIm1heCI6WzEsMV0sIm1pbiI6WzAsMF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6NjksIm1heCI6WzI0XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MSwiYmFzZUNvbG9yVGV4dHVyZSI6eyJpbmRleCI6MCwidGV4Q29vcmQiOjAsImV4dGVuc2lvbnMiOnsiS0hSX3RleHR1cmVfdHJhbnNmb3JtIjp7InJvdGF0aW9uIjoxLjAyOTc0NDI1ODY3NjY1NDN9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDEiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWUsImxheWVyT3BhY2l0eSI6MSwic291cmNlR3JhZGllbnQiOnsic3RhcnRDb2xvciI6IiNmMmY3YjciLCJlbmRDb2xvciI6IiM1ODM0MDAiLCJhbmdsZSI6MzEsImNlbnRlclgiOjAuNSwiY2VudGVyWSI6MC41LCJwcm9qZWN0aW9uQXhpcyI6IlhaIn19fSx7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjEsImJhc2VDb2xvclRleHR1cmUiOnsiaW5kZXgiOjEsInRleENvb3JkIjowLCJleHRlbnNpb25zIjp7IktIUl90ZXh0dXJlX3RyYW5zZm9ybSI6eyJyb3RhdGlvbiI6LTMuODc0NjMwOTM5NDI3NDExfX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlLCJsYXllck9wYWNpdHkiOjEsInNvdXJjZUdyYWRpZW50Ijp7InN0YXJ0Q29sb3IiOiIjZjJmN2I3IiwiZW5kQ29sb3IiOiIjNTgzNDAwIiwiYW5nbGUiOjMxMiwiY2VudGVyWCI6MC41LCJjZW50ZXJZIjowLjUsInByb2plY3Rpb25BeGlzIjoiWFoifX19XSwidGV4dHVyZXMiOlt7InNhbXBsZXIiOjAsInNvdXJjZSI6MH0seyJzYW1wbGVyIjoxLCJzb3VyY2UiOjF9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX0seyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcy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", import.meta.url).href },
  { id: "horns-hornb", category: "horns", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAQDQAA4AUAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiaG9ybnMtaG9ybmIiLCJjaGlsZHJlbiI6WzFdfSx7Im5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTAwMiIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDAyIn0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxODEyfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjEyOTU2Mjg1NDc2Njg0NTcsMCwwLjI1NDkxODQyNjI3NTI1MzNdLCJtaW4iOlstMC4xMjk1NjI4NTQ3NjY4NDU3LDAsLTAuMjU0OTE4NDI2Mjc1MjUz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", import.meta.url).href },
  { id: "legs-drip", category: "legs", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAD4DwAAcAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoibGVncy1kcmlwIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOlstMi45LDMuNTUxNDc1NzE3NTI3MzI0M2UtMTYsMCwwLC0zLjU1MTQ3NTcxNzUyNzMyNDNlLTE2LC0yLjksMCwwLDAsMCwyLjksMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAzIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDMifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTgxMiwiYnl0ZUxlbmd0aCI6MzQ0fV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIxNTZ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDc2MjUxMjY4Mzg2ODQwODIsMCwwLjE2ODQ1ODg3ODk5Mzk4ODA0XSwibWluIjpbLTAuMDc2MjUxMjgzMjg4MDAyMDEsMCwtMC4xNjg0NTg5MDg3OTYzMTA0Ml0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOjAuNDE4ODc5MDIwNDc4NjM5fX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlfX1dLCJ0ZXh0dXJlcyI6W3sic2FtcGxlciI6MCwic291cmNlIjowfV0sInNhbXBsZXJzIjpbeyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcyOSwid3JhcFMiOjMzMDcxLCJ3cmFwVCI6MzMwNzF9XSwiaW1hZ2VzIjpbeyJtaW1lVHlwZSI6ImltYWdlL3BuZyIsImJ1ZmZlclZpZXciOjR9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJh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", import.meta.url).href },
  { id: "mouth-mouth-chomp", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACcMQAA7AoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMzE1NzE5MCIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwwLDAsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDE2IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMTYifSwibWVzaCI6MH0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwwLDAsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOls0XX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDIzIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMjMifSwibWVzaCI6MX1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo4NjQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6ODY0LCJieXRlTGVuZ3RoIjo4NjQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTcyOCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MjMwNCwiYnl0ZUxlbmd0aCI6NDIwLCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MjcyNCwiYnl0ZUxlbmd0aCI6MjI5MiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1MDE2LCJieXRlTGVuZ3RoIjoyMjkyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjczMDgsImJ5dGVMZW5ndGgiOjE1MjgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo4ODM2LCJieXRlTGVuZ3RoIjoxMDQwLCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjk4NzZ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NzIsIm1heCI6WzAuMDk2NjQ2MTMwMDg0OTkxNDYsMCwwLjAyNzc4NDc2NDc2NjY5MzExNV0sIm1pbiI6Wy0wLjA5NjY0NjE4OTY4OTYzNjIzLDAsLTAuMDI3Nzg0NzQ5ODY1NTMxOTJdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjcyLCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo3MiwibWF4IjpbMC4yODI1NjU0NzQ1MTAxOTI4NywxXSwibWluIjpbLTkuNjYwMDAxNjg3NDUwNDA0ZS0xMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyMTAsIm1heCI6WzcxXSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifSx7ImJ1ZmZlclZpZXciOjQsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxOTEsIm1heCI6WzAuMDc1NjExNjgwNzQ2MDc4NDksMCwwLjAyMzMyODI3NDQ4ODQ0OTA5N10sIm1pbiI6Wy0wLjA3NTYxMTcxMDU0ODQwMDg4LDAsLTAuMDIzMzI4Mjc0NDg4NDQ5MDk3XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjUsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxOTEsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE5MSwibWF4IjpbMC45OTk5OTk5NDAzOTUzNTUyLDFdLCJtaW4iOlstMS4zMjA5MzQ0NzI5MTQ4MTQzZS05LDAuMDk2OTc5OTc1NzAwMzc4NDJdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6NywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjUxOSwibWF4IjpbMTkwXSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMCwwLDAsMV0sIm1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjF9LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdCJ9LHsicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAwMSJ9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfSx7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjQsIk5PUk1BTCI6NSwiVEVYQ09PUkRfMCI6Nn0sImluZGljZXMiOjcsIm1hdGVyaWFsIjoxfV19XX0gICCUJgAAQklOAHDuxb0AAAAAgFHRO+DjxL0AAAAAwKGcO2DJvT0AAAAAYG+sO8gywj0AAAAAkDvxO1QExL0AAAAA4HASPED4xD0AAAAAeBQPPGjuxT0AAAAAAB8XPMSKwL0AAAAAYEk8PPRlxT0AAAAAcGYcPPzgwz0AAAAASPwqPBh+wT0AAAAA4P9APADWu70AAAAA2H1lPOBbvj0AAAAAiJBcPOyYuj0AAAAAkM17PEw6tr0AAAAA8KyGPNRTtj0AAAAAKGuOPOgLsL0AAAAAiJSZPDSrsT0AAAAADOWePByfqb0AAAAAgBurPKC9rD0AAAAAIGSuPCxIo70AAAAApOe6PLSppz0AAAAADPi7PFxbnb0AAAAAwJ7IPAiOoj0AAAAAeLDGPDSJnT0AAAAAEJ3NPOwsmL0AAAAAoObTPIDvUz0AAAAAhK3OPGB2GD0AAAAAlL/PPLARsDwAAAAA2J7RPEBZqjsAAAAALBTUPCQRlL0AAAAAFGXcPMB5NLwAAAAAdOjWPHAf2bwAAAAAjOTZPHhkJr0AAAAAVNHcPEhckb0AAAAA5L/hPHD4V70AAAAArHffPGCnfr0AAAAAdKDhPITmi70AAAAAjBTjPJxikL0AAAAA4JzjPPzngz0AAAAAyJ/OPMi5mD0AAAAAgM3PPGz6wL0AAAAAILMqO2jntz0AAAAAQHwpO/SSur0AAAAAABDZt0i4sD0AAAAAgPMGulgOsr0AAAAAQJBEu2hnqD0AAAAAINl+u3zNp70AAAAAgEXLuyggnz0AAAAAgPLxu0AxnL0AAAAAoBEcvPANlT0AAAAAQLsxvISaj70AAAAAoJlSvCRcij0AAAAAcH9nvChqgr0AAAAA4LGDvFBsfj0AAAAAeOSLvCACar0AAAAAgEycvMCOZz0AAAAAaA2gvGB2UD0AAAAAIPyuvDiAT70AAAAAKDGyvCA5Nz0AAAAA6F26vFgQNr0AAAAAYHTEvCA/Gj0AAAAAWJ/EvNC59DwAAAAA6KDNvDB0Hr0AAAAAoCrSvPDNsDwAAAAAIEPVvADCCb0AAAAAePDZvCDHVDwAAAAAgGbbvED/4LwAAAAAIFvfvMCOjDsAAAAAkOvfvCADp7wAAAAAGIrivMAijbsAAAAA2LLivEBxTrwAAAAA2JzjvAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/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AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/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CwANAAYADAAOAAYADQAPAAYADgAQAAYADwARAAYAEAASAAYAEQAEAAYAEgAFAAYABAAUABYAEwAUABUAFgAxAC8AMAAyAC8AMQAzAC8AMgA0AC8AMwA1AC8ANAA1AC4ALwA2AC4ANQA3AC4ANgA4AC4ANwA5AC4AOAA6AC4AOQA7AC4AOgAXAC4AOwAYAC4AFwAYAC0ALgAYACwALQAYACsALAAYACoAKwAYACkAKgAYACgAKQAYABkAKAAZABoAKAAaABsAKAAbABwAKAAcAB0AKAAdAB4AKAAeACcAKAAeAB8AJwAfACAAJwAgACEAJwAhACIAJwAiACYAJwAjACYAIgAkACYAIwAkACUAJgA8AD4APwA9AD4APABaAFgAWQBaAFcAWABaAFYAVwBaAFUAVgBaAFQAVQBaAFMAVABaAFIAUwBaAFEAUgBaAFAAUQBaAE8AUABaAE4ATwBaAE0ATgBaAEwATQBaAEsATABaAEoASwBaAEkASgBaAEgASQBaAEcASABaAEYARwBaAEUARgBaAEQARQBbAEQAWgBcAEQAWwBdAEQAXABeAEQAXQBfAEQAXgBgAEQAXwBgAEMARABhAEMAYABiAEMAYQBjAEMAYgBjAEIAQwBkAEIAYwBlAEIAZABlAEEAQgBAAEEAZQB/AH0AfgB/AHwAfQB/AHsAfAB/AHoAewCAAHoAfwCAAHkAegCAAHgAeQCAAHcAeACAAHYAdwCAAHUAdgCBAHUAgACBAHQAdQCBAHMAdACBAHIAcwCBAHEAcgCCAHEAgQCCAHAAcQCCAG8AcACDAG8AggCDAG4AbwCEAG4AgwCEAG0AbgCFAG0AhACFAGwAbQCGAGwAhQCGAGsAbACHAGsAhgCHAGoAawCIAGoAhwCIAGkAagCJAGkAiACJAGgAaQCKAGgAiQCLAGgAigCMAGgAiwCNAGgAjACOAGgAjQCPAGgAjgCQAGgAjwCQAGcAaACRAGcAkACSAGcAkQCTAGcAkgCUAGcAkwCUAJUAZwCVAGYAZwCYAJYAlwCZAJYAmACcAJoAmwCdAJoAnACeAJoAnQCfAJoAngCgAJoAnwChAJoAoACiAJoAoQCjAJoAogCkAJoAowClAJoApACmAJoApQCnAJoApgCoAJoApwCpAJoAqACqAJoAqQCrAJoAqgCsAJoAqwCtAJoArACuAJoArQCuAL4AmgCuAL0AvgCuALwAvQCvALwArgCvALsAvACvALoAuwCvALkAugCwALkArwCwALgAuQCwALcAuACxALcAsACxALYAtwCyALYAsQCyALUAtgCyALQAtQCzALQAsgAAAA==", import.meta.url).href },
  { id: "mouth-mouth-flat", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABQLQAAEAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMTc2NzM0NCIsImNoaWxkcmVuIjpbMV19LHsibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDE0IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMTQifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjozMTY4LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjMxNjgsImJ5dGVMZW5ndGgiOjMxNjgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NjMzNiwiYnl0ZUxlbmd0aCI6MjExMiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjg0NDgsImJ5dGVMZW5ndGgiOjE1NzIsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTAwMjB9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MjY0LCJtYXgiOlswLjA1MDExNTIyNzY5OTI3OTc4NSwwLDAuMDA1NzU1ODI2ODMwODYzOTUzXSwibWluIjpbLTAuMDUwMTE1MjI3Njk5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AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAA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D4usPWDxQD1mE7I9gI/6O1vWuD2gaSk9pXitPQAAlzs2zKk9ACsPO2vWvD0AnXE8sXTDPeCEFT0xTbc9AMU1PHCZxz0g+bI8xMrLPXAtBj2mX8I9gLqWPKDgzz3At988Hz3RPWCa+DwyNMw9AN3LPCVP0j0A3ew8TjDTPUCe8TwAAAIAAQADAAIAAAAEAAIAAwAFAAIABAAFAAYAAgAHAAYABQAHAAgABgAJAAgABwAJAAoACAALAAoACQALAAwACgALAA0ADAAOAA0ACwAOAA8ADQAOABAADwAOABEAEAASABEADgASABMAEQASABQAEwASABUAFAASABYAFQASABcAFgASABgAFwASABkAGAASABoAGQAbABoAEgAbABwAGgAbAB0AHAAbAB4AHQAfAB4AGwAfACAAHgAhACAAHwAhACIAIAAhACMAIgAkACMAIQAkACUAIwAkACYAJQAnACYAJAAnACgAJgApACgAJwApACoAKAApACsAKgApACwAKwApAC0ALAAuAC0AKQAuAC8ALQAuADAALwAxADAALgAxADIAMAAzADIAMQA2ABkANAA0ABkANQA3ABkANgAYABkANwA6ADUAOAA4ADUAOQA7ADUAOgA0ADUAOwA4ADkAPAA8ADkAPQA8AD0APgA+AD0APwA+AD8AQABAAD8AQQBAAEEAQgBAAEIAQwBDAEIARABDAEQARQBFAEQARgBFAEYARwBFAEcASABIAEcASQBIAEkASgBIAEoASwBIAEsATABMAEsATQBMAE0ATgBMAE4ATwBPAE4AUABPAFAAUQBPAFEAUgBSAFEAUwBSAFMAVABSAFQAVQBVAFQAVgBVAFYAVwBVAFcAWABVAFgAWQBVAFkAWgBZAFsAWgBaAFsAXABbAF0AXABdAF4AXABfAF4AXQBgAF4AXwBhAF4AYABiAF4AYQBiAGMAXgBkAGMAYgBlAGMAZABmAGMAZQBmAGcAYwBoAGcAZgBpAGcAaABpAGoAZwBrAGoAaQBsAGoAawBsAG0AagBuAG0AbABuAG8AbQBwAG8AbgBxAG8AcABxAHIAbwBzAHIAcQBzAHQAcgB1AHQAcwB1AHYAdAB1AHcAdgB1AHgAdwB1AHkAeAB6AHkAdQB6AHsAeQB6AHwAewB9AHwAegB9AH4AfAB/AH4AfQB/AIAAfgB/AIEAgACCAIEAfwCCAIMAgQCCAIQAgwCFAIQAggCFAIYAhACFAIcAhgCFAIgAhwCJAIgAhQCJAIoAiACJAIsAigCJAIwAiwCJAI0AjACOAI0AiQCOAI8AjQCQAI8AjgCRAI8AkACSAI8AkQCSAJMAjwCUAJMAkgCVAJMAlACWAJMAlQCWAJcAkwCYAJcAlgCZAJcAmACZAJoAlwCbAJoAmQCcAJoAmwCcAJ0AmgCeAJ0AnACeAJ8AnQCgAJ8AngChAJ8AoAChAKIAnwCjAKIAoQCjAKQAogClAKQAowCmAKQApQCmAKcApACoAKcApgCpAKcAqACpAKoApwCrAKoAqQCMAI0ArACvAKwArQCtAKwArgCwAKwArwCxAKwAsACyAKwAsQCzAKwAsgC0AKwAswCMAKwAtAC3AK4AtQC1AK4AtgC4AK4AtwCtAK4AuAC1ALYAuQC5ALYAugC5ALoAuwC7ALoAvAC7ALwAvQC9ALwAvgC9AL4AvwC/AL4AwAC/AMAAwQC/AMEAwgC/AMIAwwC/AMMAxAC/AMQAxQDFAMQAxgDFAMYAxwDFAMcAyADIAMcAyQDIAMkAygDIAMoAywDLAMoAzADLAMwAzQDLAM0AzgDOAM0AzwDOAM8A0ADQAM8A0QDQANEA0gBaAFwA0wDTAFwA1ADTANQA1QDVANQA1gDVANYA1wDVANcA2ADYANcA2QDYANkA2gDaANkA2wDaANsA3ADcANsA3QDcAN0A3gDcAN4A3wDfAN4A4ADfAOAA4QDhAOAA4gDhAOIA4wDjAOIA5ADnAOQA5QDlAOQA5gDjAOQA5wDqAOYA6ADoAOYA6QDrAOYA6gDsAOYA6wDlAOYA7ADoAOkA7QDtAOkA7gDxAO4A7wDvAO4A8ADtAO4A8QDvAPAA8gDyAPAA8wDyAPMA9AD0APMA9QD0APUA9gD2APUA9wABAAIA+AD7APgA+QD5APgA+gD8APgA+wABAPgA/AD/APoA/QD9APoA/gD5APoA/wACAf4AAAEAAf4AAQH9AP4AAgEFAQEBAwEDAQEBBAEAAQEBBQEDAQQBBgEGAQQBBwE=", import.meta.url).href },
  { id: "mouth-mouth-happy", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABAGQAA7AoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMzYxNjg0OSIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwtMS4yNSwtNC43NSwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMDQiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAwNCJ9LCJtZXNoIjowfSx7Im1hdHJpeCI6WzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLDEuMjUsNC43NSwxLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzRdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMzIiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAzMiJ9LCJtZXNoIjoxfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMTUyLCJieXRlTGVuZ3RoIjozODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNTM2LCJieXRlTGVuZ3RoIjoyNzYsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxODEyLCJieXRlTGVuZ3RoIjo1ODgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MjQwMCwiYnl0ZUxlbmd0aCI6NTg4LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjI5ODgsImJ5dGVMZW5ndGgiOjM5MiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjMzODAsImJ5dGVMZW5ndGgiOjI2MCwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjozNjQwfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NzQyMzU3MjU0MDI4MzIsMCwwLjA0MjE4MjUwNTEzMDc2NzgyXSwibWluIjpbLTAuMDc3NDIzNTcyNTQwMjgzMiwwLC0wLjA0MjE4MjQ0NTUyNjEyMzA1XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuNjE0Nzg2NzQ0MTE3NzM2OCwxXSwibWluIjpbLTIuMTc3NzU0Njg3NjkzMzIzZS04LDUuOTYwNDY0NDc3NTM5MDYzZS04XSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsIm1heCI6WzQ3XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifSx7ImJ1ZmZlclZpZXciOjQsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OSwibWF4IjpbMC4wNTQwNTY1MjUyMzA0MDc3MTUsMCwwLjAxNTI1MzcyMjY2NzY5NDA5Ml0sIm1pbiI6Wy0wLjA1NDA1NjU4NDgzNTA1MjQ5LDAsLTAuMDE1MjUzNzgyMjcyMzM4ODY3XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjUsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OSwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3Ijo2LCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDksIm1heCI6WzAuODMxMDU5MDk4MjQzNzEzNCwxXSwibWluIjpbMS4zMDcxODQ0MDUxNjM3NTI3ZS04LDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6NywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEyOSwibWF4IjpbNDhdLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJiYXNlQ29sb3JGYWN0b3IiOlswLDAsMCwxXSwibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0In0seyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxfSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIn1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjMsIm1hdGVyaWFs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AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAADZPED/dhm8/SsBUPwAAgD8qrFQ/3pt9Pyh3VD+e/XY/QSxUP3z6bD9h1lM/xGdgP4SAUz+xGlI/lzVTP37oQj+UAFM/eKYzP3rsUj/aKSU/NARTP91HGD++UlM/0NUNPxfjUz/cqAY/SsBUP2GWAz/l+FM/XGIDP+b+Tz8gJAQ/pnFJP6qtBT9u8EA/+tAHP6kaNz8gYAo/no8sPxotDT+n7iE/+gkQPx3XFz+8yBI/W+gOP2I7FT+pwQc/6jMXP2ICAz9QhBg/7kkBP6n+GD+VlQE/hrIaP8BmAj+YZx8/vaIDP/6DJj/XLgU/520vP1rwBj9xizk/kcwIP8xCRD/JqAo/JvpOP0xqDD+wF1k/ZvYNP5kBYj9jMg8//h1pP48DED8A020/B0hMPadjdD/uSQE/AACAP+5JAT+4wIU+9wqSPajEkj6UkmAyom4LPwNJXTwesV8/Ah9OP4AIgTzvSQE/AAAAAPBJAT9aYgM/GFc5PxQCAT/xy0c/HlSoPp71Tz9QehE+GgAYABkAGwAYABoAHAAYABsAHAAXABgAHQAXABwAHgAXAB0AHgAWABcAHwAWAB4AIAAWAB8AIQAWACAAIQAVABYAIgAVACEAIwAVACIAJAAVACMAAAAVACQAAQAVAAAAAQAUABUAAQATABQAAQASABMAAQARABIAAQAQABEAAQAPABAAAQACAA8AAgADAA8AAwAEAA8ABAAFAA8ABQAGAA8ABgAHAA8ABwAIAA8ACAAJAA8ACQAKAA8ACgALAA8ACwAOAA8ACwAMAA4ADAANAA4AKgAoACkAJQAoACoAJgAoACUAJgAnACgALAAwACsALAAvADAALAAuAC8ALAAtAC4AAAA=", import.meta.url).href },
  { id: "mouth-mouth-help", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADYJQAA9AoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMzcyODM5MiIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwtMi4yNSwtNCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMDciLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAwNyJ9LCJtZXNoIjowfSx7Im1hdHJpeCI6WzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLDIuMjUsNCwxLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzRdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMDUiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAwNSJ9LCJtZXNoIjoxfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjE3MjgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTcyOCwiYnl0ZUxlbmd0aCI6MTcyOCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjozNDU2LCJieXRlTGVuZ3RoIjoxMTUyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NDYwOCwiYnl0ZUxlbmd0aCI6ODUyLCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTQ2MCwiYnl0ZUxlbmd0aCI6NDU2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU5MTYsImJ5dGVMZW5ndGgiOjQ1NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo2MzcyLCJieXRlTGVuZ3RoIjozMDQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo2Njc2LCJieXRlTGVuZ3RoIjoxODAsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6Njg1Nn1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxNDQsIm1heCI6WzAuMDc2ODk4ODcyODUyMzI1NDQsMCwwLjAzODgwNzMwMjcxMzM5NDE2NV0sIm1pbiI6Wy0wLjA3Njg5ODkzMjQ1Njk3MDIxLDAsLTAuMDM4ODA3MzMyNTE1NzE2NTVdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE0NCwibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTQ0LCJtYXgiOlswLjQ0MjEzMDgwNDA2MTg4OTY1LDFdLCJtaW4iOlsxLjk0MzEyNjcyNjE4OTM0OGUtOCwtMS4xOTIwOTI4OTU1MDc4MTI1ZS03XSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50Ijo0MjYsIm1heCI6WzE0M10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn0seyJidWZmZXJWaWV3Ijo0LCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MzgsIm1heCI6WzAuMDU0MzExOTMxMTMzMjcwMjY0LDAsMC4wMTUwODI4OTU3NTU3Njc4MjJdLCJtaW4iOlstMC4wNTQzMTE5MzExMzMyNzAyNjQsMCwtMC4wMTUwODI4OTU3NTU3Njc4MjJdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjM4LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjYsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjozOCwibWF4IjpbMC44OTk3MDY0ODI4ODcyNjgxLDFdLCJtaW4iOlstNy40Mzc3OTkyNjUzNzUxMzM1ZS05LDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6NywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjkwLCJtYXgiOlszN10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7ImJhc2VDb2xvckZhY3RvciI6WzAsMCwwLDFdLCJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxfSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQifSx7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjF9LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDEifV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3sibW9kZSI6NCwiYXR0cmlidXRlcyI6eyJQT1NJVElPTiI6MCwiTk9STUFMIjoxLCJURVhDT09SRF8wIjoyfSwiaW5kaWNlcyI6Mywi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4P1/PQAAAACQ2x29YF7uPAAAAABAvhy9cPMzPQAAAAAomx690GtqPQAAAABQvx69QKJQPQAAAABw9B69AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAA2vbhPjyXUT8+ftw+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", import.meta.url).href },
  { id: "mouth-mouth-open", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADIEwAA9AoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMzUyOTU1MyIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwtMSwtNi41LDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTAwOSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDA5In0sIm1lc2giOjB9LHsibWF0cml4IjpbMSwwLDAsMCwwLDEsMCwwLDAsMCwxLDAsMSw2LjUsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOls0XX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDA5IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDkifSwibWVzaCI6MX1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTgxMiwiYnl0ZUxlbmd0aCI6MTQ0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE5NTYsImJ5dGVMZW5ndGgiOjE0NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoyMTAwLCJieXRlTGVuZ3RoIjo5NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjIxOTYsImJ5dGVMZW5ndGgiOjM2LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIyMzJ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDY4MDIxNzc0MjkxOTkyMTksMCwwLjA0OTg2OTE3OTcyNTY0Njk3XSwibWluIjpbLTAuMDY4MDIxNzE0Njg3MzQ3NDEsMCwtMC4wNDk4NjkxNDk5MjMzMjQ1ODVdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMC43MzIwMTIzMzE0ODU3NDgzLDAuOTk5OTk5OTQwMzk1MzU1Ml0sIm1pbiI6WzQuOTEzMjA4MzI5MDcxNDk0NWUtOCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsIm1heCI6WzQ3XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifSx7ImJ1ZmZlclZpZXciOjQsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxMiwibWF4IjpbMC4wNDg5MTU3NDM4Mjc4MTk4MjQsMCwwLjAxMjI3NzE1NjExNDU3ODI0N10sIm1pbiI6Wy0wLjA0ODkxNTgwMzQzMjQ2NDYsMCwtMC4wMTIyNzcxMjYzMTIyNTU4Nl0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3Ijo1LCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTIsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjEyLCJtYXgiOlswLjc2ODg3Njc5MTAwMDM2NjIsMV0sIm1pbiI6Wy0xLjk2MzEzNDg5OTA4NTYxNjhlLTgsNS45NjA0NjQ0Nzc1MzkwNjNlLThdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6NywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjE4LCJtYXgiOlsxMV0sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7ImJhc2VDb2xvckZhY3RvciI6WzAsMCwwLDFdLCJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxfSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQifSx7InBick1ldGFsbGljUm91Z2huZXNzIjp7Im1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjF9LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDEifV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3sibW9kZSI6NCwiYXR0cmlidXRlcyI6eyJQT1NJVElPTiI6MCwiTk9STUFMIjoxLCJURVhDT09SRF8wIjoyfSwiaW5kaWNlcyI6Mywi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", import.meta.url).href },
  { id: "mouth-mouth-smirk", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAA4BwAA+AUAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMTgwNTc4NCIsImNoaWxkcmVuIjpbMV19LHsibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAzIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDMifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo5NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo5NiwiYnl0ZUxlbmd0aCI6OTYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTkyLCJieXRlTGVuZ3RoIjo2NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjI1NiwiYnl0ZUxlbmd0aCI6MzYsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MjkyfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjgsIm1heCI6WzAuMDM2MjUwNzcwMDkyMDEwNSwwLDAuMDA5ODQ4OTUyMjkzMzk1OTk2XSwibWluIjpbLTAuMDM2MjUwNzEwNDg3MzY1NzIsMCwtMC4wMDk4NDg5NTIyOTMzOTU5OTZdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjgsIm1heCI6WzAuMTIwNzM4NTIxMjE4Mjk5ODcsMV0sIm1pbiI6WzUuODM4MDE0NTE2MjU3MzE3ZS0xMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxOCwibWF4IjpbN10sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn1dLCJtYXRlcmlhbHMiOlt7InBick1ldGFsbGljUm91Z2huZXNzIjp7ImJhc2VDb2xvckZhY3RvciI6WzAuMDEwMzI5ODIzMDI2MzY0NTQ4LDAuMDEwMzI5ODIzMDI2MzY0NTQ4LDAuMDEwMzI5ODIzMDI2MzY0NTQ4LDFdLCJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxfSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQifV0sIm1lc2hlcyI6W3sicHJpbWl0aXZlcyI6W3sibW9kZSI6NCwiYXR0cmlidXRlcyI6eyJQT1NJVElPTiI6MCwiTk9STUFMIjoxLCJURVhDT09SRF8wIjoyfSwiaW5kaWNlcyI6MywibWF0ZXJpYWwiOjB9XX1dfSAgJAEAAEJJTgCQ8xM9AAAAAAAmubsA+F67AAAAAIAmy7uwexQ9AAAAAIBdIbwAery6AAAAAAAkG7tgzeG8AAAAAAAAqDqgHdC8AAAAAIC5xDugexS9AAAAAIAo5jsQHQ69AAAAAIBdITwAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAADCRfc9QINhPGB5IDAs6Qc/gC6HPQAAAABPIWU9HiEEP9bP6zxCl14/6pHGPSTPWj+0MKI9AACAP79F9z1R2nw/AwAAAAEAAQAAAAIABAAFAAMABAADAAEABgAFAAQABgAHAAUA", import.meta.url).href },
  { id: "mouth-mouth-tongueout", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACIMAAAoBAAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMjg2NjI1OSIsImNoaWxkcmVuIjpbMSwzLDVdfSx7Im1hdHJpeCI6WzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLC0yLjMzMzMzMzMzMzMzMzMzMzUsLTEuODMzMzMzMzMzMzMzMzMzMywwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMTMiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAxMyJ9LCJtZXNoIjowfSx7Im1hdHJpeCI6WzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLC0zLjgzMzMzMzMzMzMzMzMzMzUsNS4xNjY2NjY2NjY2NjY2NjcsMSwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOls0XX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDQ2IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wNDYifSwibWVzaCI6MX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCw2LjE2NjY2NjY2NjY2NjY2NiwtMy4zMzMzMzMzMzMzMzMzMzMsMiwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOls2XX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAxIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDEifSwibWVzaCI6Mn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjoyMzA0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjIzMDQsImJ5dGVMZW5ndGgiOjIzMDQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NDYwOCwiYnl0ZUxlbmd0aCI6MTUzNiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjYxNDQsImJ5dGVMZW5ndGgiOjExNDAsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo3Mjg0LCJieXRlTGVuZ3RoIjoyMDQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NzQ4OCwiYnl0ZUxlbmd0aCI6MjA0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjc2OTIsImJ5dGVMZW5ndGgiOjEzNiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjc4MjgsImJ5dGVMZW5ndGgiOjU2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6Nzg4NCwiYnl0ZUxlbmd0aCI6ODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6Nzk2OCwiYnl0ZUxlbmd0aCI6ODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6ODA1MiwiYnl0ZUxlbmd0aCI6NTYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo4MTA4LCJieXRlTGVuZ3RoIjozMiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjo4MTQwfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE5MiwibWF4IjpbMC4wNzQyOTE1ODY4NzU5MTU1MywwLDAuMDM2NjI1MTE3MDYzNTIyMzRdLCJtaW4iOlstMC4wNzQyOTE1ODY4NzU5MTU1MywwLC0wLjAzNjYyNTE0Njg2NTg0NDczXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxOTIsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjE5MiwibWF4IjpbMC40ODMwNzc3MzQ3MDg3ODYsMV0sIm1pbiI6Wy0yLjM5MDYwMzcxNDk4NTY3M2UtOSwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50Ijo1NzAsIm1heCI6WzE5MV0sIm1pbiI6WzBdLCJ0eXBlIjoiU0NBTEFSIn0seyJidWZmZXJWaWV3Ijo0LCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTcsIm1heCI6WzAuMDYwMjM1ODU3OTYzNTYyMDEsMCwwLjAxNDEyODE3ODM1ODA3ODAwM10sIm1pbiI6Wy0wLjA2MDIzNTkxNzU2ODIwNjc5LDAsLTAuMDE0MTI4MTc4MzU4MDc4MDAzXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjUsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxNywibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3Ijo2LCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTcsIm1heCI6WzAuNzg4NzUwNzA4MTAzMTc5OSwxXSwibWluIjpbLTEuMzA0NDU2Mjc2MzI5ODAxOGUtOCwtMS4xOTIwOTI4OTU1MDc4MTI1ZS03XSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjcsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyNywibWF4IjpbMTZdLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9LHsiYnVmZmVyVmlldyI6OCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjcsIm1heCI6WzAuMDIyMTAyNzEzNTg0ODk5OTAyLDAsMC4wMTQwMDU0MjI1OTIxNjMwODZdLCJtaW4iOlstMC4wMjIxMDI3MTM1ODQ4OTk5MDIsMCwtMC4wMTQwMDU0MjI1OTIxNjMwODZdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6OSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjcsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MTAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo3LCJtYXgiOlswLjYxNjg5NzA0NjU2NjAwOTUsMV0sIm1pbiI6WzIuNzkyMTU1NDg0NTk4ODc5NGUtOCw1Ljk2MDQ2NDQ3NzUzOTA2M2UtOF0sInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjoxMSwiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjE1LCJtYXgiOls2XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC4wMTAzMjk4MjMwMjYzNjQ1NDgsMC4wMTAzMjk4MjMwMjYzNjQ1NDgsMC4wMTAzMjk4MjMwMjYzNjQ1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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAA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QAA/AD4AQQA/AEAAQQBCAD8AQwBCAEEAQwBEAEIARQBEAEMARgBEAEUARgBHAEQASABHAEYASABJAEcASwBJAEgASgBLAEgASgBNAEsASwBMAEkATgBMAEsATwBMAE4AUABMAE8AUQBMAFAAUgBMAFEAUwBMAFIAUwBUAEwAVQBUAFMAVgBUAFUAVwBUAFYAVwBYAFQAWQBYAFcAWgBYAFkAWgBbAFgAXABbAFoAXQBbAFwAXgBbAF0AXgBfAFsAYABfAF4AYQBfAGAAYQBiAF8AYwBiAGEAZABiAGMAZABlAGIAZgBlAGQAZgBnAGUAaABnAGYAaABpAGcAagBpAGgAawBpAGoAawBsAGkAbQBsAGsAbQBuAGwAbwBuAG0AbwBwAG4AcQBwAG8AcgBwAHEAcgBzAHAAdABzAHIAdAB1AHMAdgB1AHQAdwB1AHYAdwB4AHUAeQB4AHcAeQB6AHgAewB6AHkAewB8AHoAfQB8AHsAfQB+AHwAfwB+AH0AfwCAAH4AgQCAAH8ASgCCAE0ASgCDAIIAhACDAEoAhACFAIMAhACGAIUAhACHAIYAhACIAIcAiQCIAIQAiQCKAIgAiQCLAIoAiQCMAIsAjQCMAIkAjQCOAIwAjQCPAI4AjQCQAI8AkQCQAI0AkQCSAJAAkQCTAJIAlACTAJEAlACVAJMAlACWAJUAlwCWAJQAlwCYAJYAmQCYAJcAmQCaAJgAmQCbAJoAnACbAJkAnACdAJsAngCdAJwAngCfAJ0AoACfAJ4AAQACAKEApAChAKIAogChAKMAAQChAKQApwCjAKUApQCjAKYAqACjAKcAqQCjAKgAqgCjAKkAogCjAKoArQCmAKsAqwCmAKwArgCmAK0ArwCmAK4AsACmAK8ApQCmALAAswCsALEAsQCsALIAqwCsALMAtgCyALQAtACyALUAsQCyALYAtAC1ALcAtwC1ALgAtwC4ALkAuQC4ALoAuQC6ALsAuwC6ALwAuwC8AL0AvQC8AL4AvQC+AL8AQAFnvQAAAACAQZG78Ll2vQAAAADgsRU8wIIuvQAAAABgCB88oARFvQAAAACAXsO7gDSfvAAAAACAIFi8ICPyvAAAAADgeWc8ABDEugAAAAAA+mE7gDXSuwAAAADgeWe8gAwWPAAAAADAZV28AAKBOwAAAACASck7oKAWPQAAAACABIM74HgHPQAAAADA2ke8gD40PQAAAADAFUi8oEokPQAAAAAAUAq64Ll2PQAAAAAAgnE7oK9zPQAAAACAG9+7UNJCPQAAAADAAly8AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAW4ouP/Chxz0d8tY+UNwEPR3y1j5cfb0+L1g3P9Szgj6YGmCybAQiPx7y1j4AAIA/HvLWPki72T6uN5M9moTJPh3y1j4gMWA/ketJP///fz+R60k/XH29PlcU8z6qVNc+GiLEPkBf3jzDcxg+AAAAtMRzGD6UhMk+VGavPrpTrT4f8tY+SGK2PQAAAgADAAEAAgAAAAQABgAHAAUABgAEAAkACwAIAAkACgALAAwADwAQAA0ADwAMAA0ADgAPAAAAwBC1vAAAAADAUEy8wBC1PAAAAAAAd2W8gJqkPAAAAACAI8O7YBikvAAAAAAA38A6AOYrPAAAAADgvx88ACMPvAAAAADAvGI8AHjhOgAAAAAAd2U8AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAW8E0MwAAgD8m2O8yAACAM1WkOD4g2FM98R2iPmjRdj9GEwc/dtyPPs3cGj+Y+Dc/9+wdP0AL9z4AAAIAAQADAAIAAAADAAQAAgAFAAQAAwAFAAYABAAAAA==", import.meta.url).href },
  { id: "mouth-mouth-wavy", category: "mouth", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABcJgAA7AoAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoiY3VzdG9tLXBhcnQtMTc3NDczMzg2MjQyNiIsImNoaWxkcmVuIjpbMSwzXX0seyJtYXRyaXgiOlsxLDAsMCwwLDAsMSwwLDAsMCwwLDEsMCwwLjUsMCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMTUiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAxNSJ9LCJtZXNoIjowfSx7Im1hdHJpeCI6WzEsMCwwLDAsMCwxLDAsMCwwLDAsMSwwLC0wLjUsMCwxLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzRdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMjAiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAyMCJ9LCJtZXNoIjoxfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjExMTYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTExNiwiYnl0ZUxlbmd0aCI6MTExNiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoyMjMyLCJieXRlTGVuZ3RoIjo3NDQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoyOTc2LCJieXRlTGVuZ3RoIjo1NDgsInRhcmdldCI6MzQ5NjN9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjozNTI0LCJieXRlTGVuZ3RoIjoxMTI4LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjQ2NTIsImJ5dGVMZW5ndGgiOjExMjgsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc4MCwiYnl0ZUxlbmd0aCI6NzUyLCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NjUzMiwiYnl0ZUxlbmd0aCI6NDY0LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjY5OTZ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6OTMsIm1heCI6WzAuMDY2NzE3NDMwOTQ5MjExMTIsMCwwLjAxNzMwODIwNTM2NjEzNDY0NF0sIm1pbiI6Wy0wLjA2NjcxNzQzMDk0OTIxMTEyLDAsLTAuMDE3MzA4MjA1MzY2MTM0NjQ0XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5MywibWF4IjpbMCwxLDBdLCJtaW4iOlswLDEsMF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6OTMsIm1heCI6WzAuMjQ5MzYyMTExMDkxNjEzNzcsMV0sIm1pbiI6WzIuMTYxNzQxMDA4NDIxODEzNmUtOSwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyNzMsIm1heCI6WzkyXSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifSx7ImJ1ZmZlclZpZXciOjQsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NCwibWF4IjpbMC4wNTk5NTY1MjA3OTU4MjIxNDQsMCwwLjAxMzU2Mzg0MTU4MTM0NDYwNF0sIm1pbiI6Wy0wLjA1OTk1NjUwNTg5NDY2MDk1LDAsLTAuMDEzNTYzODQxNTgxMzQ0NjA0XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjUsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NCwibWF4IjpbMCwxLDBdLCJtaW4iOlswLC0xLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6NiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjk0LCJtYXgiOlswLjk3MjI1NTI4OTU1NDU5NiwxXSwibWluIjpbLTEuOTU0NDc2NDAyOTQzMzI4ZS04LDUuOTYwNDY0NDc3NTM5MDYzZS04XSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjcsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyMzEsIm1heCI6WzkzXSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMCwwLDAsMV0sIm1ldGFsbGljRmFjdG9yIjoxLCJyb3VnaG5lc3NGYWN0b3IiOjF9LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdCJ9LHsicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MX0sImRvdWJsZVNpZGVkIjp0cnVlLCJuYW1lIjoiU1ZHTWF0LjAwMSJ9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlh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", import.meta.url).href },
  { id: "nose-drip", category: "nose", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC4DwAARAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoibm9zZS1kcmlwIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOlsxLjksMCwwLDAsMCwxLjksMCwwLDAsMCwxLjksMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDAxIiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wMDEifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTgxMiwiYnl0ZUxlbmd0aCI6MzI0fV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjIxMzZ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMTEzNjIwMzQwODI0MTI3MiwwLDAuMjI4NzU0MjUyMTk1MzU4MjhdLCJtaW4iOlstMC4xMTM2MjAzNDA4MjQxMjcyLDAsLTAuMjI4NzU0MjUyMTk1MzU4MjhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLDEsMF0sIm1pbiI6WzAsMSwwXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMSwxXSwibWluIjpbMCwwXSwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsIm1heCI6WzQ3XSwibWluIjpbMF0sInR5cGUiOiJTQ0FMQVIifV0sIm1hdGVyaWFscyI6W3sicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsibWV0YWxsaWNGYWN0b3IiOjEsInJvdWdobmVzc0ZhY3RvciI6MSwiYmFzZUNvbG9yVGV4dHVyZSI6eyJpbmRleCI6MCwidGV4Q29vcmQiOjAsImV4dGVuc2lvbnMiOnsiS0hSX3RleHR1cmVfdHJhbnNmb3JtIjp7InJvdGF0aW9uIjotMC40MTg4NzkwMjA0Nzg2Mzl9fX19LCJkb3VibGVTaWRlZCI6dHJ1ZSwibmFtZSI6IlNWR01hdC4wMDMiLCJleHRyYXMiOnsic291cmNlSGFzR3JhZGllbnQiOnRydWV9fV0sInRleHR1cmVzIjpbeyJzYW1wbGVyIjowLCJzb3VyY2UiOjB9XSwic2FtcGxlcnMiOlt7Im1hZ0ZpbHRlciI6OTcyOSwibWluRmlsdGVyIjo5NzI5LCJ3cmFwUyI6MzMwNzEsIndyYXBUIjozMzA3MX1dLCJpbWFnZXMiOlt7Im1pbWVUeXBlIjoiaW1hZ2UvcG5nIiwiYnVmZmVyVmlldyI6NH1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7Im1vZGUiOjQsImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRf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", import.meta.url).href },
  { id: "nose-round", category: "nose", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADIDwAASAcAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoibm9zZS1yb3VuZCIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbMi41LDAsMCwwLDAsMi41LDAsMCwwLDAsMi41LDAsMCwwLDAsMV0sIm5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M30seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE4MTIsImJ5dGVMZW5ndGgiOjMzNn1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoyMTQ4fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4MjU0NF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAsMSwwXSwibWluIjpbMCwxLDBdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlsxLDFdLCJtaW4iOlswLDBdLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwibWF4IjpbNDddLCJtaW4iOlswXSwidHlwZSI6IlNDQUxBUiJ9XSwibWF0ZXJpYWxzIjpbeyJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJtZXRhbGxpY0ZhY3RvciI6MSwicm91Z2huZXNzRmFjdG9yIjoxLCJiYXNlQ29sb3JUZXh0dXJlIjp7ImluZGV4IjowLCJ0ZXhDb29yZCI6MCwiZXh0ZW5zaW9ucyI6eyJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iOnsicm90YXRpb24iOi0wLjEzOTYyNjM0MDE1OTU0NjM0fX19fSwiZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE2IiwiZXh0cmFzIjp7InNvdXJjZUhhc0dyYWRpZW50Ijp0cnVlfX1dLCJ0ZXh0dXJlcyI6W3sic2FtcGxlciI6MCwic291cmNlIjowfV0sInNhbXBsZXJzIjpbeyJtYWdGaWx0ZXIiOjk3MjksIm1pbkZpbHRlciI6OTcyOSwid3JhcFMiOjMzMDcxLCJ3cmFwVCI6MzMwNzF9XSwiaW1hZ2VzIjpbeyJtaW1lVHlwZSI6ImltYWdlL3BuZyIsImJ1ZmZlclZpZXciOjR9XSwibWVzaGVzIjpbeyJwcmltaXRpdmVzIjpbeyJtb2RlIjo0LCJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENP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", import.meta.url).href },
  { id: "pupil-heart", category: "pupil", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACoEgAAIAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoicHVwaWwtaGVhcnQiLCJjaGlsZHJlbiI6WzFdfSx7Im5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTAxNiIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDE2In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6MTAwOCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMDA4LCJieXRlTGVuZ3RoIjoxMDA4LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjIwMTYsImJ5dGVMZW5ndGgiOjY3MiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjI2ODgsImJ5dGVMZW5ndGgiOjQ5MiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjozMTgwfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjg0LCJtYXgiOlswLjE2NDU3ODI1ODk5MTI0MTQ2LDAsMC4xMzUzMTY1ODA1MzM5ODEzMl0sIm1pbiI6Wy0wLjE2NDU3ODE5OTM4NjU5NjY4LDAsLTAuMTM1MzE2NjEw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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAa5cUPxQAAD/G8h0/ALcPO9/3JD9Od/E+3fckP2VEBz/I8h0/RnB/P9YmFD8AAAAA2CYUPwAAgD9p4Ak/ALcPO2vgCT9GcH8/1Wf+PgC3DzzYZ/4+GMF9P4xr6D7graE8j2voPnbyej/L9NE+ELcPPc700T5gBHc/aiy7PgCOYD1sLLs+1vZxPz47pD7oraE9RDukPtfJaz+YT5c+iLHAPZpPlz5n6Wc/j2yKPvjT5D2RbIo+ImVjP5A1ez700QY+lDV7PjBLXj/GxWE++FcdPsnFYT6/qVg/AJtIPlzDNT4Dm0g+9I5SP4LGLz6E208+hMYvPv4ITD+MWRc+rGdrPo1ZFz4GJkU/vsr+PZ4XhD6/yv49NPQ9P3v2zz3A/JI+evbPPbaBNj/PWKI94EaiPsdYoj2y3C4/cShsPa7ZsT5dKGw9VBMnP4CWFj3QmME+jZYWPcYzHz9NJtE8MkbLPmMm0TzxXBo/F9uFPIpY1T4p24U8qVMVP1uWFjyou98+dpYWPAUiED8E24U7WlvqPifbhTse0go/A9qFOnAj9T5K2oU6Cm4FPxMT6rG+//8+0S8nPxjBfT+HyS8/dvJ6P1mKMj9CeA8/fqs3P18Edz/deT0/wmsYP0zBPj/U9nE/hvZEP9bJaz9q8UU//O4hP9cySj+KhWQ//RtMPwbSKz8rT04/sFFcP5YkUD/65DU/gCBRPzReUz82NlI/7vc/P9l7Uj/62kk/hckvP+CtoTxaijI/aA/hPtAvJz8Atw88fas3PwC3Dz3eeT0/UCjPPoP2RD/graE9a/FFP9AhvD5LwT4/8I1gPdUySj9g0ds9/RtMP7pbqD4qT04/eLgOPpckUD/SNZQ+fyBRP6iGMj41NlI/6g+APtl7Uj+ok1g+BQAAAAEAAQAAAAIAAAAEAAMAAAAGAAQABQAGAAAABwAGAAUABwAIAAYACQAIAAcACQAKAAgACwAKAAkACwAMAAoADQAMAAsADQAOAAwADwAOAA0ADwAQAA4AEQAQAA8AEQASABAAEwASABEAEwAUABIAFQAUABMAFQAWABQAFwAWABUAFwAYABYAGQAYABcAGQAaABgAGwAaABkAGwAcABoAHQAcABsAHQAeABwAHwAeAB0AHwAgAB4AIQAgAB8AIQAiACAAIwAiACEAIwAkACIAJQAkACMAJQAmACQAJwAmACUAJwAoACYAKQAoACcAKQAqACgAKwAqACkAKwAsACoALQAsACsALQAuACwALwAuAC0ALwAwAC4AMQAwAC8AMQAyADAAMwAyADEAMwA0ADIANQA0ADMAAwAEADYAAwA2ADcAAwA3ADgAOAA3ADkAOAA5ADoAOgA5ADsAOgA7ADwAOgA8AD0APQA8AD4APQA+AD8APwA+AEAAPwBAAEEAQQBAAEIAQQBCAEMAQwBCAEQARwACAEUARQACAEYAAQACAEcARQBGAEgASABGAEkATABJAEoASgBJAEsASABJAEwASgBLAE0ATQBLAE4ATQBOAE8ATwBOAFAATwBQAFEAUQBQAFIAUQBSAFMA", import.meta.url).href },
  { id: "pupil-pac", category: "pupil", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABcDwAAGAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoicHVwaWwtcGFjIiwiY2hpbGRyZW4iOlsxXX0seyJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwMjQiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjAyNCJ9LCJtZXNoIjowfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjc0NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo3NDQsImJ5dGVMZW5ndGgiOjc0NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNDg4LCJieXRlTGVuZ3RoIjo0OTYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxOTg0LCJieXRlTGVuZ3RoIjozNjAsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MjM0NH1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo2MiwibWF4IjpbMC4xNjM2Mzc2MzgwOTIwNDEwMiwwLDAuMTUwMzMzODUxNTc1ODUxNDRdLCJtaW4iOlstMC4xNjM2Mzc4MTY5MDU5NzUzNCwwLC0wLjE1MDMzMzc2MjE2ODg4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AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAGHxkj2gT3A+wu1APbxaOj/Mfnw91miBPmUA6z4KGgA/8UedPeZ6SD+uruY9XWFVP7MMID7QFAI+gyc4PjjD2D1czx0+weRgP4ddUT5gGbE98IVNPrjbaj+1lms+eD6NPX9dgz6wiFo9d/qAPuUccz8yWZE+8HoiPXGynz5A7+Q8GEudPuh+eT8zXa4+gEaVPHhNvT6AiSw8y3G7PmfYfT8+d8w+AMqgO3vO2z4AjLU6givbPgAAgD8yR+s+AAAAAFnV+j4ALE46Uy/7Pl/Rfz+LRw0/AMoWPOlaHD+AlNY83xYNP0VcfT89gyo/gGpRPQjtGz+lxXg//543P6C+qj3C8yk/ZjJyP6eMQz+Qdvo9qwQ3P3LHaT+rKk4/8EgrPmP5Qj+1qV8/g1dXP/DiXj6Jq00/Fv5TP6jxXj/msYs+vfRWP3/pRj+O12Q/DBOqPp2uXj/ckDg/sOdoPy5Cyj7JsmQ/ExkpP4QAaz+O7Os+4NpoPxOnGD+BAGs/wF8HP58RVj383Yo+uR7FPDwqKz+qozI9xIOUPio9Ej2wVp4+Dc3pPFZTqD4VNQY8wBIbP/dPtTw2drI+5xOHPOC7vD5uUz482CDHPpmVCzOrPQo/UIf2O66h0T5hNIo76DrcPuDF3zoM6eY+DEUQM66o8T4BAAMAAAABAAAAAgAEAAMAAQAFAAMABAAIAAMABQADAAcABgADAAkABwAKAAMACAADAAsACQANAAMACgADAAwACwADAA4ADAAQAAMADQADAA8ADgADABEADwATAAMAEAADABIAEQADABQAEgAWAAMAEwADABUAFAADABcAFQAZAAMAFgADABgAFwAZABgAAwAZABoAGAAZABsAGgAcABsAGQAcAB0AGwAeAB0AHAAeAB8AHQAgAB8AHgAgACEAHwAiACEAIAAiACMAIQAkACMAIgAkACUAIwAmACUAJAAmACcAJQAoACcAJgAoACkAJwAqACkAKAAqACsAKQAsACsAKgAsAC0AKwAuAC0ALAAuAC8ALQABAAIAMAABADAAMQAxADAAMgAxADIAMwAxADMANAAxADQANQA1ADQANgA1ADYANwA1ADcAOAA1ADgAOQA5ADgAOgA5ADoAOwA5ADsAPAA5ADwAPQA=", import.meta.url).href },
  { id: "pupil-round", category: "pupil", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAA8DQAADAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoicHVwaWwtcm91bmQiLCJjaGlsZHJlbiI6WzFdfSx7Im5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxODEyfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4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", import.meta.url).href },
  { id: "sclera-round", category: "sclera", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAUDQAA5AUAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoic2NsZXJhLXJvdW5kIiwiY2hpbGRyZW4iOlsxXX0seyJtYXRyaXgiOlszLDAsMCwwLDAsMywwLDAsMCwwLDMsMCwwLDAsMCwxXSwibmFtZSI6IlNjZW5lIiwiY2hpbGRyZW4iOlsyXX0seyJtYXRyaXgiOls0MDAsMCwwLDAsMCwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsNDAwLjAwMDA1Mzc0MzU0MjYsMCwwLC00MDAuMDAwMDUzNzQzNTQyNiwtMC4wMDAwNTM3NDM1NDI1OTQwMjAyNTUsMCwwLDAsMCwxXSwibmFtZSI6IkN1cnZlMDQ5IiwiZXh0cmFzIjp7Im5hbWUiOiJDdXJ2ZS4wNDkifSwibWVzaCI6MH1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlT2Zmc2V0IjowLCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6NTc2LCJieXRlTGVuZ3RoIjo1NzYsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjEyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTE1MiwiYnl0ZUxlbmd0aCI6Mzg0LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjo4fSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MTUzNiwiYnl0ZUxlbmd0aCI6Mjc2LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjE4MTJ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDc2MDYwNDczOTE4OTE0OCwwLDAuMDc2MDQ0MzgwNjY0ODI1NDRdLCJt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", import.meta.url).href },
  { id: "shadow-ground", category: "shadow", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACkDQAAdAYAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoic2hhZG93LWdyb3VuZCIsImNoaWxkcmVuIjpbMV19LHsibWF0cml4IjpbOC4zOTk5OTk5OTk5OTk5OTksMCwwLDAsMCwxLjIwMDAwMDAwMDAwMDAwMDIsMCwwLDAsMCwxMiwwLDAsMCwwLDFdLCJuYW1lIjoiU2NlbmUiLCJjaGlsZHJlbiI6WzJdfSx7Im1hdHJpeCI6WzQwMCwwLDAsMCwwLC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSw0MDAuMDAwMDUzNzQzNTQyNiwwLDAsLTQwMC4wMDAwNTM3NDM1NDI2LC0wLjAwMDA1Mzc0MzU0MjU5NDAyMDI1NSwwLDAsMCwwLDFdLCJuYW1lIjoiQ3VydmUwNDkiLCJleHRyYXMiOnsibmFtZSI6IkN1cnZlLjA0OSJ9LCJtZXNoIjowfV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjAsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjU3NiwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6MTJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxMTUyLCJieXRlTGVuZ3RoIjozODQsInRhcmdldCI6MzQ5NjIsImJ5dGVTdHJpZGUiOjh9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0IjoxNTM2LCJieXRlTGVuZ3RoIjoyNzYsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTgxMn1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwibWF4IjpbMC4wNzYwNjA0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", import.meta.url).href },
  { id: "spec-one", category: "spec", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAIDQAA2AUAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJUSFJFRS5HTFRGRXhwb3J0ZXIgcjE4MyJ9LCJzY2VuZXMiOlt7Im5hbWUiOiJBdXhTY2VuZSIsIm5vZGVzIjpbMF19XSwic2NlbmUiOjAsIm5vZGVzIjpbeyJuYW1lIjoic3BlYy1vbmUiLCJjaGlsZHJlbiI6WzFdfSx7Im5hbWUiOiJTY2VuZSIsImNoaWxkcmVuIjpbMl19LHsibWF0cml4IjpbNDAwLDAsMCwwLDAsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDQwMC4wMDAwNTM3NDM1NDI2LDAsMCwtNDAwLjAwMDA1Mzc0MzU0MjYsLTAuMDAwMDUzNzQzNTQyNTk0MDIwMjU1LDAsMCwwLDAsMV0sIm5hbWUiOiJDdXJ2ZTA0OSIsImV4dHJhcyI6eyJuYW1lIjoiQ3VydmUuMDQ5In0sIm1lc2giOjB9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjU3NiwiYnl0ZUxlbmd0aCI6NTc2LCJ0YXJnZXQiOjM0OTYyLCJieXRlU3RyaWRlIjoxMn0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjExNTIsImJ5dGVMZW5ndGgiOjM4NCwidGFyZ2V0IjozNDk2MiwiYnl0ZVN0cmlkZSI6OH0seyJidWZmZXIiOjAsImJ5dGVPZmZzZXQiOjE1MzYsImJ5dGVMZW5ndGgiOjI3NiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxODEyfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4MjU0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", import.meta.url).href }
], hA = R0.map((l) => ({
  id: l.id,
  category: l.category,
  label: l.id.charAt(0).toUpperCase() + l.id.slice(1),
  glbPath: l.url,
  defaultZDepth: v0(l.category),
  defaultScale: 2.5
})), F0 = [
  { id: "fs-shape-blobs_a", label: "blobs_a", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABUEgAABAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDM4Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1cnZlLjA5NiIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjN9XX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NiwibWF4IjpbMC4wNzc3NDEzNzcwNTU2NDQ5OSwwLDAuMDkwNDMwMzE5MzA5MjM0NjJdLCJtaW4iOlstMC4wNzc3NDEzODQ1MDYyMjU1OSwwLC0wLjA5MDQzMDI1OTcwNDU4OTg0XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NiwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NiwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyODIsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjExNTIsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoxMTUyLCJieXRlT2Zmc2V0IjoxMTUyLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwi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3C9QPHT3qD6eGWU74C6zPhqxbDJ0TL4+8+BkO+5Yyj5vynk8Cl3XPoSkFT2IYeU+q42MPUBv9D59DMA9fmv9PrLs8z0RQQI/vpITPipJBT8JVyw+oD0IP9W+Qz4Gjgs/vEVZPvSpDz9LZ2w+9wAVPyqffD6qAhw/crSEPp8eJT8TIIk+bcQwPzxQiz6mYz8/ugKLPt9rUT9YlY8+9ilkP+A8nz7L7XE/g563PgL7ej9oX9Y+NZV/P7Ik+T4AAIA/xckOPwN/fD+PqCA/31V1P0sBMT8yyGo/i6Y+P5kZXT/makg/s41MP+wgTT8baDk/NJtLP3HsIz+igUg/4LYaP8L7Qz9U0hI/AIo+P6b3Cz/KrDg/qt8FP43kMj83QwA/urEtP0i29T68lCk/jMDqPgAOJz/oFt8+9J0mPwIr0j4JxSg/km7DPqcDLj86U7I+P9o2P7JKnj47tjs/SEWUPoscQD98gIo+JPxDPzTqgD79Q0c/pOBuPgrjST+EAVw+PchLP7QSST6L4kw/DPA1PuwgTT9QdSI+UnJMP1B+Dj60xUo/oM3zPQQKSD8gFck9Py5EP/iKnD1+2j4/0AZjPeYoOT+gki89AyUzP+BqGT1c2iw/0EAbPX1UJj/wxS898J4fP+CrUT1AxRg/IKR7PfbSET8AMJQ9ntMKP6BIqT2+0gM/gHS6Pca3+T5wDMU9DQALAAwADgALAA0ADgAKAAsADwAKAA4ADwAJAAoAEAAJAA8AEAAIAAkAEQAIABAAEQAHAAgAEgAHABEAEgAGAAcAEwAGABIAFAAGABMAFAAFAAYAFQAFABQAFQAEAAUAFgAEABUAFwAEABYAHAAaABsAHQAaABwAHQAZABoAHgAZAB0AHgAYABkAGAAEABcAHgAEABgAHgADAAQAHwADAB4AIAADAB8AIQADACAAIQACAAMAIgACACEAIgABAAIAIwABACIAIwAAAAEAIwBfAAAAJABfACMAJABeAF8AJABdAF4AJABcAF0AJABbAFwAJQBbACQAJQBaAFsAJQBZAFoAJQBYAFkAJgBYACUAJgBXAFgAJgBWAFcAJwBWACYAJwBVAFYAKABVACcAKABUAFUAKQBUACgAKQBTAFQAKgBTACkAKgBSAFMAKwBSACoAKwBRAFIALABRACsALABQAFEALABPAFAALQBPACwALQBOAE8ALQBNAE4ALQBMAE0ALgBMAC0ALgBLAEwALgBKAEsALgBJAEoALgBIAEkALgBHAEgALgBGAEcALwBGAC4ALwBFAEYALwBEAEUALwBDAEQAMABDAC8AMABCAEMAMABBAEIAMQBBADAAMQBAAEEAMQA/AEAAMgA/ADEAMgA+AD8AMgA9AD4AMwA9ADIAMwA8AD0ANAA8ADMANAA7ADwANQA7ADQANQA6ADsANgA6ADUANgA5ADoANwA5ADYANwA4ADkA", import.meta.url).href },
  { id: "fs-shape-blobs_b", label: "blobs_b", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAgFAAACAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDM5Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1cnZlLjEwMiIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjN9XX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoxMDgsIm1heCI6WzAuMDcxMDU2OTMyMjEwOTIyMjQsMCwwLjA4MTE5NTc3MTY5NDE4MzM1XSwibWluIjpbLTAuMDcxMDU2OTYyMDEzMjQ0NjMsMCwtMC4wODExOTU4MzEyOTg4MjgxMl0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MTA4LCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjEwOCwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjozMTgsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjEyOTYsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoxMjk2LCJieXRlT2Zmc2V0IjoxMjk2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6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AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAALA2uT7Ie8Q98h8pPuheSj4Goa4+WHrDPZUeKT7YEVY+LMfCPkAuwT3Ilss+WFG3PeIyKj4s+2A+WMzTPogmqD22jts+AO+UPWhdEz8A4E45WFXqPgC+Tj0q0w0/AAAAAMUE4z5A2H09GC0YPwBAgjurxCs+8GVrPr9UHD+AXjI83jstPmSddT7Z5h8/4NKnPEsALj6g7H8+0nktPmJPhT7m9SI/YGkEPU0QKz6C/4o+lismPjgskT5olCU/0EM8PY4zHj4k+5c+GZASPtiRnz7d1Cc/UKR5PZb0BT60cqY+NAvxPZ73rD44FNU9hkWzPsXJKT9wW509UpK4PWiBuT5xE5w9ONC/PpolgD3iVsY+ja1KPVw6zT6ihSs/6NO+PSBqGD2gn9Q+mTnVPJ6r3D71Gi0/WFHgPTbDhDxKg+U+pFIDPJxL7z46nC4/4HQAPr814jqAKfo+9hswP6TZDz7qF6Myh2ECPyrlMD9EASE+95ihO9qlBj/TXjA/BFw2PvzSezysPQo/aMUuP1gdTz5THfc864QNP1lVLD+seGo+ekpFPYrXED8cSyk/ytCDPua4iz13kRQ/I+MlP8jlkj4xp7Y9pw4ZP+NZIj8MFaI+7RThPQerHj/R6x4/YviwPlzVGz98Kb8+g1MEPo3CJT/7Uhk/JELMPiKhFz8a3Nc+JYEVPiaxLj9D/BY/HJHhPgOfFz8IIu4+wuUiPsLSOT/YdBk/mOL5PlA0HD/+jQI/yFMrPk+DRz/5kx8/vAsIP2RKIz8ojw0/vzE5PvLMVz8cDic/4DwTP7KVKj+HORk/yldUPlyMZT+yly0/wKkfP6zKLz8psiY/4G16PlqZcD8q5TA/YHcuP76dMD8LHjc/A46UPsDLeD/yqi4/xcpAP4PnJj/uE1U/FgWvPl37fT8ncMs+AACAPxSaHD8AQWU/OKPoPnqxfj+dWBA/KnpxPx+5Aj+X53k/U6fxPuARHz04Awk/AAVOO3V1AD/AG5A8IZUEP8DsFjyPIfk+wKziPBXPKj4Ulz0+I02kPmDrwT0pxC4+SG8vPkpJmj4wu8A9oSs4PpycGT6wo5A+sNXAPY5qhz44J8M9ETNDPrAfCD42WH0+4JvIPRq+Tz5IBfU9H+1sPqgf0j1GsF0+yJ7gPQMAAAABAAEAAAACAAMABAAAAAMABQAEAAYABQADAAYABwAFAAcACQAIAAYACQAHAAwACQAKAAoACQALAAgACQAMAAYADQAJAA4ADQAGAA4ADwANABAADwAOABAAEQAPABIAEQAQABMAEQASABMAFAARABUAFAATABYAFAAVABYAFwAUABgAFwAWABkAFwAYABkAGgAXABsAGgAZABwAGgAbAB0AGgAcAB0AHgAaAB8AHgAdACAAHgAfACEAHgAgACIAHgAhACIAIwAeACQAIwAiACUAIwAkACUAJgAjACcAJgAlACgAJgAnACgAKQAmACoAKQAoACoAKwApACwAKwAqACwALQArAC4ALQAsAC4ALwAtADAALwAuADAAMQAvADIAMQAwADIAMwAxADQAMwAyADQANQAzADYANQA0ADYANwA1ADgANwA2ADgAOQA3ADoAOQA4ADoAOwA5ADoAPAA7AD0APAA6AD0APgA8AD0APwA+AEAAPwA9AEAAQQA/AEAAQgBBAEMAQgBAAEMARABCAEMARQBEAEYARQBDAEYARwBFAEYASABHAEkASABGAEkASgBIAEkASwBKAEwASwBJAEwATQBLAEwATgBNAE8ATgBMAE8AUABOAE8AUQBQAFIAUQBPAFIAUwBRAFIAVABTAFUAVABSAFYAVABVAFYAVwBUAFgAVwBWAFgAWQBXAFoAWQBYAAoACwBbAFsACwBcAF8AXABdAF0AXABeAFsAXABfAAEAAgBgAGAAAgBhAGAAYQBiAGIAYQBjAGIAYwBkAGQAYwBlAGQAZQBmAGQAZgBnAGcAZgBoAGcAaABpAGkAaABqAGkAagBrAA==", import.meta.url).href },
  { id: "fs-shape-blobs_c", label: "blobs_c", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABUEgAABAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDQwIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1cnZlLjEwMyIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjN9XX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo5NiwibWF4IjpbMC4xNDgyODE4NzIyNzI0OTE0NiwwLDAuMTM2NjQ2MTgxMzQ0OTg1OTZdLCJtaW4iOlstMC4xNDgyODE3Njc5NjQzNjMxLDAsLTAuMTM2NjQ2MTUxNTQyNjYzNTddLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjk2LCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjk2LCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjI4MiwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MTE1MiwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjExNTIsImJ5dGVPZmZzZXQiOjExNTIsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJi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DxU/PxjdrD0Izpc+CltnP+VbQD8wluc9wRhAPzAKFD6Hbx0/xl7EPr+eIT9q77U+Wkk+P2iqNj7AYyc/YGynPuR6Lz9u4ZM+bOs6PzwqWz6w/DU/GoSAPlPKoj64C3A/CrQaP4qu0j45Shk/utLgPgMQGT9qv+4+HN6yPgY8dz9X4xk/mmj8PiSiGz8u4QQ/WioeP1tgCz97BMk+Q418P+ZZIT/aqxE/ug4lP7C9Fz+JOOY+vqB/P8MmKT/ijx0/8n8tP3YcIz8jC/w+//9/PyEpOD9HdDI/x44JPzPSfj+CMxU/nR18P1FGPj+sfUA/XW8gP4Podz/mW0A/YjJNP/a9Kj8mOXI/Q+4+PyaMWD/nmjM/zBVrP82BOj+1hGI/GAOsPgBwZD0NP6s9NhD4PuCsnj5Q+0g9MmAqPnypez44hpA+kOUmPbJyLT4K/IM+qwIuPtiwiT5WPSs+HCKPPshPJD7GfpQ+LGcYPsr1mT4+JEY9XMruPq2wBj4atp8+oLLcPabupT74pqc8jFDlPrJpSD0I+rU+24dTO/5D2z5tW2c8hvfDPhjq1zLsRdA+Pf8fPtTlXj7LJoI+EIQGPRmeJT4MGG4+tHYVPpQnOj6NTGg+wFfgPHlWGj74tE0+vDISPsjfIz6sOE4+YGTYPAvfED6gUd09P0E3PiDsAj0XZRc+uOeQPZ+VJD7grjw9AQADAAAAAQAAAAIABAADAAEABAAFAAMABAAGAAUABAAHAAYACAAHAAQACAAJAAcACAAKAAkACwAKAAgACwAMAAoACwANAAwACwAOAA0ADwAOAAsADwAQAA4AEQAQAA8AEQASABAAEQATABIAFAATABEAFAAVABMAFgAVABQAFgAXABUAGAAXABYAGQAXABgAGQAaABcAGwAaABkAGwAcABoAHQAcABsAHQAeABwAHwAeAB0AHwAgAB4AHwAhACAAIgAhAB8AIgAjACEAIwAkACEAJQAkACMAJgAkACUAJgAnACQAKAAnACYAKQAqACIAKQAiAB8AKQArACoAKQAsACsALQAsACkALQAuACwALQAvAC4ALQAwAC8AMQAwAC0AMQAyADAAMQAzADIANAAzADEANAA1ADMANAA2ADUANwA2ADQANwA4ADYAOQA4ADcAOgA4ADkAOgA7ADgAPAA7ADoAPAA9ADsAPgA9ADwAPgA/AD0AQAA/AD4AQQA/AEAAAQACAEIAAQBCAEMAQwBCAEQARwBEAEUARQBEAEYASABEAEcASQBEAEgAQwBEAEkAQwBJAEoAQwBKAEsAQwBLAEwATABLAE0ATABNAE4ATABOAE8ATwBOAFAATwBQAFEAUQBQAFIAUQBSAFMAVgBGAFQAVABGAFUARQBGAFYAWQBVAFcAVwBVAFgAVABVAFkAVwBYAFoAWgBYAFsAWgBbAFwAXABbAF0AXABdAF4AXgBdAF8A", import.meta.url).href },
  { id: "fs-shape-blobs_d", label: "blobs_d", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACMEAAABAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDQxIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1cnZlLjEwNCIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjN9XX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo4NCwibWF4IjpbMC4xMDY0OTgyODYxMjgwNDQxMywwLDAuMTExMzM3MzYzNzE5OTQwMTldLCJtaW4iOlstMC4xMDY0OTgyODYxMjgwNDQxMywwLC0wLjExMTMzNzMwNDExNTI5NTQxXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo4NCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo4NCwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoyNDYsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjEwMDgsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoxMDA4LCJieXRlT2Zmc2V0IjoxMDA4LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwi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4+5ZPyIb0z6XJew+4KoHPn63CD9osAk+MvJdP9CWwT47MBQ/CFboPQTYYT8Yyqw+hIAhPxCAlj25UmU/qKmSPnohZz/kAXA+E1ovP3DhAT00SWc/1JA7Pvq4Oz8AigA82c5lP+DwCT5Tt2I/6CW6PU6YRj8AAAAAlQdeP1CfWz0k808/gLDNO4rEVz+AA8s8AQADAAAAAQAAAAIABAADAAEABAAFAAMABAAGAAUABAAHAAYACAAHAAQACAAJAAcACAAKAAkACwAKAAgACwAMAAoADQAMAAsADQAOAAwADQAPAA4AEAAPAA0AEAARAA8AEAASABEAEwASABAAEwAUABIAFQAUABMAFQAWABQAFwAWABUAGAAWABcAGAAZABYAGgAZABgAGgAbABkAHAAbABoAHQAbABwAHQAeABsAHwAeAB0AIAAeAB8AIAAhAB4AIgAhACAAIgAjACEAJAAjACIAJAAlACMAJgAlACQAJgAnACUAKAAnACYAKAApACcAKAAqACkAKwAqACgAKwAsACoALQAsACsALQAuACwALwAuAC0AAQACADAAAQAwADEAAQAxADIAMgAxADMAMgAzADQAMgA0ADUAMgA1ADYAMgA2ADcANwA2ADgAOwA4ADkAOQA4ADoAPAA4ADsANwA4ADwAOwA+AD0AOwA/AD4AOwA5AD8APQA+AEAAQwA6AEEAQQA6AEIAOQA6AEMAQQBCAEQARABCAEUARABFAEYARgBFAEcARgBHAEgASABHAEkASABJAEoASABKAEsASwBKAEwASwBMAE0ATQBMAE4ATQBOAE8ATQBPAFAAUABPAFEAUABRAFIAUgBRAFMA", import.meta.url).href },
  { id: "fs-shape-blobs_f", label: "blobs_f", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAD4DAAAAAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDQ0Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1cnZlLjEwNiIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjAsIk5PUk1BTCI6MSwiVEVYQ09PUkRfMCI6Mn0sImluZGljZXMiOjN9XX1dLCJhY2Nlc3NvcnMiOlt7ImJ1ZmZlclZpZXciOjAsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo2MCwibWF4IjpbMC4yMTgwMTM0MDU3OTk4NjU3MiwwLDAuMTU1NzMxOTE2NDI3NjEyM10sIm1pbiI6Wy0wLjIxODAxMzQzNTYwMjE4ODEsMCwtMC4xNTU3MzE4ODY2MjUyODk5Ml0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NjAsInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NjAsInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTc0LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo3MjAsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo3MjAsImJ5dGVPZmZzZXQiOjcyMCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVM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", import.meta.url).href },
  { id: "fs-shape-cloudsb_a", label: "cloudsb_a", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAcLwAATAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDQ1Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE0In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4xMDciLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI4OCwibWF4IjpbMC4yMDc5MzQ3MDc0MDMxODI5OCwwLDAuMjAwODc1MDQzODY5MDE4NTVdLCJtaW4iOlstMC4yMDc5MzQ2OTI1MDIwMjE4LDAsLTAuMjAwODc1MDQzODY5MDE4NTVdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI4OCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyODgsInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6ODU4LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjozNDU2LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZl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PKOlvQAAAACIoDq+IBacvQAAAAAIWzu+3KKSvQAAAACIxju+9FeJvQAAAACg5Du+6kOAvQAAAADotju+hOpuvQAAAAD4Pju+APVdvQAAAABkfjq+AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAA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BQEzADIABAEzAAUBBAE0ADMAAwE0AAQBAwE1ADQAAgE1AAMBAgE2ADUAAQE2AAIBAQE3ADYAAAE3AAEBAAE4ADcA/wA4AAAB/wA5ADgA/gA5AP8A/gA6ADkA/QA6AP4A/QA7ADoA/AA7AP0A/AA8ADsA+wA8APwA+wA9ADwA+gA9APsA+gA+AD0A+QA+APoA+QA/AD4A+AA/APkA+ABAAD8A9wBAAPgA9wBBAEAA9gBBAPcA9gBCAEEA9QBCAPYA9QBDAEIA9ABDAPUA9ABEAEMA8wBEAPQA8wBFAEQA8gBFAPMA8gBGAEUA8QBGAPIA8QBHAEYA8ABHAPEA8ABIAEcA7wBIAPAA7wBJAEgA7gBJAO8A7gBKAEkA7QBKAO4A7QBLAEoA7ABLAO0A7ABMAEsA6wBMAOwA6wBNAEwA6gBNAOsA6gBOAE0A6QBOAOoA6QBPAE4A6ABPAOkA6ABQAE8A5wBQAOgA5wBRAFAA5gBRAOcA5gBSAFEA5QBSAOYA5QBTAFIA5ABTAOUA5ABUAFMA4wBUAOQA4wBVAFQA4gBVAOMA4gBWAFUA4QBWAOIA4QBXAFYA4ABXAOEA4ABYAFcA3wBYAOAA3wBZAFgA3gBZAN8A3gBaAFkA3QBaAN4A3QBbAFoA3ABbAN0A3ABcAFsA2wBcANwA2wBdAFwA2gBdANsA2gBeAF0A2QBeANoA2QBfAF4A2ABfANkA2ABgAF8A1wBgANgA1wBhAGAA1gBhANcA1gBiAGEA1QBiANYA1QBjAGIA1ABjANUA1ABkAGMA0wBkANQA0wBlAGQA0gBlANMA0gBmAGUA0QBmANIA0QBnAGYA0ABnANEA0ABoAGcAzwBoANAAzwBpAGgAzgBpAM8AzgBqAGkAzQBqAM4AzQBrAGoAzABrAM0AzABsAGsAywBsAMwAywBtAGwAygBtAMsAygBuAG0AyQBuAMoAyQBvAG4AyABvAMkAyABwAG8AxwBwAMgAxwBxAHAAxgBxAMcAxgByAHEAxQByAMYAxQBzAHIAxABzAMUAxAB0AHMAwwB0AMQAwwB1AHQAwgB1AMMAwgB2AHUAwQB2AMIAwQB3AHYAwAB3AMEAwAB4AHcAvwB4AMAAvwB5AHgAvgB5AL8AvgB6AHkAvQB6AL4AvQB7AHoAvAB7AL0AvAB8AHsAuwB8ALwAuwB9AHwAugB9ALsAugB+AH0AuQB+ALoAuQB/AH4AuAB/ALkAuACAAH8AtwCAALgAtwCBAIAAtgCBALcAtgCCAIEAtQCCALYAtQCDAIIAtACDALUAtACEAIMAswCEALQAswCFAIQAswCGAIUAsgCGALMAsgCHAIYAsQCHALIAsQCIAIcAsACoALEAqACQALEAkACIALEAsACpAKgApwCQAKgApwCRAJAAjwCIAJAAjwCJAIgArwCpALAAjgCJAI8ArwCqAKkAjgCKAIkArgCqAK8AjQCKAI4ArgCrAKoAjQCLAIoArQCrAK4AjACLAI0ArQCsAKsApgCRAKcApgCSAJEApQCSAKYApQCTAJIApACTAKUApACUAJMAowCUAKQAowCVAJQAogCVAKMAogCWAJUAoQCWAKIAoQCXAJYAoACXAKEAoACYAJcAnwCYAKAAnwCZAJgAngCZAJ8AngCaAJkAnQCaAJ4AnQCbAJoAnACbAJ0A", import.meta.url).href },
  { id: "fs-shape-heart_c", label: "heart_c", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADQEAAASAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDE2Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDA1In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNjYiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjg0LCJtYXgiOlswLjE2NDU3ODI1ODk5MTI0MTQ2LDAsMC4xMzUzMTY1ODA1MzM5ODEzMl0sIm1pbiI6Wy0wLjE2NDU3ODE5OTM4NjU5NjY4LDAsLTAuMTM1MzE2NjEwMzM2MzAzN10sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6ODQsInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6ODQsInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MjQ2LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoxMDA4LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6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XwR3P915PT/Caxg/TME+P9T2cT+G9kQ/1slrP2rxRT/87iE/1zJKP4qFZD/9G0w/BtIrPytPTj+wUVw/liRQP/rkNT+AIFE/NF5TPzY2Uj/u9z8/2XtSP/raST+FyS8/4K2hPFqKMj9oD+E+0C8nPwC3Dzx9qzc/ALcPPd55PT9QKM8+g/ZEP+CtoT1r8UU/0CG8PkvBPj/wjWA91TJKP2DR2z39G0w/uluoPipPTj94uA4+lyRQP9I1lD5/IFE/qIYyPjU2Uj/qD4A+2XtSP6iTWD4FAAAAAQABAAAAAgAAAAQAAwAAAAYABAAFAAYAAAAHAAYABQAHAAgABgAJAAgABwAJAAoACAALAAoACQALAAwACgANAAwACwANAA4ADAAPAA4ADQAPABAADgARABAADwARABIAEAATABIAEQATABQAEgAVABQAEwAVABYAFAAXABYAFQAXABgAFgAZABgAFwAZABoAGAAbABoAGQAbABwAGgAdABwAGwAdAB4AHAAfAB4AHQAfACAAHgAhACAAHwAhACIAIAAjACIAIQAjACQAIgAlACQAIwAlACYAJAAnACYAJQAnACgAJgApACgAJwApACoAKAArACoAKQArACwAKgAtACwAKwAtAC4ALAAvAC4ALQAvADAALgAxADAALwAxADIAMAAzADIAMQAzADQAMgA1ADQAMwADAAQANgADADYANwADADcAOAA4ADcAOQA4ADkAOgA6ADkAOwA6ADsAPAA6ADwAPQA9ADwAPgA9AD4APwA/AD4AQAA/AEAAQQBBAEAAQgBBAEIAQwBDAEIARABHAAIARQBFAAIARgABAAIARwBFAEYASABIAEYASQBMAEkASgBKAEkASwBIAEkATABKAEsATQBNAEsATgBNAE4ATwBPAE4AUABPAFAAUQBRAFAAUgBRAFIAUwA=", import.meta.url).href },
  { id: "fs-shape-horns_a", label: "horns_a", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB0CwAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDAxIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNTAiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjExMzYyMDM0MDgyNDEyNzIsMCwwLjIyODc1NDI1MjE5NTM1ODI4XSwibWluIjpbLTAuMTEzNjIwMzQwODI0MTI3MiwwLC0wLjIyODc1NDI1MjE5NTM1ODI4XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6NTc2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6Mzg0LCJieXRlT2Zmc2V0IjoxMTUyLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6Mjc2LCJieXRlT2Zmc2V0IjoxNTM2LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjE4MTJ9XX0gICAUBwAAQklOAAAAuLUAAAAAjj5qvtBFMzwAAAAAOEJTvrjXujwAAAAAxp45vixXED0AAAAAIMcdvsgcRD0AAAAALi4AvhRGdz0AAAAArI3CvTwulD0AAAAAAAiDvar0qj0AAAAAUGIFvQg7vz0AAAAAAL2bughG0D0AAAAAMGPzPFxa3T0AAAAAmIB0PbS85T0AAAAAuuG0Pcix6D0AAAAATNfrPZCR5j0AAAAAMLIFPmBg4D0AAAAAS9QUPmhl1j0AAAAAXS4jPuDnyD0AAAAAz5wwPvguuD0AAAAACPw8PuiBpD0AAAAAcihIPuAnjj0AAAAAcv5RPijQaj0AAAAAc1paPnATNT0AAAAA2hhhPgBQ9zwAAAAAEhZmPvBwfDwAAAAAgC5pPgAAuLUAAAAAjj5qPtB5fLwAAAAAgC5pPlBT97wAAAAAEhZmPqYUNb0AAAAA2hhhPgLRar0AAAAAc1paPikojr0AAAAAcv5RPhaCpL0AAAAAcihIPhQvuL0AAAAACPw8Pu3nyL0AAAAAzpwwPm1l1r0AAAAAXC4jPl9g4L0AAAAAStQUPo6R5r0AAAAAMLIFPsix6L0AAAAATNfrPax3470AAAAAroC2PX8Z1b0AAAAALiWAPYCPv70AAAAAkJARPerRpL0AAAAAoGsDPPvYhr0AAAAAQJ+jvOA5T70AAAAAGGhGvQwsEr0AAAAAyHOevejxtLwAAAAAiKPavUBEMLwAAAAA6N8LvsBNLrsAAAAAlOIqvoBlozoAAAAAClhKvgAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAJAXSzEAAAAAnD4nPVCFIz0KZa89GH6tPYyGCD7E6Qg+rCk7PgyyPj7YeW4+hGh3PoKqkD7eLpk+j0ypPihxtz4NksA+aCPWPvXp1T7o7fQ+P8PoPny8CT/jjPg+cLYYP+9aAj/2OCc//9AEP4LrLz86DwY/nqk4P/IhBj9EWUE/ehUFP3TgST8j9gI/LCVSP4Kg/z5qDVo/TWD3Pil/YT9KRO0+a2BoPx5l4T4sl24/cNvTPmoJdD/jv8Q+Ip14Px0rtD5UOHw/RMWiPo6ufj9eSJE+Au1/P+HQfz4AAIA/BbNdPtnzfj8xnzw+3tR8P3b9HD5hr3k/tWv+PbGPdT/fYMc9IYJwP36qlT0Ck2o/VzFUPaTOYz8C9wo9WUFcPz+Mojxy91M/0eOtOy4bRT+mUKMztRc1P8tQ8zpyHiQ/zVUQPM5gEj/19Jk8NRAAP22m8zwgvNo+QikiPZT3tD4/hj09mjWPPtFzQz0MslM+jnsrPViJCj4oTto8kG2HPS8AAQAAAC8AAgABAC4AAgAvAC4AAwACAC0AAwAuAC0ABAADACwABAAtACwABQAEACsABQAsACsABgAFACoABgArACoABwAGACkABwAqACkACAAHACgACAApACgACQAIACcACQAoACcACgAJACYACgAnACYACwAKACUACwAmACUADAALACQADAAlACMADAAkACMADQAMACIADQAjACIADgANACEADgAiACEADwAOACAADwAhACAAEAAPAB8AEAAgAB8AEQAQAB4AEQAfAB4AEgARAB0AEgAeAB0AEwASABwAEwAdABwAFAATABsAFAAcABsAFQAUABoAFQAbABoAFgAVABoAFwAWABkAFwAaABkAGAAXAA==", import.meta.url).href },
  { id: "fs-shape-horns_b", label: "horns_b", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAABwCwAAQAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDAyIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNTEiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjEyOTU2Mjg1NDc2Njg0NTcsMCwwLjI1NDkxODQyNjI3NTI1MzNdLCJtaW4iOlstMC4xMjk1NjI4NTQ3NjY4NDU3LDAsLTAuMjU0OTE4NDI2Mjc1MjUzM10sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTM4LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo1NzYsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo1NzYsImJ5dGVPZmZzZXQiOjU3NiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjM4NCwiYnl0ZU9mZnNldCI6MTE1MiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjI3NiwiYnl0ZU9mZnNldCI6MTUzNiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxODEyfV19IBQHAABCSU4AAAAAAAAAAACrhIK+AKo9uwAAAAD6uVW+AEwdOgAAAADyJSm+4JMYPAAAAADUlf69cNS0PAAAAAAYTbC9eHoaPQAAAAAQ2k69QIthPQAAAADgw4+8DGmVPQAAAAAgXlE8QMK4PQAAAACo2yU9AGzYPQAAAADkWYY9EAHyPQAAAACgdLQ9HI4BPgAAAACwQt09IKwEPgAAAABiZAA+2HUDPgAAAACOYRI+GNz/PQAAAAA3oyM+qHr0PQAAAADGADQ+mBjlPQAAAACkUUM+GAfSPQAAAAA8bVE+UJe7PQAAAAD2Kl4+eBqiPQAAAAA+Ymk+wOGFPQAAAAB86nI+uHxOPQAAAAAam3o+8AINPQAAAADBJYA+IPGPPAAAAACO6YE+AAAAAAAAAACrhII+8O+PvAAAAACP6YE+8AENvQAAAADBJYA+gHtOvQAAAAAam3o+HOGFvQAAAAB86nI+2BmivQAAAAA+Ymk+wJa7vQAAAAD2Kl4+oAbSvQAAAAA8bVE+RBjlvQAAAACkUUM+dHr0vQAAAADGADQ+/Nv/vQAAAAA3oyM+1HUDvgAAAACOYRI+IKwEvgAAAABiZAA+KFQDvgAAAAA0uto9HOf+vQAAAAB4Pqs9lIryvQAAAAA8ZWc9qAjivQAAAADQztU8TNfNvQAAAABAE+K7bGy2vQAAAAAYXiu9+D2cvQAAAADI2J+9yIN/vQAAAABYQeu9QNxCvQAAAADWRRu+MHEDvQAAAABaLUC+AF2EvAAAAACyqGO+AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAApmQFPwAAALS5+vc+oPGyPaZq7D4kEjI+4u/mPuyAhD45YeY+5L6uPnqV6T7qXdc+dGPvPur4/T70ofY+axURP8gn/j5OxyE/32UCP5XfMD9SsgQ/uCs+P6ZkBT8weUk/QugDP3SVUj9hSgA/FxNbP29a9z4X0mI/dlbsPq7FaT/Hvd8+FOFvP03F0T6DF3U/76HCPjJceT+ciLI+XKJ8Pz+uoT443X4/xkeQPgAAgD80FH0+7f1/P1BUWT42yn4/uLk1PhhYfD+OwRM+G7p4P6OH6T3kHHQ/SuexPeuabj9mCIE9pE5oP4KiLj2EUmE/l6DUPAHBWT/rmlc8kbRRP1STkTuoR0k/uqqssr6UQD+YIOA3RrY3P9KYmju2xi4/f8dpPIXgJT+yQ/A88OccP8UeVj1wFRI/D2WoPXKzBT+tQvI9wBjwPnhsIz5Q1dI+TyxSPmwxtD6cPII+7sGUPsi1nD5YN2o+2Q24PgSnKz4A0dM+GPndPWuL7z6AhlU9LwABAAAALgABAC8ALgACAAEALQACAC4ALQADAAIALAADAC0ALAAEAAMAKwAEACwAKwAFAAQAKgAFACsAKgAGAAUAKQAGACoAKQAHAAYAKAAHACkAKAAIAAcAJwAIACgAJwAJAAgAJgAJACcAJgAKAAkAJQAKACYAJQALAAoAJAALACUAJAAMAAsAIwAMACQAIwANAAwAIgANACMAIgAOAA0AIQAOACIAIQAPAA4AIAAPACEAIAAQAA8AIAARABAAHwARACAAHwASABEAHgASAB8AHgATABIAHQATAB4AHQAUABMAHAAUAB0AHAAVABQAGwAVABwAGwAWABUAGgAWABsAGgAXABYAGQAXABoAGQAYABcA", import.meta.url).href },
  { id: "fs-shape-horns_c", label: "horns_c", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB0CwAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDAzIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNTIiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjI1MTI2ODM4Njg0MDgyLDAsMC4xNjg0NTg4Nzg5OTM5ODgwNF0sIm1pbiI6Wy0wLjA3NjI1MTI4MzI4ODAwMjAxLDAsLTAuMTY4NDU4OTA4Nzk2MzEwNDJdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJieXRlT2Zmc2V0Ijo1NzYsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjozODQsImJ5dGVPZmZzZXQiOjExNTIsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoyNzYsImJ5dGVPZmZzZXQiOjE1MzYsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTgxMn1dfSAUBwAAQklOAOBsAbwAAAAAfIAsPqAzGLwAAAAAgLsoPoATV7wAAAAAWB0ePgDvmrwAAAAAPK8NPmAy1rwAAAAAyPTwPVCeDL0AAAAACBC/PUj7L70AAAAAqMKHPXgkU70AAAAAMD4aPUQOdL0AAAAAAL4JPIhWiL0AAAAAwIOnvJ56k70AAAAAGDFEvZZtmr0AAAAApFyVvaIpnL0AAAAA1JrBvRwYmr0AAAAAXLzWvaxSlb0AAAAA/OvqvYwKjr0AAAAAbPv9vfhwhL0AAAAAJt4Hvlhucb0AAAAAKgAQvsQcVr0AAAAAkkwXvqhPN70AAAAAOqwdvoBpFb0AAAAA9gcjvoCZ4bwAAAAAnkgnvrC3k7wAAAAABlcqviDlA7wAAAAAChwsvgCJFzsAAAAAfoAsvkD1TjwAAAAAyncrvqA8uDwAAAAANhUpvtg+Aj0AAAAAXnElvkDCJT0AAAAA3qQgvthLRj0AAAAATsgavvh+Yz0AAAAATvQTvuj+fD0AAAAAekEMvoA3iT0AAAAAbsgDvki5kT0AAAAAjEP1vXTWlz0AAAAAPMzhvaxgmz0AAAAAJFzNvaApnD0AAAAAdCS4vXzAlz0AAAAA9BWMvQi2jT0AAAAAOKsyvXBffj0AAAAAQJSHvPilWj0AAAAA4NBBPIiKMj0AAAAAkAwmPQBYCD0AAAAA3H2MPYCyvDwAAAAAPJ/CPaBkWzwAAAAA0GjzPcAUoTsAAAAAfmwOPgDy77oAAAAAEncePoATzrsAAAAAVtMoPgAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAP14jz4AAIA/686MPipRfT8BbIU++8B1P2hydD7vCWo/6D5YPofmWj9oDzg+PhFJP8u1FT6SRDU/7QfmPQI7ID+dl6M9Ca8KP+B8Tz1Otuo+yYDYPLDzwT5nBRM8OIucPmeUjjiw43c+QF5HsiBSWD7oNII7+L85PhdNQDz8eBw+Kry8PBDJAD4aHxo9+PfNPX9OYj1Au549L/KaPSDnaD1j7Mk9EHEfPeuR/T1gh8Q8cK8aPoA5SjyeZzg+gAGMO5ivVz4AAJE4YkJ3PgAAAADl6oo+gCOCO/iOmT4AOEA8f2enPuCpvDyOTrQ+gBEaPToewD7QO2I9k7DKPvjlmj2u39M+GN3JPZ+F2z5Yf/09d3zhPmikGj5LnuU+zFo4PjPF5z70oFc+M8XnPhS7jD7yGeQ+NASzPnp23T4mGt0+0o3UPqS1BD8BE8o++DIbPw25vj48PDE//TKzPpkIRj/ZM6g+Ps9YP6dunj5Vx2g/bpaWPgsodT81XpE+iyh9PxcAGQAYABYAGQAXABYAGgAZABUAGgAWABUAGwAaABQAGwAVABQAHAAbABMAHAAUABMAHQAcABIAHQATABIAHgAdABEAHgASABEAHwAeABAAHwARABAAIAAfAA8AIAAQAA8AIQAgAA4AIQAPAA4AIgAhAA0AIgAOAA0AIwAiAAwAIwANAAwAJAAjAAsAJAAMAAsAJQAkAAoAJQALAAoAJgAlAAkAJgAKAAkAJwAmAAgAJwAJAAgAKAAnAAcAKAAIAAcAKQAoAAYAKQAHAAYAKgApAAUAKgAGAAUAKwAqAAQAKwAFAAQALAArAAMALAAEAAMALQAsAAIALQADAAIALgAtAAEALgACAAEALwAuAAAALwABAA==", import.meta.url).href },
  { id: "fs-shape-horns_g", label: "horns_g", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB0CwAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDA4Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNTYiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjE4NTU4ODAwMjIwNDg5NTAyLDAsMC4wODc3NjA4NjU2ODgzMjM5N10sIm1pbiI6Wy0wLjE4NTU4Nzg4Mjk5NTYwNTQ3LDAsLTAuMDg3NzYwODY1Njg4MzIzOTddLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjEzOCwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NTc2LCJieXRlT2Zmc2V0Ijo1NzYsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjozODQsImJ5dGVPZmZzZXQiOjExNTIsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjoyNzYsImJ5dGVPZmZzZXQiOjE1MzYsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTgxMn1dfSAUBwAAQklOAMAKPr4AAAAAGN2vvTAAHL4AAAAASJ2yvUj+8b0AAAAA+LuzveBGq70AAAAAoFWzvaAjSr0AAAAAsIaxvQBbgrwAAAAAmGuuvaDKgzwAAAAAyCCqvYClPD0AAAAAuMKkveBRlj0AAAAA0G2evWC4xz0AAAAAiD6XvaBO8T0AAAAAWFGPvXjuCD4AAAAAqMKGvcgVFD4AAAAA0F17vchjHT4AAAAA0FRjvUCcJT4AAAAAMDBHvXi1LD4AAAAAgHcnvbilMj4AAAAAULIEvUhjNz4AAAAAYNC+vHjkOj4AAAAAwIJgvIgfPT4AAAAAADZ2u8gKPj4AAAAAAEHSO4CcPT4AAAAAgLSIPADLOz4AAAAAAJfcPIiMOD4AAAAAMJQXPWjXMz4AAAAA8Kw/PfDULT4AAAAAcOJkPXjLJj4AAAAAIOGCPfDcHj4AAAAAwBKRPTgrFj4AAAAAoPKcPTjYDD4AAAAAUG2mPdgFAz4AAAAAaG+tPfCr8T0AAAAAcOWxPQDV3D0AAAAA+LuzPbDKxz0AAAAAkN+yPcjQsj0AAAAAyDyvPRgrnj0AAAAAMMCoPWgdij0AAAAASFafPbCmbz0AAAAAEDmSPUCGRD0AAAAA4Jp8PTAZEj0AAAAAYJ5JPWA+rzwAAAAAQPQNPQC/ojsAAAAAICiYPED0YbwAAAAAAKzOOvCfD70AAAAAYOCAvBDRcb0AAAAAECUGvWjor70AAAAAsDFIvcAv7b0AAAAAOA+CvVyPGL4AAAAA4LmbvQAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAPzszjMAAAAA5lVRPQhRlD0+edA9fKYXPtPzGj60CGc+ablLPgJvmz61y3k+pNrCPoU0kj6qDuk+4WelPkCpBj8WH7Y+y3YXP1D5wz6qkyY/wpXOPpKjMz+Nk9U+PEo+P9KR2D5VK0Y/sJTYPuSLTT+2qNY+WbBUP8Ps0j4Ch1s/t3/NPi7+YT9zgMY+KwRoP9sNvj5Lh20/yka0Ptd1cj8qSqk+Ir52P9o2nT55Tno/vCuQPjAVfT+zR4I+jgB/Py5TZz7q/n8/CNJJPv//fz/oQC0+pgl/P6bmET5TK30/GhTwPXR0ej/U4789evR2PwTKkz3aunI/fqhYPf/WbT8/IBQ9W1hoPwAttjxhTmI/f5k6PIDIWz88sX47LNZUP8BX1DHQhk0/IsO3OmQKRj+31wE8dGg8P+gYkzw6vzA/+8z0PPIsIz/naCw91M8TP6X4WD0cxgI/iXp5PQxc4D7EqYM9mEu4Pn7oez1Ml40+Pp5QPUT3QD51s/08QNTEPQEAAwACAAEABAADAAAABAABAAAABQAEAC8ABQAAAC8ABgAFAC8ABwAGAC8ACAAHAC8ACQAIAC4ACQAvAC4ACgAJAC4ACwAKAC4ADAALAC0ADAAuAC0ADQAMAC0ADgANACwADgAtACwADwAOACwAEAAPACsAEAAsACsAEQAQACsAEgARACoAEgArACoAEwASACoAFAATACkAFAAqACkAFQAUACkAFgAVACgAFgApACgAFwAWACcAFwAoACcAGAAXACcAGQAYACYAGQAnACYAGgAZACUAGgAmACUAGwAaACUAHAAbACQAHAAlACQAHQAcACMAHQAkACMAHgAdACIAHgAjACIAHwAeACEAHwAiACEAIAAfAA==", import.meta.url).href },
  { id: "fs-shape-horns_i", label: "horns_i", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB4CwAASAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDExIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAzIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNTgiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjAxOTQ2MTA5NTMzMzA5OTM2NSwwLDAuMDI4OTc0NDczNDc2NDA5OTEyXSwibWluIjpbLTAuMDE5NDYwOTc2MTIzODA5ODE0LDAsLTAuMDI4OTc0NDQzNjc0MDg3NTI0XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6NTc2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6Mzg0LCJieXRlT2Zmc2V0IjoxMTUyLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6Mjc2LCJieXRlT2Zmc2V0IjoxNTM2LCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjE4MTJ9XX0gFAcAAEJJTgAAXcO7AAAAANBb7bwAt2S7AAAAALDe3LwA1Fa6AAAAAOCVyLwAIgE7AAAAADAcsbyAUp07AAAAAIAMl7wA1fg7AAAAAEADdrzAQSg8AAAAAOAsO7wA5VA8AAAAAACX/buACXU8AAAAAIAphLuAsok8AAAAAADMx7mAVpU8AAAAAIAHTjugy5w8AAAAAADt0zvgbJ88AAAAAKDpGzwA+J08AAAAAMAlRzzguZk8AAAAAECfcDxg45I8AAAAAFD6izxApYk8AAAAACBinjyAYHw8AAAAAFBWrzzAamE8AAAAABCmvjyAykI8AAAAAJAgzDyA4SA8AAAAACCV1zyAIvg7AAAAAODS4DwAd6k7AAAAACCp5zwACC07AAAAABDn6zwAAMg1AAAAAOBb7TwA4Sy7AAAAABDn6zwAaKm7AAAAACCp5zwAF/i7AAAAAODS4DxA3SC8AAAAACCV1zyAx0K8AAAAAJAgzDzAaGG8AAAAABCmvjxAX3y8AAAAAFBWrzzApIm8AAAAACBinjwA45K8AAAAAFD6izyguZm8AAAAAECfcDzA9528AAAAAMAlRzygbJ+8AAAAAKDpGzxgdJy8AAAAAMBr2DugWJS8AAAAAIC5bjvATIi8AAAAAADuJDqACHO8AAAAAACzH7tAZVK8AAAAAIARtruAFjG8AAAAAGAJD7wAgxG8AAAAAMDyQ7wAJOy7AAAAAADJebwAVMK7AAAAAEBImLyAZKq7AAAAAKAmtLwAI6m7AAAAAMCB0LwAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAADO4GwyAAAAAF9vZz3A6pw8ZcH0PZDlOD3npT8+UA+ePYLhgz7Qduo9r2eoPiwIID4eccw+VKFOPsEJ7z4YHYA+kJ4HPzADmj6ACxY/lpy0PoNRIj/6gs8+g/YrPyRQ6j5zgDI/zE4CP5sdNj/4cw4/3QU4PzuvGj8OSjg/5NsmP/H6Nj891TI/Syk0P5x2Pj/+5S8/QZtJP71BKj99HlQ/X00jP6jbXT+kGRs/Ba5mP2W3ET/rcG4/dTcHP5//dD8qVfc+bzV6P4oJ3z7e0n0/3JHGPnS7fz97N64+AACAP8VDlj5QsX4/WQB+Phfgez8qbFE+LZ13P+NdJz5I+XE/PWgAPjMFaz/lO7o9vtFiP75GeD2tb1k/0VkPPcbvTj/T7m880GJDPw4tAjsutTU/zqU+MgXBJj90J8g76MMWP6VEkTx6+wU/ukgEPaJK6T7IaUE9Av7FPlR3dT1KjKI+g/CKPZThfj6yDIw9EE06PkmQcT2Qo/A9WrcXPTCYZz0vAAEAAAAvAAIAAQAuAAIALwAuAAMAAgAtAAMALgAtAAQAAwAsAAQALQAsAAUABAArAAUALAArAAYABQAqAAYAKwAqAAcABgApAAcAKgApAAgABwAoAAgAKQAoAAkACAAnAAkAKAAnAAoACQAmAAoAJwAmAAsACgAlAAsAJgAlAAwACwAkAAwAJQAjAAwAJAAjAA0ADAAiAA0AIwAiAA4ADQAhAA4AIgAhAA8ADgAgAA8AIQAgABAADwAfABAAIAAfABEAEAAeABEAHwAeABIAEQAdABIAHgAdABMAEgAcABMAHQAcABQAEwAbABQAHAAbABUAFAAaABUAGwAaABYAFQAZABYAGgAZABcAFgAYABcAGQA=", import.meta.url).href },
  { id: "fs-shape-pacman_d", label: "pacman_d", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAACIDQAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDI0Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDA3In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wNzUiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYyLCJtYXgiOlswLjE2MzYzNzYzODA5MjA0MTAyLDAsMC4xNTAzMzM4NTE1NzU4NTE0NF0sIm1pbiI6Wy0wLjE2MzYzNzgxNjkwNTk3NTM0LDAsLTAuMTUwMzMzNzYyMTY4ODg0MjhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYyLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYyLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjE4MCwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NzQ0LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6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", import.meta.url).href },
  { id: "fs-shape-pills_b", label: "pills_b", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAICAAAQAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDAxIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wMDciLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI1LCJtYXgiOlswLjA0MjMzNDE5ODk1MTcyMTE5LDAsMC4wODQ2NTA1MTY1MTAwMDk3N10sIm1pbiI6Wy0wLjA0MjMzNDE5ODk1MTcyMTE5LDAsLTAuMDg0NjUwNTE2NTEwMDA5NzddLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI1LCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI1LCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjY5LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjozMDAsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjozMDAsImJ5dGVPZmZzZXQiOjMwMCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjIwMCwiYnl0ZU9mZnNldCI6NjAwLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MTM4LCJieXRlT2Zmc2V0Ijo4MDAsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6OTQwfV19IKwDAABCSU4AoGYtPQAAAABAXa29oK/8PAAAAAAYyKu9oGYtPQAAAABAXa09IGuiPAAAAADoK6e9QKYZPAAAAACIvZ+9ACjRuQAAAADgsZW9QBEavAAAAADQPYm9QKWPvAAAAABwLHW9AEfKvAAAAAAA4FO9IBr8vAAAAAAAAC+9kCUSvQAAAABA9ga9MAMhvQAAAAAAWbi8IDwqvQAAAAAAMjy8oGYtvQAAAAAAAACAEDwqvQAAAABAMjw8IAMhvQAAAAAgWbg8gCUSvQAAAABQ9gY9ABr8vAAAAAAQAC894EbKvAAAAAAQ4FM9IKWPvAAAAACILHU9ABEavAAAAADYPYk9ACDRuQAAAADksZU9gKYZPAAAAACIvZ89QGuiPAAAAADkK6c9wK/8PAAAAAAYyKs9AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAA7AYAPwAAAABTT90+gJGVO+wGAD8AAIA/evy7PiBQkjxWY5w+YPEgPSSkfT6Izos9hS1HPkBd1T0P/xU+SPYVPtNp1T38IUc+2NaLPaSVfT79+iA9hFqcPhJZkjwA8rs+pZqVOzBD3T4AAAAAAAAAP5mdlTtuXhE/z1mSPAYHIj9b+yA9w9IxPwfXiz2cmkA/AmrVPYc3Tj8m/xU+doJaP50tRz5dVGU/O6R9PjKGbj9iY5w+6vB1P4b8uz57bXs/X0/dPtzUfj8BAAIAAAADAAIAAQAEAAIAAwAFAAIABAAGAAIABQAHAAIABgAIAAIABwAJAAIACAAKAAIACQALAAIACgAMAAIACwANAAIADAAOAAIADQAPAAIADgAQAAIADwARAAIAEAASAAIAEQATAAIAEgAUAAIAEwAVAAIAFAAWAAIAFQAXAAIAFgAYAAIAFwAAAA==", import.meta.url).href },
  { id: "fs-shape-pills_e", label: "pills_e", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADYEQAASAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDA0Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wMTAiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjkyLCJtYXgiOlswLjA0MjMzNDE5ODk1MTcyMTE5LDAsMC4wNDIzMjUyNTgyNTUwMDQ4OF0sIm1pbiI6Wy0wLjA0MjMzNDE5ODk1MTcyMTE5LDAsLTAuMDQyMzI1MjU4MjU1MDA0ODhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjkyLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjkyLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjI0OSwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MTEwNCwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIi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", import.meta.url).href },
  { id: "fs-shape-pills_g", label: "pills_g", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAD8DAAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDA2Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDAxIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wMTIiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYwLCJtYXgiOlswLjA4NDY2ODM5NzkwMzQ0MjM4LDAsMC4wNDIzMjUyNTgyNTUwMDQ4OF0sIm1pbiI6Wy0wLjA4NDY2ODM5NzkwMzQ0MjM4LDAsLTAuMDQyMzI1MjU4MjU1MDA0ODhdLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MSwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYwLCJ0eXBlIjoiVkVDMyJ9LHsiYnVmZmVyVmlldyI6MiwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjYwLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjE0MSwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NzIwLCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6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", import.meta.url).href },
  { id: "fs-shape-egg_a", label: "egg_a", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAkCwAA9AMAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUiLCJyb3RhdGlvbiI6WzAuNzA3MTA2ODI4Njg5NTc1MiwwLDAsMC43MDcxMDY4Mjg2ODk1NzUyXSwic2NhbGUiOls0MDAsNDAwLDQwMF19XSwibWVzaGVzIjpbeyJuYW1lIjoiQ3VydmUiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozfV19XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsIm1heCI6WzAuMDg2MTI2NTgwODM0Mzg4NzMsMCwwLjEyOTMyNzE5MjkwMjU2NV0sIm1pbiI6Wy0wLjA4NjEyNjU4MDgzNDM4ODczLDAsLTAuMTI5MzI3MTkyOTAyNTY1XSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0OCwidHlwZSI6IlZFQzIifSx7ImJ1ZmZlclZpZXciOjMsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjoxMzgsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjU3NiwiYnl0ZU9mZnNldCI6NTc2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6Mzg0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", import.meta.url).href },
  { id: "fs-shape-shapes_a", label: "shapes_a", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAB0CwAARAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDQ5Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE2In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4xMTIiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQ4LCJtYXgiOlswLjA3NjA2MDQ3MzkxODkxNDgsMCwwLjA3NjA0NDM4MDY2NDgyNTQ0XSwibWluIjpbLTAuMDc2MDYwNDE0MzE0MjcwMDIsMCwtMC4wNzYwNDQzODA2NjQ4MjU0NF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NDgsInR5cGUiOiJWRUMyIn0seyJidWZmZXJWaWV3IjozLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MTM4LCJ0eXBlIjoiU0NBTEFSIn1dLCJidWZmZXJWaWV3cyI6W3siYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo1NzYsImJ5dGVPZmZzZXQiOjAsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlTGVuZ3RoIjo1NzYsImJ5dGVPZmZzZXQiOjU3NiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjM4NCwiYnl0ZU9mZnNldCI6MTE1MiwidGFyZ2V0IjozNDk2Mn0seyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjI3NiwiYnl0ZU9mZnNldCI6MTUzNiwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxODEyfV19ICAUBwAAQklOAJDFm70AAAAAAAAAgFBZmr0AAAAAAP0ovFA0lr0AAAAAgIulvDCGj70AAAAAYGjyvJR+hr0AAAAAYCsdvTiadr0AAAAAEEw+vdhCXL0AAAAAADdcvUhWPr0AAAAA8Ix2vdAzHb0AAAAAUHeGvWB18rwAAAAAcH6PvVCUpbwAAAAAMCyWvQAGKbwAAAAA+FCavQAAADMAAAAAKL2bvUAGKTwAAAAA+FCavXCUpTwAAAAAMCyWvYB18jwAAAAAcH6PveAzHT0AAAAAUHeGvVhWPj0AAAAA8Ix2vehCXD0AAAAAADdcvUiadj0AAAAAEEw+vZx+hj0AAAAAYCsdvTiGjz0AAAAAYGjyvFg0lj0AAAAAgIulvFhZmj0AAAAAAP0ovJjFmz0AAAAAAAAAgFhZmj0AAAAAAP0oPFg0lj0AAAAAcIulPDiGjz0AAAAAYGjyPJx+hj0AAAAAYCsdPUiadj0AAAAAEEw+PehCXD0AAAAAADdcPVhWPj0AAAAA8Ix2PeAzHT0AAAAAVHeGPYB18jwAAAAAdH6PPXCUpTwAAAAAOCyWPUAGKTwAAAAAAFGaPQAAADMAAAAAKL2bPQAGKbwAAAAA/FCaPVCUpbwAAAAANCyWPWB18rwAAAAAcH6PPdAzHb0AAAAAUHeGPUhWPr0AAAAA6Ix2PdhCXL0AAAAA+DZcPTiadr0AAAAACEw+PZR+hr0AAAAAWCsdPTCGj70AAAAAUGjyPFA0lr0AAAAAYIulPFBZmr0AAAAA4PwoPAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAC07j4AAIAzsMkIPwAAgDPaqhk/wC4SPLTTKT8AttY8fho5P+AlUj1yVUc/GFKrPc1aVD/wRvs9xwBgP8DmKz6dHWo/0OBfPpCHcj/Yf4w+0hR5P7BYqz6nm30/6jHMPknyfz+Gwu4+ZvJ/P+LRCD/pqX0/7LMZP1I9eT+c3Sk/GNFyPywlOT/CiWo/0mBHP8qLYD/OZlQ/rvtUP1QNYD/t/Uc/oSpqPwi3OT/rlHI/fksqP24ieT/H3xk/Yql9P2qYCD8AAIA/c1HuPgAAgD8lj8w+Rrd9P2s9rD5RSnk/2K+NPqPdcj/cc2I+vpVqP3NeLj4il2A/EI3/PVEGVT9Hpq49zQdIP2qtVj0WwDk/DLLbPKpTKj/hrhU8DOcZP6weAja+ngg/7aujsT5c7j43HxI8KpjMPvqi1jzIRKw+GBVSPay1jT5TRas9uHxiPhc1+z3MZC4+/NorPmiV/z390V8+AKuuPcl2jD5gsVY95E2rPkCy2zxLJcw+wKcVPAsADQAMAAoADQALAAoADgANAAkADgAKAAkADwAOAAgADwAJAAgAEAAPAAcAEAAIAAcAEQAQAAYAEQAHAAYAEgARAAUAEgAGAAUAEwASAAQAEwAFAAQAFAATAAMAFAAEAAMAFQAUAAIAFQADAAIAFgAVAAEAFgACAAEAFwAWAAAAFwABAAAAGAAXAC8AGAAAAC8AGQAYAC4AGQAvAC4AGgAZAC0AGgAuAC0AGwAaACwAGwAtACwAHAAbACsAHAAsACsAHQAcACoAHQArACoAHgAdACkAHgAqACkAHwAeACgAHwApACgAIAAfACcAIAAoACcAIQAgACYAIQAnACYAIgAhACUAIgAmACUAIwAiACQAIwAlAA==", import.meta.url).href },
  { id: "fs-shape-shapes_b", label: "shapes_b", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAC4BAAANAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDUwIiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE2In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4xMjMiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjMsIm1heCI6WzAuMDczNTIwNDIxOTgxODExNTIsMCwwLjA3MzUwNDgwNTU2NDg4MDM3XSwibWluIjpbLTAuMDczNTIwMzYyMzc3MTY2NzUsMCwtMC4wNzM1MDQ5MjQ3NzQxNjk5Ml0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MywidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjozLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjMsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjM2LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MzYsImJ5dGVPZmZzZXQiOjM2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MjQsImJ5dGVPZmZzZXQiOjcyLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NiwiYnl0ZU9mZnNldCI6OTYsInRhcmdldCI6MzQ5NjN9XSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MTA0fV19IGgAAABCSU4AAAAAMwAAAADAiZa92JGWvQAAAACwiZY94JGWPQAAAACwiZY9AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAActNMPwAAAAD1QJyyvZAZP3LTTD8AAIA/AQACAAAAAAA=", import.meta.url).href },
  { id: "fs-shape-shapes_g", label: "shapes_g", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAADgBAAAOAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDU1Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDE2In1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4xMjgiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjQsIm1heCI6WzAuMDQ0MDI3NTY2OTA5NzkwMDQsMCwwLjA0NDAxODI2ODU4NTIwNTA4XSwibWluIjpbLTAuMDQ0MDI3NTY2OTA5NzkwMDQsMCwtMC4wNDQwMTgyNjg1ODUyMDUwOF0sInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoxLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6NCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50Ijo0LCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjYsInR5cGUiOiJTQ0FMQVIifV0sImJ1ZmZlclZpZXdzIjpbeyJidWZmZXIiOjAsImJ5dGVMZW5ndGgiOjQ4LCJieXRlT2Zmc2V0IjowLCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6NDgsImJ5dGVPZmZzZXQiOjQ4LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MzIsImJ5dGVPZmZzZXQiOjk2LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MTIsImJ5dGVPZmZzZXQiOjEyOCwidGFyZ2V0IjozNDk2M31dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxNDB9XX0gICCMAAAAQklOAEBWNL0AAAAAgEw0vUBWNL0AAAAAgEw0PUBWND0AAAAAgEw0vUBWND0AAAAAgEw0PQAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAACjyfz8AAAAAOJccMgAAgDMp8n8///9/P0+0tTMAAIA/AQACAAAAAQADAAIA", import.meta.url).href },
  { id: "fs-shape-stars_e", label: "stars_e", url: new URL("data:model/gltf-binary;base64,Z2xURgIAAAAUIgAATAQAAEpTT057ImFzc2V0Ijp7ImdlbmVyYXRvciI6Iktocm9ub3MgZ2xURiBCbGVuZGVyIEkvTyB2NS4xLjE4IiwidmVyc2lvbiI6IjIuMCJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJuYW1lIjoiU2NlbmUiLCJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJtZXNoIjowLCJuYW1lIjoiQ3VydmUuMDM3Iiwicm90YXRpb24iOlswLjcwNzEwNjgyODY4OTU3NTIsMCwwLDAuNzA3MTA2ODI4Njg5NTc1Ml0sInNjYWxlIjpbNDAwLDQwMCw0MDBdfV0sIm1hdGVyaWFscyI6W3siZG91YmxlU2lkZWQiOnRydWUsIm5hbWUiOiJTVkdNYXQuMDExIn1dLCJtZXNoZXMiOlt7Im5hbWUiOiJDdXJ2ZS4wOTUiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjEsIlRFWENPT1JEXzAiOjJ9LCJpbmRpY2VzIjozLCJtYXRlcmlhbCI6MH1dfV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjIwMSwibWF4IjpbMC4xMDQxMDA4MjM0MDI0MDQ3OSwwLDAuMTAwOTUzNzg3NTY1MjMxMzJdLCJtaW4iOlstMC4xMDQxMDA4ODMwMDcwNDk1NiwwLC0wLjEwMDk1Mzc4MDExNDY1MDczXSwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyMDEsInR5cGUiOiJWRUMzIn0seyJidWZmZXJWaWV3IjoyLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MjAxLCJ0eXBlIjoiVkVDMiJ9LHsiYnVmZmVyVmlldyI6MywiY29tcG9uZW50VHlwZSI6NTEyMywiY291bnQiOjU4MiwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZUxlbmd0aCI6MjQxMiwiYnl0ZU9mZnNldCI6MCwidGFyZ2V0IjozNDk2Mn0seyJidWZm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AAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAA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WQBcAFsAWQBdAFwAWQBeAF0AWQBfAF4AWQBgAF8AWQBhAGAAWQBiAGEAWQBjAGIAWQBkAGMAWQBlAGQAZgBlAFkAZgBnAGUAaABnAGYAaQBnAGgAagBnAGkAawBnAGoAbABnAGsAbQBnAGwAbgBnAG0AbwBnAG4AcABnAG8AcQBnAHAAcgBnAHEAcwBnAHIAcwB0AGcAcwB1AHQAdgB1AHMAdgB3AHUAeAB3AHYAeAB5AHcAegB5AHgAegB7AHkAfAB7AHoAfAB9AHsAfgB9AHwAfgB/AH0AgAB/AH4AgACBAH8AggCBAIAAggCDAIEAhACDAIIAhACFAIMAhgCFAIQAhgCHAIUAiACHAIYAiACJAIcAjACJAIgAkACKAI0AjwCRAI4AjwCSAJEAkwCLAJEAkwCUAIsAlQCUAJMAlgCUAJUAlwCUAJYAlwCYAJQAmQCYAJcAmgCYAJkAmgCbAJgAnACbAJoAnACdAJsAngCdAJwAnwCdAJ4AnwCgAJ0AoQCgAJ8AoQCiAKAAowCiAKEApACiAKMApQCiAKQApQCmAKIApwCmAKUApwCoAKYApwCpAKgAqgCSAI8AqwCSAKoArACSAKsArQCSAKwArgCSAK0ArgCvAJIAsACvAK4AsACxAK8AsgCxALAAswCxALIAAQACALQAAQC0ALUAtQC0ALYAtQC2ALcAtwC2ALgAtwC4ALkAuQC4ALoAuQC6ALsAuwC6ALwAuwC8AL0AvQC8AL4AvQC+AL8AvwC+AMAAvwDAAMEAwQDAAMIAwQDCAMMAwwDCAMQAwwDEAMUAxQDEAMYAxQDGAMcAxwDGAMgA", import.meta.url).href }
], k0 = F0.map((l) => ({
  id: l.id,
  category: "__palette__",
  label: l.label,
  glbPath: l.url,
  defaultZDepth: 62,
  defaultScale: 2.5
})), H0 = new P0();
let m0 = [];
function K0(l) {
  m0 = l;
}
async function jA(l) {
  const A = new D.Group();
  A.name = l.id;
  const i = l.layers.length, s = i > 0 ? l.layers.reduce((I, c) => I + c.position.x, 0) / i : 0, e = i > 0 ? l.layers.reduce((I, c) => I + c.position.y, 0) / i : 0, t = /* @__PURE__ */ new Map();
  let a = 10;
  for (const I of l.layers)
    I.isClipper && t.set(I.instanceId, a++);
  for (const I of l.layers)
    if (I.glbPartId) {
      const c = hA.find((g) => g.id === I.glbPartId) ?? m0.find((g) => g.id === I.glbPartId);
      if (c) {
        let g;
        try {
          g = await H0.loadPart(c);
        } catch {
          continue;
        }
        const o = new D.Box3().setFromObject(g).getSize(new D.Vector3()), n = Math.max(o.x, o.y, 1), m = I.radius * 2 / n, y = I.scaleX ?? 1, M = I.scaleY ?? 1;
        g.scale.set(m * I.scale * y, m * I.scale * M, m * I.scale), g.position.set(I.position.x - s, I.position.y - e, I.zDepth), g.rotation.z = (I.rotation ?? 0) * Math.PI / 180;
        const d = I.opacity ?? 1, z = I.castShadow !== !1, J = I.receiveShadow !== !1;
        g.traverse((p) => {
          if (p instanceof D.Mesh && (p.castShadow = z, p.receiveShadow = J), p instanceof D.Mesh && p.material instanceof D.MeshStandardMaterial) {
            const u = !!I.gradient, T = !!(I.gradient?.startColor && I.gradient?.endColor);
            if (p.material.userData = { ...p.material.userData ?? {}, sourceHasGradient: u, layerOpacity: d }, T) {
              p.material.userData.sourceGradient = I.gradient, d0(p.geometry, I.gradient.projectionAxis ?? "XY");
              const Y = RA(I.gradient);
              Y && (p.material.map = Y, p.material.color.set(16777215), p.material.needsUpdate = !0);
            } else
              p.material.color.set(I.color);
            p.material.transparent = d < 1, p.material.opacity = d, p.material.depthWrite = d >= 1;
            const h = p.material;
            if (I.isClipper) {
              const Y = t.get(I.instanceId) ?? 10;
              p.renderOrder = -1, h.depthWrite = !1, h.stencilWrite = !0, h.stencilRef = Y, h.stencilFunc = D.AlwaysStencilFunc, h.stencilFail = D.KeepStencilOp, h.stencilZFail = D.KeepStencilOp, h.stencilZPass = D.ReplaceStencilOp;
            } else if (I.clipToLayer) {
              const Y = t.get(I.clipToLayer);
              Y !== void 0 && (p.renderOrder = 1, h.depthFunc = D.LessEqualDepth, h.stencilWrite = !0, h.stencilWriteMask = 0, h.stencilRef = Y, h.stencilFunc = D.EqualStencilFunc, h.stencilFail = D.KeepStencilOp, h.stencilZFail = D.KeepStencilOp, h.stencilZPass = D.KeepStencilOp);
            }
            p.material.needsUpdate = !0;
          }
        }), A.add(g);
      }
      continue;
    }
  return A;
}
const y0 = 4, q0 = 0.6, _0 = 0.35;
let OA = 0, vA = 1, j0 = 1;
const cA = /* @__PURE__ */ new Set();
function $0() {
  return vA;
}
function Ae(l) {
  vA = Math.max(0, Math.min(1, l));
  for (const A of [...cA]) {
    if (!A.parent) {
      cA.delete(A);
      continue;
    }
    A.traverse((i) => {
      if (!(i instanceof D.Mesh) || i.userData?.shadowBlurLayer !== 0) return;
      const s = i.userData?.shadowAuthoredOpacity ?? 1, e = (t) => {
        t.opacity = s * vA, t.transparent = t.opacity < 1, t.depthWrite = t.opacity >= 1, t.needsUpdate = !0;
      };
      Array.isArray(i.material) ? i.material.forEach(e) : i.material && e(i.material);
    });
  }
}
function ee(l) {
  j0 = Math.max(0, Math.min(1, l));
  for (const A of [...cA]) {
    if (!A.parent) {
      cA.delete(A);
      continue;
    }
    FA(A, OA);
  }
}
function ie(l) {
  const A = [];
  l.traverse((i) => {
    i instanceof D.Mesh && i.userData?.shadowBlurLayer === void 0 && A.push(i);
  });
  for (const i of A) {
    i.userData = { ...i.userData ?? {}, shadowBlurLayer: 0 };
    for (let s = 1; s <= y0; s++) {
      const e = i.clone();
      e.name = "_shadowBlur", Array.isArray(i.material) ? e.material = i.material.map((a) => a.clone()) : i.material && (e.material = i.material.clone());
      const t = (a) => {
        a.transparent = !0, a.depthWrite = !1, a.opacity = 0;
      };
      Array.isArray(e.material) ? e.material.forEach(t) : e.material && t(e.material), e.userData = {
        ...e.userData ?? {},
        shadowBlurLayer: s,
        // Preserve the original mesh's local scale so updateBlur can
        // multiply it instead of overwriting (some meshes have non-1 local
        // scales applied by buildPartGroup or the source GLB).
        shadowBlurBaseSX: i.scale.x,
        shadowBlurBaseSY: i.scale.y,
        shadowBlurBaseSZ: i.scale.z
      }, i.parent?.add(e);
    }
  }
  cA.add(l), FA(l, OA);
}
function se(l) {
  OA = Math.max(0, Math.min(1, l));
  for (const A of [...cA]) {
    if (!A.parent) {
      cA.delete(A);
      continue;
    }
    FA(A, OA);
  }
}
function FA(l, A) {
  l.traverse((i) => {
    if (!(i instanceof D.Mesh)) return;
    const s = i.userData?.shadowBlurLayer;
    if (s === void 0 || s === 0) return;
    const e = s / y0, t = 1 + q0 * A * e, a = i.userData?.shadowBlurBaseSX ?? 1, I = i.userData?.shadowBlurBaseSY ?? 1, c = i.userData?.shadowBlurBaseSZ ?? 1;
    i.scale.set(a * t, I * t, c);
    const g = A * _0 * (1 - e * 0.6) * j0, r = (o) => {
      o.opacity = g, o.transparent = !0, o.needsUpdate = !0;
    };
    Array.isArray(i.material) ? i.material.forEach(r) : i.material && r(i.material), i.visible = g > 0;
  });
}
function te(l, A) {
  const i = A.gradient?.startColor ?? A.color, s = A.gradient?.endColor ?? A.color;
  !i || !s || l.traverse((e) => {
    if (!(e instanceof D.Mesh) || e.name.startsWith("_") || !(e.material instanceof D.MeshStandardMaterial)) return;
    const t = e.material.userData?.sourceGradient;
    if (!t) return;
    const a = RA({ ...t, startColor: i, endColor: s });
    a && (e.material.map = a, e.material.color.set(16777215), e.material.userData = { ...e.material.userData ?? {}, gradientApplied: !0 }, e.material.needsUpdate = !0);
  });
}
function bA(l, A, i = !1) {
  let s = !1;
  if (!i) {
    const e = /* @__PURE__ */ new Set();
    l.traverse((t) => {
      !(t instanceof D.Mesh) || t.name === "_selectionOutline" || t.name === "_layerOutline" || t.name === "_shadowBlur" || t.material instanceof D.MeshStandardMaterial && e.add(t.material.color.getHex());
    }), e.size > 1 && (s = !0);
  }
  l.traverse((e) => {
    if (!(!(e instanceof D.Mesh) || e.name === "_selectionOutline" || e.name === "_layerOutline" || e.name === "_shadowBlur") && (A.castShadow !== void 0 && (e.castShadow = A.castShadow), A.receiveShadow !== void 0 && (e.receiveShadow = A.receiveShadow), e.material instanceof D.MeshStandardMaterial)) {
      const a = e.material.userData?.sourceHasGradient === !1;
      if (A.gradient?.startColor && A.gradient?.endColor && !a) {
        d0(e.geometry, A.gradient.projectionAxis ?? "XY");
        const n = RA(A.gradient);
        n && (e.material.map = n, e.material.color.set(16777215), e.material.userData = { ...e.material.userData ?? {}, gradientApplied: !0 }, e.material.needsUpdate = !0);
      } else
        !i && e.material.map && e.material.userData?.gradientApplied && (e.material.map = null, e.material.userData.gradientApplied = !1, e.material.needsUpdate = !0), !i && !s && !e.material.map && A.color && e.material.color.set(A.color);
      const I = e.material.userData?.layerOpacity ?? 1, c = A.opacity ?? 1, g = I * c, r = e.userData?.shadowBlurLayer === 0;
      r && (e.userData.shadowAuthoredOpacity = g);
      const o = g * (r ? $0() : 1);
      e.material.transparent = o < 1, e.material.opacity = o, e.material.depthWrite = o >= 1, e.material.needsUpdate = !0;
    }
  });
}
function TA(l, A, i) {
  const s = i.pivotOffsetX ?? 0, e = i.pivotOffsetY ?? 0, t = i.scale * (i.scaleX ?? 1), a = i.scale * (i.scaleY ?? 1);
  l.position.set(i.position.x + s * t, i.position.y + e * a, i.zDepth), l.rotation.z = i.rotation * Math.PI / 180, A && (A.position.set(-s * t, -e * a, 0), A.scale.set(t, a, i.scale));
}
function o0(l) {
  if (l.category === "spec") return !0;
  const A = l.id?.toLowerCase().startsWith("spec-"), i = l.label?.toLowerCase().startsWith("spec-");
  return !!A || !!i;
}
const kA = 1, p0 = 2, w0 = 100, D0 = 200, h0 = 14, YA = 128;
function aA(l, A) {
  const i = l.material;
  Array.isArray(i) ? i.forEach(A) : i && A(i);
}
function Ie(l) {
  const A = [];
  l.traverse((i) => {
    i instanceof D.Mesh && A.push(i);
  });
  for (const i of A) {
    const s = i.clone();
    Array.isArray(i.material) ? s.material = i.material.map((e) => e.clone()) : i.material && (s.material = i.material.clone()), i.parent?.add(s), c0(i, kA, "pupil"), c0(s, p0, "sclera");
  }
  l.renderOrder = 1e3;
}
function c0(l, A, i) {
  l.renderOrder = 1e3, l.castShadow = !1, l.receiveShadow = !1, aA(l, (s) => {
    const e = s;
    e.blending = D.AdditiveBlending, e.transparent = !0, e.depthWrite = !1, e.depthTest = !1, e.stencilWrite = !0, e.stencilRef = A, e.stencilFunc = D.EqualStencilFunc, e.stencilFail = D.KeepStencilOp, e.stencilZFail = D.KeepStencilOp, e.stencilZPass = D.KeepStencilOp, e.userData = { ...e.userData ?? {}, specMask: i }, e.needsUpdate = !0;
  });
}
function ae(l, A, i) {
  l.traverse((s) => {
    s instanceof D.Mesh && aA(s, (e) => {
      const t = e, a = t.userData?.specMask;
      a === "pupil" ? t.opacity = A : a === "sclera" && (t.opacity = i);
    });
  });
}
function g0(l, A = !1) {
  l.renderOrder = D0, l.traverse((i) => {
    i instanceof D.Mesh && (i.renderOrder = D0, aA(i, (s) => {
      const e = s;
      e.stencilWrite = !0, e.depthTest = !1, A ? (e.stencilRef = 0, e.stencilFuncMask = h0, e.stencilFunc = D.NotEqualStencilFunc, e.stencilFail = D.KeepStencilOp, e.stencilZFail = D.KeepStencilOp, e.stencilZPass = D.DecrementStencilOp) : (e.stencilFuncMask = 255, e.stencilRef = kA, e.stencilFunc = D.AlwaysStencilFunc, e.stencilFail = D.KeepStencilOp, e.stencilZFail = D.KeepStencilOp, e.stencilZPass = D.ReplaceStencilOp), e.userData = { ...e.userData ?? {}, pupilStencil: !0 }, e.needsUpdate = !0;
    }));
  });
}
function le(l, A) {
  const i = l.userData?.pairedScleraStencil, s = i ? i - 1 : kA;
  l.traverse((e) => {
    e instanceof D.Mesh && aA(e, (t) => {
      const a = t;
      a.userData?.pupilStencil && (A ? (a.stencilRef = 0, a.stencilFuncMask = h0, a.stencilFunc = D.NotEqualStencilFunc, a.stencilZPass = D.DecrementStencilOp) : (a.stencilFuncMask = 255, a.stencilRef = s, a.stencilFunc = D.AlwaysStencilFunc, a.stencilZPass = D.ReplaceStencilOp), a.needsUpdate = !0);
    });
  });
}
function oe(l, A) {
  const i = A - 1;
  l.traverse((s) => {
    s instanceof D.Mesh && aA(s, (e) => {
      const t = e, a = t.userData?.specMask;
      a === "sclera" ? t.stencilRef = A : a === "pupil" && (t.stencilRef = i), t.needsUpdate = !0;
    });
  });
}
function we(l, A) {
  l.userData = { ...l.userData ?? {}, scleraStencilValue: A }, l.traverse((i) => {
    i instanceof D.Mesh && aA(i, (s) => {
      const e = s;
      e.stencilWrite = !0, e.stencilRef = A, e.stencilFunc = D.AlwaysStencilFunc, e.stencilFail = D.KeepStencilOp, e.stencilZFail = D.KeepStencilOp, e.stencilZPass = D.ReplaceStencilOp, e.needsUpdate = !0;
    });
  });
}
function De(l) {
  l.traverse((A) => {
    A instanceof D.Mesh && aA(A, (i) => {
      const s = i;
      s.stencilWrite = !0, s.stencilWriteMask = YA, s.stencilRef = YA, s.stencilFunc = D.AlwaysStencilFunc, s.stencilFail = D.KeepStencilOp, s.stencilZFail = D.KeepStencilOp, s.stencilZPass = D.ReplaceStencilOp, s.needsUpdate = !0;
    });
  });
}
function ce(l) {
  l.traverse((A) => {
    A instanceof D.Mesh && aA(A, (i) => {
      const s = i;
      s.stencilWrite = !0, s.stencilWriteMask = 0, s.stencilRef = YA, s.stencilFuncMask = YA, s.stencilFunc = D.EqualStencilFunc, s.stencilFail = D.KeepStencilOp, s.stencilZFail = D.KeepStencilOp, s.stencilZPass = D.KeepStencilOp, s.depthFunc = D.LessEqualDepth, s.needsUpdate = !0;
    });
  });
}
function C0(l) {
  l.renderOrder = w0, l.traverse((A) => {
    A instanceof D.Mesh && (A.renderOrder = w0, aA(A, (i) => {
      const s = i;
      s.stencilWrite = !0, s.stencilRef = p0, s.stencilFunc = D.AlwaysStencilFunc, s.stencilFail = D.KeepStencilOp, s.stencilZFail = D.KeepStencilOp, s.stencilZPass = D.ReplaceStencilOp, s.userData = { ...s.userData ?? {}, isSclera: !0 }, s.needsUpdate = !0;
    }));
  });
}
function r0(l) {
  l.traverse((A) => {
    A instanceof D.Mesh && aA(A, (i) => {
      const s = i.color;
      !s || !(s.r > 0.6 && s.g > 0.6 && s.b > 0.6) || (i.userData = { ...i.userData ?? {}, isTeeth: !0 }, i.needsUpdate = !0);
    });
  });
}
function n0(l) {
  l.renderOrder = 500, l.traverse((A) => {
    A instanceof D.Mesh && (A.renderOrder = 500, aA(A, (i) => {
      const s = i;
      s.stencilWrite = !0, s.stencilRef = 0, s.stencilFunc = D.AlwaysStencilFunc, s.stencilFail = D.KeepStencilOp, s.stencilZFail = D.KeepStencilOp, s.stencilZPass = D.ReplaceStencilOp, s.needsUpdate = !0;
    }));
  });
}
const HA = {
  blinkIntervalMin: 2e3,
  blinkIntervalMax: 6e3,
  boredAfter: 27e3,
  sleepyAfter: 8e4,
  sleepAfter: 3e5,
  eyelidForAnim: {
    lookAround: "squint",
    wiggle: "closed",
    headTilt: "squint",
    nod: "squint",
    sleep: "squint",
    wave: "closed",
    earFlap: "squint",
    tailWag: "squint",
    yawn: "closed",
    stretch: "squint",
    shrug: "squint"
  },
  pupilScaleForAnim: {
    surprise: 0.5,
    hop: 0.1,
    celebrate: 0.5,
    tailWag: 1,
    brainless: 0.5,
    puffedUp: 0.5,
    footTap: 1.6,
    stretch: 0.5,
    build: 0.2,
    yawn: 0.05,
    shrug: 0.5,
    explode: 0.5
  },
  animSpeed: {
    hop: 1.5,
    celebrate: 2,
    wave: 2,
    earFlap: 1.2,
    brainless: 1.5,
    yawn: 0.71,
    footTap: 5,
    shrug: 2,
    explode: 1.5,
    build: 2
  },
  pupilClipToSclera: !0,
  mouthForAnim: {
    hop: "mouth-mouth-smirk",
    wiggle: "mouth-mouth-wavy",
    nod: "mouth-mouth-smirk",
    celebrate: "mouth-mouth-happy",
    sleep: "mouth-mouth-smirk",
    wake: "mouth-mouth-smirk",
    earFlap: "mouth-mouth-chomp",
    tailWag: "mouth-mouth-wavy",
    yawn: "mouth-mouth-open",
    brainless: "mouth-mouth-tongueout",
    footTap: "mouth-mouth-smirk",
    bored: "mouth-mouth-smirk",
    build: "mouth-mouth-tongueout",
    stretch: "mouth-mouth-open",
    lookAround: "mouth-mouth-wavy",
    shrug: "mouth-mouth-smirk"
  },
  mouthScaleForAnim: {
    hop: 0.5,
    wiggle: 0.7,
    headTilt: 0.7,
    earFlap: 0.5,
    puffedUp: 0.5,
    stretch: 0.5,
    lookAround: 0.5,
    idle: 0.5,
    build: 0.5,
    surprise: 0.75,
    wake: 0.25
  },
  hopHeight: 304,
  hopCrouch: 120,
  armAngleForAnim: {
    hop: 18,
    nod: -26,
    surprise: 61,
    sleep: 12,
    wake: 46,
    wave: 30,
    earFlap: 38,
    tailWag: 31,
    yawn: 36,
    stretch: 70,
    footTap: -35,
    shrug: 31,
    explode: 58,
    puffedUp: 36,
    idle: -30,
    bored: -23,
    build: 94,
    celebrate: 9
  },
  hopLegSplay: 41,
  pupilForAnim: {
    hop: "pupil-round",
    surprise: "pupil-round",
    wake: "pupil-pac",
    earFlap: "pupil-round",
    tailWag: "pupil-pac",
    yawn: "pupil-round",
    stretch: "pupil-round",
    lookAround: "pupil-round",
    footTap: "pupil-round",
    puffedUp: "pupil-pac",
    brainless: "pupil-pac",
    bored: "pupil-round",
    build: "pupil-pac"
  },
  wiggleAngle: 33,
  wiggleSpeed: 0.8,
  headTiltAngle: 7,
  headTiltBounce: 0.42,
  excludeFromAnim: {
    headTilt: "stem",
    nod: "stem",
    wiggle: "stem",
    lookAround: "stem"
  },
  nodDepth: 33,
  animAmounts: {
    celebrate: 1,
    surprise: 2,
    wave: 3,
    earFlap: 1,
    yawn: 2,
    footTap: 5,
    explode: 2,
    puffedUp: 1,
    idle: 5,
    wiggle: 1,
    stretch: 1,
    hop: 1,
    headTilt: 1,
    nod: 1,
    tailWag: 1,
    lookAround: 0.25,
    shrug: 1,
    build: 1
  },
  surpriseScale: 0.1,
  waveAngle: 19,
  animLength: {
    lookAround: 2,
    footTap: 10,
    tailWag: 2,
    build: 1
  },
  loopPauseForAnim: {
    lookAround: 1e3,
    tailWag: 1500,
    footTap: 2e3,
    explode: 500
  },
  gazePursuitSpeed: 0.5,
  pupilLookDistance: 1,
  specPupilOpacity: 0.9,
  specScleraOpacity: 0.85,
  gazeAutoMinMs: 600,
  gazeHoldMaxMs: 2850,
  gazeMousePauseMaxMs: 1600,
  gazeJitterAmount: 0.08,
  gazeMouseDistractIntervalMaxMs: 25e3,
  explodeGravity: 4e3,
  framePadding: 0,
  explodeFloor: -900,
  tailWagDip: 80,
  tailWagDipHold: 0.9,
  gazeAutoMaxMs: 5300,
  animLabels: {
    tailWag: "poop",
    lookAround: "shifty"
  },
  specPupilOffset: 20,
  shadowScaleFloor: 0,
  shadowYSensitivity: 1e-3,
  shadowBlur: 1,
  pupilLookSmall: 2.9,
  pupilLookLarge: 2.8,
  idleAnimations: [
    "wiggle",
    "hop",
    "wave",
    "earFlap",
    "lookAround",
    "shrug",
    "puffedUp"
  ],
  boredAnimations: [
    "yawn",
    "stretch",
    "sleep",
    "wake",
    "footTap",
    "headTilt"
  ],
  footTapCount: 6,
  footTapArmAngle: 10,
  pupilScleraPadding: -16.5,
  pupilCursorDepth: 300,
  idleBodyBob: 9.9,
  idleSpeed: 2.35,
  idleStepAmount: 15,
  idleSwayAngle: 2.4,
  idleBreathDepth: 2e-3,
  idleStepSpeed: 2.9,
  idleBobSpeed: 1.4,
  idleSwaySpeed: 1.7,
  idleSwayNoise: 0.74,
  idleStepNoise: 0.8,
  headTiltArmDroop: 0.35,
  shadowOpacity: 0,
  shadowBlurOpacity: 0.1,
  explodeVanishSpeed: 15,
  footTapGazeDistance: 3,
  lookAroundDistance: 41,
  animStepFrames: 2,
  pixelate: !1,
  pixelSize: 4,
  cutoutJitterTranslate: 0.5,
  cutoutJitterRotate: 1,
  browRaiseForAnim: {
    wave: 40,
    nod: 12,
    celebrate: 40,
    lookAround: -20,
    footTap: -19,
    shrug: 28,
    puffedUp: 80,
    hop: 40,
    surprise: 40,
    explode: 32,
    wake: 40
  },
  browAngleForAnim: {
    wave: -23,
    headTilt: -8,
    nod: -13,
    celebrate: -32,
    surprise: 22,
    sleep: 23,
    tailWag: -27,
    lookAround: 19,
    footTap: 6,
    shrug: -9,
    puffedUp: -30,
    wiggle: 28,
    explode: 42,
    build: -45,
    wake: 45
  },
  hopHeightVar: 300,
  armAnticipation: 4,
  armOvershoot: 4,
  wiggleCount: 4,
  wiggleCountVar: 5,
  explodeSettle: 500,
  explodeOvershoot: 0.55,
  explodePop: 220,
  explodeStagger: 35,
  explodeStaggerCurve: 1,
  buildOvershoot: 2.8,
  buildPop: 360,
  buildStagger: 70,
  buildStaggerCurve: 1.8,
  celebrateHeight: 61,
  armTransitionMs: 225
};
function ge(l) {
  for (const A of l.children)
    if (A instanceof D.Group && A.name !== "_pivotIndicator") return A;
  return null;
}
const G = Math.PI / 180, Ce = /* @__PURE__ */ new Set(["wave", "footTap", "headTilt", "lookAround"]), gA = {
  hop: "mouth-mouth-happy",
  wiggle: "mouth-mouth-wavy",
  headTilt: "mouth-mouth-smirk",
  nod: "mouth-mouth-flat",
  celebrate: "mouth-mouth-open",
  surprise: "mouth-mouth-help",
  sleep: "mouth-mouth-flat",
  wake: "mouth-mouth-happy",
  wave: "mouth-mouth-happy",
  brainless: "mouth-mouth-tongueout",
  yawn: "mouth-mouth-open",
  stretch: "mouth-mouth-flat",
  lookAround: "mouth-mouth-flat",
  footTap: "mouth-mouth-flat",
  shrug: "mouth-mouth-flat",
  explode: "mouth-mouth-help",
  puffedUp: "mouth-mouth-happy",
  build: "mouth-mouth-happy"
}, re = /* @__PURE__ */ new Set(), GA = {
  surprise: "pupil-pac",
  brainless: "pupil-pac",
  celebrate: "pupil-heart",
  explode: "pupil-pac"
};
function ne(l, A, i, s, e) {
  const a = l.baseX - i >= 0 ? 1 : -1, I = 60 + Math.abs(l.bFloatAmpX * 6), c = a * I, g = 250 + l.bFloatAmpY * 2;
  let r = 1 / 0;
  if (s > 0) {
    const o = 0.5 * s, n = -g, m = e - l.baseY, y = n * n - 4 * o * m;
    if (y >= 0) {
      const M = Math.sqrt(y);
      r = Math.max((-n + M) / (2 * o), (-n - M) / (2 * o)), r < 0 && (r = 1 / 0);
    }
  }
  return A < r ? { dX: c * A, dY: g * A - 0.5 * s * A * A, landed: !1 } : { dX: c * r, dY: e - l.baseY, landed: !0 };
}
function Me(l, A) {
  if (l < 0.35) {
    const e = l / 0.35;
    return 1 + A * (1 - (1 - e) * (1 - e));
  }
  const s = (l - 0.35) / (1 - 0.35);
  return (1 + A) * (1 - s * s);
}
function Pe(l, A, i) {
  if (l <= 0) return 0;
  if (l >= 1) return 1;
  if (l < 0.5) {
    const e = l * 2;
    return e * e * ((A + 1) * e - A) / 2;
  }
  const s = l * 2 - 2;
  return (s * s * ((i + 1) * s + i) + 2) / 2;
}
const rA = {
  hop: 1400,
  wiggle: 600,
  headTilt: 1800,
  nod: 600,
  celebrate: 2e3,
  surprise: 1500,
  sleep: 2e3,
  wake: 1e3,
  wave: 1500,
  blink: 150,
  earFlap: 700,
  tailWag: 800,
  brainless: 200,
  yawn: 2e3,
  stretch: 2e3,
  lookAround: 1800,
  footTap: 800,
  shrug: 1e3,
  sway: 3e3,
  explode: 2400,
  puffedUp: 1500,
  build: 1500
}, de = Object.keys(rA), me = ["yawn", "stretch", "lookAround", "wiggle", "headTilt"], ye = ["footTap", "lookAround", "shrug", "sway"];
function M0(l, A) {
  const { all: i, nonFeet: s, heads: e, arms: t, ears: a, tails: I, waveTarget: c } = l, g = e.length > 0 ? [...e, ...l.eyes, ...l.mouths] : s, r = Math.max(0, A.explodeSettle), o = Math.max(1e-4, r / 1e3), n = A.explodeVanishSpeed > 0, m = Math.max(0, A.explodeOvershoot), y = Math.max(0, A.explodeStagger), M = Math.max(1, A.explodePop), d = Math.max(0.05, A.explodeStaggerCurve), z = i.filter((C) => !C.part.instanceId.startsWith("anim-synth-") && C.category !== "shadow").slice().sort((C, P) => P.baseZ - C.baseZ), J = /* @__PURE__ */ new Map();
  z.forEach((C, P) => J.set(C, P));
  const p = z.length, u = y * Math.max(0, p - 1), T = n ? u + M : 0, h = r + T, Y = Math.max(1, A.buildPop), U = Math.max(0, A.buildStagger), b = Math.max(0.05, A.buildStaggerCurve), O = i.filter((C) => !C.part.instanceId.startsWith("anim-synth-") && C.category !== "shadow"), v = i.filter((C) => C.category === "shadow"), $ = U * Math.max(0, O.length - 1), sA = 0.1, eA = $ + Y, q = Math.max(0.5, A.wiggleCount), tA = Math.max(0.1, A.wiggleSpeed), IA = q * 200 / tA;
  return {
    hop: {
      duration: 1400,
      fn(C) {
        const P = A.animAmounts.hop ?? 1, j = A.hopCrouch, Z = A.hopHeight, B = A.hopLegSplay * (A.hopHeightRatio ?? 1), V = 0.143, Q = 0.214, X = 0.714;
        if (C < V) {
          const L = C / V, E = -Math.sin(L * Math.PI * 0.5) * j * P;
          for (const x of s) x.dY = E;
        } else if (C < Q) {
          const L = -j * P;
          for (const E of s) E.dY = L;
        } else if (C < X) {
          const L = (C - Q) / (X - Q), E = Math.sin(L * Math.PI) * Z * P, x = Math.min(L / 0.15, 1), H = -j * P * (1 - x);
          for (const K of s) K.dY = H + E;
          for (const K of i)
            if (!s.includes(K)) {
              K.dY = E;
              const _ = K.baseX >= 0 ? 1 : -1;
              K.dRotZ = Math.sin(L * Math.PI) * B * G * _ * P;
            }
        } else {
          const L = (C - X) / (1 - X), E = -Math.sin(L * Math.PI * 2.5) * (j * 0.5) * Math.exp(-L * 4) * P;
          for (const x of s) x.dY = E;
          for (const x of i)
            s.includes(x) || (x.dY = 0, x.dRotZ = 0);
        }
        if (t.length > 0) {
          const L = Math.min(C / 0.18, 1), E = C < Q ? -Math.sin(L * Math.PI * 0.5) * 22 * G * P : 0;
          let x = 0;
          if (C >= Q && C < X) {
            const H = (C - Q) / (X - Q);
            x = Math.sin(H * Math.PI) * 38 * G * Math.max(0, 1 - H * 0.5) * P;
          } else if (C >= X) {
            const H = (C - X) / (1 - X);
            x = -Math.sin(H * Math.PI * 2.5) * 28 * G * Math.exp(-H * 4) * P;
          }
          for (const H of t) {
            const K = H.baseX >= 0 ? 1 : -1;
            H.dRotZ = (E + x) * K;
          }
        }
      }
    },
    wiggle: {
      duration: IA,
      fn(C) {
        const P = A.animAmounts.wiggle ?? 1, j = A.wiggleAngle, Z = Math.max(0.5, A.wiggleCount), B = A.wiggleDir, V = Math.PI * 2 * Z, Q = Math.sin(C * V) * j * G * (1 - C) * P * B;
        for (const L of s) L.dRotZ = Q;
        const X = (L, E) => {
          const x = Math.max(0, C - L / Z);
          return Math.sin(x * V) * j * G * E * (1 - x) * P * B;
        };
        for (const L of a) L.dRotZ = X(0.16, 1.25);
        for (const L of I) L.dRotZ = X(0.2, 1.4);
        for (const L of t) L.dRotZ = X(0.22, 1.6);
        l.gazeOverride = { x: 0, y: 0 };
      }
    },
    headTilt: {
      duration: 1800,
      fn(C) {
        const P = A.animAmounts.headTilt ?? 1, j = A.headTiltAngle * (l.mirror ? -1 : 1), Z = A.headTiltArmDroop, B = A.headTiltBounce, V = 0.15, Q = 0.7, X = (C < V ? C / V * j * G : C < Q ? j * G : (1 - C) / (1 - Q) * j * G) * P, L = i.length > 0 ? i.reduce((E, x) => E + x.baseY, 0) / i.length : 0;
        for (const E of g)
          E.category === "legs" || E.category === "foot" || E.category !== "body" && E.baseY < L || (E.dRotZ = X);
        if (t.length > 0) {
          let K;
          if (C < 0.12)
            K = C / 0.12;
          else if (C < 0.45) {
            const _ = (C - 0.12) / 0.33;
            K = 1 + Math.sin(_ * Math.PI * 2) * B * (1 - _);
          } else C < 0.7 ? K = 1 : K = 1 - (C - 0.7) / (1 - 0.7);
          K *= P * Z;
          for (const _ of t) {
            if (Math.sqrt(_.baseMGX * _.baseMGX + _.baseMGY * _.baseMGY) < 2) continue;
            const QA = ((-Math.PI / 2 - Math.atan2(_.baseMGY, _.baseMGX) - _.baseRotZ) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
            _.dRotZ = QA * K;
          }
        }
      }
    },
    nod: {
      duration: 700,
      fn(C) {
        const P = A.animAmounts.nod ?? 1, j = A.nodDepth, Z = Math.sin(C * Math.PI * 4) * j * P * (1 - C * 0.4);
        for (const B of s) B.dY = Z;
      }
    },
    celebrate: {
      duration: 1400,
      fn(C) {
        const P = A.animAmounts.celebrate ?? 1, j = A.celebrateHeight, Z = Math.sin(Math.PI * Math.min(C * 2, 1)) * j * P, B = Math.sin(C * Math.PI * 5) * 15 * G * (1 - C) * P;
        for (const Q of i) Q.dY = Z;
        for (const Q of s) Q.dRotZ = B;
        const V = Math.sin(Math.PI * Math.min(C * 2, 1)) * 40 * G * P;
        for (const Q of t) Q.dRotZ += V;
      }
    },
    surprise: {
      duration: 500,
      fn(C) {
        const P = A.animAmounts.surprise ?? 1, j = A.surpriseScale, Z = (C < 0.3 ? C / 0.3 * j : (1 - C) / 0.7 * j) * P, B = Math.sin(C * Math.PI * 3) * 8 * G * (1 - C) * P;
        for (const V of s)
          V.scaleMult = 1 + Z, V.dRotZ = B;
      }
    },
    earFlap: {
      duration: 900,
      fn(C) {
        if (a.length === 0) return;
        const P = A.animAmounts.earFlap ?? 1, j = Math.sin(C * Math.PI * 6) * 20 * G * (1 - C) * P;
        for (const B of a) B.dRotZ = j;
        const Z = C < 0.15 ? C / 0.15 : C > 0.85 ? (1 - C) / 0.15 : 1;
        l.gazeOverride = { x: 0, y: 8 * P * Z };
      }
    },
    tailWag: {
      duration: 1e3,
      fn(C) {
        const P = A.animAmounts.tailWag ?? 1;
        if (I.length > 0) {
          const Z = Math.sin(C * Math.PI * 7) * 30 * G * (1 - C * 0.5) * P;
          for (const B of I) B.dRotZ = Z;
        }
        const j = A.tailWagDip;
        if (j > 0) {
          const B = (1 - Math.min(0.95, Math.max(0, A.tailWagDipHold))) / 2;
          let V;
          if (C < B && B > 0)
            V = -j * Math.sin(C / B * Math.PI * 0.5);
          else if (C < 1 - B)
            V = -j;
          else if (B > 0) {
            const Q = (C - (1 - B)) / B;
            V = -j * Math.cos(Q * Math.PI * 0.5);
          } else
            V = -j;
          for (const Q of s) Q.dY += V * P;
        }
      }
    },
    wave: {
      duration: 1200,
      fn(C) {
        let P = c;
        if (l.mirror && t.length > 0 && (P = t.reduce((V, Q) => V.baseX < Q.baseX ? V : Q)), !P) return;
        const j = A.animAmounts.wave ?? 1, Z = A.waveAngle;
        P.dRotZ = Math.sin(C * Math.PI * 5) * Z * G * (1 - C * 0.3) * j;
        const B = Math.sin(Math.PI * C) * 12 * G * j * (l.mirror ? -1 : 1);
        for (const V of s)
          V !== P && (V.dRotZ += B);
      }
    },
    blink: {
      duration: 200,
      fn(C) {
      }
    },
    yawn: {
      duration: 1800,
      fn(C) {
        const P = Math.sin(C * Math.PI), j = P * 0.1;
        for (const B of s) B.scaleMult = 1 + j;
        const Z = -P * 8 * G;
        for (const B of g)
          B.category === "legs" || B.category === "foot" || (B.dRotZ = Z);
      }
    },
    stretch: {
      duration: 2e3,
      fn(C) {
        const P = Math.sin(C * Math.PI), j = P * 8;
        for (const Z of s)
          Z.dY = j, Z.scaleMult = 1 + P * 0.06;
        if (t.length > 0)
          for (const Z of t) {
            const B = Z.baseX >= 0 ? 1 : -1;
            Z.dRotZ = -P * 110 * G * B;
          }
      }
    },
    lookAround: {
      duration: 2400,
      fn(C) {
        const P = A.animAmounts.lookAround ?? 1, j = A.lookAroundDistance * P;
        let Z = 0, B = 0;
        if (C < 0.08)
          Z = -j * (C / 0.08), B = 8 * P * (C / 0.08);
        else if (C < 0.3)
          Z = -j, B = 8 * P;
        else if (C < 0.38) {
          const Q = (C - 0.3) / 0.08;
          Z = -j + j * 2 * Q, B = 8 * P - 16 * P * Q;
        } else if (C < 0.6)
          Z = j, B = -8 * P;
        else if (C < 0.68) {
          const Q = (C - 0.6) / 0.08;
          Z = j - j * 1.5 * Q, B = -8 * P + 12 * P * Q;
        } else if (C < 0.85)
          Z = -j * 0.5, B = 4 * P;
        else {
          const Q = (C - 0.85) / 0.15;
          Z = -j * 0.5 * (1 - Q), B = 4 * P * (1 - Q);
        }
        l.mirror && (Z = -Z), l.gazeOverride = { x: Z, y: B };
        const V = Z / j * 6 * G * P;
        for (const Q of g)
          Q.category === "legs" || Q.category === "foot" || (Q.dRotZ = V);
      }
    },
    footTap: {
      duration: 800,
      fn(C) {
        const P = A.animAmounts.footTap ?? 1, j = l.mirror, Z = i.filter((Q) => Q.category === "legs");
        if (Z.length > 0) {
          const Q = Z.reduce(
            (E, x) => j ? E.baseX < x.baseX ? E : x : E.baseX > x.baseX ? E : x
          ), X = Math.max(1, A.footTapCount) * 2, L = Math.max(0, Math.sin(C * Math.PI * X)) * A.footTapHeight * P;
          Q.dY = L;
        }
        const B = C < 0.2 ? C / 0.2 : 1;
        if (t.length > 0) {
          const Q = A.footTapArmAngle * G * B * P;
          for (const X of t) {
            const L = X.baseX >= 0, E = j ? !L : L;
            X.dRotZ = E ? L ? Q : -Q : 0;
          }
        }
        const V = A.footTapGazeDistance;
        l.gazeOverride = { x: (j ? -V : V) * P, y: V * (-3 / 9) * P };
      }
    },
    shrug: {
      duration: 1e3,
      fn(C) {
        const P = Math.sin(C * Math.PI);
        if (t.length > 0)
          for (const j of t) {
            const Z = j.baseX >= 0 ? 1 : -1;
            j.dRotZ = -P * 25 * G * Z, j.dY = P * 4;
          }
        for (const j of s)
          t.includes(j) || (j.dY = P * 2);
      }
    },
    sway: {
      duration: 3e3,
      fn(C) {
        const j = 6 * (A.animAmounts.sway ?? 1);
        let Z = 0;
        if (C < 0.15)
          Z = -j * (C / 0.15);
        else if (C < 0.4)
          Z = -j;
        else if (C < 0.55) {
          const B = (C - 0.4) / 0.15;
          Z = -j + j * 2 * B;
        } else C < 0.85 ? Z = j : Z = j * (1 - (C - 0.85) / 0.15);
        for (const B of s) B.dX = Z;
      }
    },
    puffedUp: {
      duration: 1400,
      fn(C) {
        const P = A.animAmounts.puffedUp ?? 1, Z = 1 + (C < 0.25 ? C / 0.25 : C < 0.75 ? 1 : 1 - (C - 0.75) / 0.25) * 0.18 * P;
        for (const B of s)
          B.scaleMult = Z;
        if (C >= 0.3 && C < 0.65) {
          const B = (C - 0.3) / 0.35, V = Math.sin(B * Math.PI * 5) * 4 * G * (1 - B) * P;
          for (const Q of s) Q.dRotZ = V;
        }
      }
    },
    explode: {
      duration: h,
      fn(C) {
        const P = A.explodeGravity, j = A.explodeFloor, Z = C * h, B = Math.min(Z / 1e3, o), V = i.length > 0 ? i.reduce((Q, X) => Q + X.baseX, 0) / i.length : 0;
        for (const Q of i) {
          if (Q.category === "shadow") {
            Q.dX = 0, Q.dY = 0, Q.dModelRotZ = 0, Q.dRotZ = 0, Q.scaleMult = 1, Q.vanish = n && T > 0 ? Math.max(0, Math.min(1, (Z - r) / T)) : 0;
            continue;
          }
          const { dX: X, dY: L, landed: E } = ne(Q, B, V, P, j);
          if (Q.dX = X, Q.dY = L, Q.dModelRotZ = E ? 0 : B / o * Q.bSpinSpeed * Math.PI * 6, Q.dRotZ = 0, Q.scaleMult = 1, !n || T <= 0) continue;
          const x = J.get(Q);
          if (x === void 0) continue;
          const K = (p > 1 ? Math.pow(x / (p - 1), d) : 0) * u, _ = Math.max(0, Math.min(1, (Z - r - K) / M));
          Q.vanish = 1 - Me(_, m);
        }
      }
    },
    build: {
      // Each part scales up from nothing with an overshoot pop, one at a time
      // in rapid succession, starting with the part closest to the camera
      // (highest z) and working back. A "materialize" intro played when a new
      // mascot is generated. Total length grows with the part count so the
      // stagger stays the same per part regardless of how many parts there are.
      duration: eA,
      fn(C) {
        const P = C * eA, j = A.buildOvershoot, Z = j + 1, B = O.slice().sort((Q, X) => {
          const L = Q.category === "body" ? 1 : 0, E = X.category === "body" ? 1 : 0;
          return L !== E ? E - L : X.baseZ - Q.baseZ;
        }), V = B.length;
        for (let Q = 0; Q < V; Q++) {
          const X = B[Q], E = (V > 1 ? Math.pow(Q / (V - 1), b) : 0) * $, H = Math.max(0, Math.min(1, (P - E) / Y)) - 1, K = 1 + Z * H * H * H + j * H * H;
          X.vanish = 1 - K, X.dX = 0, X.dY = 0, X.dModelRotZ = 0, X.dRotZ = 0;
        }
        if (v.length > 0) {
          const Q = 1 - (1 - C) * (1 - C), X = sA + (1 - sA) * Q;
          for (const L of v)
            L.vanish = 1 - X, L.dX = 0, L.dY = 0, L.dModelRotZ = 0, L.dRotZ = 0;
        }
      }
    }
  };
}
class je {
  states = [];
  eyes = [];
  pupils = [];
  nonFeet = [];
  heads = [];
  arms = [];
  ears = [];
  tails = [];
  mouths = [];
  brows = [];
  allPupilParts = [];
  _pupilSet = /* @__PURE__ */ new Set();
  _pupilScaleTarget = 1;
  _pupilScaleMult = 1;
  _pupilLookSmall = 1.5;
  _pupilLookLarge = 0.5;
  _pupilCursorDepth = 30;
  _pupilScleraPadding = 0;
  _pupilScleraClamp = !0;
  _mouseWorldCurrentX = 0;
  _mouseWorldCurrentY = 0;
  _breathPhase = 0;
  // seconds since engine start, drives idle breathing
  _mouthScaleTarget = 1;
  _mouthScaleMult = 1;
  bodyState = null;
  paintParts = [];
  shadowParts = [];
  _shadowYSensitivity = 5e-3;
  _shadowScaleFloor = 0.4;
  _excludeFromAnim = {};
  _currentAnimName = null;
  _defaultMouth = null;
  _lastBuildMouth = null;
  // last mouth picked for a build, to avoid repeats
  _defaultPupilKeyword = null;
  waveTarget = null;
  ctx;
  _bodyTilt = 0;
  // degrees
  _armTilt = 0;
  // degrees, mirrored per side
  _animParams = {
    animAmounts: {},
    hopCrouch: 18,
    hopHeight: 55,
    hopLegSplay: 20,
    hopHeightRatio: 1,
    headTiltAngle: 18,
    headTiltArmDroop: 1,
    headTiltBounce: 0.08,
    wiggleSpeed: 1,
    wiggleAngle: 15,
    wiggleCount: 4,
    wiggleDir: 1,
    nodDepth: 14,
    celebrateHeight: 50,
    surpriseScale: 0.25,
    waveAngle: 30,
    explodeGravity: 600,
    explodeFloor: -460,
    explodeVanishSpeed: 0,
    explodeSettle: 2200,
    explodeOvershoot: 0.3,
    explodePop: 380,
    explodeStagger: 70,
    explodeStaggerCurve: 1,
    tailWagDip: 0,
    tailWagDipHold: 0.5,
    footTapHeight: 8,
    footTapCount: 2,
    footTapArmAngle: 90,
    footTapGazeDistance: 9,
    lookAroundDistance: 45,
    buildOvershoot: 1.7,
    buildPop: 380,
    buildStagger: 70,
    buildStaggerCurve: 1
  };
  animDefs;
  anim = null;
  cooldowns = /* @__PURE__ */ new Map();
  // Eye close state: 0 = open, 1 = fully closed
  _eyeClose = 0;
  // current value (for sleep/wake transitions)
  // Blink
  _blinkCountdown;
  _blinkT = 0;
  // 0→1 = blink closing/opening cycle
  _blinking = !1;
  // Sleep blink sequence (slowing blinks → final close)
  _sleepBlinking = !1;
  _sleepBlinkStep = 0;
  _sleepBlinkTimer = 0;
  _sleepBlinkSpeed = 180;
  // ms per cycle for current sleep blink
  // Arm droop (driven separately from _eyeClose)
  _armDroopT = 0;
  _armDroopActive = !1;
  // Animation-driven eye close (e.g. wiggle keeps eyes shut)
  _animEyeClose = 0;
  // Idle lifecycle
  _idleMs = 0;
  // Stop-motion stepping: when > 0, the whole rig only updates every _stepMs
  // (e.g. animating "on 2s/3s"). 0 = smooth (update every frame). _stepAccum
  // banks skipped frame time so a step fires once the interval is reached.
  _stepMs = 0;
  _stepAccum = 0;
  _steppedOnce = !1;
  // first update always applies (so a primed intro frame paints under stop-motion)
  // Paper-cutout jitter amounts (world units / degrees) + a re-roll timer.
  _jitterTrans = 0;
  _jitterRot = 0;
  _jitterAccum = 0;
  _idleState = "active";
  _sleeping = !1;
  // true when in a sustained sleep state
  // Sway (during sleep)
  _swayPhase = 0;
  // Brainless float
  _brainlessActive = !1;
  _brainlessMs = 0;
  _brainlessAmplitude = 0;
  // 0→1 fade-in, 1→0 fade-out envelope
  // Swap-blink parts (label-based)
  scleraParts = [];
  eyelidClosedParts = [];
  eyelidSquintParts = [];
  _scleraSet = /* @__PURE__ */ new Set();
  _eyelidClosedSet = /* @__PURE__ */ new Set();
  _useSwapBlink = !1;
  _swapBlinkClosed = !1;
  _currentPupilTarget = null;
  specParts = [];
  _specSet = /* @__PURE__ */ new Set();
  _specParallax = 0.5;
  _specPupilOpacity = 1;
  _specScleraOpacity = 1;
  // Gaze system — smooth pursuit, autonomous look-around, micro-saccades
  _gazeTargetX = 0;
  // where the pupil WANTS to be (in eye offset units)
  _gazeTargetY = 0;
  _gazeCurrentX = 0;
  // where the pupil IS (smoothed)
  _gazeCurrentY = 0;
  _gazeMouseX = 0;
  // latest mouse-derived target
  _gazeMouseY = 0;
  _mouseWorldX = 0;
  // raw mouse world X (for cross-eye proximity check)
  _mouseWorldY = 0;
  _gazeHasMouseTarget = !1;
  // true when mouse is actively providing a target
  _gazeMouseStaleTimer = 0;
  // ms since last mouse move; auto-clears after timeout
  _gazeHoldTimer = 0;
  // ms remaining to hold at current target before moving
  _gazeAutoTimer = 0;
  // ms until next autonomous glance
  _gazeJitterX = 0;
  // current micro-saccade offset
  _gazeJitterY = 0;
  _gazeJitterTimer = 0;
  // ms until next jitter update
  _gazeOverrideWasActive = !1;
  // tracks transitions for snap-on-start
  _gazeDistractIntervalTimer = 0;
  // ms until next distraction (counts down only while following the mouse)
  _gazeDistractActive = !1;
  // true when currently looking away from the mouse
  _gazeDistractRemaining = 0;
  // ms remaining for the current distraction
  // Keyboard-driven "eye focus" mode (studio). When active the eyes lock onto
  // an invisible point placed `_gazeFocusDir` away from the eye-pair center and
  // smoothly pursue it, with mouse tracking and random glance-aways suppressed.
  _gazeFocusActive = !1;
  _gazeFocusDirX = 0;
  _gazeFocusDirY = 0;
  // Auto-trigger timers
  _boredCountdown = 0;
  // ms until next bored auto-anim
  // ms until next idle fidget. Seeded with a full interval so a freshly built or
  // randomized mascot settles after its intro instead of immediately firing a
  // random fidget (the "extra expression" right after the generate-intro).
  _fidgetCountdown = 5e3 + Math.random() * 8e3;
  // Per-param phase accumulators for the active-idle "living hold". Each
  // ticks at its own speed so sliders for sway/bob/breath/step are independent.
  // (_swayPhase already exists for the separate sleeping-sway motion.)
  _idleSwayPhase = 0;
  _idleBobPhase = 0;
  _idleBreathPhase = 0;
  _stepPhase = 0;
  // When true, the engine stays in 'active' idle: no random fidgets, no
  // bored/sleepy/asleep cascade. Set by play('idle'); cleared by any other
  // user-driven play() call.
  _idleLocked = !1;
  _queuedAfterWake = null;
  // anim to play once wake's eye-open finishes
  _armAngleSmoothed = 0;
  // current per-side arm offset (degrees), tweened toward _armAngleTarget
  _armAngleTarget = 0;
  // target per-side arm offset (degrees), set when an anim starts
  _armAngleFrom = 0;
  // arm offset at the start of the current tween
  _armAngleTweenMs = 0;
  // elapsed ms into the current arm tween
  _armAnglePrevTarget = 0;
  // last target seen, to detect when a new tween should start
  // Per-animation eyebrow keyframe: raise (world units, +up) and per-side
  // angle (degrees, mirrored — inward/outward). Eased like the arm angle.
  _browRaiseSmoothed = 0;
  _browRaiseTarget = 0;
  _browAngleSmoothed = 0;
  _browAngleTarget = 0;
  _frameHalfWidth = 0;
  // world-space half-width of the visible frame (0 disables clamping)
  _frameHalfHeight = 0;
  // world-space half-height of the visible frame
  _config;
  constructor(A, i, s, e = HA) {
    this._config = e, this._blinkCountdown = this._randBlink();
    for (const o of i) {
      const n = A.get(o.instanceId);
      if (!n) continue;
      const m = ge(n), y = s.find((eA) => eA.id === o.partId)?.category ?? "body", M = o.pivotOffsetX ?? 0, d = o.pivotOffsetY ?? 0, z = o.scale * (o.scaleX ?? 1), J = o.scale * (o.scaleY ?? 1), p = o.position.x + M * z, u = o.position.y + d * J;
      let T = 0, h = 0, Y = 0, U = 0, b = 0;
      try {
        n.updateMatrixWorld(!0);
        const eA = new D.Vector3();
        n.traverse((q) => {
          if (!(q instanceof D.Mesh) || !q.visible || q.name === "_selectionOutline" || q.name === "_layerOutline") return;
          const tA = Array.isArray(q.material) ? q.material : [q.material];
          let IA = !1;
          for (const P of tA) {
            const j = P;
            if (j && (j.opacity == null || j.opacity > 0.01) && j.visible !== !1) {
              IA = !0;
              break;
            }
          }
          if (!IA) return;
          const C = q.geometry?.getAttribute?.("position");
          if (C)
            for (let P = 0; P < C.count; P++) {
              eA.set(C.getX(P), C.getY(P), C.getZ(P)), eA.applyMatrix4(q.matrixWorld);
              const j = eA.x - p, Z = eA.y - u;
              j < 0 && -j > T && (T = -j), j > 0 && j > h && (h = j), Z > 0 && Z > Y && (Y = Z), Z < 0 && -Z > U && (U = -Z);
              const B = j * j + Z * Z;
              B > b && (b = B);
            }
        });
      } catch {
      }
      const O = Math.max(T, h), v = Math.max(Y, U), $ = Math.sqrt(O * O + v * v), sA = Math.sqrt(b);
      this.states.push({
        wrapper: n,
        modelGroup: m,
        part: o,
        category: y,
        baseX: p,
        baseY: u,
        baseZ: o.zDepth,
        baseRotZ: o.rotation * G,
        baseSX: z,
        baseSY: J,
        baseSZ: o.scale,
        baseMGX: -M * z,
        baseMGY: -d * J,
        dX: 0,
        dY: 0,
        dRotZ: 0,
        dModelRotZ: 0,
        scaleMult: 1,
        vanish: 0,
        jX: 0,
        jY: 0,
        jRotZ: 0,
        eyeOffsetX: 0,
        eyeOffsetY: 0,
        bFloatPhaseX: Math.random() * Math.PI * 2,
        bFloatPhaseY: Math.random() * Math.PI * 2,
        bSpinSpeed: (Math.random() * 0.4 + 0.2) * (Math.random() < 0.5 ? 1 : -1),
        bFloatSpeedX: Math.random() * 0.15 + 0.1,
        bFloatSpeedY: Math.random() * 0.2 + 0.15,
        bFloatAmpX: Math.random() * 10 + 8,
        bFloatAmpY: Math.random() * 16 + 14,
        extLeft: T,
        extRight: h,
        extUp: Y,
        extDown: U,
        extRadius: $,
        extBoundingRadius: sA
      });
    }
    this.eyes = this.states.filter((o) => o.category === "eye" || o.category === "sclera");
    const t = this.states.filter((o) => o.category === "pupil");
    this.pupils = t.length > 0 ? t : this.eyes;
    const a = (o) => o.category === "foot" || o.category === "legs";
    if (this.nonFeet = this.states.filter((o) => !a(o)), this.heads = this.states.filter((o) => o.category === "head"), this.arms = this.states.filter((o) => o.category === "arms"), this.ears = this.states.filter((o) => o.category === "ear"), this.tails = this.states.filter((o) => o.category === "tail"), this.brows = this.states.filter((o) => o.category === "brows"), this.bodyState = this.states.find((o) => o.category === "body") ?? null, this.paintParts = this.states.filter((o) => o.category === "paint"), this.shadowParts = this.states.filter((o) => o.category === "shadow"), this.mouths = this.states.filter((o) => o.category === "mouth"), this.mouths.length > 0) {
      const o = this.mouths.filter((M) => !M.part.instanceId.startsWith("anim-synth-")), n = o.length > 0 ? o : this.mouths, m = new Set(Object.values(gA).filter(
        (M) => ["brainless"].some((d) => gA[d] === M)
      )), y = n.filter((M) => !m.has(M.part.partId));
      this._defaultMouth = y[0] ?? n[0] ?? null, this._setMouth(null);
    }
    const I = this.states.filter((o) => o.category === "pupil");
    if (this.allPupilParts = I, this._pupilSet = new Set(I), I.length > 1) {
      const o = I.filter((y) => !y.part.instanceId.startsWith("anim-synth-")), n = o.length > 0 ? o : I, m = n.find((y) => this._pupilKeyword(y) === "default") ?? n.find((y) => {
        const M = this._pupilKeyword(y);
        return !M.includes("dilated") && !M.includes("pinhole") && !M.includes("heart");
      }) ?? n[0];
      this._defaultPupilKeyword = this._pupilKeyword(m);
      for (const y of this.allPupilParts)
        y.wrapper.visible = this._pupilKeyword(y) === this._defaultPupilKeyword;
    }
    this.scleraParts = this.states.filter((o) => o.category === "sclera");
    const c = this.states.filter((o) => o.category === "eyelid");
    this.eyelidSquintParts = c.filter((o) => /squint/i.test(o.part.partId) || /squint/i.test(o.part.label ?? "")), this.eyelidClosedParts = c.filter((o) => !this.eyelidSquintParts.includes(o));
    for (const o of this.eyelidSquintParts) o.wrapper.visible = !1;
    this._scleraSet = new Set(this.scleraParts), this._eyelidClosedSet = new Set(this.eyelidClosedParts), this._useSwapBlink = this.scleraParts.length > 0 || this.eyelidClosedParts.length > 0 || this.allPupilParts.length > 0;
    for (const o of this.eyelidClosedParts) o.wrapper.visible = !1;
    if (this.allPupilParts.length > 0 && this.scleraParts.length > 0) {
      const o = Math.max(...this.scleraParts.map((n) => n.baseZ));
      for (const n of this.allPupilParts)
        n.baseZ = o + 2, n.wrapper.position.z = n.baseZ;
    }
    for (const o of c) {
      const n = this._nearestPupil(o);
      n && (o.baseZ = n.baseZ + 1, o.wrapper.position.z = o.baseZ);
    }
    if (this.specParts = this.states.filter(
      (o) => o.category === "spec" || o.part.partId.toLowerCase().startsWith("spec-") || (o.part.label ?? "").toLowerCase().startsWith("spec-")
    ), this._specSet = new Set(this.specParts), this.specParts.length > 0 && this.allPupilParts.length > 0)
      for (const o of this.specParts) {
        let n = null, m = 1 / 0;
        for (const d of this.allPupilParts) {
          const z = d.baseX - o.baseX, J = d.baseY - o.baseY, p = z * z + J * J;
          p < m && (m = p, n = d);
        }
        if (!n) continue;
        const y = (n.extLeft + n.extRight) / 2;
        if (!(y > 0)) continue;
        const M = y / 2;
        o.baseX = n.baseX - M, o.baseY = n.baseY + M, o.baseZ = n.baseZ + 1, o.wrapper.position.set(o.baseX, o.baseY, o.baseZ);
      }
    const g = this.states.filter((o) => o.category !== "body"), r = this.arms.length > 0 ? this.arms : g.length > 0 ? g : this.states;
    this.waveTarget = r.length > 0 ? r.reduce((o, n) => o.baseX > n.baseX ? o : n) : null, this.ctx = { all: this.states, nonFeet: this.nonFeet, heads: this.heads, arms: this.arms, ears: this.ears, tails: this.tails, eyes: this.eyes, mouths: this.mouths, pupils: this.pupils, brows: this.brows, waveTarget: this.waveTarget, gazeOverride: null, mirror: !1 }, this.animDefs = M0(this.ctx, this._animParams), this._pairPupilsToScleras(), this._applyFaceStacking(), this.configure(e);
  }
  // Per-pupil reference to its associated sclera, used at apply-time to
  // clamp the pupil's pivot inside the sclera's bounding circle.
  _pupilSclera = /* @__PURE__ */ new Map();
  // Each eyelid paired to its nearest sclera so cutout jitter moves them together.
  _eyelidSclera = /* @__PURE__ */ new Map();
  // Run AFTER every other dX/dY/eyeOffset mutation. Hard-clamp each pupil's
  // final pivot to its paired sclera's inscribed circle. The pivot can hit
  // the rim but not pass it. pupilScleraPadding shrinks (positive) or grows
  // (negative) the allowed radius. Adjusts eyeOffsetX/Y so the apply step
  // (baseX + dX + eyeOffsetX) lands inside the constraint.
  _clampPupilsInSclera() {
    if (this._pupilScleraClamp)
      for (const A of this.pupils) {
        const i = this._pupilSclera.get(A);
        if (!i) continue;
        const s = A.baseX + A.dX + A.eyeOffsetX - (i.baseX + i.dX), e = A.baseY + A.dY + A.eyeOffsetY - (i.baseY + i.dY), t = Math.sqrt(s * s + e * e);
        if (t === 0) continue;
        const a = Math.min(i.extLeft, i.extRight, i.extUp, i.extDown);
        if (a <= 0) continue;
        const I = Math.max(0, a - this._pupilScleraPadding);
        if (t <= I) continue;
        const c = I / t;
        A.eyeOffsetX -= s * (1 - c), A.eyeOffsetY -= e * (1 - c);
      }
  }
  // Give each sclera its own stencil value (2, 4, 6...) and pair each pupil
  // with its nearest sclera so per-eye clip-to-sclera doesn't leak across.
  // Using even spacing keeps one value free per pair for the pupil mask
  // (pupil decrements sclera_value → sclera_value - 1).
  // Static face-stacking using actual geometry extents: keep the nose's center
  // no higher than the average sclera center, and the mouth's top edge no
  // higher than the lowest nose/sclera bottom edge. Adjusts rest positions
  // (baseY) once, so studio + runtime match the editor's geometry-aware pass.
  // baseY is the pivot world Y and extents are measured from it.
  _applyFaceStacking() {
    const A = this.scleraParts, i = this.states.filter((e) => e.category === "nose"), s = this.mouths;
    if (A.length > 0 && i.length > 0) {
      const e = A.reduce((t, a) => t + a.baseY, 0) / A.length;
      for (const t of i)
        t.baseY > e && (t.baseY = e);
    }
    if (s.length > 0 && (A.length > 0 || i.length > 0)) {
      let e = 1 / 0;
      for (const t of i) e = Math.min(e, t.baseY - t.extDown);
      for (const t of A) e = Math.min(e, t.baseY - t.extDown);
      if (Number.isFinite(e))
        for (const t of s) {
          const a = t.baseY + t.extUp;
          a > e && (t.baseY -= a - e);
        }
    }
  }
  _pairPupilsToScleras() {
    this._pupilSclera.clear();
    const A = this.states.filter((e) => e.category === "sclera");
    if (A.length === 0) return;
    A.sort((e, t) => e.baseX - t.baseX);
    const i = /* @__PURE__ */ new Map();
    A.forEach((e, t) => {
      const a = 2 + t * 2;
      i.set(e, a), we(e.wrapper, a);
    });
    const s = (e, t) => {
      let a = null, I = 1 / 0;
      for (const c of A) {
        const g = e - c.baseX, r = t - c.baseY, o = g * g + r * r;
        o < I && (I = o, a = c);
      }
      return a;
    };
    for (const e of this.allPupilParts) {
      const t = s(e.baseX, e.baseY);
      if (t) {
        this._pupilSclera.set(e, t);
        const a = i.get(t);
        a !== void 0 && (e.wrapper.userData = { ...e.wrapper.userData ?? {}, pairedScleraStencil: a });
      }
    }
    for (const e of this.specParts) {
      const t = s(e.baseX, e.baseY), a = t ? i.get(t) : void 0;
      a !== void 0 && (e.wrapper.userData = { ...e.wrapper.userData ?? {}, pairedScleraStencil: a }, oe(e.wrapper, a));
    }
    this._eyelidSclera.clear();
    for (const e of this.states) {
      if (e.category !== "eyelid") continue;
      const t = s(e.baseX, e.baseY);
      t && this._eyelidSclera.set(e, t);
    }
  }
  get animations() {
    return ["hop", "wiggle", "headTilt", "nod", "celebrate", "surprise", "sleep", "wake", "wave", "earFlap", "tailWag", "brainless", "yawn", "stretch", "lookAround", "footTap", "shrug", "sway", "explode", "build", "puffedUp", "idle", "bored"];
  }
  get idleState() {
    return this._idleState;
  }
  configure(A) {
    this._config = A, this._animParams.animAmounts = A.animAmounts ?? {}, this._bodyTilt = A.bodyTilt ?? 0, this._armTilt = A.armTilt ?? 0, this._pupilLookSmall = A.pupilLookSmall ?? A.pupilLookDistance ?? 1.5, this._pupilLookLarge = A.pupilLookLarge ?? A.pupilLookDistance ?? 0.5, this._pupilCursorDepth = A.pupilCursorDepth ?? 30, this._pupilScleraPadding = A.pupilScleraPadding ?? 0, this._pupilScleraClamp = A.pupilScleraClamp ?? !0, this._specParallax = A.specParallax ?? 0.5, this._specPupilOpacity = A.specPupilOpacity ?? 1, this._specScleraOpacity = A.specScleraOpacity ?? 1;
    for (const e of this.specParts)
      ae(e.wrapper, this._specPupilOpacity, this._specScleraOpacity);
    const i = this.scleraParts.length > 0 && (A.pupilClipToSclera ?? !1);
    for (const e of this.allPupilParts)
      le(e.wrapper, i);
    this._animParams.hopCrouch = A.hopCrouch ?? 18, this._animParams.hopHeight = A.hopHeight ?? 55, this._animParams.hopLegSplay = A.hopLegSplay ?? 20, this._animParams.headTiltAngle = A.headTiltAngle ?? 18, this._animParams.headTiltArmDroop = A.headTiltArmDroop ?? 1, this._animParams.headTiltBounce = A.headTiltBounce ?? 0.08, this._animParams.wiggleSpeed = A.wiggleSpeed ?? 1, this._animParams.wiggleAngle = A.wiggleAngle ?? 15, this._animParams.wiggleCount = A.wiggleCount ?? 4, this._animParams.nodDepth = A.nodDepth ?? 14, this._animParams.celebrateHeight = A.celebrateHeight ?? 50, this._animParams.surpriseScale = A.surpriseScale ?? 0.25, this._animParams.waveAngle = A.waveAngle ?? 30, this._animParams.explodeGravity = A.explodeGravity ?? 600, this._animParams.explodeVanishSpeed = A.explodeVanishSpeed ?? 0, this._animParams.explodeSettle = A.explodeSettle ?? 2200, this._animParams.explodeOvershoot = A.explodeOvershoot ?? 0.3, this._animParams.explodePop = A.explodePop ?? 380, this._animParams.explodeStagger = A.explodeStagger ?? 70, this._animParams.explodeStaggerCurve = A.explodeStaggerCurve ?? 1, this._animParams.explodeFloor = A.explodeFloor ?? -460, this._animParams.tailWagDip = A.tailWagDip ?? 0, this._shadowYSensitivity = A.shadowYSensitivity ?? 5e-3, this._shadowScaleFloor = A.shadowScaleFloor ?? 0.4, this._animParams.tailWagDipHold = A.tailWagDipHold ?? 0.5, this._animParams.footTapHeight = A.footTapHeight ?? 8, this._animParams.footTapCount = A.footTapCount ?? 2, this._animParams.footTapArmAngle = A.footTapArmAngle ?? 90, this._animParams.footTapGazeDistance = A.footTapGazeDistance ?? 9, this._animParams.lookAroundDistance = A.lookAroundDistance ?? 45, this._animParams.buildOvershoot = A.buildOvershoot ?? 1.7, this._animParams.buildPop = A.buildPop ?? 380, this._animParams.buildStagger = A.buildStagger ?? 70, this._animParams.buildStaggerCurve = A.buildStaggerCurve ?? 1;
    const s = A.animStepFrames ?? 0;
    if (this._stepMs = s > 0 ? s / 24 * 1e3 : 0, this._jitterTrans = A.cutoutJitterTranslate ?? 0, this._jitterRot = A.cutoutJitterRotate ?? 0, this._jitterTrans === 0 && this._jitterRot === 0)
      for (const e of this.states)
        e.jX = 0, e.jY = 0, e.jRotZ = 0;
    this._excludeFromAnim = A.excludeFromAnim ?? {}, this._blinkCountdown = Math.min(this._blinkCountdown, this._randBlink()), this.animDefs = M0(this.ctx, this._animParams);
  }
  setMouseWorld(A, i) {
    if (this.states.length === 0) return;
    const s = this.states.reduce((r, o) => r + o.part.position.x, 0) / this.states.length, e = this.states.reduce((r, o) => r + o.part.position.y, 0) / this.states.length, t = A - s, a = i - e, I = Math.sqrt(t * t + a * a) || 1, c = 10, g = Math.min(I / 120, 1);
    if (this._gazeMouseX = t / I * g * c, this._gazeMouseY = a / I * g * c, this._mouseWorldX = A, this._mouseWorldY = i, this._gazeMouseStaleTimer = 0, !this._gazeHasMouseTarget) {
      const r = this._config.gazeMousePauseMinMs ?? 200, o = this._config.gazeMousePauseMaxMs ?? 800;
      this._gazeHoldTimer = r + Math.random() * (o - r), this._gazeHasMouseTarget = !0;
      const n = this._config.gazeMouseDistractIntervalMinMs ?? 5e3, m = this._config.gazeMouseDistractIntervalMaxMs ?? 12e3;
      this._gazeDistractIntervalTimer = n + Math.random() * Math.max(0, m - n), this._gazeDistractActive = !1;
    }
    this.wake();
  }
  clearMouseTarget() {
    this._gazeHasMouseTarget = !1, this._gazeDistractActive = !1, this._gazeAutoTimer = 500 + Math.random() * 1e3;
  }
  /**
   * Keyboard "eye focus" mode. The eyes track an invisible point in the given
   * direction (relative to the eye-pair center); a zero vector looks straight
   * ahead. The vector is normalized, so only direction matters. Suppresses
   * mouse tracking and the random glance-aways until cleared. Idempotent —
   * call again with a new direction to move the focus point.
   */
  setGazeFocus(A, i) {
    const s = Math.sqrt(A * A + i * i);
    s > 0 ? (this._gazeFocusDirX = A / s, this._gazeFocusDirY = i / s) : (this._gazeFocusDirX = 0, this._gazeFocusDirY = 0), this._gazeFocusActive = !0, this._gazeHasMouseTarget = !0, this._gazeDistractActive = !1, this._gazeMouseStaleTimer = 0, this.wake();
  }
  /** Exit keyboard eye-focus mode and resume mouse / autonomous gaze. */
  clearGazeFocus() {
    this._gazeFocusActive && (this._gazeFocusActive = !1, this.clearMouseTarget());
  }
  get gazeFocusActive() {
    return this._gazeFocusActive;
  }
  /**
   * World-space half-width and half-height of the visible frame. Used to
   * dampen animation translations as parts approach the canvas edge so they
   * stay in view. Set to (0, 0) to disable clamping.
   */
  setFrameBounds(A, i) {
    this._frameHalfWidth = Math.max(0, A), this._frameHalfHeight = Math.max(0, i);
  }
  _startAnim(A) {
    const i = performance.now();
    if (A === "sleep") {
      this._setMouth(this._config.mouthForAnim?.sleep ?? gA.sleep), this._browRaiseTarget = this._config.browRaiseForAnim?.sleep ?? 0, this._browAngleTarget = this._config.browAngleForAnim?.sleep ?? 0, this._sleepBlinking = !0, this._sleepBlinkStep = 0, this._sleepBlinkTimer = 150, this.cooldowns.set(A, i + rA[A]);
      return;
    }
    if (A === "wake") {
      this._setMouth(this._config.mouthForAnim?.wake ?? gA.wake), this._setPupil(this._config.pupilForAnim?.wake ?? GA.wake ?? null);
      const u = this._config.pupilScaleForAnim?.wake;
      u !== void 0 && (this._pupilScaleTarget = u);
      const T = this._config.mouthScaleForAnim?.wake;
      T !== void 0 && (this._mouthScaleTarget = T), this._armAngleTarget = this._config.armAngleForAnim?.wake ?? 0, this._browRaiseTarget = this._config.browRaiseForAnim?.wake ?? 0, this._browAngleTarget = this._config.browAngleForAnim?.wake ?? 0;
      const h = this._eyeClose, Y = this._armDroopT;
      this._sleeping = !1, this._sleepBlinking = !1, this._armDroopActive = !1, this.anim = {
        startTime: i,
        duration: 400,
        fn: (U) => {
          this._eyeClose = h * (1 - U), this._armDroopT = Y * (1 - U);
          const b = U < 0.3 ? 1 + U / 0.3 * 0.12 : 1 + (1 - U) / 0.7 * 0.12;
          for (const O of this.states) O.scaleMult = b;
        },
        onDone: () => {
          this._armDroopT = 0, this._idleState = "active", this._idleMs = 0, this._setMouth(null), this._setPupil(null), this._mouthScaleTarget = 1, this._armAngleTarget = 0, this._browRaiseTarget = 0, this._browAngleTarget = 0;
          const U = this._queuedAfterWake;
          this._queuedAfterWake = null, U && this._startAnim(U);
        }
      }, this.cooldowns.set(A, i + rA[A]);
      return;
    }
    const s = this.animDefs[A];
    if (!s) return;
    let e = this._config.mouthForAnim?.[A] ?? gA[A] ?? null;
    if (A === "build" && this.mouths.length > 0) {
      const u = [...new Set(this.mouths.map((h) => h.part.partId))], T = u.length > 1 && this._lastBuildMouth ? u.filter((h) => h !== this._lastBuildMouth) : u;
      e = T[Math.floor(Math.random() * T.length)], this._lastBuildMouth = e;
    }
    const t = this._config.pupilForAnim?.[A] ?? GA[A] ?? null, a = this._config.eyelidForAnim?.[A] ?? "open";
    this._setMouth(e), this._setPupil(t), this._setEyelid(a);
    const I = this._config.pupilScaleForAnim?.[A];
    I !== void 0 && (this._pupilScaleTarget = I);
    const c = this._config.mouthScaleForAnim?.[A];
    c !== void 0 && (this._mouthScaleTarget = c), re.has(A) && (this._animEyeClose = 1);
    const g = 0.3;
    let r = !1;
    if (A === "hop" && (this._setEyelid("closed"), r = !0), Ce.has(A)) {
      const u = this._config.animMirror?.[A] ?? !0;
      this.ctx.mirror = u ? Math.random() < 0.5 : !1;
    } else
      this.ctx.mirror = !1;
    const o = this._config.animAmounts?.[A] ?? 1, n = this._config.animAmountRange?.[A], m = n ? n[0] + Math.random() * (n[1] - n[0]) : o;
    this._animParams.animAmounts[A] = m;
    const y = this._config.animSpeed?.[A] ?? 1, M = this._config.animSpeedRange?.[A], d = M ? M[0] + Math.random() * (M[1] - M[0]) : y, z = Math.max(0.05, d);
    let J = Math.max(0.1, this._config.animLength?.[A] ?? 1);
    if (A === "wiggle") {
      const u = Math.max(0.5, this._config.wiggleCount ?? 4), T = this._config.wiggleCountVar ?? 0, h = T > 0 ? Math.max(1, Math.round(u - Math.random() * T)) : u;
      this._animParams.wiggleCount = h, J *= h / u, this._animParams.wiggleDir = Math.random() < 0.5 ? 1 : -1;
    }
    const p = s.duration * J / z;
    if (this._currentAnimName = A, A === "hop") {
      const u = this._config.hopHeight ?? 55, T = this._config.hopHeightVar ?? 0, h = T > 0 ? Math.max(0, u - Math.random() * T) : u;
      this._animParams.hopHeight = h, this._animParams.hopHeightRatio = u > 0 ? h / u : 1;
    }
    this._armAngleTarget = this._config.armAngleForAnim?.[A] ?? 0, this._browRaiseTarget = this._config.browRaiseForAnim?.[A] ?? 0, this._browAngleTarget = this._config.browAngleForAnim?.[A] ?? 0, this.anim = {
      startTime: i,
      duration: p,
      fn: (u) => {
        s.fn(u), A === "hop" && (u < g && !r ? (this._setEyelid("closed"), r = !0) : u >= g && r && (this._setEyelid(a), r = !1));
      },
      onDone: () => {
        this._animEyeClose = 0, this._setMouth(null), this._setPupil(null), this._setEyelid("open"), this._mouthScaleTarget = 1, this._armAngleTarget = 0, this._browRaiseTarget = 0, this._browAngleTarget = 0;
      }
    }, this.cooldowns.set(A, i + (rA[A] ?? 500) / z);
  }
  _exitBrainlessWithHop(A) {
    this._brainlessActive = !1;
    const i = performance.now(), s = this.animDefs.hop;
    if (!s) {
      this._brainlessAmplitude = 0, A && this._startAnim(A);
      return;
    }
    this.anim = {
      startTime: i,
      duration: s.duration,
      fn: (e) => s.fn(e),
      onDone: () => {
        this._brainlessAmplitude = 0, this._setMouth(null), this._setPupil(null), A && this._startAnim(A);
      }
    }, this.cooldowns.set("hop", i + rA.hop);
  }
  /**
   * Resolve an external label back to its canonical animation name. Returns
   * the input unchanged if it doesn't match any label (so canonical names
   * still work directly). External callers can use either, but the engine
   * always operates on canonicals downstream.
   */
  resolveAnimName(A) {
    const i = this._config.animLabels;
    if (!i) return A;
    for (const [s, e] of Object.entries(i))
      if (e === A) return s;
    return A;
  }
  /**
   * The public-facing list of label → canonical pairs. Returns the canonical
   * name when no label is set. Consumers (LLMs, UI generators) should call
   * this to discover what to pass to play().
   */
  getAnimationLabels() {
    const A = this._config.animLabels ?? {};
    return de.map((i) => ({
      canonical: i,
      name: A[i] ?? i
    }));
  }
  play(A) {
    A = this.resolveAnimName(A);
    const i = performance.now();
    if (A === "idle") {
      this._idleState = "active", this._idleMs = 0, this._fidgetCountdown = 0, this._idleLocked = !0;
      return;
    }
    if (A === "bored") {
      this._idleState = "bored", this._idleMs = this._config.boredAfter, this._boredCountdown = 200, this._idleLocked = !1;
      return;
    }
    if (this._idleLocked = !1, !((this.cooldowns.get(A) ?? 0) > i)) {
      if (A === "brainless") {
        this.cooldowns.set(A, i + rA.brainless), this._brainlessActive ? this._brainlessAmplitude > 0.05 ? this._exitBrainlessWithHop(null) : (this._brainlessActive = !1, this._brainlessAmplitude = 0, this._setMouth(null), this._setPupil(null)) : (this._brainlessActive = !0, this._setMouth(this._config.mouthForAnim?.brainless ?? gA.brainless), this._setPupil(this._config.pupilForAnim?.brainless ?? GA.brainless));
        return;
      }
      if (this._brainlessAmplitude > 0.05) {
        this._exitBrainlessWithHop(A);
        return;
      }
      if ((this._sleeping || this._eyeClose > 0.5) && A !== "sleep" && A !== "wake") {
        this._queuedAfterWake = A, this._startAnim("wake"), this.wake();
        return;
      }
      this._startAnim(A), A !== "sleep" && A !== "wake" && this.wake();
    }
  }
  wake() {
    this._idleMs = 0, this._brainlessActive = !1, this._sleepBlinking = !1, this._armDroopActive = !1, (this._idleState === "asleep" || this._sleeping) && (this._sleeping = !1, this._eyeClose = this._eyeClose, this._setMouth(null)), this._idleState !== "active" && (this._idleState = "active");
  }
  // Roll a fresh random translation + rotation offset per part for the
  // paper-cutout boil. Held in jX/jY/jRotZ until the next call.
  _rollJitter() {
    const A = this._jitterTrans, i = this._jitterRot * G;
    for (const s of this.states)
      s.category !== "shadow" && (s.category === "eyelid" && this._eyelidSclera.has(s) || (s.jX = (Math.random() * 2 - 1) * A, s.jY = (Math.random() * 2 - 1) * A, s.jRotZ = (Math.random() * 2 - 1) * i));
    for (const [s, e] of this._eyelidSclera)
      s.jX = e.jX, s.jY = e.jY, s.jRotZ = e.jRotZ;
  }
  update(A) {
    if (this._stepMs > 0 && this._steppedOnce) {
      if (this._stepAccum += A, this._stepAccum < this._stepMs) return;
      A = this._stepAccum, this._stepAccum = 0;
    }
    if (this._steppedOnce = !0, this._jitterTrans > 0 || this._jitterRot > 0) {
      const e = this._stepMs > 0 ? this._stepMs : 83.33333333333333;
      this._jitterAccum += A, this._jitterAccum >= e && (this._jitterAccum -= e, this._rollJitter());
    }
    if (this._idleMs += A, this._idleLocked || (this._idleState === "active" && this._idleMs >= this._config.boredAfter ? this._idleState = "bored" : this._idleState === "bored" && this._idleMs >= this._config.sleepyAfter ? this._idleState = "sleepy" : this._idleState === "sleepy" && this._idleMs >= this._config.sleepAfter && (this._idleState = "asleep", this._sleeping || this.play("sleep"))), this._idleState === "bored" && !this.anim && !this._sleeping && !this._brainlessActive && (this._boredCountdown -= A, this._boredCountdown <= 0)) {
      const e = this._config.boredAnimations ?? me;
      if (e.length > 0) {
        const t = e[Math.floor(Math.random() * e.length)];
        this._startAnim(t);
      }
      this._boredCountdown = 2500 + Math.random() * 4e3;
    }
    if (!this._idleLocked && this._idleState === "active" && !this.anim && !this._sleeping && !this._brainlessActive && (this._fidgetCountdown -= A, this._fidgetCountdown <= 0)) {
      const e = this._config.idleAnimations ?? ye;
      if (e.length > 0) {
        const t = e[Math.floor(Math.random() * e.length)];
        this._startAnim(t);
      }
      this._fidgetCountdown = 5e3 + Math.random() * 8e3;
    }
    if (this._sleepBlinking) {
      const e = [150, 200, 300], t = [320, 500, 800];
      if (this._blinking || (this._sleepBlinkTimer -= A, this._sleepBlinkTimer <= 0 && this._sleepBlinkStep < e.length && (this._blinking = !0, this._blinkT = 0, this._sleepBlinkSpeed = t[this._sleepBlinkStep], this._sleepBlinkStep++)), this._blinking) {
        this._blinkT += A / this._sleepBlinkSpeed;
        const a = this._sleepBlinkStep >= e.length;
        a && this._blinkT >= 0.5 ? (this._blinking = !1, this._blinkT = 0, this._sleepBlinking = !1, this._eyeClose = 1, this._sleeping = !0, this._armDroopActive = !0) : !a && this._blinkT >= 1 && (this._blinking = !1, this._blinkT = 0, this._sleepBlinkTimer = e[this._sleepBlinkStep] ?? 0);
      }
    } else
      !this._sleeping && !this._brainlessActive && this._eyeClose < 0.5 && (this._blinkCountdown -= A, this._blinkCountdown <= 0 && (this._blinking = !0, this._blinkT = 0, this._blinkCountdown = this._randBlink())), this._blinking && (this._blinkT += A / 180, this._blinkT >= 1 && (this._blinking = !1, this._blinkT = 0));
    this._sleeping && (this._swayPhase += A / 1e3), this.ctx.gazeOverride = null;
    for (const e of this.states)
      e.dX = 0, e.dY = 0, e.dRotZ = 0, e.dModelRotZ = 0, e.scaleMult = 1, e.vanish = 0;
    if (this.anim) {
      const e = Math.min((performance.now() - this.anim.startTime) / this.anim.duration, 1);
      this.anim.fn(e), e >= 1 && (this.anim.onDone?.(), this.anim = null, this._currentAnimName = null);
    }
    if (this.arms.length > 0) {
      const e = Math.max(1, this._config.armTransitionMs ?? 250);
      this._armAngleTarget !== this._armAnglePrevTarget && (this._armAngleFrom = this._armAngleSmoothed, this._armAngleTweenMs = 0, this._armAnglePrevTarget = this._armAngleTarget), this._armAngleTweenMs = Math.min(e, this._armAngleTweenMs + A);
      const t = Math.max(0, this._config.armAnticipation ?? 0), a = Math.max(0, this._config.armOvershoot ?? 0), I = Pe(this._armAngleTweenMs / e, t, a);
      if (this._armAngleSmoothed = this._armAngleFrom + (this._armAngleTarget - this._armAngleFrom) * I, Math.abs(this._armAngleSmoothed) > 1e-3) {
        const c = this._armAngleSmoothed * G;
        for (const g of this.arms) {
          const r = g.baseX >= 0 ? 1 : -1;
          g.dRotZ += c * r;
        }
      }
    }
    if (this.brows.length > 0) {
      const e = Math.max(1, this._config.armTransitionMs ?? 250), t = 1 - Math.exp(-A / e);
      this._browRaiseSmoothed += (this._browRaiseTarget - this._browRaiseSmoothed) * t, this._browAngleSmoothed += (this._browAngleTarget - this._browAngleSmoothed) * t;
      const a = this._browRaiseSmoothed, I = this._browAngleSmoothed * G;
      if (Math.abs(a) > 1e-3 || Math.abs(I) > 1e-4)
        for (const c of this.brows) {
          const g = c.baseX >= 0 ? 1 : -1;
          c.dY += a, c.dRotZ += I * g;
        }
    }
    if (!this.anim && !this._sleeping && !this._brainlessActive && this._idleState === "active") {
      const e = this._config.idleSwayAngle ?? 2, t = this._config.idleBodyBob ?? 2.5, a = this._config.idleBreathDepth ?? 0.02, I = this._config.idleStepAmount ?? 4, c = this._config.idleSwaySpeed ?? 1, g = this._config.idleBobSpeed ?? 1, r = this._config.idleBreathSpeed ?? 1, o = this._config.idleStepSpeed ?? 1, n = this._config.idleSwayNoise ?? 0.4, m = this._config.idleBobNoise ?? 0.4, y = this._config.idleBreathNoise ?? 0.4, M = this._config.idleStepNoise ?? 0.4, d = A / 1e3;
      this._idleSwayPhase += d * c, this._idleBobPhase += d * g, this._idleBreathPhase += d * r, this._stepPhase += d * o;
      const z = (h, Y, U) => {
        const b = Math.max(0, Math.min(1, U)), O = 1 / (1 + b * 0.7), v = Math.sin(h * Math.PI * Y) * (1 - b * 0.4), $ = Math.sin(h * Math.PI * Y * 1.7320508 + 1.3) * b * 0.7;
        return (v + $) * O;
      }, J = z(this._idleSwayPhase, 0.5, n) * e * G, p = z(this._idleBobPhase, 0.4, m) * t, u = z(this._idleBreathPhase, 0.4, y) * a;
      for (const h of this.nonFeet)
        h.dRotZ += J, h.dY += p, h.scaleMult *= 1 + u;
      const T = this.states.filter((h) => h.category === "legs" || h.category === "foot");
      if (T.length >= 2) {
        const h = [...T].sort(($, sA) => $.baseX - sA.baseX), Y = Math.ceil(h.length / 2), U = h.slice(0, Y), b = h.slice(Y), O = Math.max(0, z(this._stepPhase, 0.8, M)) * I, v = Math.max(0, z(this._stepPhase + 1.25, 0.8, M)) * I;
        for (const $ of U) $.dY += O;
        for (const $ of b) $.dY += v;
      }
    }
    if (!this._sleeping && !this._brainlessActive) {
      let t = 0, a = 0;
      if (this.pupils.length > 0) {
        let b = 0, O = 0;
        for (const v of this.pupils)
          b += v.baseX, O += v.baseY;
        t = b / this.pupils.length, a = O / this.pupils.length;
      }
      this._gazeFocusActive && (this._mouseWorldX = t + this._gazeFocusDirX * 150, this._mouseWorldY = a + this._gazeFocusDirY * 150, this._gazeHasMouseTarget = !0, this._gazeMouseStaleTimer = 0, this._gazeDistractActive = !1);
      const I = this._config.gazeMouseStaleMs ?? 2e3, c = this._config.gazeAutoMinMs ?? 1200, g = this._config.gazeAutoMaxMs ?? 4200, r = this._config.gazeHoldMinMs ?? 400, o = this._config.gazeHoldMaxMs ?? 1900, n = this._config.gazePursuitSpeed ?? 0.15, m = this._config.gazeJitterAmount ?? 0.08, y = this._config.gazeMouseDistractIntervalMinMs ?? 5e3, M = this._config.gazeMouseDistractIntervalMaxMs ?? 12e3, d = this._config.gazeMouseDistractDurationMinMs ?? 500, z = this._config.gazeMouseDistractDurationMaxMs ?? 1200;
      this._gazeHasMouseTarget && (this._gazeMouseStaleTimer += A, this._gazeMouseStaleTimer > I && (this._gazeHasMouseTarget = !1, this._gazeAutoTimer = 300 + Math.random() * 700, this._gazeDistractActive = !1));
      const J = this.ctx.gazeOverride;
      if (J)
        this._gazeTargetX = J.x, this._gazeTargetY = J.y, this._gazeHoldTimer = 0, this._gazeOverrideWasActive || (this._gazeCurrentX = J.x, this._gazeCurrentY = J.y), this._gazeOverrideWasActive = !0;
      else if (this._gazeHasMouseTarget)
        if (this._gazeOverrideWasActive = !1, this._gazeFocusActive)
          this._gazeTargetX = this._gazeMouseX, this._gazeTargetY = this._gazeMouseY;
        else if (this._gazeDistractActive)
          this._gazeDistractRemaining -= A, this._gazeDistractRemaining <= 0 && (this._gazeDistractActive = !1, this._gazeDistractIntervalTimer = y + Math.random() * Math.max(0, M - y));
        else if (this._gazeDistractIntervalTimer -= A, M > 0 && this._gazeDistractIntervalTimer <= 0) {
          this._gazeDistractActive = !0, this._gazeDistractRemaining = d + Math.random() * Math.max(0, z - d);
          const b = Math.random() * Math.PI * 2, O = (0.4 + Math.random() * 0.6) * 10;
          this._gazeTargetX = Math.cos(b) * O, this._gazeTargetY = Math.sin(b) * O, this._gazeHoldTimer = r + Math.random() * (o - r);
        } else
          this._gazeTargetX = this._gazeMouseX, this._gazeTargetY = this._gazeMouseY, this._gazeAutoTimer = c * 0.5 + Math.random() * g * 0.3;
      else if (this._gazeOverrideWasActive = !1, this._gazeAutoTimer -= A, this._gazeAutoTimer <= 0) {
        const b = Math.random() * Math.PI * 2, O = (0.3 + Math.random() * 0.7) * 10;
        this._gazeTargetX = Math.cos(b) * O, this._gazeTargetY = Math.sin(b) * O, this._gazeHoldTimer = r + Math.random() * (o - r), this._gazeAutoTimer = c + Math.random() * (g - c);
      }
      if (this._gazeJitterTimer -= A, this._gazeJitterTimer <= 0 && (this._gazeJitterX = (Math.random() - 0.5) * 10 * m, this._gazeJitterY = (Math.random() - 0.5) * 10 * m, this._gazeJitterTimer = 40 + Math.random() * 120), this._gazeHoldTimer > 0)
        this._gazeHoldTimer -= A;
      else {
        const b = this.ctx.gazeOverride || this._gazeHasMouseTarget ? n * 1.2 : n * 0.8, O = 1 - Math.pow(1 - b, A / 16);
        this._gazeCurrentX += (this._gazeTargetX - this._gazeCurrentX) * O, this._gazeCurrentY += (this._gazeTargetY - this._gazeCurrentY) * O, this._mouseWorldCurrentX += (this._mouseWorldX - this._mouseWorldCurrentX) * O, this._mouseWorldCurrentY += (this._mouseWorldY - this._mouseWorldCurrentY) * O;
      }
      const u = (b, O, v) => b + (O - b) * v, T = this._gazeHasMouseTarget && !this._gazeDistractActive && !this.ctx.gazeOverride, h = Math.max(1, this._pupilCursorDepth);
      let Y = 0, U = 0;
      if (T && this.pupils.length > 0) {
        const b = this._mouseWorldCurrentX - t, O = this._mouseWorldCurrentY - a, v = Math.sqrt(b * b + O * O + h * h);
        Y = b / v * 10, U = O / v * 10;
      }
      for (const b of this.pupils) {
        const O = this._pupilSclera.get(b), v = O ? Math.min(O.extLeft, O.extRight, O.extUp, O.extDown) : 0, $ = Math.min(b.extLeft, b.extRight, b.extUp, b.extDown), sA = v > 0 ? $ / v : 0.5, eA = Math.max(0, Math.min(1, (sA - 0.2) / 0.5)), q = u(this._pupilLookSmall, this._pupilLookLarge, eA);
        let tA, IA;
        T ? (tA = (Y + this._gazeJitterX) * q, IA = (U + this._gazeJitterY) * q) : (tA = (this._gazeCurrentX + this._gazeJitterX) * q, IA = (this._gazeCurrentY + this._gazeJitterY) * q), b.eyeOffsetX = tA, b.eyeOffsetY = IA;
      }
    }
    if (this._sleeping) {
      const e = Math.sin(this._swayPhase * Math.PI * 0.4) * 4 * G;
      for (const t of this.nonFeet) t.dRotZ += e;
    }
    if (this._armDroopActive && (this._armDroopT = Math.min(this._armDroopT + A / 1600, 1)), this._armDroopT > 0 && this.arms.length > 0)
      for (const e of this.arms) {
        if (Math.sqrt(e.baseMGX * e.baseMGX + e.baseMGY * e.baseMGY) < 2) continue;
        const I = ((-Math.PI / 2 - Math.atan2(e.baseMGY, e.baseMGX) - e.baseRotZ) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        e.dRotZ += I * this._armDroopT;
      }
    if (this.bodyState) {
      const e = this.bodyState, t = e.dRotZ;
      if (t !== 0) {
        const a = Math.cos(t) - 1, I = Math.sin(t);
        for (const c of this.states) {
          if (c.category === "body" || c.category === "foot" || c.category === "legs" || this._specSet.has(c)) continue;
          const g = c.baseX - e.baseX, r = c.baseY - e.baseY;
          c.dX += a * g - I * r, c.dY += I * g + a * r;
        }
      }
    }
    if (this._brainlessActive ? this._brainlessAmplitude = Math.min(this._brainlessAmplitude + A / 1200, 1) : this._brainlessAmplitude = Math.max(this._brainlessAmplitude - A / 700, 0), this._brainlessAmplitude > 0) {
      this._brainlessMs += A;
      const e = this._brainlessMs / 1e3, t = this._brainlessAmplitude * (this._animParams.animAmounts.brainless ?? 1);
      for (const a of this.states) {
        a.dX += Math.sin(e * a.bFloatSpeedX * Math.PI * 2 + a.bFloatPhaseX) * a.bFloatAmpX * t, a.dY += Math.sin(e * a.bFloatSpeedY * Math.PI * 2 + a.bFloatPhaseY) * a.bFloatAmpY * t;
        const I = Math.abs(a.bSpinSpeed) * 0.25, c = 0.6 + Math.abs(a.bSpinSpeed) * 0.5;
        a.dRotZ += Math.sin(e * I * Math.PI * 2 + a.bFloatPhaseX + Math.PI) * c * t;
      }
    }
    this._pupilScaleMult += (this._pupilScaleTarget - this._pupilScaleMult) * Math.min(A / 100, 1), this._mouthScaleMult += (this._mouthScaleTarget - this._mouthScaleMult) * Math.min(A / 100, 1);
    const i = this._blinking ? Math.sin(this._blinkT * Math.PI) * 0.95 : 0, s = Math.max(0, 1 - Math.max(this._eyeClose, i, this._animEyeClose));
    if (this._useSwapBlink) {
      const e = i > 0.5 || this._eyeClose > 0.5 || this._animEyeClose > 0;
      if (!this._swapBlinkClosed && e) {
        for (const t of this.scleraParts) t.wrapper.visible = !1;
        for (const t of this.eyelidClosedParts) t.wrapper.visible = !0;
        for (const t of this.allPupilParts) t.wrapper.visible = !1;
        for (const t of this.specParts) t.wrapper.visible = !1;
      } else if (this._swapBlinkClosed && !e) {
        for (const t of this.scleraParts) t.wrapper.visible = !0;
        for (const t of this.eyelidClosedParts) t.wrapper.visible = !1;
        for (const t of this.allPupilParts) t.wrapper.visible = !0;
        for (const t of this.specParts) t.wrapper.visible = !0;
        this._setPupil(this._currentPupilTarget);
      }
      this._swapBlinkClosed = e;
    }
    if (this._currentAnimName && this._excludeFromAnim) {
      const e = this._excludeFromAnim[this._currentAnimName];
      if (e) {
        const t = e.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
        if (t.length > 0)
          for (const a of this.states) {
            const I = (a.part.label ?? a.part.partId).toLowerCase();
            t.some((c) => I.includes(c)) && (a.dX = 0, a.dY = 0, a.dRotZ = 0, a.dModelRotZ = 0, a.scaleMult = 1);
          }
      }
    }
    if (this._frameHalfWidth > 0 || this._frameHalfHeight > 0) {
      const e = this._config.framePadding ?? 30, t = Math.max(0, this._frameHalfWidth - e), a = Math.max(0, this._frameHalfHeight - e);
      for (const I of this.states) {
        if (I.category === "paint" || I.dX === 0 && I.dY === 0) continue;
        const c = I.dRotZ, g = Math.cos(c), r = Math.sin(c), o = [
          [-I.extLeft, -I.extDown],
          [-I.extLeft, I.extUp],
          [I.extRight, -I.extDown],
          [I.extRight, I.extUp]
        ];
        let n = -1 / 0, m = 1 / 0, y = -1 / 0, M = 1 / 0;
        for (const [d, z] of o) {
          const J = d * g - z * r, p = d * r + z * g;
          J > n && (n = J), J < m && (m = J), p > y && (y = p), p < M && (M = p);
        }
        if (t > 0 && I.dX !== 0) {
          const d = I.dX > 0 ? t - (I.baseX + n) : t + (I.baseX + m);
          if (d <= 0)
            I.dX = 0;
          else {
            const z = I.dX > 0 ? 1 : -1;
            I.dX = z * d * Math.tanh(Math.abs(I.dX) / d);
          }
        }
        if (a > 0 && I.dY !== 0) {
          const d = I.dY > 0 ? a - (I.baseY + y) : a + (I.baseY + M);
          if (d <= 0)
            I.dY = 0;
          else {
            const z = I.dY > 0 ? 1 : -1;
            I.dY = z * d * Math.tanh(Math.abs(I.dY) / d);
          }
        }
      }
    }
    if (this.bodyState && this.paintParts.length > 0) {
      const e = this.bodyState;
      for (const t of this.paintParts)
        t.dX = e.dX, t.dY = e.dY, t.dRotZ = e.dRotZ, t.scaleMult = e.scaleMult;
    }
    if (this.bodyState && this.shadowParts.length > 0 && this._currentAnimName !== "explode") {
      const e = this.bodyState, t = 1 - this._shadowYSensitivity * e.dY, a = Math.max(this._shadowScaleFloor, t);
      for (const I of this.shadowParts)
        I.dX = e.dX, I.dY = 0, I.dRotZ = 0, I.scaleMult = a;
    }
    if (this._breathPhase += A / 1e3, !this._sleeping && !this._brainlessActive) {
      const t = this._breathPhase / 3.5 * Math.PI * 2, a = Math.sin(t) * 1.5, I = 1 + Math.sin(t) * 6e-3;
      for (const c of this.nonFeet)
        c.dY += a, c.scaleMult *= I;
    }
    this._clampPupilsInSclera();
    for (const e of this.states) {
      const t = e.category === "eye", a = this._pupilSet.has(e), I = e.category === "mouth", c = this._specSet.has(e), r = (c ? 1 : e.scaleMult) * (a ? this._pupilScaleMult : I ? this._mouthScaleMult : 1) * (1 - e.vanish), o = c ? e.dX * this._specParallax : e.dX, n = c ? e.dY * this._specParallax : e.dY;
      e.wrapper.position.x = e.baseX + o + e.eyeOffsetX + e.jX, e.wrapper.position.y = e.baseY + n + e.eyeOffsetY + e.jY, e.wrapper.position.z = e.baseZ;
      const m = e.category === "arms" && this._armTilt !== 0 ? this._armTilt * G * (e.baseX >= 0 ? 1 : -1) : 0;
      if (e.wrapper.rotation.z = (c ? e.baseRotZ : e.baseRotZ + e.dRotZ + this._bodyTilt * G + m) + e.jRotZ, e.modelGroup) {
        e.modelGroup.position.set(e.baseMGX, e.baseMGY, 0), e.modelGroup.rotation.z = e.dModelRotZ;
        const y = t ? this._useSwapBlink && (this._scleraSet.has(e) || this._eyelidClosedSet.has(e)) ? 1 : s : 1;
        e.modelGroup.scale.set(
          e.baseSX * r,
          e.baseSY * r * y,
          e.baseSZ
        );
      }
    }
  }
  // Switch which mouth is visible. Pass null to restore the default mouth.
  _setMouth(A) {
    if (this.mouths.length === 0) return;
    let i;
    A ? i = this.mouths.find((s) => s.part.partId === A) : i = this._defaultMouth ?? void 0;
    for (const s of this.mouths) s.wrapper.visible = s === i;
  }
  // Extract the variant keyword from a pupil part's ID: 'pupil-pupil-heart' → 'heart'
  _pupilKeyword(A) {
    return A.part.partId.toLowerCase().replace(/^pupil-pupil-/, "").replace(/^pupil-/, "");
  }
  _setPupil(A) {
    this._currentPupilTarget = A;
    const i = A ? this._partIdToKeyword(A) : this._defaultPupilKeyword;
    if (i === "pinhole" || i === "dilated" ? this._pupilScaleTarget = 0.25 : i === "heart" ? this._pupilScaleTarget = 1.3 : this._pupilScaleTarget = 1, this.allPupilParts.length <= 1 || new Set(this.allPupilParts.map((I) => this._pupilKeyword(I))).size <= 1) return;
    const e = i ?? this._defaultPupilKeyword, t = e ? this.allPupilParts.some((I) => this._pupilKeyword(I) === e) : !1, a = A ? t ? e : null : this._defaultPupilKeyword;
    for (const I of this.allPupilParts)
      I.wrapper.visible = a !== null && this._pupilKeyword(I) === a;
    if (this._useSwapBlink) {
      const I = a === "closed";
      for (const c of this.scleraParts) c.wrapper.visible = !I;
      for (const c of this.eyelidClosedParts) c.wrapper.visible = I;
      this._swapBlinkClosed = I;
    }
  }
  // Extract keyword from a partId: 'pupil-pupil-heart' → 'heart'
  _partIdToKeyword(A) {
    return A.toLowerCase().replace(/^pupil-pupil-/, "").replace(/^pupil-/, "");
  }
  // Set eyelid mode: 'open' (no eyelids), 'closed' (hide sclera/pupil), or 'squint' (show squint over eyes)
  _setEyelid(A) {
    if (A === "closed") {
      for (const i of this.scleraParts) i.wrapper.visible = !1;
      for (const i of this.allPupilParts) i.wrapper.visible = !1;
      for (const i of this.eyelidClosedParts) i.wrapper.visible = !0;
      for (const i of this.eyelidSquintParts) i.wrapper.visible = !1;
      for (const i of this.specParts) i.wrapper.visible = !1;
    } else if (A === "squint") {
      for (const i of this.scleraParts) i.wrapper.visible = !0;
      for (const i of this.eyelidClosedParts) i.wrapper.visible = !1;
      for (const i of this.eyelidSquintParts) {
        i.wrapper.visible = !0;
        const s = this._nearestSclera(i);
        if (s) {
          const e = this._modelBBoxSize(s), t = this._modelBBoxSize(i), a = e.x > 0 && t.x > 0 ? e.x / t.x : 1, I = e.y > 0 && t.y > 0 ? e.y / t.y : 1;
          i.baseSX = s.baseSX * a, i.baseSY = s.baseSY * I, i.baseSZ = s.baseSZ;
        }
      }
      for (const i of this.specParts) i.wrapper.visible = !0;
      this._setPupil(this._currentPupilTarget);
    } else {
      for (const i of this.scleraParts) i.wrapper.visible = !0;
      for (const i of this.eyelidClosedParts) i.wrapper.visible = !1;
      for (const i of this.eyelidSquintParts) i.wrapper.visible = !1;
      for (const i of this.specParts) i.wrapper.visible = !0;
      this._setPupil(this._currentPupilTarget);
    }
  }
  /**
   * The creature's bounding box at REST — every part at its base transform, with
   * animation offsets ignored.
   *
   * A blueprint's height is a property of the blueprint, but the thing on screen is never
   * at rest: the idle bob and breath move it continuously, the intro `build` plays over the
   * first frames, and any animation can extend a limb well past the resting silhouette. So
   * a host that wants to place the creature — centring it in a circle, say, rather than
   * standing it on the frame's floor — cannot get the answer by measuring a frame. Sampling
   * a moving thing once gives an answer that is wrong however carefully it is taken, and
   * wrong differently each run.
   *
   * Measured from `baseX/baseY/baseS*` rather than from the live wrappers for the same
   * reason, so the answer does not depend on when it is asked. The scene is posed at base,
   * measured, and put back inside one synchronous call — the next frame overwrites these
   * transforms anyway, which is what makes borrowing them safe.
   *
   * Synthesised and shadow parts are left out: they are not the creature.
   */
  restBounds() {
    const A = this.states.filter(
      (e) => !e.part.instanceId.startsWith("anim-synth-") && e.category !== "shadow"
    );
    if (A.length === 0) return null;
    const i = A.map((e) => ({
      s: e,
      pos: e.wrapper.position.clone(),
      rot: e.wrapper.rotation.z,
      mg: e.modelGroup?.position.clone() ?? null,
      mgRot: e.modelGroup?.rotation.z ?? 0,
      mgScale: e.modelGroup?.scale.clone() ?? null
    }));
    for (const e of A)
      e.wrapper.position.set(e.baseX, e.baseY, e.baseZ), e.wrapper.rotation.z = e.baseRotZ, e.modelGroup && (e.modelGroup.position.set(e.baseMGX, e.baseMGY, e.modelGroup.position.z), e.modelGroup.rotation.z = 0, e.modelGroup.scale.set(e.baseSX, e.baseSY, e.baseSZ));
    const s = new D.Box3();
    for (const e of A)
      e.wrapper.updateMatrixWorld(!0), s.expandByObject(e.wrapper);
    for (const e of i)
      e.s.wrapper.position.copy(e.pos), e.s.wrapper.rotation.z = e.rot, e.s.modelGroup && e.mg && (e.s.modelGroup.position.copy(e.mg), e.s.modelGroup.rotation.z = e.mgRot, e.mgScale && e.s.modelGroup.scale.copy(e.mgScale)), e.s.wrapper.updateMatrixWorld(!0);
    return s.isEmpty() ? null : s;
  }
  // Measure the unscaled bounding box of a part's model geometry,
  // accounting for child mesh transforms within the model group.
  _modelBBoxSize(A) {
    const i = A.modelGroup ?? A.wrapper, s = i.scale.clone();
    i.scale.set(1, 1, 1), i.updateMatrixWorld(!0);
    const e = new D.Box3().expandByObject(i);
    return i.scale.copy(s), i.updateMatrixWorld(!0), e.isEmpty() ? new D.Vector3(1, 1, 1) : e.getSize(new D.Vector3());
  }
  // Find the closest sclera to a given part (by base position).
  _nearestSclera(A) {
    let i = null, s = 1 / 0;
    for (const e of this.scleraParts) {
      const t = e.baseX - A.baseX, a = e.baseY - A.baseY, I = t * t + a * a;
      I < s && (s = I, i = e);
    }
    return i;
  }
  // Find the closest pupil to a given part (by base position).
  _nearestPupil(A) {
    let i = null, s = 1 / 0;
    for (const e of this.allPupilParts) {
      const t = e.baseX - A.baseX, a = e.baseY - A.baseY, I = t * t + a * a;
      I < s && (s = I, i = e);
    }
    return i;
  }
  _randBlink() {
    return this._config.blinkIntervalMin + Math.random() * (this._config.blinkIntervalMax - this._config.blinkIntervalMin);
  }
}
let pe = class {
  canvas;
  opts;
  sm = null;
  engine = null;
  partGroups = /* @__PURE__ */ new Map();
  rafId = null;
  lastT = 0;
  tick = null;
  wantRender = !0;
  onDocMouseMove = null;
  disposed = !1;
  readyPromise;
  resolveReady;
  rejectReady;
  thumbMode;
  thumbSize;
  reducedMotion = !1;
  constructor(A, i) {
    this.canvas = A, this.opts = i, this.thumbMode = i.thumbnail ?? "hidden", this.thumbSize = i.thumbnailSize ?? 120, this.reducedMotion = i.honorReducedMotion !== !1 && typeof window < "u" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === !0, this.readyPromise = new Promise((s, e) => {
      this.resolveReady = s, this.rejectReady = e;
    }), this._init().catch((s) => this.rejectReady(s));
  }
  /** Resolves once parts are loaded, synthetics are added, and the first frame is rendered. */
  ready() {
    return this.readyPromise;
  }
  get sceneManager() {
    return this.sm;
  }
  get animationPlayer() {
    return this.engine;
  }
  get animations() {
    return this.engine?.animations ?? [];
  }
  get idleState() {
    return this.engine?.idleState ?? null;
  }
  play(A) {
    this.engine?.play(A);
  }
  wake() {
    this.engine?.wake();
  }
  setMouseWorld(A, i) {
    this.engine?.setMouseWorld(A, i);
  }
  clearMouseTarget() {
    this.engine?.clearMouseTarget();
  }
  /**
   * Convert a canvas-client mousemove event to world coords via the scene
   * manager and push it to the engine. Studio uses this in its own handler.
   */
  pushClientMouse(A, i) {
    if (!this.sm || !this.engine) return;
    const s = this.canvas.getBoundingClientRect(), e = this.sm.screenToWorld(
      A - s.left,
      i - s.top,
      s.width,
      s.height
    );
    this.engine.setMouseWorld(e.x, e.y);
  }
  /**
   * Where the creature sits inside its canvas at REST, as fractions of the canvas height:
   * 0 is the top edge, 1 the bottom.
   *
   * **For hosts that place the creature rather than just show it.** Every blueprint is
   * rendered standing on the same ground plane and blueprints are not the same height, so a
   * short one sits low with a lot of sky above it. That is invisible in a panel and is the
   * whole impression in the middle of a circle, where the eye reads the creature against the
   * centre. Given this, a host can shift it by however far the middle of the band is from
   * the middle of the frame.
   *
   * It reports the RESTING silhouette (see `restBounds`), not the current frame, which is
   * the only version of this answer worth having: the creature is never still, so a host
   * measuring a snapshot is sampling a moving thing and gets a different answer depending on
   * when it looked. It is also available before the first frame is drawn, so nothing has to
   * be hidden while it is worked out — which is what makes the intro animation watchable.
   *
   * Projected through the camera rather than divided out of the frustum, so it stays correct
   * under pan, dolly and orbit.
   */
  restExtent() {
    const A = this.engine?.restBounds();
    if (!A || !this.sm) return null;
    const i = this.sm.camera;
    let s = 1 / 0, e = -1 / 0;
    for (const t of [A.min.x, A.max.x])
      for (const a of [A.min.y, A.max.y])
        for (const I of [A.min.z, A.max.z]) {
          const g = (1 - new D.Vector3(t, a, I).project(i).y) / 2;
          s = Math.min(s, g), e = Math.max(e, g);
        }
    return Number.isFinite(s) && Number.isFinite(e) ? { top: s, bottom: e } : null;
  }
  /** Capture the current frame as a PNG data URL (forces one render first). */
  snapshot() {
    if (!this.sm) return null;
    this.sm.render();
    try {
      return this.canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }
  /**
   * Capture a high-resolution PNG of the current frame — the live pose at the
   * moment of the call. Temporarily enlarges the drawing buffer (without
   * touching the canvas's CSS size, so there's no visible flicker) and, when
   * `transparent` is set, renders with no background, then restores the prior
   * size/background. `maxEdge` is the long edge of the output in pixels; the
   * other edge follows the camera's aspect so the image isn't distorted.
   * Returns a data URL, or null if the scene isn't ready.
   */
  captureImage(A = {}) {
    const i = this.sm;
    if (!i) return null;
    const s = Math.max(1, Math.round(A.maxEdge ?? 2048)), e = A.transparent ?? !1, t = (A.crop ?? !1) && e, a = Math.max(0, Math.round(A.padding ?? 0)), I = i.renderer, c = this.canvas.width, g = this.canvas.height, r = I.getPixelRatio(), o = i.scene.background, n = i.camera, m = (n.right - n.left) / (n.top - n.bottom) || 1, y = m >= 1 ? s : Math.round(s * m), M = m >= 1 ? Math.round(s / m) : s, d = [];
    try {
      return e && (i.scene.background = null), i.scene.traverse((z) => {
        z.userData.editorOverlay && z.visible && (d.push(z), z.visible = !1);
      }), I.setPixelRatio(1), I.setSize(y, M, !1), i.render(), t ? this._cropToContent(y, M, a) ?? this.canvas.toDataURL("image/png") : this.canvas.toDataURL("image/png");
    } catch {
      return null;
    } finally {
      for (const z of d) z.visible = !0;
      i.scene.background = o, I.setPixelRatio(r), I.setSize(c / r, g / r, !1), this._renderFrame();
    }
  }
  /**
   * Reads back the freshly-rendered (transparent) drawing buffer, finds the
   * bounding box of non-transparent pixels, and returns a PNG cropped to that
   * box plus `padding` pixels on every side. Returns null if nothing was drawn
   * (caller falls back to the full-frame capture).
   */
  _cropToContent(A, i, s) {
    const e = document.createElement("canvas");
    e.width = A, e.height = i;
    const t = e.getContext("2d");
    if (!t) return null;
    t.drawImage(this.canvas, 0, 0);
    const { data: a } = t.getImageData(0, 0, A, i), I = 128;
    let c = A, g = i, r = -1, o = -1;
    for (let d = 0; d < i; d++)
      for (let z = 0; z < A; z++)
        a[(d * A + z) * 4 + 3] >= I && (z < c && (c = z), z > r && (r = z), d < g && (g = d), d > o && (o = d));
    if (r < c || o < g) return null;
    c = Math.max(0, c - s), g = Math.max(0, g - s), r = Math.min(A - 1, r + s), o = Math.min(i - 1, o + s);
    const n = r - c + 1, m = o - g + 1, y = document.createElement("canvas");
    y.width = n, y.height = m;
    const M = y.getContext("2d");
    return M ? (M.drawImage(e, c, g, n, m, 0, 0, n, m), y.toDataURL("image/png")) : null;
  }
  /**
   * Read a built body part's actual color/gradient from its meshes. Saved
   * mascots often leave the body PlacedPart's color/gradient null and rely on
   * the color baked into the GLB / composition, so the blink eyelid — which
   * tints itself to the body — needs the model's real appearance, not the
   * (empty) PlacedPart field. Returns the dominant gradient (stashed as
   * userData.sourceGradient by buildPartGroup) and/or a flat color, weighting
   * meshes by vertex count so the main shell wins over small trim.
   */
  _sampleBodyAppearance(A) {
    if (!A) return {};
    const i = this.partGroups.get(A.instanceId);
    if (!i) return {};
    let s, e = -1;
    const t = /* @__PURE__ */ new Map();
    i.traverse((c) => {
      if (!(c instanceof D.Mesh) || c.name.startsWith("_")) return;
      const g = c.material;
      if (!(g instanceof D.MeshStandardMaterial)) return;
      const r = c.geometry?.attributes?.position?.count ?? 1, o = g.userData?.sourceGradient;
      if (o?.startColor && o?.endColor)
        r > e && (e = r, s = o);
      else if (!(g.map && g.userData?.gradientApplied)) {
        const n = g.color.getHex();
        t.set(n, (t.get(n) ?? 0) + r);
      }
    });
    let a, I = -1;
    for (const [c, g] of t)
      g > I && (I = g, a = "#" + c.toString(16).padStart(6, "0"));
    return { color: a ?? s?.startColor, gradient: s };
  }
  /** Resize scene + renderer to new pixel dimensions. */
  resize(A, i) {
    this.sm?.resize(A, i);
  }
  setThumbnailMode(A) {
    this.thumbMode = A;
  }
  // Recording: while capturing a video we hide the corner thumbnail and every
  // editor overlay (pink bounds frame, slot rects, selection rings) and force
  // a transparent background so canvas.captureStream() yields clean alpha
  // frames. The prior on-screen state is stashed and restored on stop.
  _recordRestore = null;
  setRecordingMode(A) {
    const i = this.sm;
    if (i) {
      if (A) {
        if (this._recordRestore) return;
        const s = [];
        i.scene.traverse((e) => {
          e.userData.editorOverlay && e.visible && (s.push(e), e.visible = !1);
        }), this._recordRestore = { thumb: this.thumbMode, bg: i.scene.background, overlays: s }, this.thumbMode = "hidden", i.scene.background = null;
      } else {
        const s = this._recordRestore;
        if (!s) return;
        for (const e of s.overlays) e.visible = !0;
        this.thumbMode = s.thumb, i.scene.background = s.bg, this._recordRestore = null;
      }
      this._renderFrame();
    }
  }
  /**
   * Grab the current canvas frame as a PNG blob with its alpha channel intact.
   * Used by the video recorder: reading the drawing buffer back (as Export PNG
   * does) preserves transparency, unlike MediaRecorder which flattens alpha to
   * opaque black. Resolves null if the canvas can't be read.
   */
  captureFramePng() {
    return new Promise((A) => {
      try {
        this.canvas.toBlob((i) => A(i), "image/png");
      } catch {
        A(null);
      }
    });
  }
  /** Replace the lighting config live. */
  setLighting(A) {
    this.sm?.applyLighting(A);
  }
  setBackground(A, i) {
    this.sm && (this.sm.scene.background = i ? null : new D.Color(A ?? "#ffffff"));
  }
  setShadowPlane(A) {
    this.sm?.shadowCatcher && (this.sm.shadowCatcher.visible = A);
  }
  setCameraAngle(A) {
    this.sm?.setCameraAngle(A);
  }
  setCameraDolly(A) {
    this.sm?.setCameraDolly(A);
  }
  /** Toggle pixelation and set the block size (CSS px per pixel; 1 = off). */
  setPixelation(A, i) {
    this.sm?.setPixelation(A, i);
  }
  // Pupil-look helper rings: green ring at MAX_OFFSET × smallValue, orange
  // ring at MAX_OFFSET × largeValue, drawn around each pupil's current
  // world position. Visible only while the user is adjusting the
  // Pupil Look sliders so the canvas reads as normal otherwise.
  _pupilHelperRings = [];
  _pupilHelperConfig = { visible: !1, smallValue: 1.5, largeValue: 0.5 };
  setPupilLookHelper(A) {
    this._pupilHelperConfig = { ...A }, A.visible && this._ensurePupilHelpers();
    for (const i of this._pupilHelperRings)
      i.small.visible = A.visible, i.large.visible = A.visible;
    this._updatePupilHelpers();
  }
  _ensurePupilHelpers() {
    const A = this.sm;
    if (!A) return;
    const i = /* @__PURE__ */ new Set(["pupil"]), s = (a) => {
      const I = this.opts.placedParts.find((o) => o.instanceId === a);
      if (!I) return !1;
      const c = this.opts.allPartDefs.find((o) => o.id === I.partId), g = (this.opts.savedParts ?? []).find((o) => o.id === I.partId), r = c?.category ?? g?.category;
      return !!r && i.has(r);
    }, e = (a) => {
      const c = [];
      for (let n = 0; n < 48; n++) {
        const m = n / 48 * Math.PI * 2;
        c.push(new D.Vector3(Math.cos(m), Math.sin(m), 0));
      }
      const g = new D.BufferGeometry().setFromPoints(c), r = new D.LineBasicMaterial({ color: a, depthTest: !1, transparent: !0, opacity: 0.85 }), o = new D.LineLoop(g, r);
      return o.renderOrder = 1500, o.userData.editorOverlay = !0, o;
    }, t = new Set(this._pupilHelperRings.map((a) => a.instanceId));
    for (const [a] of this.partGroups) {
      if (t.has(a) || !s(a)) continue;
      const I = e(2278750), c = e(16347926);
      A.scene.add(I), A.scene.add(c), this._pupilHelperRings.push({ instanceId: a, small: I, large: c });
    }
  }
  _updatePupilHelpers() {
    const i = 10 * this._pupilHelperConfig.smallValue, s = 10 * this._pupilHelperConfig.largeValue;
    for (const e of this._pupilHelperRings) {
      const t = this.opts.placedParts.find((o) => o.instanceId === e.instanceId);
      if (!t) continue;
      const a = t.scale * (t.scaleX ?? 1), I = t.scale * (t.scaleY ?? 1), c = t.position.x + (t.pivotOffsetX ?? 0) * a, g = t.position.y + (t.pivotOffsetY ?? 0) * I, r = (this.partGroups.get(e.instanceId)?.position.z ?? 0) + 0.5;
      e.small.position.set(c, g, r), e.large.position.set(c, g, r), e.small.scale.setScalar(Math.max(1e-3, i)), e.large.scale.setScalar(Math.max(1e-3, s));
    }
  }
  dispose() {
    this.disposed || (this.disposed = !0, this.rafId !== null && cancelAnimationFrame(this.rafId), this.rafId = null, this.onDocMouseMove && (document.removeEventListener("mousemove", this.onDocMouseMove), this.onDocMouseMove = null), this.tick = null, this.sm?.dispose(), this.sm = null, this.engine = null, this.partGroups.clear());
  }
  /**
   * Pause (`false`) or resume (`true`) the render loop without disposing the
   * WebGL context. Lets a caller stop an off-screen mascot from burning
   * CPU/GPU while keeping its context alive (so there's no re-init / context
   * churn when it scrolls back into view). No-op for static / reduced-motion
   * mascots, which never start a loop.
   */
  setRendering(A) {
    this.disposed || (this.wantRender = A, A ? this.rafId === null && this.tick && (this.lastT = 0, this.rafId = requestAnimationFrame(this.tick)) : this.rafId !== null && (cancelAnimationFrame(this.rafId), this.rafId = null));
  }
  // ── private ────────────────────────────────────────────────────────────
  async _init() {
    const A = this.opts.width ?? this.canvas.clientWidth ?? this.canvas.width, i = this.opts.height ?? this.canvas.clientHeight ?? this.canvas.height, s = new W0(this.canvas, A, i, {
      showBounds: this.opts.showBounds ?? !1
    });
    this.opts.transparentBg === !1 && this.opts.backgroundColor ? s.scene.background = new D.Color(this.opts.backgroundColor) : this.opts.transparentBg !== !1 && (s.scene.background = null), s.applyLighting(this.opts.lighting ?? x0), this.opts.cameraAngle !== void 0 && s.setCameraAngle(this.opts.cameraAngle), this.opts.cameraDolly !== void 0 && s.setCameraDolly(this.opts.cameraDolly), s.shadowCatcher && (s.shadowCatcher.visible = this.opts.shadowPlane !== !1);
    const e = this.opts.animationConfig;
    if (e?.pixelate && s.setPixelation(!0, e.pixelSize ?? 1), this.sm = s, await this._loadParts(s), this.disposed) return;
    if (this.engine && this.opts.introAnimation && !this.opts.staticFrame && !this.reducedMotion) {
      const a = s.camera;
      this.engine.setFrameBounds(Math.abs(a.right - a.left) / 2, Math.abs(a.top - a.bottom) / 2), this.engine.play(this.opts.introAnimation), this.engine.update(0);
    }
    if (s.render(), this.resolveReady(), this.opts.staticFrame || this.reducedMotion) return;
    this.opts.autoMouseTracking && (this.onDocMouseMove = (a) => this.pushClientMouse(a.clientX, a.clientY), document.addEventListener("mousemove", this.onDocMouseMove));
    const t = (a) => {
      if (this.disposed) return;
      const I = this.lastT ? a - this.lastT : 16;
      if (this.lastT = a, this.engine && this.sm) {
        const c = this.sm.camera;
        this.engine.setFrameBounds(Math.abs(c.right - c.left) / 2, Math.abs(c.top - c.bottom) / 2);
      }
      this.engine?.update(I), this._renderFrame(), this.rafId = requestAnimationFrame(t);
    };
    this.tick = t, this.wantRender && (this.rafId = requestAnimationFrame(t));
  }
  _renderFrame() {
    const A = this.sm;
    if (!A) return;
    if (this._pupilHelperConfig.visible && this._updatePupilHelpers(), this.thumbMode === "hidden") {
      A.render();
      return;
    }
    const i = this.canvas.clientWidth || this.canvas.width, s = this.canvas.clientHeight || this.canvas.height;
    this.thumbMode === "corner" ? (A.render(), A.renderThumbnail(i, s, this.thumbSize)) : (A.renderer.clear(), A.renderThumbnail(i, s, this.thumbSize));
  }
  /**
   * Mirrors AnimationStudio's loadParts — prefers buildPartGroup for parts
   * that have a composition so per-layer authoring (gradient vs flat color,
   * clippers, per-layer shadows) survives. Then loads animation synthetics
   * (unplaced mouth/pupil/sclera/eyelid variants) so the engine can swap
   * expressions and do blinks.
   */
  async _loadParts(A) {
    const { placedParts: i, allPartDefs: s } = this.opts, e = this.opts.savedParts ?? [], t = [
      ...s,
      ...e.filter((m) => !s.some((y) => y.id === m.id)).map((m) => ({
        id: m.id,
        category: m.category,
        label: m.name,
        glbPath: "",
        defaultZDepth: 0,
        defaultScale: 1
      }))
    ], a = async (m) => {
      const y = e.find((d) => d.id === m);
      if (y)
        return {
          model: await jA(y),
          cat: y.category,
          isComp: !0,
          isSpecPart: o0({ category: y.category, id: y.id, label: y.name })
        };
      const M = s.find((d) => d.id === m);
      if (!M) return null;
      try {
        return {
          model: await JA.loadPart(M),
          cat: M.category,
          isComp: !1,
          isSpecPart: o0({ category: M.category, id: M.id, label: M.label })
        };
      } catch {
        return null;
      }
    };
    for (const m of i) {
      const y = await a(m.partId);
      if (!y || this.disposed) continue;
      const { model: M, cat: d, isComp: z, isSpecPart: J } = y;
      bA(M, m, z), J ? Ie(M) : d === "pupil" ? g0(M) : d === "sclera" ? C0(M) : d === "mouth" ? r0(M) : d === "eyelid" || d === "brows" ? n0(M) : d === "body" ? De(M) : d === "paint" ? ce(M) : d === "shadow" && ie(M);
      const p = new D.Group();
      TA(p, M, m), p.add(M), A.scene.add(p), this.partGroups.set(m.instanceId, p);
    }
    if (this.disposed) return;
    const I = i.map((m) => {
      const y = e.find((M) => M.id === m.partId);
      return y ? { ...m, label: y.name } : m;
    }), c = async (m) => {
      const y = I.filter((p) => t.find((u) => u.id === p.partId)?.category === m);
      if (y.length === 0) return;
      const M = y[0].partId, d = y.filter((p) => p.partId === M), z = I.filter((p) => t.find((u) => u.id === p.partId)?.category === "sclera"), J = async (p, u, T) => {
        if (I.some((U) => U.partId === p)) return;
        const Y = p.toLowerCase().includes("closed") && z.length > 0 ? z : d;
        for (let U = 0; U < Y.length; U++) {
          if (this.disposed) return;
          try {
            const b = await T();
            bA(b, Y[U], !0), m === "pupil" ? g0(b) : m === "mouth" && r0(b);
            const O = new D.Group();
            O.visible = !1, TA(O, b, Y[U]), O.add(b);
            const v = `anim-synth-${m}-${p}-${U}`;
            this.partGroups.set(v, O), A.scene.add(O), I.push({ ...Y[U], instanceId: v, partId: p, label: u });
          } catch {
          }
        }
      };
      for (const p of e.filter((u) => u.category === m))
        await J(p.id, p.name, () => jA(p));
      for (const p of s.filter((u) => u.category === m)) {
        const u = e.find((T) => T.id === p.id);
        await J(p.id, p.label, u ? () => jA(u) : () => JA.loadPart(p));
      }
    };
    await c("mouth"), await c("pupil");
    const g = I.filter((m) => t.find((y) => y.id === m.partId)?.category === "sclera"), r = g.length > 0 ? g : I.filter((m) => t.find((y) => y.id === m.partId)?.category === "eye");
    if (r.length > 0 && !this.disposed) {
      for (const z of s.filter((J) => J.category === "sclera"))
        if (!I.some((J) => J.partId === z.id))
          for (let J = 0; J < r.length; J++) {
            if (this.disposed) return;
            try {
              const p = e.find((Y) => Y.id === z.id), u = p ? await jA(p) : await JA.loadPart(z);
              bA(u, r[J], !!p), C0(u);
              const T = new D.Group();
              T.visible = !1, TA(T, u, r[J]), T.add(u);
              const h = `anim-synth-sclera-${z.id}-${J}`;
              this.partGroups.set(h, T), A.scene.add(T), I.push({ ...r[J], instanceId: h, partId: z.id, label: z.label });
            } catch {
            }
          }
      const m = I.find((z) => t.find((p) => p.id === z.partId)?.category === "body"), y = this._sampleBodyAppearance(m), M = m?.gradient ?? y.gradient, d = m?.color ?? y.color;
      for (const z of s.filter((J) => J.category === "eyelid"))
        if (!I.some((J) => J.partId === z.id))
          for (let J = 0; J < r.length; J++) {
            if (this.disposed) return;
            try {
              const p = e.find((Y) => Y.id === z.id), u = p ? await jA(p) : await JA.loadPart(z);
              bA(
                u,
                { ...r[J], gradient: void 0, color: d, castShadow: !1 },
                !!p
              ), te(u, { gradient: M, color: d }), n0(u);
              const T = new D.Group();
              T.visible = !1, TA(T, u, r[J]), T.add(u);
              const h = `anim-synth-eyelid-${z.id}-${J}`;
              this.partGroups.set(h, T), A.scene.add(T), I.push({ ...r[J], instanceId: h, partId: z.id, label: z.label });
            } catch {
            }
          }
    }
    let o = I;
    if (!this.disposed) {
      const m = (T) => {
        const h = i.find((b) => b.instanceId === T);
        if (!h) return;
        const Y = t.find((b) => b.id === h.partId), U = e.find((b) => b.id === h.partId);
        return Y?.category ?? U?.category;
      }, y = /* @__PURE__ */ new Map();
      for (const T of i) {
        const h = this.partGroups.get(T.instanceId);
        if (!h) continue;
        h.updateMatrixWorld(!0);
        const Y = new D.Box3().setFromObject(h);
        Y.isEmpty() || y.set(T.instanceId, { minY: Y.min.y, maxY: Y.max.y, cat: m(T.instanceId) });
      }
      let M = 1 / 0, d = 1 / 0, z = null, J = 0, p = 0;
      for (const [T, h] of y) {
        if (h.cat === "shadow") {
          z = T, J = h.maxY - h.minY, p = (h.minY + h.maxY) / 2;
          continue;
        }
        h.minY < d && (d = h.minY), (h.cat === "legs" || h.cat === "foot") && h.minY < M && (M = h.minY);
      }
      const u = M !== 1 / 0 ? M : d;
      if (u !== 1 / 0) {
        const T = A.camera.bottom, Y = (z ? T + J / 2 : T) - u, U = z ? u - p : 0;
        if (z && U !== 0) {
          const b = this.partGroups.get(z);
          b && (b.position.y += U);
        }
        if (Math.abs(Y) > 0.01)
          for (const b of this.partGroups.values())
            b.position.y += Y;
        (Math.abs(Y) > 0.01 || U !== 0) && (o = I.map((b) => {
          const O = (b.instanceId === z ? U : 0) + Y;
          return O === 0 ? b : { ...b, position: { ...b.position, y: b.position.y + O } };
        }));
      }
    }
    const n = this.opts.animationConfig ?? HA;
    se(n.shadowBlur ?? 0), typeof n.shadowOpacity == "number" && Ae(n.shadowOpacity), typeof n.shadowBlurOpacity == "number" && ee(n.shadowBlurOpacity), this.engine = new je(
      this.partGroups,
      o,
      t,
      n
    ), A.applyScleraBrightness(), A.applyTeethBrightness(), A.applySpecBrightness();
  }
};
K0(k0);
const KA = [
  {
    id: "accessory-dark-circ",
    name: "dark circ",
    category: "accessory",
    layers: [
      {
        instanceId: "layer-1-1780954848464",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-shapes_a",
        scaleX: 3,
        scaleY: 0.4
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 3,
    _key: "accessory-dark-circ"
  },
  {
    id: "arms-dripr",
    name: "dripR",
    category: "arms",
    layers: [
      {
        instanceId: "layer-1-1776199460983",
        name: "armR",
        radius: 74.2351770401001,
        color: "#FFFFFF",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 2.4,
        glbPartId: "fs-shape-horns_g",
        gradient: {
          startColor: "#ffd877",
          endColor: "#53a0ff",
          angle: 0,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: -61,
    pivotOffsetY: 33,
    pivotScale: 2.4,
    _key: "arms-dripr"
  },
  {
    id: "body-cloud",
    name: "cloud",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1780708550317",
        name: "Cloudsb_a",
        radius: 83.17387998104095,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 4,
        glbPartId: "fs-shape-cloudsb_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#7c41ad",
          angle: 91,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        scaleY: 1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 4,
    _key: "body-cloud"
  },
  {
    id: "body-derp-copy",
    name: "derp copy",
    category: "body",
    layers: [
      {
        instanceId: "layer-2-1780696564197",
        name: "Egg_a",
        radius: 51.7308841115275,
        color: "#ffffff",
        position: {
          x: -6.822183098591549,
          y: -52.958375251509054
        },
        zDepth: 0,
        scale: 5,
        glbPartId: "fs-shape-egg_a",
        gradient: {
          startColor: "#E8D5B5",
          endColor: "#68412b",
          angle: 0,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        rotation: 91,
        scaleX: 1.3
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 5,
    _key: "body-derp-copy"
  },
  {
    id: "body-dill",
    name: "dill",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1780455955141",
        name: "Pills_g",
        radius: 33.86735916137695,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 9,
        glbPartId: "fs-shape-pills_g",
        rotation: -90,
        gradient: {
          startColor: "#fecdfa",
          endColor: "#f47cda",
          angle: 167,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: -29,
    pivotScale: 9,
    _key: "body-dill"
  },
  {
    id: "body-eggnew",
    name: "eggNew",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1777497953033",
        name: "Egg_a",
        radius: 51.7308841115275,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 6.5,
        glbPartId: "fs-shape-egg_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#f47cda",
          angle: 89,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: -33.23076923076923,
    pivotScale: 6.5,
    _key: "body-eggnew"
  },
  {
    id: "body-exportball",
    name: "exportBall",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1781160298022",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 8.6,
        glbPartId: "fs-shape-shapes_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#e0576a",
          angle: 88,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 8.6,
    _key: "body-exportball"
  },
  {
    id: "body-plainball",
    name: "pinkBall",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1776828720031",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#5C5C5C",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 7.6,
        glbPartId: "fs-shape-shapes_a",
        gradient: {
          startColor: "#ffd877",
          endColor: "#53a0ff",
          angle: 88,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 7.6,
    _key: "body-plainball"
  },
  {
    id: "body-roundbee",
    name: "roundBee",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1777181742479",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 7.7,
        glbPartId: "fs-shape-shapes_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#f47cda",
          angle: 129,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "body-roundbee"
  },
  {
    id: "body-squirc",
    name: "squirc",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1777183106278",
        name: "Pills_e",
        radius: 16.933679580688477,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 11.528243999999994,
        glbPartId: "fs-shape-pills_e",
        gradient: {
          startColor: "#ecf8c6",
          endColor: "#a9cc8a",
          angle: 83,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 11.528243999999994,
    _key: "body-squirc"
  },
  {
    id: "body-star",
    name: "star",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1780708628996",
        name: "Stars_e",
        radius: 41.64034128189087,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 6.8,
        glbPartId: "fs-shape-stars_e",
        gradient: {
          startColor: "#fecdfa",
          endColor: "#7c41ad",
          angle: 90,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 6.8,
    _key: "body-star"
  },
  {
    id: "body-superdrip",
    name: "superDrip",
    category: "body",
    layers: [
      {
        instanceId: "layer-1-1777667331000",
        name: "drip",
        radius: 11.589784987289535,
        color: "#FFFFFF",
        position: {
          x: 0.4872987927565392,
          y: 0
        },
        zDepth: 0,
        scale: 25,
        glbPartId: "fs-shape-horns_i",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#53a0ff",
          angle: 74,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: -8.486238532110091,
    pivotScale: 25,
    _key: "body-superdrip"
  },
  {
    id: "brows-flat",
    name: "flat",
    category: "brows",
    layers: [
      {
        instanceId: "layer-2-1776889881320",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0.5030181086519115
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 5,
        scaleY: 1.2,
        castShadow: !1,
        receiveShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "brows-flat"
  },
  {
    id: "ear-drop",
    name: "drop",
    category: "ear",
    layers: [
      {
        instanceId: "layer-1-1776309409977",
        name: "Horns_i",
        radius: 11.589784987289535,
        color: "#FFFFFF",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 18,
        glbPartId: "fs-shape-horns_i",
        rotation: 180,
        gradient: {
          startColor: "#ffb5af",
          endColor: "#00f900",
          angle: 291,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      },
      {
        instanceId: "layer-2-1776309431995",
        name: "Horns_i",
        radius: 11.589784987289535,
        color: "#fecdfa",
        position: {
          x: 0,
          y: 0.4872987927565393
        },
        zDepth: 4,
        scale: 15,
        glbPartId: "fs-shape-horns_i",
        rotation: 180
      }
    ],
    pivotOffsetX: 1.5,
    pivotOffsetY: -11,
    pivotScale: 16.5,
    _key: "ear-drop"
  },
  {
    id: "ear-rounder",
    name: "rounder",
    category: "ear",
    layers: [
      {
        instanceId: "layer-1-1776217270881",
        name: "outer",
        radius: 30.424177646636963,
        color: "#5C5C5C",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 4,
        glbPartId: "fs-shape-shapes_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#f7ed1a",
          angle: 270,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      },
      {
        instanceId: "layer-2-1776217328150",
        name: "outer",
        radius: 30.424177646636963,
        color: "#febed0",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 1,
        scale: 3.3,
        glbPartId: "fs-shape-shapes_a"
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: -30,
    pivotScale: 3.65,
    _key: "ear-rounder"
  },
  {
    id: "eyelid-closed",
    name: "closed",
    category: "eyelid",
    layers: [
      {
        instanceId: "layer-2-1776309054594",
        name: "lid",
        radius: 33.86021115342255,
        color: "#ffffff",
        position: {
          x: -2.378568284708249,
          y: 51.11111984406438
        },
        zDepth: 1,
        scale: 3,
        glbPartId: "fs-shape-pills_b",
        gradient: {
          startColor: "#fff995",
          endColor: "#ff9300",
          angle: 0,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        rotation: -90,
        castShadow: !1,
        receiveShadow: !1
      },
      {
        instanceId: "layer-3-1776309110837",
        name: "lid",
        radius: 33.86021115342255,
        color: "#ffffff",
        position: {
          x: -2.485381036217303,
          y: -50.368932344064405
        },
        zDepth: 2,
        scale: 3,
        glbPartId: "fs-shape-pills_b",
        gradient: {
          startColor: "#fff995",
          endColor: "#ff9300",
          angle: 0,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        rotation: -90,
        scaleY: -1,
        scaleX: -1,
        castShadow: !1,
        receiveShadow: !1
      },
      {
        instanceId: "layer-4-1776309140877",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 3,
        scale: 1,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 6,
        scaleY: 0.4,
        receiveShadow: !1,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.3333333333333335,
    _key: "eyelid-closed"
  },
  {
    id: "eyelid-squint",
    name: "squint",
    category: "eyelid",
    layers: [
      {
        instanceId: "layer-3-1776376286907",
        name: "lid",
        radius: 33.86021115342255,
        color: "#ffffff",
        position: {
          x: 0.2436493963782696,
          y: 59.5
        },
        zDepth: 1,
        scale: 2.7,
        glbPartId: "fs-shape-pills_b",
        gradient: {
          startColor: "#f2f7b7",
          endColor: "#583400",
          angle: 31,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        rotation: -90,
        scaleX: 0.8
      },
      {
        instanceId: "layer-4-1776376344744",
        name: "lid",
        radius: 33.86021115342255,
        color: "#ffffff",
        position: {
          x: 0,
          y: -56.5
        },
        zDepth: 2,
        scale: 2.7,
        glbPartId: "fs-shape-pills_b",
        gradient: {
          startColor: "#f2f7b7",
          endColor: "#583400",
          angle: 312,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        },
        rotation: 90,
        scaleX: 0.8
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.7,
    _key: "eyelid-squint"
  },
  {
    id: "horns-hornb",
    name: "hornB",
    category: "horns",
    layers: [
      {
        instanceId: "layer-2-1777188673451",
        name: "Horns_b",
        radius: 101.96738421032062,
        color: "#fffbb9",
        position: {
          x: 0,
          y: 0.25150905432595577
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-horns_b"
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: -66,
    pivotScale: 1,
    _key: "horns-hornb"
  },
  {
    id: "legs-drip",
    name: "drip",
    category: "legs",
    layers: [
      {
        instanceId: "layer-1-1776199360692",
        name: "leg",
        radius: 67.38356661163743,
        color: "#D4B775",
        position: {
          x: 0,
          y: -0.24364939637826963
        },
        zDepth: 0,
        scale: 2.9,
        glbPartId: "fs-shape-horns_c",
        rotation: 180,
        gradient: {
          startColor: "#ffd877",
          endColor: "#53a0ff",
          angle: 66,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 3,
    pivotOffsetY: 60.5,
    pivotScale: 2.9,
    _key: "legs-drip"
  },
  {
    id: "nose-drip",
    name: "drip",
    category: "nose",
    layers: [
      {
        instanceId: "layer-1-1776543799788",
        name: "Horns_a",
        radius: 91.5017131722072,
        color: "#C17F6B",
        position: {
          x: 0.4872987927565392,
          y: 0.007859657947686144
        },
        zDepth: 0,
        scale: 1.9,
        glbPartId: "fs-shape-horns_a",
        gradient: {
          startColor: "#ffd877",
          endColor: "#f1966a",
          angle: 114,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 9.5,
    pivotOffsetY: 20,
    pivotScale: 1.9,
    _key: "nose-drip"
  },
  {
    id: "nose-round",
    name: "round",
    category: "nose",
    layers: [
      {
        instanceId: "layer-1-1776826426182",
        name: "nose",
        radius: 30.424177646636963,
        color: "#E8D2A0",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 2.5,
        glbPartId: "fs-shape-shapes_a",
        gradient: {
          startColor: "#c1fdff",
          endColor: "#f47cda",
          angle: 98,
          centerX: 0.5,
          centerY: 0.5,
          projectionAxis: "XZ"
        }
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.5,
    _key: "nose-round"
  },
  {
    id: "paint-cow",
    name: "cow",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776829726758",
        name: "Blobs_a",
        radius: 36.17212066280901,
        color: "#D4A574",
        position: {
          x: -161.47667253521126,
          y: 156.26571931589538
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_a"
      },
      {
        instanceId: "layer-2-1776829730700",
        name: "Blobs_b",
        radius: 32.47832496235232,
        color: "#C17F6B",
        position: {
          x: -7.435236418511066,
          y: 32.50754527162978
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_b"
      },
      {
        instanceId: "layer-3-1776829736389",
        name: "Blobs_c",
        radius: 59.31272804737091,
        color: "#C17F6B",
        position: {
          x: 161.3509180080483,
          y: -118.10707997987932
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_c"
      },
      {
        instanceId: "layer-1-1776829741405",
        name: "Blobs_d",
        radius: 44.534939550709865,
        color: "#D4A574",
        position: {
          x: -187.24063128772636,
          y: -140.83721076458752
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_d"
      },
      {
        instanceId: "layer-2-1776829753730",
        name: "Blobs_f",
        radius: 87.20536828041077,
        color: "#D4A574",
        position: {
          x: 88.67266096579478,
          y: 204.728370221328
        },
        zDepth: 0,
        scale: 1.3,
        glbPartId: "fs-shape-blobs_f",
        rotation: 142
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.66,
    _key: "paint-cow"
  },
  {
    id: "paint-cowpink-copy",
    name: "cowPink",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776829726758",
        name: "Blobs_a",
        radius: 36.17212066280901,
        color: "#ecf8c6",
        position: {
          x: -161.47667253521126,
          y: 156.7687374245473
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_a",
        opacity: 0.25
      },
      {
        instanceId: "layer-2-1776829730700",
        name: "Blobs_b",
        radius: 32.47832496235232,
        color: "#ecf8c6",
        position: {
          x: -7.435236418511066,
          y: 32.50754527162978
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_b",
        opacity: 0.38
      },
      {
        instanceId: "layer-3-1776829736389",
        name: "Blobs_c",
        radius: 59.31272804737091,
        color: "#ecf8c6",
        position: {
          x: 161.83821680080482,
          y: -118.63367706237429
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_c",
        opacity: 0.68
      },
      {
        instanceId: "layer-1-1776829741405",
        name: "Blobs_d",
        radius: 44.534939550709865,
        color: "#ecf8c6",
        position: {
          x: -187.47642102615694,
          y: -140.59356136820927
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_d",
        opacity: 0.6
      },
      {
        instanceId: "layer-2-1776829753730",
        name: "Blobs_f",
        radius: 87.20536828041077,
        color: "#ecf8c6",
        position: {
          x: 89.15995975855131,
          y: 204.23321177062377
        },
        zDepth: 0,
        scale: 1.3,
        glbPartId: "fs-shape-blobs_f",
        rotation: 142,
        opacity: 0.28
      },
      {
        instanceId: "layer-2-1777503979261",
        name: "Blobs_c",
        radius: 59.31272804737091,
        color: "#ecf8c6",
        position: {
          x: 59.57746478873238,
          y: -414.9911971830986
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_c",
        opacity: 0.68,
        rotation: 139
      },
      {
        instanceId: "layer-3-1777504002240",
        name: "Blobs_b",
        radius: 32.47832496235232,
        color: "#ecf8c6",
        position: {
          x: 308.64216549295776,
          y: 165.72748993963782
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-blobs_b",
        opacity: 0.38,
        rotation: -180
      },
      {
        instanceId: "layer-4-1777504019723",
        name: "Blobs_d",
        radius: 44.534939550709865,
        color: "#ecf8c6",
        position: {
          x: -117.14694416498995,
          y: 430.0163480885311
        },
        zDepth: -2,
        scale: 3,
        glbPartId: "fs-shape-blobs_d",
        opacity: 0.6
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.7875,
    _key: "paint-cowpink-copy"
  },
  {
    id: "paint-dots",
    name: "dots",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776828794512",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: -26.65210010060362,
          y: 14.964788732394364
        },
        zDepth: 0,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        receiveShadow: !0,
        castShadow: !1
      },
      {
        instanceId: "layer-2-1776828801007",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 143.9273138832998,
          y: 198.40794768611673
        },
        zDepth: 0,
        scale: 4,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        receiveShadow: !0,
        castShadow: !1
      },
      {
        instanceId: "layer-3-1776828803467",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 155.40367203219313,
          y: -29.971390845070346
        },
        zDepth: 0,
        scale: 2.3,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        receiveShadow: !0,
        castShadow: !1
      },
      {
        instanceId: "layer-4-1776828806529",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 26.45938128772633,
          y: -145.69825201207237
        },
        zDepth: 0,
        scale: 1.6,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        receiveShadow: !0,
        castShadow: !1
      },
      {
        instanceId: "layer-5-1776828808799",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: -227.28055835010062,
          y: 79.25176056338036
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-shapes_a",
        castShadow: !1,
        opacity: 1
      },
      {
        instanceId: "layer-6-1776828811228",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: -82.96026156941652,
          y: 231.96365694165
        },
        zDepth: 0,
        scale: 2.4,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        castShadow: !1
      },
      {
        instanceId: "layer-7-1776828845657",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 12.77697434607643,
          y: 360.2030935613682
        },
        zDepth: 0,
        scale: 1.6,
        glbPartId: "fs-shape-shapes_a",
        opacity: 1,
        receiveShadow: !0,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.5142857142857147,
    _key: "paint-dots"
  },
  {
    id: "paint-drips",
    name: "drips",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776827461996",
        name: "Horns_a",
        radius: 91.5017131722072,
        color: "#E8D5B5",
        position: {
          x: 62.09129778672032,
          y: -2.4522132796780687
        },
        zDepth: 0,
        scale: 2.2,
        glbPartId: "fs-shape-horns_a"
      },
      {
        instanceId: "layer-2-1776827470097",
        name: "Horns_a",
        radius: 91.5017131722072,
        color: "#F5F1EA",
        position: {
          x: -122.0513707243461,
          y: 41.44271881287726
        },
        zDepth: 1,
        scale: 2.2,
        glbPartId: "fs-shape-horns_a",
        scaleY: -1,
        scaleX: -1
      },
      {
        instanceId: "layer-3-1776827510697",
        name: "Horns_a",
        radius: 91.5017131722072,
        color: "#E8E3DA",
        position: {
          x: 154.789361167002,
          y: 243.56168259557344
        },
        zDepth: 0,
        scale: 2.2,
        glbPartId: "fs-shape-horns_a",
        rotation: 56
      },
      {
        instanceId: "layer-4-1776827544301",
        name: "Horns_b",
        radius: 101.96738421032062,
        color: "#E8E3DA",
        position: {
          x: -155.81771881287725,
          y: -247.64996227364185
        },
        zDepth: 0,
        scale: 1.7,
        glbPartId: "fs-shape-horns_b",
        rotation: 49
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.075,
    _key: "paint-drips"
  },
  {
    id: "paint-shapes",
    name: "shapes",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776830431253",
        name: "Shapes_b",
        radius: 29.408156871795654,
        color: "#EFEBE3",
        position: {
          x: -124.81136820925552,
          y: 142.40914235412473
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-shapes_b"
      },
      {
        instanceId: "layer-2-1776830438044",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#F5F1EA",
        position: {
          x: 42.12776659959757,
          y: 155.7391222334004
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-shapes_a"
      },
      {
        instanceId: "layer-3-1776830443426",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#E8E3DA",
        position: {
          x: 99.96698943661974,
          y: -21.205357142857093
        },
        zDepth: 0,
        scale: 3.9,
        glbPartId: "fs-shape-shapes_g",
        rotation: 16
      },
      {
        instanceId: "layer-4-1776830482593",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#E8D5B5",
        position: {
          x: -145.09588782696176,
          y: 342.37330231388336
        },
        zDepth: 0,
        scale: 5,
        glbPartId: "fs-shape-shapes_g",
        rotation: 5
      },
      {
        instanceId: "layer-5-1776830501221",
        name: "Shapes_b",
        radius: 29.408156871795654,
        color: "#E1DBD2",
        position: {
          x: 182.8719190140845,
          y: 231.1905809859155
        },
        zDepth: 0,
        scale: 3.4,
        glbPartId: "fs-shape-shapes_b",
        rotation: 60
      },
      {
        instanceId: "layer-6-1776830516504",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#E1DBD2",
        position: {
          x: -46.65367203219314,
          y: -6.524773641851112
        },
        zDepth: 0,
        scale: 1.3,
        glbPartId: "fs-shape-shapes_a"
      },
      {
        instanceId: "layer-7-1776830569120",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#F5F1EA",
        position: {
          x: 13.882671026156956,
          y: 308.3004275653923
        },
        zDepth: 0,
        scale: 1.3,
        glbPartId: "fs-shape-shapes_a"
      },
      {
        instanceId: "layer-8-1776830576222",
        name: "Shapes_b",
        radius: 29.408156871795654,
        color: "#E8D5B5",
        position: {
          x: 202.37173038229378,
          y: 55.739436619718305
        },
        zDepth: 0,
        scale: 1.1,
        glbPartId: "fs-shape-shapes_b",
        rotation: 66
      },
      {
        instanceId: "layer-9-1776830595385",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#EFEBE3",
        position: {
          x: 131.8234406438632,
          y: 354.69724597585514
        },
        zDepth: 0,
        scale: 3.1,
        glbPartId: "fs-shape-shapes_g",
        rotation: -96
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.7888888888888896,
    _key: "paint-shapes"
  },
  {
    id: "paint-stripes",
    name: "stripes",
    category: "paint",
    layers: [
      {
        instanceId: "layer-1-1776829024308",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#E8D2A0",
        position: {
          x: 0.47157947686116697,
          y: -0.031438631790744465
        },
        zDepth: 0,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 9,
        scaleY: 0.6,
        castShadow: !1,
        opacity: 0.45
      },
      {
        instanceId: "layer-2-1776829040390",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#E1DBD2",
        position: {
          x: 7.593687122736419,
          y: -108.40165995975856
        },
        zDepth: 1,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 9,
        scaleY: 0.6,
        castShadow: !1,
        opacity: 0.85
      },
      {
        instanceId: "layer-3-1776829043168",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#EFEBE3",
        position: {
          x: 0.48981388329980025,
          y: -212.5198063380282
        },
        zDepth: 2,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 9,
        scaleY: 0.6,
        castShadow: !1,
        opacity: 0.6
      },
      {
        instanceId: "layer-1-1776890057805",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#EFEBE3",
        position: {
          x: -6.120158450704228,
          y: 102.73893360160967
        },
        zDepth: 2,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 9,
        scaleY: 0.6,
        castShadow: !1,
        opacity: 0.71
      },
      {
        instanceId: "layer-2-1776890062626",
        name: "Shapes_g",
        radius: 17.611026763916016,
        color: "#E8D5B5",
        position: {
          x: -9.176307847082498,
          y: 202.83042002012073
        },
        zDepth: 3,
        scale: 2.7,
        glbPartId: "fs-shape-shapes_g",
        scaleX: 9,
        scaleY: 0.6,
        castShadow: !1,
        opacity: 0.66
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 2.7,
    _key: "paint-stripes"
  },
  {
    id: "pupil-heart",
    name: "heart",
    category: "pupil",
    layers: [
      {
        instanceId: "layer-1-1776274231990",
        name: "Heart_c",
        radius: 65.83129167556763,
        color: "#1A1A1A",
        position: {
          x: 0.2436493963782696,
          y: 0
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-heart_c",
        receiveShadow: !1,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "pupil-heart"
  },
  {
    id: "pupil-pac",
    name: "pac",
    category: "pupil",
    layers: [
      {
        instanceId: "layer-1-1776274260591",
        name: "Pacman_d",
        radius: 65.45509099960327,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-pacman_d",
        receiveShadow: !1,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "pupil-pac"
  },
  {
    id: "pupil-round",
    name: "round",
    category: "pupil",
    layers: [
      {
        instanceId: "layer-1-1776198996862",
        name: "pupil",
        radius: 30.424177646636963,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-shapes_a",
        receiveShadow: !1,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "pupil-round"
  },
  {
    id: "sclera-round",
    name: "round",
    category: "sclera",
    layers: [
      {
        instanceId: "layer-1-1776198916163",
        name: "sclera",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 3,
        glbPartId: "fs-shape-shapes_a"
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 3,
    _key: "sclera-round"
  },
  {
    id: "shadow-ground",
    name: "ground",
    category: "shadow",
    layers: [
      {
        instanceId: "layer-1-1777498672291",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#1A1A1A",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 12,
        glbPartId: "fs-shape-shapes_a",
        scaleY: 0.1,
        opacity: 0.025,
        castShadow: !1,
        receiveShadow: !1,
        scaleX: 0.7
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 12,
    _key: "shadow-ground"
  },
  {
    id: "spec-one",
    name: "one",
    category: "spec",
    layers: [
      {
        instanceId: "layer-1-1776197805585",
        name: "Shapes_a",
        radius: 30.424177646636963,
        color: "#ffffff",
        position: {
          x: 0,
          y: 0
        },
        zDepth: 0,
        scale: 1,
        glbPartId: "fs-shape-shapes_a",
        receiveShadow: !1,
        castShadow: !1
      }
    ],
    pivotOffsetX: 0,
    pivotOffsetY: 0,
    pivotScale: 1,
    _key: "spec-one"
  }
], he = {
  light1On: !0,
  light2On: !0,
  light1Brightness: 0.1,
  light2Brightness: 0,
  ambientBrightness: 0.6,
  ambientColor: "#94e3fe",
  scleraBrightness: 1,
  teethBrightness: 0,
  specBrightness: 0.05,
  light1Color: "#ffffff",
  light2Color: "#ffffff",
  shadowsEnabled: !1,
  light1Bias: -7e-3,
  light1NormalBias: 2,
  light2Bias: -7e-3,
  light2NormalBias: 2
}, Qe = {
  light1On: !0,
  light2On: !0,
  light1Brightness: 1,
  light2Brightness: 1,
  ambientBrightness: 0.7,
  ambientColor: "#ffffff",
  scleraBrightness: 0.5,
  teethBrightness: 1.3,
  specBrightness: 0,
  light1Color: "#ffffff",
  light2Color: "#ffffff",
  shadowsEnabled: !0,
  light1Bias: -7e-3,
  light1NormalBias: 2,
  light2Bias: -7e-3,
  light2NormalBias: 2
}, Fe = he;
class ze {
  shared;
  constructor(A, i, s = {}) {
    const e = s.size ?? 200, t = s.introOnLoad ?? !0, a = t && !s.staticFrame ? typeof t == "string" ? t : "build" : void 0;
    this.shared = new pe(A, {
      placedParts: i.parts,
      savedParts: s.savedParts ?? KA,
      allPartDefs: s.partManifest ?? hA,
      width: e,
      height: e,
      animationConfig: s.animationConfig ?? HA,
      lighting: Qe,
      transparentBg: !0,
      showBounds: !1,
      thumbnail: "hidden",
      autoMouseTracking: s.autoMouseTracking ?? !s.staticFrame,
      staticFrame: s.staticFrame,
      introAnimation: a
    });
  }
  ready() {
    return this.shared.ready();
  }
  play(A) {
    this.shared.play(A);
  }
  /** Toggle pixelation and set the block size (CSS px per pixel; 1 = off). */
  setPixelation(A, i) {
    this.shared.setPixelation(A, i);
  }
  wake() {
    this.shared.wake();
  }
  /** Pause/resume the render loop without disposing the WebGL context. */
  setRendering(A) {
    this.shared.setRendering(A);
  }
  setMousePosition(A, i) {
    this.shared.pushClientMouse(A, i);
  }
  snapshot() {
    return this.shared.snapshot();
  }
  /** Where the creature sits in its canvas at rest, as fractions of the canvas height —
   *  see `restExtent` on the shared renderer. Null before the parts have loaded. */
  restExtent() {
    return this.shared.restExtent();
  }
  /** No-op. Theme is locked to light. */
  setTheme(A) {
  }
  dispose() {
    this.shared.dispose();
  }
  get animations() {
    return this.shared.animations;
  }
  get animationPlayer() {
    return this.shared.animationPlayer;
  }
  get idleState() {
    return this.shared.idleState;
  }
}
const ke = L0(function({ config: A, size: i = 200, className: s, style: e, options: t, onReady: a }, I) {
  const c = s0(null), g = s0(null);
  return f0(
    I,
    () => ({
      play: (r) => g.current?.play(r),
      wake: () => g.current?.wake(),
      setRendering: (r) => g.current?.setRendering(r),
      snapshot: () => g.current?.snapshot() ?? null,
      restExtent: () => g.current?.restExtent() ?? null,
      setTheme: (r) => g.current?.setTheme(r),
      get animations() {
        return g.current?.animations ?? [];
      },
      get animationLabels() {
        return g.current?.animationPlayer?.getAnimationLabels() ?? [];
      },
      get renderer() {
        return g.current;
      }
    }),
    []
  ), V0(() => {
    const r = c.current;
    if (!r) return;
    const o = new ze(r, A, { ...t ?? {}, size: i });
    g.current = o;
    let n = !1;
    return o.ready().then(() => {
      n || a?.(o, o.restExtent());
    }).catch(() => {
    }), () => {
      n = !0, o.dispose(), g.current === o && (g.current = null);
    };
  }, [A, i, t, a]), /* @__PURE__ */ Y0(
    "canvas",
    {
      ref: c,
      width: i,
      height: i,
      className: s,
      style: { width: `${i}px`, height: `${i}px`, display: "block", ...e }
    }
  );
}), Ze = [
  {
    id: "grad-e8d5b5-68412b",
    startHex: "#E8D5B5",
    endHex: "#68412b"
  },
  {
    id: "grad-fffbb9-68412b",
    startHex: "#fffbb9",
    endHex: "#68412b"
  },
  {
    id: "grad-ecf8c6-68412b",
    startHex: "#ecf8c6",
    endHex: "#68412b"
  },
  {
    id: "grad-a9cc8a-f47cda",
    startHex: "#a9cc8a",
    endHex: "#f47cda"
  },
  {
    id: "grad-c1fdff-f47cda",
    startHex: "#c1fdff",
    endHex: "#f47cda"
  },
  {
    id: "grad-fffbb9-f47cda",
    startHex: "#fffbb9",
    endHex: "#f47cda"
  },
  {
    id: "grad-fecdfa-f47cda",
    startHex: "#fecdfa",
    endHex: "#f47cda"
  },
  {
    id: "grad-c1fdff-7c41ad",
    startHex: "#c1fdff",
    endHex: "#7c41ad"
  },
  {
    id: "grad-fecdfa-7c41ad",
    startHex: "#fecdfa",
    endHex: "#7c41ad"
  },
  {
    id: "grad-fffbb9-7c41ad",
    startHex: "#fffbb9",
    endHex: "#7c41ad"
  },
  {
    id: "grad-ecf8c6-e0576a",
    startHex: "#ecf8c6",
    endHex: "#e0576a"
  },
  {
    id: "grad-c1fdff-e0576a",
    startHex: "#c1fdff",
    endHex: "#e0576a"
  },
  {
    id: "grad-febed0-e0576a",
    startHex: "#febed0",
    endHex: "#e0576a"
  },
  {
    id: "grad-fffbb9-e0576a",
    startHex: "#fffbb9",
    endHex: "#e0576a"
  },
  {
    id: "grad-ecf8c6-f1966a",
    startHex: "#ecf8c6",
    endHex: "#f1966a"
  },
  {
    id: "grad-fecdfa-f1966a",
    startHex: "#fecdfa",
    endHex: "#f1966a"
  },
  {
    id: "grad-ffd877-f1966a",
    startHex: "#ffd877",
    endHex: "#f1966a"
  },
  {
    id: "grad-e8d5b5-a9cc8a",
    startHex: "#E8D5B5",
    endHex: "#a9cc8a"
  },
  {
    id: "grad-ecf8c6-a9cc8a",
    startHex: "#ecf8c6",
    endHex: "#a9cc8a"
  },
  {
    id: "grad-fecdfa-a9cc8a",
    startHex: "#fecdfa",
    endHex: "#a9cc8a"
  },
  {
    id: "grad-c1fdff-f7ed1a",
    startHex: "#c1fdff",
    endHex: "#f7ed1a"
  },
  {
    id: "grad-ecf8c6-f7ed1a",
    startHex: "#ecf8c6",
    endHex: "#f7ed1a"
  },
  {
    id: "grad-c1fdff-53a0ff",
    startHex: "#c1fdff",
    endHex: "#53a0ff"
  },
  {
    id: "grad-9ee4fd-53a0ff",
    startHex: "#9ee4fd",
    endHex: "#53a0ff"
  },
  {
    id: "grad-abe8e8-53a0ff",
    startHex: "#abe8e8",
    endHex: "#53a0ff"
  },
  {
    id: "grad-ffd9ad-653d2a",
    startHex: "#ffd9ad",
    endHex: "#653d2a"
  },
  {
    id: "grad-fffbb9-9c9500",
    startHex: "#fffbb9",
    endHex: "#9c9500"
  },
  {
    id: "grad-c1fdff-538328",
    startHex: "#c1fdff",
    endHex: "#538328"
  }
], Be = Ze.slice(), Je = {
  "body-ball": { slots: [{ category: "sclera", x: [-151.7021746817539, -121.70217468175389], y: [41.206904172560115, 71.20690417256012], zDepth: 18 }, { category: "sclera", x: [129.5146746817539, 159.5146746817539], y: [38.64325495049505, 68.64325495049505], zDepth: 18 }, { category: "mouth", x: [-20.287526520509168, 9.712473479490832], y: [-125.70655056577083, -95.70655056577083], zDepth: 26 }, { category: "ear", x: [-148.8177599009901, -118.8177599009901], y: [182.64228253182455, 212.64228253182455], zDepth: 0 }, { category: "ear", x: [118.8177599009901, 148.8177599009901], y: [182.64228253182455, 212.64228253182455], zDepth: 0 }, { category: "arms", x: [-265.83590876944834, -235.83590876944837], y: [-78.14091230551627, -48.14091230551627], zDepth: 0, scale: [0.5, 1] }, { category: "arms", x: [235.83590876944837, 265.83590876944834], y: [-78.14091230551627, -48.14091230551627], zDepth: 0, scale: [0.45, 1] }, { category: "legs", x: [-119.04327263083451, -89.04327263083451], y: [-221.09237977369168, -191.09237977369168], zDepth: 0, scale: [0.3, 1] }, { category: "legs", x: [89.04327263083451, 119.04327263083451], y: [-221.09237977369168, -191.09237977369168], zDepth: 0, scale: [0.3, 1] }] },
  "body-round": { slots: [{ category: "spec", x: [-6.000000000000003, 6.000000000000003], y: [-6.000000000000003, 6.000000000000003], zDepth: 29 }, { category: "sclera", x: [-59.575848656294234, -47.57584865629423], y: [30.72869519094768, 42.72869519094768], zDepth: 37 }, { category: "sclera", x: [46.28960396039605, 58.28960396039606], y: [31.444748939179636, 43.44474893917965], zDepth: 37 }, { category: "mouth", x: [-6.413277934936366, 5.58672206506364], y: [-41.85130834512021, -29.851308345120206], zDepth: 30 }, { category: "arms", x: [72.6715954622048, 84.67159546220479], y: [-14.850200994538893, -2.8502009945388895], zDepth: 0, scale: [0.65, 1.1] }, { category: "ear", x: [-44.65505691536483, -32.65505691536483], y: [64.23694747485641, 76.23694747485641], zDepth: 0, scale: [0.6, 1] }, { category: "ear", x: [49.8319824074016, 61.831982407401576], y: [59.4536360239163, 71.45363602391629], zDepth: 0, flip: !0, scale: [0.65, 1] }, { category: "legs", x: [-47.55922668009355, -35.55922668009354], y: [-73.00718819969163, -61.00718819969163], zDepth: 0, scale: [0.65, 1.1] }, { category: "legs", x: [10.69882535513995, 22.698825355139956], y: [-80.50548230514178, -68.50548230514178], zDepth: 0, scale: [0.7, 1.1] }, { category: "arms", x: [-85.10753635510471, -74.59047482752342], y: [-15.538092457597783, -2.923700661275298], zDepth: 0, scale: [0.7, 1.05], mirror: !1, flip: !0 }, { category: "spec", x: [-79.1157620887009, -67.1157620887009], y: [62.274715946189595, 74.27471594618959], zDepth: 47 }, { category: "spec", x: [24.721304034198294, 36.7213040341983], y: [62.21253297575135, 74.21253297575134], zDepth: 47 }] },
  "body-circ": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 34, scale: [0.5, 1.7] }, { category: "sclera", x: [96.40738742526162, 120.63238742526157], y: [44.88539798206276, 69.11039798206278], zDepth: 32, scale: [0.5, 1.7] }, { category: "mouth", x: [-9.152251494768272, 15.072748505231726], y: [-72.99728606128548, -48.77228606128548], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "ear", x: [-115.86405773542613, -91.63905773542614], y: [158.800754671151, 183.02575467115096], zDepth: 0, scale: [0.475, 0.95] }, { category: "ear", x: [100.35659323617341, 124.5815932361734], y: [159.31458127802685, 183.53958127802682], zDepth: 0, scale: [0.4275, 0.8074999999999999], flip: !0 }, { category: "legs", x: [-88.22138983557545, -63.99638983557546], y: [-122.63195304559028, -98.40695304559029], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [55.19127025411069, 79.41627025411069], y: [-127.01699602017935, -102.79199602017935], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [126.42469854260096, 150.649698542601], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.45, 0.8], mirror: !1, flip: !1 }, { category: "arms", x: [-150.649698542601, -126.42469854260096], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.45, 0.8], mirror: !1, flip: !0 }, { category: "spec", x: [-155.7274009715994, -129.60474588938715], y: [82.77031483557548, 119.65997290732432], zDepth: 124.77999999999999 }, { category: "spec", x: [44.10697169282509, 68.33197169282509], y: [92.83609631913296, 117.06109631913299], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [76.3603984285127, 104.8603984285127], y: [-39.11336505398174, -10.613365053981731], zDepth: 73.39999999999995, scale: [0.25, 0.9024999999999997] }, { category: "pupil", x: [-98.74730490231886, -70.24730490231886], y: [46.693107727246854, 75.19310772724685], zDepth: 73.39999999999995, scale: [0.25, 0.9024999999999997] }] },
  "body-clouda": { slots: [{ category: "sclera", x: [-144.13944607059312, -114.13944607059311], y: [77.34112452973856, 107.34112452973856], zDepth: 26.100000000000005, scale: [0.9, 1.1] }, { category: "sclera", x: [82.88087412376528, 112.88087412376528], y: [42.09766433937507, 72.09766433937507], zDepth: 31.9, scale: [0.9, 1.1] }, { category: "mouth", x: [-39.08368875444421, -9.083688754444207], y: [-21.417503028291605, 8.582496971708395], zDepth: 37.700000000000045, scale: [0.55, 0.95] }, { category: "ear", x: [-119.27483129437643, -89.44649609258272], y: [81.76833650658641, 111.3724564617434], zDepth: 0, scale: [0.7, 1.1], rotation: [0, 90] }, { category: "ear", x: [93.96974374998385, 124.56006045401975], y: [64.01205606021401, 107.20922534272522], zDepth: 0, scale: [0.9, 1.1], flip: !0, rotation: [0, 90] }, { category: "legs", x: [-103.67202894623784, -73.67202894623784], y: [-115.0756027558754, -85.0756027558754], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [44.11056516867817, 74.11056516867816], y: [-124.72335165959399, -94.72335165959399], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [130.1581284629309, 160.1581284629309], y: [-45.95186392405657, -15.951863924056568], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-161.0630400694668, -131.0630400694668], y: [-46.094671969051035, -16.094671969051035], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "spec", x: [-166.8601605392791, -136.8601605392791], y: [99.56389862210368, 129.5638986221037], zDepth: 128.18, scale: [0.9, 1.1] }, { category: "spec", x: [64.40250771787038, 94.40250771787038], y: [62.92029342213824, 92.92029342213824], zDepth: 128.18, scale: [0.9, 1.1] }, { category: "pupil", x: [87.52658897896481, 127.64934682649844], y: [34.29327251088594, 68.30637508936132], zDepth: 75.40000000000009, scale: [0.15, 1.1] }, { category: "pupil", x: [-144.08873838102022, -111.8448342330382], y: [83.62776210653826, 102.73230246528266], zDepth: 75.40000000000009, scale: [0.65, 0.25] }, { category: "paint", x: [-58.34828101644245, -28.34828101644245], y: [10.784753363228681, 40.78475336322868], zDepth: 13, scale: [0.9, 1.1], opacity: [0.25, 0.6], rotation: [0, 360] }], bodyZDepth: 14.5 },
  "body-blob": { slots: [{ category: "mouth", x: [9.052187768987316, 39.05218776898732], y: [31.840480688160888, 61.84048068816089], zDepth: 33.800000000000004, scale: [0.9, 1.1] }, { category: "legs", x: [-165.06049789349544, -135.06049789349544], y: [-121.97043600804041, -91.97043600804041], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [117.2045049898779, 147.20450498987788], y: [-242.2325534151577, -212.2325534151577], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [124.59039330930258, 154.59039330930258], y: [1.3902329898897214, 31.39023298988972], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-169.511991469243, -139.51199146924296], y: [56.34594701552567, 86.34594701552567], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "sclera", x: [-59.66204222720478, -29.66204222720478], y: [198.9854260089686, 228.9854260089686], zDepth: 18, scale: [0.9, 1.1] }, { category: "sclera", x: [135.79643124065768, 165.79643124065768], y: [151.1411621823617, 181.1411621823617], zDepth: 18, scale: [0.9, 1.1] }, { category: "spec", x: [-81.61061285500749, -51.61061285500749], y: [222.22440209267566, 252.22440209267566], zDepth: 26, scale: [0.9, 1.1] }, { category: "spec", x: [113.8478606128549, 143.8478606128549], y: [174.38013826606877, 204.38013826606877], zDepth: 26, scale: [0.9, 1.1] }, { category: "pupil", x: [-59.66204222720478, -29.66204222720478], y: [198.9854260089686, 228.9854260089686], zDepth: 34, scale: [0.1, 0.5] }, { category: "pupil", x: [135.79643124065768, 165.79643124065768], y: [151.1411621823617, 181.1411621823617], zDepth: 34, scale: [0.1, 0.45] }, { category: "nose", x: [31.874999999999922, 61.87499999999992], y: [141.57047850036568, 171.57047850036568], zDepth: 22, scale: [0.15, 0.25] }, { category: "paint", x: [-19.484304932735434, 10.515695067264566], y: [3.684603886397589, 33.68460388639759], zDepth: 18, scale: [0.9, 1.1], opacity: [0.2, 0.65] }], bodyZDepth: 13.000000000000009 },
  "body-cloudc": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 32.29999999999999, scale: [0.7, 1.7] }, { category: "sclera", x: [87.17871122944692, 111.40371122944687], y: [53.088172645739945, 77.31317264573995], zDepth: 31, scale: [0.7, 1.7] }, { category: "mouth", x: [-12.512327167414036, 11.71267283258596], y: [-89.67142656950672, -65.44642656950671], zDepth: 69.72999999999996, scale: [0.95, 1.0924999999999998] }, { category: "spec", x: [-140.11407884902835, -116.11971692825105], y: [76.03509902840052, 106.3034005979072], zDepth: 237.0820000000004 }, { category: "spec", x: [55.20971365844556, 79.43471365844556], y: [84.67617946562032, 108.90117946562034], zDepth: 237.0820000000004, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [85.69931378725707, 114.19931378725707], y: [50.56187317471784, 79.06187317471785], zDepth: 139.45999999999992, scale: [0.65, 1.5] }, { category: "pupil", x: [-106.2386632730214, -75.3213426452187], y: [35.82976224892106, 65.67271815325587], zDepth: 139.45999999999992, scale: [0.6, 0.9] }, { category: "paint", x: [-30.916946935724937, -0.9169469357249351], y: [-14.567918535127085, 15.432081464872915], zDepth: 18, scale: [1, 1.65], rotation: [0, 360], opacity: [0.15, 0.3] }, { category: "accessory", x: [-17.691750747384205, 12.308249252615795], y: [-224.08071748878922, -194.08071748878922], zDepth: 0, scale: [1, 1] }], bodyZDepth: 19.00000000000003 },
  "body-clipping": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 34, scale: [0.6174999999999999, 0.95] }, { category: "sclera", x: [92.31405782884904, 116.539057828849], y: [44.157515881913284, 68.38251588191329], zDepth: 32, scale: [0.7124999999999999, 0.9024999999999997] }, { category: "mouth", x: [-12.512327167414036, 11.71267283258596], y: [-89.67142656950672, -65.44642656950671], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "legs", x: [-92.6356275037369, -68.4106275037369], y: [-151.28946425635272, -127.06446425635272], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [68.4106275037369, 92.6356275037369], y: [-151.28946425635272, -127.06446425635272], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [126.42469854260096, 150.649698542601], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [-150.649698542601, -126.42469854260096], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.48449999999999976, 0.76] }, { category: "spec", x: [-155.7274009715994, -131.5024009715994], y: [95.43497290732435, 119.65997290732432], zDepth: 124.77999999999999 }, { category: "spec", x: [44.10697169282509, 68.33197169282509], y: [92.83609631913296, 117.06109631913299], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [96.51010881715246, 125.01010881715246], y: [31.013106358574355, 59.51310635857436], zDepth: 73.39999999999995, scale: [0.5225, 0.9024999999999997] }, { category: "pupil", x: [-98.74730490231886, -70.24730490231886], y: [46.693107727246854, 75.19310772724685], zDepth: 73.39999999999995, scale: [0.19, 0.855] }] },
  "body-egg-flat": { slots: [{ category: "sclera", x: [-140.64461416292974, -116.41961416292973], y: [24.883728045590445, 49.10872804559045], zDepth: 34, scale: [0.6174999999999999, 2.75] }, { category: "sclera", x: [170.64342068385636, 194.8684206838563], y: [20.860150411061245, 45.08515041106125], zDepth: 32, scale: [0.7124999999999999, 2.85] }, { category: "mouth", x: [20.562808295964146, 44.78780829596415], y: [-150.92259435724964, -126.69759435724964], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "legs", x: [-82.15473251121072, -57.92973251121073], y: [-301.24508832212257, -277.0200883221226], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [106.13017159940206, 130.35517159940207], y: [-310.2136981875933, -285.9886981875933], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [245.60911558295967, 269.8341155829597], y: [-61.838557436472314, -37.613557436472334], zDepth: 0, scale: [0.48449999999999976, 0.85] }, { category: "arms", x: [-218.17118583707037, -193.94618583707035], y: [-72.36616393871446, -48.14116393871449], zDepth: 0, scale: [0.48449999999999976, 0.76], flip: !0 }, { category: "spec", x: [-189.90854820627803, -165.68354820627803], y: [70.70706745142004, 94.93206745142001], zDepth: 124.77999999999999 }, { category: "spec", x: [114.93913723841553, 139.16413723841555], y: [72.02027980194313, 96.24527980194316], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [169.0096417020553, 197.5096417020553], y: [17.915199034209618, 46.41519903420962], zDepth: 73.39999999999995, scale: [0.65, 1.35] }, { category: "pupil", x: [-144.0057363298226, -115.50573632982258], y: [21.705019162224467, 50.12175589615569], zDepth: 73.39999999999995, scale: [0.7, 1.05] }, { category: "nose", x: [0.14573991031394584, 30.145739910313946], y: [-60.69880418535126, -30.698804185351257], zDepth: 18, scale: [0.2, 0.35] }, { category: "paint", x: [-12.540872571001522, 17.459127428998478], y: [-53.02924140508227, -23.029241405082267], zDepth: 18, scale: [1.05, 1.5], rotation: [0, 360], opacity: [0.4, 1] }] },
  "body-star": { slots: [{ category: "mouth", x: [-0.3588573042168675, -0.3588573042168675], y: [-199, -37.244681852409634], zDepth: 18, scale: [1, 1] }, { category: "sclera", x: [-99.05638177710846, -99.05638177710846], y: [-71, 78.54856927710844], zDepth: 12, scale: [1.4, 1.8] }, { category: "arms", x: [181.94088667168674, 181.94088667168674], y: [-74.8252014307229, -74.8252014307229], zDepth: 0, scale: [0.65, 1] }, { category: "arms", x: [-182.65860128012045, -182.65860128012045], y: [-74.8252014307229, -74.8252014307229], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "legs", x: [-119.94539156626509, -119.94539156626509], y: [-214.09317959337358, -214.09317959337358], zDepth: 0, scale: [0.65, 1] }, { category: "legs", x: [119.22767695783135, 119.22767695783135], y: [-214.09317959337358, -214.09317959337358], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "sclera", x: [98.33866716867472, 98.33866716867472], y: [-71, 78.54856927710844], zDepth: 16, scale: [1.4, 1.8], flip: !0 }, { category: "pupil", x: [-95.83254894578315, -95.83254894578315], y: [68.20053652108433, 68.20053652108433], zDepth: 14, scale: [1, 1] }, { category: "pupil", x: [95.11483433734941, 95.11483433734941], y: [68.20053652108433, 68.20053652108433], zDepth: 20, scale: [1, 1], flip: !0 }, { category: "spec", x: [-115.27555534638554, -115.27555534638554], y: [87.53176769578313, 87.53176769578313], zDepth: 26, scale: [1, 1] }, { category: "spec", x: [82.11949359939763, 82.11949359939763], y: [87.53176769578313, 87.53176769578313], zDepth: 26, scale: [1, 1] }, { category: "ear", x: [80.13107115963855, 80.13107115963855], y: [131.74342055722892, 131.74342055722892], zDepth: 0, scale: [0.65, 1], rotation: [-51, -51] }, { category: "ear", x: [-80.84878576807229, -80.84878576807229], y: [131.74342055722892, 131.74342055722892], zDepth: 0, scale: [0.65, 1], flip: !0, rotation: [-51, -51] }, { category: "brows", x: [-106.87476468373494, -106.87476468373494], y: [195.47722138554218, 195.47722138554218], zDepth: 26, scale: [0.5, 0.8] }, { category: "brows", x: [106.1570500753012, 106.1570500753012], y: [195.47722138554218, 195.47722138554218], zDepth: 26, scale: [0.5, 0.8], flip: !0 }, { category: "shadow", x: [-2.570860976846809, -2.570860976846809], y: [-439.7435897435897, -439.7435897435897], zDepth: 9, scale: [1, 1] }, { category: "horns", x: [236.5507033475784, 236.5507033475784], y: [71.33640491452992, 71.33640491452992], zDepth: 18, scale: [0.1, 1], rotation: [-70, -70] }, { category: "horns", x: [-236.15562678062682, -236.15562678062682], y: [45.623041310541296, 45.623041310541296], zDepth: 18, scale: [0.1, 1], flip: !0, rotation: [-118, -118] }, { category: "nose", x: [-0.31717414529914534, -0.31717414529914534], y: [-143, -0.37838319088319083], zDepth: 18, scale: [0.25, 0.6] }], bodyZDepth: 10 },
  "body-plainball": { slots: [{ category: "sclera", x: [-164.68142750373696, -164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19.000000000000018, scale: [0.65, 1.35] }, { category: "sclera", x: [164.68142750373696, 164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19.000000000000018, scale: [0.65, 1.35], flip: !0 }, { category: "nose", x: [-8.507333707025412, -8.507333707025412], y: [20.039237668161434, 20.039237668161434], zDepth: 34, scale: [0.3, 0.6] }, { category: "mouth", x: [-2.896113602391629, -2.896113602391629], y: [-40.25364349775785, -40.25364349775785], zDepth: 28, scale: [0.65, 1] }, { category: "pupil", x: [-164.68142750373696, -164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19, scale: [1, 1.5] }, { category: "pupil", x: [164.68142750373696, 164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 24, scale: [1, 1.5], flip: !0 }, { category: "legs", x: [93.55730194319878, 93.55730194319878], y: [-138.2497888639761, -138.2497888639761], zDepth: 0, scale: [0.55, 0.85], rotation: [22, 22] }, { category: "legs", x: [-93.55730194319878, -93.55730194319878], y: [-138.2497888639761, -138.2497888639761], zDepth: 0, scale: [0.55, 0.85], flip: !0, rotation: [22, 22] }, { category: "arms", x: [177.68395739910318, 177.68395739910318], y: [-55.88520553064271, -55.88520553064271], zDepth: 0, scale: [0.55, 1] }, { category: "arms", x: [-190.23767563527656, -190.23767563527656], y: [-62.23213191330339, -62.23213191330339], zDepth: 0, scale: [0.55, 1], flip: !0 }, { category: "ear", x: [90.19866405082216, 90.19866405082216], y: [144.6280829596413, 144.6280829596413], zDepth: 0, scale: [0.6, 1], rotation: [-40, -40] }, { category: "ear", x: [-90.19866405082216, -90.19866405082216], y: [144.6280829596413, 144.6280829596413], zDepth: 0, scale: [0.6, 1], flip: !0, rotation: [-40, -40] }, { category: "spec", x: [-183.85650224215246, -183.85650224215246], y: [26.158445440956633, 26.158445440956633], zDepth: 20, scale: [1, 1] }, { category: "spec", x: [145.50635276532145, 145.50635276532145], y: [26.158445440956633, 26.158445440956633], zDepth: 25, scale: [1, 1] }, { category: "brows", x: [-174.52003923766813, -174.52003923766813], y: [51, 120], zDepth: 36, scale: [0.8, 0.8] }, { category: "brows", x: [174.52003923766813, 174.52003923766813], y: [51, 120], zDepth: 36, scale: [0.8, 0.8], flip: !0 }, { category: "horns", x: [-98.71517319277109, -98.71517319277109], y: [156.69554759523635, 156.69554759523635], zDepth: 27, scale: [1, 1] }, { category: "horns", x: [98.71517319277109, 98.71517319277109], y: [156.69554759523635, 156.69554759523635], zDepth: 27, scale: [1, 1], flip: !0 }, { category: "shadow", x: [15.601468373493983, 15.601468373493983], y: [-401.8637048192771, -401.8637048192771], zDepth: -1, scale: [1, 1] }], bodyZDepth: 14.857142857142861, compatibleGradients: ["grad-a9cc8a-f47cda", "grad-c1fdff-f47cda", "grad-fffbb9-f47cda", "grad-fecdfa-f47cda"] },
  "body-heart": { slots: [{ category: "sclera", x: [-166.43287556053812, -136.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 27.90000000000001, scale: [0.9, 1.1] }, { category: "mouth", x: [-15, 15], y: [-111, -81], zDepth: 40.300000000000026, scale: [0.9, 1.1] }, { category: "sclera", x: [136.43287556053812, 166.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 27.90000000000001, scale: [1.25, 2.65] }, { category: "pupil", x: [-166.43287556053812, -136.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 52.69999999999999, scale: [0.9, 1.1] }, { category: "pupil", x: [136.61388266068755, 166.61388266068755], y: [42.00555866965621, 72.00555866965621], zDepth: 52.69999999999999, scale: [0.9, 1.1] }, { category: "legs", x: [-133.9158389387145, -103.91583893871451], y: [-173.19560351270553, -143.19560351270553], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [103.91583893871451, 133.9158389387145], y: [-173.19560351270553, -143.19560351270553], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [221.79737294469356, 251.79737294469356], y: [-86.00805680119583, -56.008056801195835], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-251.79737294469356, -221.79737294469356], y: [-86.00805680119583, -56.008056801195835], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "paint", x: [-4.583333333333332, 25.416666666666668], y: [-2.7349872111121307, 27.26501278888787], zDepth: 34, scale: [1.1, 1.6], rotation: [0, 360], opacity: [0.25, 0.8] }], bodyZDepth: 15.500000000000018 },
  "body-drip": { slots: [{ category: "sclera", x: [-120.59136771300453, -90.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 28.800000000000008, scale: [0.9, 1.85] }, { category: "mouth", x: [-23.694179745889386, 6.305820254110614], y: [-252.27111360239164, -222.27111360239164], zDepth: 28.800000000000008, scale: [0.6, 0.75] }, { category: "pupil", x: [-120.59136771300453, -90.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 41.60000000000001, scale: [0.9, 1.55] }, { category: "sclera", x: [90.59136771300453, 120.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 28.800000000000008, scale: [0.9, 1.85] }, { category: "pupil", x: [90.59136771300453, 120.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 41.60000000000001, scale: [0.9, 1.55] }, { category: "legs", x: [-66.02649289985055, -36.02649289985054], y: [-274.09527092675626, -244.09527092675626], zDepth: 0, scale: [0.3, 0.65] }, { category: "legs", x: [30.316010837070188, 60.316010837070195], y: [-280.5940097159941, -250.5940097159941], zDepth: 0, scale: [0.3, 0.65] }, { category: "arms", x: [81.10814461883409, 111.10814461883409], y: [-196.34064275037375, -166.34064275037375], zDepth: 0, scale: [0.4, 0.7] }, { category: "arms", x: [-110.92713751868456, -80.92713751868456], y: [-196.15379671150976, -166.15379671150976], zDepth: 0, scale: [0.4, 0.7], flip: !0 }, { category: "paint", x: [-14.102905455904276, 15.897094544095726], y: [-79.20444423588805, -49.20444423588804], zDepth: 17.600000000000005, scale: [1, 1], opacity: [0.4, 0.75], rotation: [0, 360] }, { category: "nose", x: [-11.598467862481384, -11.598467862481384], y: [-152.02041292974576, -151.0204129297459], zDepth: 32, scale: [0.4, 0.4] }, { category: "brows", x: [-107.31385463378177, -107.31385463378177], y: [-12.42560105896429, -12.42560105896429], zDepth: 49.60000000000001, scale: [0.35, 0.7] }, { category: "brows", x: [107.31385463378177, 107.31385463378177], y: [-12.42560105896429, -12.42560105896429], zDepth: 49.60000000000001, scale: [0.35, 0.7], flip: !0 }, { category: "spec", x: [-147.5903614457832, -147.5903614457832], y: [-49.41473146229495, -49.41473146229495], zDepth: 57.60000000000001, scale: [1, 1] }, { category: "spec", x: [63.02657074157142, 63.02657074157142], y: [-54.61796932862072, -54.61796932862072], zDepth: 57.60000000000001, scale: [1, 1] }, { category: "shadow", x: [-20.760777484939762, -20.760777484939762], y: [-415.0590643825301, -415.0590643825301], zDepth: 9, scale: [0.5, 0.5] }], bodyZDepth: 16.000000000000007, compatibleGradients: ["grad-c1fdff-53a0ff", "grad-fecdfa-53a0ff", "grad-ffd877-53a0ff"] },
  "body-blobb": { slots: [{ category: "sclera", x: [-139.37523355754854, -109.37523355754854], y: [130.75158819133037, 160.75158819133037], zDepth: 25.200000000000003, scale: [0.9, 1.5] }, { category: "sclera", x: [30.134529147982093, 60.13452914798209], y: [124.92479446935727, 154.92479446935727], zDepth: 25.200000000000003, scale: [0.9, 1.5] }, { category: "mouth", x: [-58.932174887892415, -28.932174887892415], y: [11.199318011958134, 41.199318011958134], zDepth: 25.200000000000003, scale: [0.75, 1.55] }, { category: "arms", x: [234.56129297458887, 264.56129297458887], y: [-58.88618647234672, -28.886186472346722], zDepth: 0, scale: [0.7, 0.7] }, { category: "arms", x: [-264.56129297458887, -234.56129297458887], y: [-58.88618647234672, -28.886186472346722], zDepth: 0, scale: [0.7, 0.7], flip: !0 }, { category: "legs", x: [-201.4256483557549, -171.4256483557549], y: [-178.5382324364724, -148.5382324364724], zDepth: 0, scale: [0.7, 0.7] }, { category: "legs", x: [171.4256483557549, 201.4256483557549], y: [-178.5382324364724, -148.5382324364724], zDepth: 0, scale: [0.7, 0.7] }, { category: "pupil", x: [-139.37523355754854, -109.37523355754854], y: [130.75158819133037, 160.75158819133037], zDepth: 36.40000000000001, scale: [0.9, 1.4] }, { category: "pupil", x: [30.134529147982093, 60.13452914798209], y: [125.02195440956652, 155.02195440956652], zDepth: 36.40000000000001, scale: [0.9, 1.4] }, { category: "spec", x: [-180.9192825112108, -150.9192825112108], y: [171.09865470852017, 201.09865470852017], zDepth: 47.59999999999998, scale: [0.5, 0.5] }, { category: "spec", x: [-11.409519805680162, 18.590480194319838], y: [165.27186098654707, 195.27186098654707], zDepth: 47.59999999999998, scale: [0.5, 0.5] }, { category: "paint", x: [15.706978699551595, 45.7069786995516], y: [-26.22827914798208, 3.7717208520179213], zDepth: 15.399999999999999, scale: [1.3, 1.3], rotation: [0, 360], opacity: [0.4, 0.8] }], bodyZDepth: 14.000000000000007 },
  "body-roundbee": { slots: [{ category: "sclera", x: [-106.61318198804184, -106.61318198804184], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 17, scale: [0.85, 2] }, { category: "sclera", x: [106.26284566517188, 106.26284566517188], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 21, scale: [0.85, 2], flip: !0 }, { category: "mouth", x: [-0.17516816143497757, -0.17516816143497757], y: [-131, -131], zDepth: 19, scale: [0.7, 1] }, { category: "arms", x: [158.2753251121076, 158.2753251121076], y: [-67.72073430493273, -67.72073430493273], zDepth: 0, scale: [0.6, 1] }, { category: "arms", x: [-158.62566143497756, -158.62566143497756], y: [-67.72073430493273, -67.72073430493273], zDepth: 0, scale: [0.6, 1], flip: !0 }, { category: "legs", x: [107.50652653213751, 107.50652653213751], y: [-175.89926569506724, -175.89926569506724], zDepth: 0, scale: [0.5, 0.8], rotation: [13, 13] }, { category: "legs", x: [-107.85686285500748, -107.85686285500748], y: [-175.89926569506724, -175.89926569506724], zDepth: 0, scale: [0.5, 0.8], flip: !0, rotation: [13, 13] }, { category: "pupil", x: [-106.61318198804184, -106.61318198804184], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 27, scale: [1, 1.65] }, { category: "pupil", x: [106.26284566517188, 106.26284566517188], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 42, scale: [1, 1.65], flip: !0 }, { category: "ear", x: [107.9140041106129, 107.9140041106129], y: [109.4017656950673, 109.4017656950673], zDepth: 0, scale: [0.7, 1], rotation: [-46, -46] }, { category: "ear", x: [-108.26434043348286, -108.26434043348286], y: [109.4017656950673, 109.4017656950673], zDepth: 0, scale: [0.7, 1], flip: !0, rotation: [-46, -46] }, { category: "spec", x: [-132.68988228699547, -132.68988228699547], y: [25.300121449925236, 25.300121449925236], zDepth: 28, scale: [1, 1] }, { category: "spec", x: [77.6053344544095, 77.6053344544095], y: [28.785967862481236, 28.785967862481236], zDepth: 43, scale: [1, 1] }, { category: "nose", x: [0, 0], y: [-34.02073845425821, -34.02073845425821], zDepth: 30, scale: [0.4, 0.4] }, { category: "horns", x: [3.0362481315396757, 3.0362481315396757], y: [132.3804185351271, 132.3804185351271], zDepth: 23, scale: [1, 1] }, { category: "brows", x: [-110.74715059790736, -110.74715059790736], y: [63.79621001960689, 63.79621001960689], zDepth: 143, scale: [0.7, 0.7] }, { category: "brows", x: [110.3968142750374, 110.3968142750374], y: [63.79621001960689, 63.79621001960689], zDepth: 167.2, scale: [0.7, 0.7], flip: !0 }, { category: "shadow", x: [-4.156626506024096, -4.156626506024096], y: [-390.0914009725475, -390.0914009725475], zDepth: -1, scale: [0.8, 0.8] }], bodyZDepth: 11, compatibleGradients: ["grad-fffbb9-a39400", "grad-fffbb9-f7ed1a", "grad-ecf8c6-f7ed1a", "grad-c1fdff-f7ed1a"] },
  "body-squirc": { slots: [{ category: "sclera", x: [-95, -171], y: [-38.26316388733179, -38.26316388733179], zDepth: 21, scale: [1.45, 2.25] }, { category: "sclera", x: [171, 95], y: [-38.26316388733179, -38.26316388733179], zDepth: 28, scale: [1.45, 2.25], flip: !0 }, { category: "pupil", x: [-143.45099999999985, -243.86669999999984], y: [-38.26316388733179, -38.26316388733179], zDepth: 26, scale: [2.4125849999999973, 1.8909449999999979], rotation: [0, -3] }, { category: "pupil", x: [243.86669999999984, 143.45099999999985], y: [-38.26316388733179, -38.26316388733179], zDepth: 29, scale: [2.4125849999999973, 1.8909449999999979], flip: !0, rotation: [3, 0] }, { category: "mouth", x: [-9.72004127693936, -9.72004127693936], y: [-163, -138], zDepth: 16, scale: [0.6, 0.95] }, { category: "nose", x: [-0.228436799327354, -0.228436799327354], y: [-45.80919282511201, -45.80919282511201], zDepth: 57, scale: [0.25, 0.5] }, { category: "ear", x: [116.86042266811964, 116.86042266811964], y: [161.3002417952277, 161.3002417952277], zDepth: 0, scale: [0.35, 0.95], rotation: [-60, -6], flip: !1 }, { category: "ear", x: [-118.53581305781901, -118.53581305781901], y: [164.15705149672024, 164.15705149672024], zDepth: 0, scale: [0.35, 0.95], flip: !0, rotation: [6, 60] }, { category: "legs", x: [61.99929824503022, 61.99929824503022], y: [-157.40352540796277, -157.40352540796277], zDepth: 0, scale: [0.5216399999999994, 0.95], rotation: [18, 18] }, { category: "legs", x: [-100.76074273920736, -100.76074273920736], y: [-169.95599742288812, -169.95599742288812], zDepth: 0, scale: [0.5216399999999994, 0.95], flip: !0, rotation: [18, 18] }, { category: "arms", x: [169.95634390934313, 169.95634390934313], y: [-116.43087007532114, -116.43087007532114], zDepth: 0, scale: [0.55, 0.8] }, { category: "arms", x: [-158.3271634035204, -158.3271634035204], y: [-128.05633649323153, -128.05633649323153], zDepth: 0, scale: [0.55, 0.8], flip: !0 }, { category: "brows", x: [-147.85608518506112, -147.85608518506112], y: [87.5509371762853, 87.5509371762853], zDepth: 50.6625, scale: [0.45643499999999954, 1.15] }, { category: "brows", x: [196.25277361789696, 97.37217660297168], y: [66.39571307144888, 97.34837165353845], zDepth: 50.6625, scale: [0.45643499999999954, 1.15], flip: !0 }, { category: "spec", x: [-210.02106635497185, -210.02106635497185], y: [11.553053721660934, 11.553053721660934], zDepth: 41.16250000000001, scale: [1.3040999999999991, 1.3040999999999991] }, { category: "spec", x: [156.8438898163851, 156.8438898163851], y: [6.6498354380787426, 6.6498354380787426], zDepth: 33, scale: [1.3040999999999991, 1.3040999999999991] }, { category: "horns", x: [-92.13005555922365, -92.13005555922365], y: [159.68396537438167, 159.68396537438167], zDepth: 24, scale: [0.35, 1.3040999999999991] }, { category: "horns", x: [106.77216837265088, 106.77216837265088], y: [153.15994485199357, 153.15994485199357], zDepth: 24, scale: [0.35, 1.3040999999999991], flip: !0 }, { category: "shadow", x: [15.520250729480404, 15.520250729480404], y: [-513.2300648296306, -513.2300648296306], zDepth: -1, scale: [1.0432799999999989, 1.0432799999999989] }], bodyZDepth: 13.125000000000005, compatibleGradients: ["grad-c1fdff-a39400", "grad-fecdfa-a39400", "grad-fffbb9-a39400", "grad-c1fdff-a9cc8a", "grad-e8d5b5-a9cc8a", "grad-ecf8c6-a9cc8a", "grad-fecdfa-a9cc8a"] },
  "body-egg": { slots: [{ category: "sclera", x: [-114.1570908071749, -114.1570908071749], y: [-25.510323243647235, -25.510323243647235], zDepth: 28.80000000000001, scale: [1.3, 2] }, { category: "sclera", x: [106.2394899103139, 106.2394899103139], y: [-25.39354446935725, -25.39354446935725], zDepth: 28.80000000000001, scale: [1.3, 2], flip: !0 }, { category: "mouth", x: [-6.580483931240657, -6.580483931240657], y: [-169.5160687593423, -169.5160687593423], zDepth: 41.600000000000016, scale: [0.8076923076923077, 0.8076923076923077] }, { category: "arms", x: [99.61150784753362, 99.61150784753362], y: [-140.84176382660686, -140.84176382660686], zDepth: 0, scale: [0.5, 0.75] }, { category: "arms", x: [-99.61150784753362, -99.61150784753362], y: [-140.84176382660686, -140.84176382660686], zDepth: 0, scale: [0.5, 0.75], flip: !0 }, { category: "legs", x: [48.095328849028384, 48.095328849028384], y: [-228.24916853512698, -228.24916853512698], zDepth: 0, scale: [0.5, 0.95], rotation: [15, 15] }, { category: "legs", x: [-48.095328849028384, -48.095328849028384], y: [-228.24916853512698, -228.24916853512698], zDepth: 0, scale: [0.5, 0.95], flip: !0, rotation: [15, 15] }, { category: "paint", x: [0, 0], y: [0, 0], zDepth: 17.600000000000005, scale: [1, 1], rotation: [0, 360], opacity: [0.1, 0.4] }, { category: "nose", x: [-8.670823991031401, -8.670823991031401], y: [-80.93352952167417, -80.93352952167417], zDepth: 36, scale: [0.3, 0.5] }, { category: "pupil", x: [-114.1570908071749, -114.1570908071749], y: [-25.510323243647235, -25.510323243647235], zDepth: 54.40000000000001, scale: [1, 2.2] }, { category: "pupil", x: [106.2394899103139, 106.2394899103139], y: [-25.39354446935725, -25.39354446935725], zDepth: 54.40000000000001, scale: [1, 2.2], flip: !0 }, { category: "brows", x: [-119.72159940209269, -119.72159940209269], y: [85.11138095672618, 85.11138095672618], zDepth: 54.40000000000001, scale: [1, 1] }, { category: "brows", x: [119.72159940209269, 119.72159940209269], y: [85.11138095672618, 85.11138095672618], zDepth: 54.40000000000001, scale: [1, 1], flip: !0 }, { category: "spec", x: [-143.07228915662654, -143.07228915662654], y: [15.709622160263578, 15.709622160263578], zDepth: 62.40000000000001, scale: [1, 1] }, { category: "spec", x: [77.32429156086226, 77.32429156086226], y: [15.826400934553561, 15.826400934553561], zDepth: 62.40000000000001, scale: [1, 1] }, { category: "horns", x: [-0.07647778614459355, -0.07647778614459355], y: [177.3429649411792, 177.3429649411792], zDepth: 33, scale: [1, 1] }], bodyZDepth: 16.000000000000007, compatibleGradients: ["grad-ecf8c6-a9cc8a"] },
  "body-bloba": { slots: [{ category: "ear", x: [49.506276709401696, 49.506276709401696], y: [239.53476673789174, 239.53476673789174], zDepth: 0, scale: [1, 1], rotation: [-35, -103] }, { category: "ear", x: [-81.20143340455843, -81.20143340455843], y: [251.7765758547009, 251.7765758547009], zDepth: 0, scale: [1, 1], flip: !0, rotation: [103, 35] }, { category: "sclera", x: [-105.75253739316241, -105.75253739316241], y: [194.8193541936209, 194.8193541936209], zDepth: 22, scale: [0.95, 1.3], rotation: [12, 0] }, { category: "sclera", x: [35.97422542735045, 35.97422542735045], y: [188.96554365231037, 188.96554365231037], zDepth: 22, scale: [0.95, 1.3], flip: !0, rotation: [0, -12] }, { category: "mouth", x: [-40.336761039886014, -40.336761039886014], y: [101.28080362382036, 101.28080362382036], zDepth: 18, scale: [0.1, 0.6923076923076923] }, { category: "pupil", x: [-105.75253739316241, -105.75253739316241], y: [194.8193541936209, 194.8193541936209], zDepth: 30, scale: [0.5, 1.95], rotation: [3, 0] }, { category: "pupil", x: [35.97422542735045, 35.97422542735045], y: [188.96554365231037, 188.96554365231037], zDepth: 30, scale: [0.5, 1.95], flip: !0, rotation: [0, -3] }, { category: "legs", x: [1.5380039173789095, 1.5380039173789095], y: [-141.06701866962692, -141.06701866962692], zDepth: 0, scale: [0.45, 0.75], rotation: [-15, -15] }, { category: "legs", x: [88.04978098290599, 88.04978098290599], y: [-145.50189224512548, -145.50189224512548], zDepth: 0, scale: [0.45, 0.75], flip: !0, rotation: [-10, -10] }, { category: "arms", x: [215.35075142450148, 215.35075142450148], y: [25.327240589632268, 25.327240589632268], zDepth: 0, scale: [0.4, 1], rotation: [18, 23] }, { category: "arms", x: [-82.56607371794878, -82.56607371794878], y: [-7.219278285011612, -7.219278285011612], zDepth: 0, scale: [0.4, 1], flip: !0, rotation: [-23, -18] }, { category: "brows", x: [-108.74065170940176, -108.74065170940176], y: [272.5548420853588, 272.5548420853588], zDepth: 38, scale: [0.4, 0.4] }, { category: "brows", x: [31.355724715099743, 31.355724715099743], y: [272.6828246352164, 272.6828246352164], zDepth: 38, scale: [0.4, 0.4], flip: !0 }, { category: "paint", x: [36.92018340455848, 36.92018340455848], y: [62.13483674347842, 62.13483674347842], zDepth: 11, scale: [1, 1], rotation: [-180, 180], opacity: [0.15, 0.6], parts: ["paint-cow", "paint-drips", "paint-stripes", "paint-shapes", "paint-dots", "paint-cowpink-copy"] }, { category: "spec", x: [-125.48410790598291, -125.48410790598291], y: [213.60753500998183, 213.60753500998183], zDepth: 31, scale: [1, 1] }, { category: "spec", x: [16.242654914529965, 16.242654914529965], y: [207.7537244686713, 207.7537244686713], zDepth: 31, scale: [1, 1] }, { category: "nose", x: [-39.59112357549859, -39.59112357549859], y: [180.38771663391344, 180.38771663391344], zDepth: 38, scale: [0.1, 0.3], rotation: [3, 0] }, { category: "shadow", x: [49, 36], y: [-313, -256], zDepth: -1, scale: [0.7, 0.7] }], bodyZDepth: 10, compatibleGradients: ["grad-e8d5b5-68412b", "grad-ebc164-68412b", "grad-fffbb9-68412b", "grad-ecf8c6-68412b"] },
  "body-eggnew": { slots: [{ category: "sclera", x: [-131.69079228237734, -132.50818900602405], y: [-76.55713478915663, 82], zDepth: 16, scale: [1.65, 2.25], rotation: [0, -3] }, { category: "sclera", x: [120.18349962349397, 119.36610289984726], y: [-76.55713478915663, 82], zDepth: 14, scale: [1.65, 2.25], flip: !0, rotation: [3, 0] }, { category: "pupil", x: [-131.40544617036517, -131.40544617036517], y: [-78.89490654927408, -78.89490654927408], zDepth: 20, scale: [0.9, 1.9] }, { category: "pupil", x: [119.44846359261834, 119.44846359261834], y: [-79.93832635563624, -79.93832635563624], zDepth: 26, scale: [0.9, 1.9], flip: !0 }, { category: "mouth", x: [-10.09252018758805, -10.09252018758805], y: [-204.27204946924462, -204.27204946924462], zDepth: 13, scale: [1, 1] }, { category: "legs", x: [-78.154228988604, -78.154228988604], y: [-273.29707977207977, -273.29707977207977], zDepth: 0, scale: [0.5, 0.7142857142857143], rotation: [0, -19] }, { category: "legs", x: [78.154228988604, 78.154228988604], y: [-273.29707977207977, -273.29707977207977], zDepth: 0, scale: [0.5, 0.7142857142857143], flip: !0, rotation: [19, 0] }, { category: "arms", x: [142.78038850916488, 142.78038850916488], y: [-199.61390284428325, -199.61390284428325], zDepth: 0, scale: [0.65, 1] }, { category: "arms", x: [-111.93042615976736, -111.93042615976736], y: [-198.22553688042774, -198.22553688042774], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "shadow", x: [-3.4473832831325244, -3.4473832831325244], y: [-397.8284106040383, -397.8284106040383], zDepth: -1, scale: [1, 1] }, { category: "horns", x: [-74.30778133903134, -74.30778133903134], y: [254.29580662393164, 254.29580662393164], zDepth: 20, scale: [0.55, 1] }, { category: "horns", x: [74.30778133903134, 74.30778133903134], y: [254.29580662393164, 254.29580662393164], zDepth: 19, scale: [0.55, 1], flip: !0 }, { category: "spec", x: [-148.1389299183915, -148.1389299183915], y: [-59.778057877879064, -59.778057877879064], zDepth: 21, scale: [1, 1] }, { category: "spec", x: [104.9798988957969, 104.9798988957969], y: [-52.685417819783396, -52.685417819783396], zDepth: 27, scale: [1, 1] }, { category: "nose", x: [-6.371187876506051, -6.371187876506051], y: [-127.73555780045047, -127.73555780045047], zDepth: 25, scale: [0.4, 0.4] }], compatibleGradients: ["grad-ffd877-f1966a", "grad-fecdfa-f1966a", "grad-c1fdff-f1966a", "grad-ecf8c6-f1966a"], bodyZDepth: 10 },
  "body-superdrip": { slots: [{ category: "sclera", x: [-41, -113], y: [-151, -3.1179405120481896], zDepth: 27.973809523809532, scale: [0.8, 1.3] }, { category: "sclera", x: [113, 41], y: [-151, -3.1179405120481896], zDepth: 27.973809523809532, scale: [0.8, 1.3], flip: !0 }, { category: "mouth", x: [2.6120105421686755, 2.6120105421686755], y: [-218, -94.2922628012048], zDepth: 20.223809523809532, scale: [0.6538461538461539, 0.6538461538461539] }, { category: "pupil", x: [-71.10080948795182, -71.10080948795182], y: [-3.1179405120481896, -3.1179405120481896], zDepth: 40.373809523809534, scale: [0.8, 1.35] }, { category: "pupil", x: [71.10080948795182, 71.10080948795182], y: [-3.1179405120481896, -3.1179405120481896], zDepth: 40.373809523809534, scale: [0.8, 1.35], flip: !0 }, { category: "spec", x: [-88.85542168674701, -88.85542168674701], y: [10.542168674698816, 10.542168674698816], zDepth: 41.373809523809534, scale: [1, 1] }, { category: "spec", x: [53.346197289156635, 53.346197289156635], y: [10.542168674698816, 10.542168674698816], zDepth: 41.373809523809534, scale: [1, 1] }, { category: "brows", x: [-68.11229292168679, -68.11229292168679], y: [52.11078689759036, 52.11078689759036], zDepth: 65.17380952380952, scale: [0.35, 0.7] }, { category: "brows", x: [68.11229292168679, 68.11229292168679], y: [52.11078689759036, 52.11078689759036], zDepth: 65.17380952380952, scale: [0.35, 0.7], flip: !0 }, { category: "legs", x: [57.61450677710849, 57.61450677710849], y: [-247.33223644578322, -247.33223644578322], zDepth: 0.0738095238095239, scale: [0.35, 0.5714285714285715] }, { category: "legs", x: [-68.59789344879525, -68.59789344879525], y: [-240.8492733433735, -240.8492733433735], zDepth: 0.0738095238095239, scale: [0.35, 0.5714285714285715], flip: !0 }, { category: "arms", x: [149.28897402108444, 149.28897402108444], y: [-108.93323418674697, -108.93323418674697], zDepth: 0.0738095238095239, scale: [0.35, 0.65] }, { category: "arms", x: [-149.28897402108444, -149.28897402108444], y: [-108.92735128012046, -108.92735128012046], zDepth: 0.0738095238095239, scale: [0.35, 0.65], flip: !0 }, { category: "horns", x: [-62.15879141566257, -62.15879141566257], y: [92.9654179216868, 92.9654179216868], zDepth: 27.973809523809532, scale: [0.25, 0.75] }, { category: "horns", x: [62.15879141566257, 62.15879141566257], y: [92.9654179216868, 92.9654179216868], zDepth: 27.973809523809532, scale: [0.25, 0.75], flip: !0 }, { category: "nose", x: [-2.553181475903652, -2.553181475903652], y: [-187, -72], zDepth: 52.77380952380953, scale: [0.15, 0.3] }, { category: "shadow", x: [-3.923378967377077, -3.923378967377077], y: [-357.3771649096386, -357.3771649096386], zDepth: -0.9261904761904761, scale: [1, 1] }], compatibleGradients: ["grad-c1fdff-53a0ff", "grad-fecdfa-53a0ff", "grad-ffd877-53a0ff", "grad-c1fdff-7c41ad", "grad-fecdfa-7c41ad", "grad-fffbb9-f7ed1a"], bodyZDepth: 10 },
  "body-dill": { slots: [{ category: "sclera", x: [-77.7249623493976, -77.7249623493976], y: [-58, 168.46879706325302], zDepth: 18, scale: [1.1, 1.45] }, { category: "sclera", x: [77.7249623493976, 77.7249623493976], y: [-58, 168.46879706325302], zDepth: 18, scale: [1.1, 1.45], flip: !0 }, { category: "pupil", x: [-76.80722891566265, -76.80722891566265], y: [168.49232868975903, 168.49232868975903], zDepth: 26, scale: [1, 1] }, { category: "pupil", x: [80.5958207831325, 80.5958207831325], y: [170.1924887048193, 170.1924887048193], zDepth: 26, scale: [1, 1] }, { category: "mouth", x: [2.0060711596385543, 2.0060711596385543], y: [-235.78101468373492, 52], zDepth: 18, scale: [1, 1] }, { category: "legs", x: [-87.39914156626507, -87.39914156626507], y: [-263.7573117469879, -263.7573117469879], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "legs", x: [87.39914156626507, 87.39914156626507], y: [-263.7573117469879, -263.7573117469879], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "arms", x: [117.5414815512048, 117.5414815512048], y: [-146.44103915662652, -146.44103915662652], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "arms", x: [-117.5414815512048, -117.5414815512048], y: [-146.44103915662652, -146.44103915662652], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "shadow", x: [0, 0], y: [-412.2905089426753, -412.2905089426753], zDepth: -1, scale: [1, 1] }, { category: "nose", x: [1.029508659638557, 1.029508659638557], y: [-145, 52], zDepth: 26, scale: [0.4, 0.4] }, { category: "spec", x: [-94.87951807228919, -101.04480421686748], y: [188.79241650913204, 187.2275633464814], zDepth: 27, scale: [1, 1] }, { category: "spec", x: [60.57040662650601, 60.57040662650601], y: [187.2275633464814, 187.2275633464814], zDepth: 27, scale: [1, 1] }, { category: "ear", x: [-120.87608245481928, -120.87608245481928], y: [57, 211], zDepth: 0, scale: [0.4, 0.7], rotation: [89, 89] }, { category: "ear", x: [120.87608245481928, 120.87608245481928], y: [57, 211], zDepth: 0, scale: [0.4, 0.7], flip: !0, rotation: [89, 89] }, { category: "horns", x: [0.4588667168674698, 0.4588667168674698], y: [280.1452967802163, 280.1452967802163], zDepth: 34, scale: [0.5, 0.5] }, { category: "brows", x: [-77.12490587349399, -77.12490587349399], y: [246.00368345190304, 246.00368345190304], zDepth: 34, scale: [0.6, 0.6] }, { category: "brows", x: [77.12490587349399, 77.12490587349399], y: [246.00368345190304, 246.00368345190304], zDepth: 34, scale: [0.6, 0.6], flip: !0 }], compatibleGradients: [], bodyZDepth: 10 },
  "body-bloop": { slots: [{ category: "sclera", x: [-100.42121611445783, -100.42121611445783], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1.6666666666666667, 1.6666666666666667] }, { category: "sclera", x: [103.25677710843375, 103.25677710843375], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1.6666666666666667, 1.6666666666666667], flip: !0 }, { category: "pupil", x: [-100.42121611445783, -100.42121611445783], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1, 1] }, { category: "pupil", x: [103.25677710843375, 103.25677710843375], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1, 1], flip: !0 }, { category: "mouth", x: [-3.87683546686747, -3.87683546686747], y: [-105.55111069277115, -105.55111069277115], zDepth: 10, scale: [1, 1] }, { category: "legs", x: [172.20176204819276, 172.20176204819276], y: [-91.75877070783133, -91.75877070783133], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "legs", x: [-169.36620105421687, -169.36620105421687], y: [-91.75877070783133, -91.75877070783133], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "arms", x: [193.51922063253014, 193.51922063253014], y: [-44.57262801204817, -44.57262801204817], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "arms", x: [-190.68365963855425, -190.68365963855425], y: [-44.57262801204817, -44.57262801204817], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "shadow", x: [7327471962526033e-30, 7327471962526033e-30], y: [-240.10371489147047, -240.10371489147047], zDepth: -1, scale: [1, 1] }, { category: "brows", x: [-102.59789156626505, -102.59789156626505], y: [141.2132906626506, 141.2132906626506], zDepth: 18, scale: [1, 1] }, { category: "brows", x: [105.43345256024097, 105.43345256024097], y: [141.2132906626506, 141.2132906626506], zDepth: 18, scale: [1, 1], flip: !0 }, { category: "ear", x: [135.57746611445785, 135.57746611445785], y: [73.220265436747, 73.220265436747], zDepth: -1, scale: [1, 1], rotation: [-42, -42] }, { category: "ear", x: [-132.74190512048196, -132.74190512048196], y: [73.220265436747, 73.220265436747], zDepth: -1, scale: [1, 1], flip: !0, rotation: [-42, -42] }] },
  "body-proof": { slots: [{ category: "sclera", x: [-119.67008659638556, -119.67008659638556], y: [38.0859375, 38.0859375], zDepth: 29, scale: [1.4, 2.166666666666667] }, { category: "arms", x: [233.7230045180723, 233.7230045180723], y: [-35.47765436746985, -35.47765436746985], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "legs", x: [160.10650602409638, 160.10650602409638], y: [-120.64384224397591, -120.64384224397591], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "sclera", x: [127.78849774096388, 127.78849774096388], y: [38.0859375, 38.0859375], zDepth: 29, scale: [1.4, 2.166666666666667], flip: !0 }, { category: "pupil", x: [-115.8108998493976, -115.8108998493976], y: [38.04475715361447, 38.04475715361447], zDepth: 37, scale: [1, 1] }, { category: "pupil", x: [123.92931099397592, 123.92931099397592], y: [38.04475715361447, 38.04475715361447], zDepth: 37, scale: [1, 1], flip: !0 }, { category: "spec", x: [-139.01308358433738, -139.01308358433738], y: [49.516425075301214, 49.516425075301214], zDepth: 45, scale: [1, 1] }, { category: "spec", x: [108.44550075301206, 108.44550075301206], y: [49.516425075301214, 49.516425075301214], zDepth: 45, scale: [1, 1] }, { category: "mouth", x: [1.229527484939759, 1.229527484939759], y: [-110.5751129518072, -110.5751129518072], zDepth: 37, scale: [1, 1] }, { category: "arms", x: [-225.60459337349397, -225.60459337349397], y: [-35.47765436746985, -35.47765436746985], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "legs", x: [-151.98809487951806, -151.98809487951806], y: [-120.64384224397591, -120.64384224397591], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "shadow", x: [-17763568394002505e-31, -17763568394002505e-31], y: [-268.9887864276151, -268.9887864276151], zDepth: -1, scale: [1, 1] }, { category: "brows", x: [-112.79296875000001, -112.79296875000001], y: [197.20091302710844, 197.20091302710844], zDepth: 45, scale: [0.65, 1], rotation: [-5, 7] }, { category: "brows", x: [120.91137989457833, 120.91137989457833], y: [197.20091302710844, 197.20091302710844], zDepth: 45, scale: [0.65, 1], flip: !0, rotation: [-7, 5] }, { category: "ear", x: [175.7871329066265, 175.7871329066265], y: [73.14967055722893, 73.14967055722893], zDepth: -1, scale: [0.55, 1], rotation: [-36, -36] }, { category: "ear", x: [-167.6687217620482, -167.6687217620482], y: [73.14967055722893, 73.14967055722893], zDepth: -1, scale: [0.55, 1], flip: !0, rotation: [-36, -36] }, { category: "nose", x: [1.294239457831325, 1.294239457831325], y: [-29.996940888554207, -29.996940888554207], zDepth: 45, scale: [0.4, 0.4] }], compatibleGradients: ["grad-e8d5b5-68412b", "grad-ecf8c6-68412b", "grad-fffbb9-68412b"], bodyZDepth: 0 },
  "body-derp-copy": { slots: [{ category: "sclera", x: [-92.54400414156626, -92.54400414156626], y: [-5, 30.755835843373493], zDepth: 18, scale: [0.95, 1.6666666666666667], linked: !1 }, { category: "sclera", x: [129.61219879518075, 129.61219879518075], y: [68.0652296686747, 68.0652296686747], zDepth: 18, scale: [1.6666666666666667, 1.6666666666666667], flip: !0, linked: !1 }, { category: "mouth", x: [-68, 81], y: [-92.06944967369482, -92.06944967369482], zDepth: 26, scale: [0.6, 1] }, { category: "pupil", x: [-89.85551581325302, -89.85551581325302], y: [28.090879141566266, 28.090879141566266], zDepth: 34, scale: [0.5, 1.75], linked: !1 }, { category: "pupil", x: [130.41227409638557, 130.41227409638557], y: [66.00621234939759, 66.00621234939759], zDepth: 34, scale: [1, 2.05], flip: !0, linked: !1 }, { category: "arms", x: [177.8993298192771, 177.8993298192771], y: [-32.12118222891567, -32.12118222891567], zDepth: 0, scale: [0.45, 1], linked: !1 }, { category: "legs", x: [-89.85298381024097, -89.85298381024097], y: [-146.29702560240966, -146.29702560240966], zDepth: 0, scale: [0.4, 0.7142857142857143], linked: !0 }, { category: "legs", x: [174.06090926204823, 174.06090926204823], y: [-134.14294051204823, -134.14294051204823], zDepth: 0, scale: [0.4, 0.7142857142857143], flip: !0, linked: !0 }, { category: "arms", x: [-164.13921121987954, -164.13921121987954], y: [-59.447283509036154, -59.447283509036154], zDepth: 0, scale: [0.4, 1], flip: !0, linked: !1 }, { category: "ear", x: [131.1241057981928, 131.1241057981928], y: [128.56665097891565, 128.56665097891565], zDepth: 0, scale: [0.75, 1], rotation: [-47, -47], linked: !1 }, { category: "ear", x: [-95.85608057228917, -95.85608057228917], y: [114.82418109939758, 114.82418109939758], zDepth: 0, scale: [0.75, 1], flip: !0, rotation: [-47, -47], linked: !1 }, { category: "brows", x: [-115.40497929216868, -115.40497929216868], y: [151.04951054216866, 151.04951054216866], zDepth: 42, scale: [0.7, 0.7], rotation: [11, 11], linked: !0 }, { category: "brows", x: [145.1901355421687, 145.1901355421687], y: [191.85923381024094, 191.85923381024094], zDepth: 42, scale: [0.7, 0.7], flip: !0, rotation: [8, 8], linked: !0 }, { category: "shadow", x: [-0.17648719879518487, -0.17648719879518487], y: [-331.7282058319586, -331.7282058319586], zDepth: -1, scale: [1, 1] }, { category: "horns", x: [9.400884789156628, 9.400884789156628], y: [175.59916615599323, 175.59916615599323], zDepth: 23, scale: [1, 1], linked: !1 }, { category: "horns", x: [148.79941641566265, 148.79941641566265], y: [-61.87330184099474, -61.87330184099474], zDepth: 6, scale: [0.4, 1], rotation: [-126, -126], linked: !1 }, { category: "horns", x: [-151.7644013554217, -151.7644013554217], y: [-120.3348511632839, -120.3348511632839], zDepth: 23, scale: [0.15, 0.65], flip: !0, rotation: [-137, -137], linked: !1 }, { category: "spec", x: [-123.82341867469887, -123.82341867469887], y: [51.29301969514982, 51.29301969514982], zDepth: 35, scale: [1, 1] }, { category: "spec", x: [98.33278426204814, 98.33278426204814], y: [88.60241352045104, 88.60241352045104], zDepth: 35, scale: [1, 1] }], bodyZDepth: 10 },
  "body-cloud": { slots: [{ category: "mouth", x: [8.912603539156626, 8.912603539156626], y: [-195.53605045180723, -195.53605045180723], zDepth: 18, scale: [1, 1] }, { category: "sclera", x: [-179.39923757530124, -179.39923757530124], y: [-33.77376694277108, -33.77376694277108], zDepth: 26, scale: [1.75, 3] }, { category: "sclera", x: [179.7639777861446, 179.7639777861446], y: [-33.77376694277108, -33.77376694277108], zDepth: 26, scale: [1.75, 3], flip: !0 }, { category: "pupil", x: [-179.39923757530124, -179.39923757530124], y: [-33.77376694277108, -33.77376694277108], zDepth: 34, scale: [1, 1] }, { category: "pupil", x: [179.7639777861446, 179.7639777861446], y: [-33.77376694277108, -33.77376694277108], zDepth: 34, scale: [1, 1], flip: !0 }, { category: "arms", x: [186.03538968373493, 186.03538968373493], y: [-192.27154932228913, -192.27154932228913], zDepth: 0, scale: [0.5, 1] }, { category: "arms", x: [-185.67064947289157, -185.67064947289157], y: [-192.27154932228913, -192.27154932228913], zDepth: 0, scale: [0.5, 1], flip: !0 }, { category: "legs", x: [-98.57867469879518, -98.57867469879518], y: [-228.6945538403615, -228.6945538403615], zDepth: 0, scale: [0.5, 0.75] }, { category: "legs", x: [98.94341490963855, 98.94341490963855], y: [-228.6945538403615, -228.6945538403615], zDepth: 0, scale: [0.5, 0.75], flip: !0 }, { category: "shadow", x: [-0.18824109111923767, -0.18824109111923767], y: [-476.4029689629348, -476.4029689629348], zDepth: -1, scale: [1, 1] }, { category: "ear", x: [231.16881588855424, 231.16881588855424], y: [17.444427710843396, 17.444427710843396], zDepth: -1, scale: [0.45, 1], rotation: [-53, -53] }, { category: "ear", x: [-230.80407567771087, -230.80407567771087], y: [17.444427710843396, 17.444427710843396], zDepth: -1, scale: [0.45, 1], flip: !0, rotation: [-53, -53] }, { category: "brows", x: [-175.8518448795181, -175.8518448795181], y: [163.9507247740964, 163.9507247740964], zDepth: 34, scale: [0.6, 1] }, { category: "brows", x: [176.21658509036146, 176.21658509036146], y: [163.9507247740964, 163.9507247740964], zDepth: 34, scale: [0.6, 1], flip: !0 }, { category: "nose", x: [-4.323936370481928, -4.323936370481928], y: [-96.03256777108433, -96.03256777108433], zDepth: 44, scale: [0.4, 0.4] }, { category: "spec", x: [-196.50084713855426, -196.50084713855426], y: [-9.912697665662694, -9.912697665662694], zDepth: 35, scale: [1, 1] }, { category: "spec", x: [162.6623682228916, 162.6623682228916], y: [-9.912697665662694, -9.912697665662694], zDepth: 35, scale: [1, 1] }, { category: "horns", x: [18.478209713855428, 18.478209713855428], y: [173.33349294327604, 173.33349294327604], zDepth: 26, scale: [1.4, 1.4], flip: !0 }], bodyZDepth: 10 }
}, ue = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Je
}, Symbol.toStringTag, { value: "Module" })), be = /* @__PURE__ */ Object.assign({ "/public/body-configs.json": ue }), Te = Object.values(be)[0]?.default ?? {}, Ne = Object.fromEntries(
  Object.entries(Te).filter(([l]) => !l.startsWith("_"))
), Oe = [
  "#F7E7CE",
  // champagne cream
  "#E8D2A0",
  // light champagne
  "#D4B775",
  // bronze
  "#8B6914",
  // dark gold
  "#5C5C5C",
  // gray
  "#3A3A3A",
  // carbon
  "#1C1C1C",
  // dark carbon
  "#FFFFFF"
  // accent
];
let Ye = 1;
function NA() {
  return `rand-${Ye++}-${Date.now()}`;
}
function CA(l, A) {
  return l + Math.random() * (A - l);
}
function pA(l) {
  return l.length === 0 ? null : l[Math.floor(Math.random() * l.length)];
}
let Le = 4;
function fe(l, A, i, s, e) {
  const t = e?.matchPairs ?? !0, a = e?.bodyConfigs ?? Ne, I = e?.partManifest ?? hA, c = e?.gradientManifest ?? Be, g = s?.filter((w) => w.category === "body"), r = /* @__PURE__ */ new Map();
  for (const w of s ?? []) r.set(w.id, w);
  const o = 0, n = 0, m = (w) => !!I.find((N) => N.id === w) || !!g?.find((N) => N.id === w);
  let y = null;
  if (l && a[l] && m(l))
    y = l;
  else {
    const w = Object.keys(a).filter(m);
    if (w.length === 0)
      return console.warn("[randomize] No bodies configured in body-configs.json"), [];
    y = pA(w);
  }
  const M = a[y];
  let d = I.find((w) => w.id === y) ?? null;
  if (!d) {
    const w = g?.find((N) => N.id === y);
    w && (d = {
      id: w.id,
      category: w.category || "body",
      label: w.name,
      glbPath: "",
      defaultZDepth: 10,
      defaultScale: 1
    });
  }
  if (!d)
    return console.warn(`[randomize] Body "${y}" not found in PART_MANIFEST or custom bodies`), [];
  const z = M.colorPalette && M.colorPalette.length > 0 ? M.colorPalette : Oe, J = [], p = pA(z) ?? void 0;
  let u = null;
  if (!u && c.length > 0) {
    let w = c;
    if (M.compatibleGradients && M.compatibleGradients.length > 0) {
      const F = new Set(M.compatibleGradients), R = c.filter((iA) => F.has(iA.id));
      R.length > 0 && (w = R);
    }
    const N = pA(w), W = r.get(y)?.layers.find((F) => !!F.gradient)?.gradient;
    u = {
      startColor: N.startHex,
      endColor: N.endHex,
      angle: W?.angle ?? 0,
      centerX: W?.centerX ?? 0.5,
      centerY: W?.centerY ?? 0.5,
      projectionAxis: W?.projectionAxis ?? "XZ"
    };
  }
  const T = t0(d.id, 1), h = I0(d.id, 1), Y = WA(d.id, 0), U = SA(d.id, 0);
  J.push({
    instanceId: NA(),
    partId: d.id,
    label: d.label,
    position: { x: o, y: n },
    zDepth: M.bodyZDepth ?? d.defaultZDepth,
    scale: EA(d.id, 1),
    ...T !== 1 ? { scaleX: T } : {},
    ...h !== 1 ? { scaleY: h } : {},
    rotation: xA(d.id, 0),
    pivotOffsetX: Y,
    pivotOffsetY: U,
    color: p,
    ...u ? { gradient: u } : {}
  });
  const b = (w) => {
    const N = (g ?? []).filter((R) => (R.category || "eye") === w.category).map((R) => ({ id: R.id, category: R.category || "eye", label: R.name, glbPath: "", defaultZDepth: 10, defaultScale: 1 }));
    let F = [...I.filter((R) => R.category === w.category), ...N];
    if (M.compatibleParts && M.compatibleParts.length > 0) {
      const R = new Set(M.compatibleParts);
      F = F.filter((iA) => R.has(iA.id));
    }
    if (w.parts && w.parts.length > 0) {
      const R = new Set(w.parts);
      F = F.filter((iA) => R.has(iA.id));
    }
    return F;
  }, O = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), $ = /* @__PURE__ */ new Map(), sA = /* @__PURE__ */ new Map(), eA = /* @__PURE__ */ new Map(), q = (w, N) => w[0] === N[0] && w[1] === N[1], tA = (w, N) => w[0] === -N[1] && w[1] === -N[0];
  p && (v.set("arms", p), v.set("legs", p));
  const IA = (w) => w.parts && w.parts.length > 0 ? `${w.category}:${[...w.parts].sort().join(",")}` : w.category, C = (() => {
    let w = I.filter((N) => N.category === "pupil");
    if (M.compatibleParts && M.compatibleParts.length > 0) {
      const N = new Set(M.compatibleParts);
      w = w.filter((W) => N.has(W.id));
    }
    return w;
  })(), P = C.find((w) => /(^|-)pupil-round(-|$|\.)/i.test(w.id)) ?? C.find((w) => /round/i.test(w.id)) ?? C[0] ?? null, j = (w, N, W, F) => {
    if (!P) return;
    const R = WA(P.id, 0), iA = SA(P.id, 0), AA = EA(P.id, 1), oA = F ? -AA : AA, PA = w - R * oA, wA = N - iA * AA;
    J.push({
      instanceId: NA(),
      partId: P.id,
      label: P.label,
      position: { x: PA, y: wA },
      zDepth: W + 2,
      scale: AA,
      ...F ? { scaleX: -1 } : {},
      rotation: xA(P.id, 0),
      pivotOffsetX: R,
      pivotOffsetY: iA
    });
  }, Z = M.slots.some((w) => w.category === "pupil"), B = [], V = /* @__PURE__ */ new Set(["body", "arms", "legs", "sclera", "pupil", "eyelid", "spec", "mouth", "shadow"]), Q = /* @__PURE__ */ new Map();
  for (const w of M.slots)
    V.has(w.category) || Q.has(w.category) || Q.set(w.category, Math.random() <= 0.5);
  for (const w of M.slots) {
    if (w.category === "pupil" && !Z || !V.has(w.category) && Q.get(w.category) === !1) continue;
    let N = O.get(IA(w));
    if (!N) {
      const f = b(w);
      let k = null;
      if (w.category === "mouth" ? k = f.find((S) => /(^|-)mouth-flat(-|$|\.)/i.test(S.id)) ?? f.find((S) => /flat/i.test(S.id)) ?? f[0] ?? null : w.category === "pupil" ? k = f.find((S) => /(^|-)pupil-round(-|$|\.)/i.test(S.id)) ?? f.find((S) => /round/i.test(S.id)) ?? f[0] ?? null : k = pA(f), !k) continue;
      N = k, O.set(IA(w), N);
    }
    const W = t && w.linked !== !1;
    let F, R;
    if (w.category === "pupil" && B.length > 0) {
      const f = (w.x[0] + w.x[1]) / 2 + o, k = (w.y[0] + w.y[1]) / 2 + n;
      let S = B[0], e0 = 1 / 0;
      for (const XA of B) {
        const i0 = (XA.x - f) ** 2 + (XA.y - k) ** 2;
        i0 < e0 && (e0 = i0, S = XA);
      }
      F = S.x, R = S.y;
    } else {
      const f = W ? eA.get(w.category) : void 0;
      let k, S;
      f ? (k = q(w.x, f.xRange) ? f.xVal : tA(w.x, f.xRange) ? -f.xVal : CA(w.x[0], w.x[1]), S = q(w.y, f.yRange) ? f.yVal : tA(w.y, f.yRange) ? -f.yVal : CA(w.y[0], w.y[1])) : (k = CA(w.x[0], w.x[1]), S = CA(w.y[0], w.y[1]), W && eA.set(w.category, { xRange: w.x, xVal: k, yRange: w.y, yVal: S })), F = k + o, R = S + n;
    }
    const iA = ["arms", "ear"];
    let AA = w.zDepth ?? (iA.includes(w.category) ? 0 : N.defaultZDepth);
    const oA = M.bodyZDepth ?? d.defaultZDepth;
    (/feet|foot/i.test(N.id) || /feet|foot/i.test(N.label)) && AA <= oA && (AA = oA + 5), w.category === "paint" && (AA = oA + 1);
    const wA = EA(N.id, 1), dA = xA(N.id, 0), qA = W;
    let lA;
    if (w.scale) {
      let f = qA ? $.get(w.category) : void 0;
      f === void 0 && (f = Math.random(), qA && $.set(w.category, f)), lA = wA * (w.scale[0] + (w.scale[1] - w.scale[0]) * f);
    } else
      lA = wA;
    const Z0 = (w.x[0] + w.x[1]) / 2, _A = w.flip !== void 0 ? !!w.flip : w.category === "arms" && Z0 < 0;
    let mA;
    if (w.rotation) {
      const f = W ? sA.get(w.category) : void 0, k = !!f && (q(w.rotation, f.range) || tA(w.rotation, f.range));
      let S;
      f && k ? S = _A === f.flip ? -f.value : f.value : (S = CA(w.rotation[0], w.rotation[1]), t && !f && sA.set(w.category, { range: w.rotation, value: S, flip: _A })), mA = dA + S;
    } else
      mA = dA;
    const B0 = ["sclera", "pupil", "eyelid", "spec", "mouth", "shadow"].includes(w.category), J0 = ["sclera", "pupil", "spec", "mouth", "brows", "shadow"].includes(w.category);
    let fA, yA;
    if (!B0) {
      const f = w.category;
      let k = v.get(f);
      k || (k = pA(z) ?? void 0, k && v.set(f, k)), fA = k;
    }
    if (u && !J0) {
      const f = r.get(N.id)?.layers.find((k) => !!k.gradient)?.gradient?.angle;
      yA = {
        ...u,
        angle: f ?? u.angle
      };
    }
    const zA = WA(N.id, 0), VA = SA(N.id, 0), UA = t0(N.id, 1), ZA = I0(N.id, 1), u0 = (w.x[0] + w.x[1]) / 2, BA = w.flip !== void 0 ? !!w.flip : w.category === "arms" && u0 < 0, $A = BA ? -UA : UA, b0 = BA ? -lA : lA, T0 = BA ? -mA : mA, N0 = F - zA * b0, A0 = R - VA * lA;
    if (J.push({
      instanceId: NA(),
      partId: N.id,
      label: N.label,
      position: { x: N0, y: A0 },
      zDepth: AA,
      scale: lA,
      ...$A !== 1 ? { scaleX: $A } : BA ? { scaleX: -1 } : {},
      ...ZA !== 1 ? { scaleY: ZA } : {},
      rotation: T0,
      pivotOffsetX: zA,
      pivotOffsetY: VA,
      color: fA,
      ...yA ? { gradient: yA } : {},
      ...w.category === "mouth" || w.category === "paint" ? { castShadow: !1 } : {},
      ...w.opacity ? { opacity: CA(w.opacity[0], w.opacity[1]) } : {}
    }), w.category === "sclera" && B.push({ x: F, y: R, z: AA }), w.category === "sclera" && !Z && j(F, R, AA, !1), w.mirror) {
      const f = -((w.x[0] + w.x[1]) / 2);
      if (M.slots.some(
        (S) => S !== w && S.category === w.category && Math.min(S.x[0], S.x[1]) <= f && Math.max(S.x[0], S.x[1]) >= f
      )) continue;
    }
    if (w.mirror) {
      const f = F - o, k = o - f, S = k - zA * -lA;
      J.push({
        instanceId: NA(),
        partId: N.id,
        label: N.label,
        position: { x: S, y: A0 },
        zDepth: AA,
        scale: lA,
        scaleX: -UA,
        ...ZA !== 1 ? { scaleY: ZA } : {},
        rotation: -mA,
        pivotOffsetX: zA,
        pivotOffsetY: VA,
        color: fA,
        ...yA ? { gradient: yA } : {}
      }), w.category === "sclera" && B.push({ x: k, y: R, z: AA }), w.category === "sclera" && !Z && j(k, R, AA, !0);
    }
  }
  const X = (w) => I.find((N) => N.id === w.partId)?.category ?? r.get(w.partId)?.category, L = (w) => ({
    x: w.position.x + (w.pivotOffsetX ?? 0) * w.scale * (w.scaleX ?? 1),
    y: w.position.y + (w.pivotOffsetY ?? 0) * w.scale * (w.scaleY ?? 1)
  }), E = J.filter((w) => X(w) === "spec"), x = J.filter((w) => X(w) === "pupil");
  if (E.length > 0 && x.length > 0)
    for (const w of E) {
      const N = L(w);
      let W = x[0], F = 1 / 0;
      for (const PA of x) {
        const wA = L(PA), dA = (wA.x - N.x) ** 2 + (wA.y - N.y) ** 2;
        dA < F && (F = dA, W = PA);
      }
      const R = L(W), iA = W.scale * Le, AA = R.x - iA, oA = R.y + iA;
      w.position.x = AA - (w.pivotOffsetX ?? 0) * w.scale * (w.scaleX ?? 1), w.position.y = oA - (w.pivotOffsetY ?? 0) * w.scale * (w.scaleY ?? 1), w.zDepth = W.zDepth + 1;
    }
  const H = B.length > 0 ? B.reduce((w, N) => w + N.y, 0) / B.length : null, K = (w, N) => {
    for (const W of J) {
      if (X(W) !== w) continue;
      const F = L(W).y;
      F > N && (W.position.y -= F - N);
    }
  };
  H !== null && K("nose", H);
  const _ = J.filter((w) => X(w) === "nose").map((w) => L(w).y), MA = [];
  H !== null && MA.push(H), _.length > 0 && MA.push(Math.min(..._)), MA.length > 0 && K("mouth", Math.min(...MA));
  const LA = (w) => {
    const N = I.find((F) => F.id === w.partId);
    return N ? N.category === "shadow" : r.get(w.partId)?.category === "shadow";
  }, QA = J.filter(LA);
  if (QA.length > 0) {
    const w = J.filter((W) => !LA(W)).map((W) => W.zDepth), N = w.length > 0 ? Math.min(...w) : 0;
    for (const W of QA) W.zDepth = N - 1;
  }
  return J;
}
class Ve {
  queue = [];
  builtFrom = "";
  // signature of the pool the current queue was shuffled from
  last = null;
  // most recently dealt item, to avoid back-to-back repeats
  keyOf;
  /** keyOf maps an item to a stable string id (defaults to String()). Used to
   *  detect pool changes and compare items. */
  constructor(A = (i) => String(i)) {
    this.keyOf = A;
  }
  /**
   * Deal the next item from `pool`. Reshuffles when the deck empties or when the
   * pool's membership changes. Avoids returning `avoid` (or, if omitted, the
   * last dealt item) when an alternative is available — so the same item never
   * comes up twice in a row, even across a reshuffle.
   */
  next(A, i) {
    if (A.length === 0)
      return this.last = null, null;
    if (A.length === 1)
      return this.last = A[0], A[0];
    const s = A.map(this.keyOf).slice().sort().join("|");
    if (this.queue.length === 0 || s !== this.builtFrom) {
      this.queue = [...A];
      for (let I = this.queue.length - 1; I > 0; I--) {
        const c = Math.floor(Math.random() * (I + 1));
        [this.queue[I], this.queue[c]] = [this.queue[c], this.queue[I]];
      }
      this.builtFrom = s;
    }
    const e = i !== void 0 ? i : this.last, t = this.queue.length - 1;
    if (t > 0 && e != null && this.keyOf(this.queue[t]) === this.keyOf(e)) {
      const I = Math.floor(Math.random() * t);
      [this.queue[t], this.queue[I]] = [this.queue[I], this.queue[t]];
    }
    const a = this.queue.pop();
    return this.last = a, a;
  }
  /** Forget the current deck so the next call reshuffles from scratch. */
  reset() {
    this.queue = [], this.last = null, this.builtFrom = "";
  }
}
const Ue = {
  "body-ball": { slots: [{ category: "sclera", x: [-151.7021746817539, -121.70217468175389], y: [41.206904172560115, 71.20690417256012], zDepth: 18 }, { category: "sclera", x: [129.5146746817539, 159.5146746817539], y: [38.64325495049505, 68.64325495049505], zDepth: 18 }, { category: "mouth", x: [-20.287526520509168, 9.712473479490832], y: [-125.70655056577083, -95.70655056577083], zDepth: 26 }, { category: "ear", x: [-148.8177599009901, -118.8177599009901], y: [182.64228253182455, 212.64228253182455], zDepth: 0 }, { category: "ear", x: [118.8177599009901, 148.8177599009901], y: [182.64228253182455, 212.64228253182455], zDepth: 0 }, { category: "arms", x: [-265.83590876944834, -235.83590876944837], y: [-78.14091230551627, -48.14091230551627], zDepth: 0, scale: [0.5, 1] }, { category: "arms", x: [235.83590876944837, 265.83590876944834], y: [-78.14091230551627, -48.14091230551627], zDepth: 0, scale: [0.45, 1] }, { category: "legs", x: [-119.04327263083451, -89.04327263083451], y: [-221.09237977369168, -191.09237977369168], zDepth: 0, scale: [0.3, 1] }, { category: "legs", x: [89.04327263083451, 119.04327263083451], y: [-221.09237977369168, -191.09237977369168], zDepth: 0, scale: [0.3, 1] }] },
  "body-round": { slots: [{ category: "spec", x: [-6.000000000000003, 6.000000000000003], y: [-6.000000000000003, 6.000000000000003], zDepth: 29 }, { category: "sclera", x: [-59.575848656294234, -47.57584865629423], y: [30.72869519094768, 42.72869519094768], zDepth: 37 }, { category: "sclera", x: [46.28960396039605, 58.28960396039606], y: [31.444748939179636, 43.44474893917965], zDepth: 37 }, { category: "mouth", x: [-6.413277934936366, 5.58672206506364], y: [-41.85130834512021, -29.851308345120206], zDepth: 30 }, { category: "arms", x: [72.6715954622048, 84.67159546220479], y: [-14.850200994538893, -2.8502009945388895], zDepth: 0, scale: [0.65, 1.1] }, { category: "ear", x: [-44.65505691536483, -32.65505691536483], y: [64.23694747485641, 76.23694747485641], zDepth: 0, scale: [0.6, 1] }, { category: "ear", x: [49.8319824074016, 61.831982407401576], y: [59.4536360239163, 71.45363602391629], zDepth: 0, flip: !0, scale: [0.65, 1] }, { category: "legs", x: [-47.55922668009355, -35.55922668009354], y: [-73.00718819969163, -61.00718819969163], zDepth: 0, scale: [0.65, 1.1] }, { category: "legs", x: [10.69882535513995, 22.698825355139956], y: [-80.50548230514178, -68.50548230514178], zDepth: 0, scale: [0.7, 1.1] }, { category: "arms", x: [-85.10753635510471, -74.59047482752342], y: [-15.538092457597783, -2.923700661275298], zDepth: 0, scale: [0.7, 1.05], mirror: !1, flip: !0 }, { category: "spec", x: [-79.1157620887009, -67.1157620887009], y: [62.274715946189595, 74.27471594618959], zDepth: 47 }, { category: "spec", x: [24.721304034198294, 36.7213040341983], y: [62.21253297575135, 74.21253297575134], zDepth: 47 }] },
  "body-circ": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 34, scale: [0.5, 1.7] }, { category: "sclera", x: [96.40738742526162, 120.63238742526157], y: [44.88539798206276, 69.11039798206278], zDepth: 32, scale: [0.5, 1.7] }, { category: "mouth", x: [-9.152251494768272, 15.072748505231726], y: [-72.99728606128548, -48.77228606128548], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "ear", x: [-115.86405773542613, -91.63905773542614], y: [158.800754671151, 183.02575467115096], zDepth: 0, scale: [0.475, 0.95] }, { category: "ear", x: [100.35659323617341, 124.5815932361734], y: [159.31458127802685, 183.53958127802682], zDepth: 0, scale: [0.4275, 0.8074999999999999], flip: !0 }, { category: "legs", x: [-88.22138983557545, -63.99638983557546], y: [-122.63195304559028, -98.40695304559029], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [55.19127025411069, 79.41627025411069], y: [-127.01699602017935, -102.79199602017935], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [126.42469854260096, 150.649698542601], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.45, 0.8], mirror: !1, flip: !1 }, { category: "arms", x: [-150.649698542601, -126.42469854260096], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.45, 0.8], mirror: !1, flip: !0 }, { category: "spec", x: [-155.7274009715994, -129.60474588938715], y: [82.77031483557548, 119.65997290732432], zDepth: 124.77999999999999 }, { category: "spec", x: [44.10697169282509, 68.33197169282509], y: [92.83609631913296, 117.06109631913299], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [76.3603984285127, 104.8603984285127], y: [-39.11336505398174, -10.613365053981731], zDepth: 73.39999999999995, scale: [0.25, 0.9024999999999997] }, { category: "pupil", x: [-98.74730490231886, -70.24730490231886], y: [46.693107727246854, 75.19310772724685], zDepth: 73.39999999999995, scale: [0.25, 0.9024999999999997] }] },
  "body-clouda": { slots: [{ category: "sclera", x: [-144.13944607059312, -114.13944607059311], y: [77.34112452973856, 107.34112452973856], zDepth: 26.100000000000005, scale: [0.9, 1.1] }, { category: "sclera", x: [82.88087412376528, 112.88087412376528], y: [42.09766433937507, 72.09766433937507], zDepth: 31.9, scale: [0.9, 1.1] }, { category: "mouth", x: [-39.08368875444421, -9.083688754444207], y: [-21.417503028291605, 8.582496971708395], zDepth: 37.700000000000045, scale: [0.55, 0.95] }, { category: "ear", x: [-119.27483129437643, -89.44649609258272], y: [81.76833650658641, 111.3724564617434], zDepth: 0, scale: [0.7, 1.1], rotation: [0, 90] }, { category: "ear", x: [93.96974374998385, 124.56006045401975], y: [64.01205606021401, 107.20922534272522], zDepth: 0, scale: [0.9, 1.1], flip: !0, rotation: [0, 90] }, { category: "legs", x: [-103.67202894623784, -73.67202894623784], y: [-115.0756027558754, -85.0756027558754], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [44.11056516867817, 74.11056516867816], y: [-124.72335165959399, -94.72335165959399], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [130.1581284629309, 160.1581284629309], y: [-45.95186392405657, -15.951863924056568], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-161.0630400694668, -131.0630400694668], y: [-46.094671969051035, -16.094671969051035], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "spec", x: [-166.8601605392791, -136.8601605392791], y: [99.56389862210368, 129.5638986221037], zDepth: 128.18, scale: [0.9, 1.1] }, { category: "spec", x: [64.40250771787038, 94.40250771787038], y: [62.92029342213824, 92.92029342213824], zDepth: 128.18, scale: [0.9, 1.1] }, { category: "pupil", x: [87.52658897896481, 127.64934682649844], y: [34.29327251088594, 68.30637508936132], zDepth: 75.40000000000009, scale: [0.15, 1.1] }, { category: "pupil", x: [-144.08873838102022, -111.8448342330382], y: [83.62776210653826, 102.73230246528266], zDepth: 75.40000000000009, scale: [0.65, 0.25] }, { category: "paint", x: [-58.34828101644245, -28.34828101644245], y: [10.784753363228681, 40.78475336322868], zDepth: 13, scale: [0.9, 1.1], opacity: [0.25, 0.6], rotation: [0, 360] }], bodyZDepth: 14.5 },
  "body-blob": { slots: [{ category: "mouth", x: [9.052187768987316, 39.05218776898732], y: [31.840480688160888, 61.84048068816089], zDepth: 33.800000000000004, scale: [0.9, 1.1] }, { category: "legs", x: [-165.06049789349544, -135.06049789349544], y: [-121.97043600804041, -91.97043600804041], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [117.2045049898779, 147.20450498987788], y: [-242.2325534151577, -212.2325534151577], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [124.59039330930258, 154.59039330930258], y: [1.3902329898897214, 31.39023298988972], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-169.511991469243, -139.51199146924296], y: [56.34594701552567, 86.34594701552567], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "sclera", x: [-59.66204222720478, -29.66204222720478], y: [198.9854260089686, 228.9854260089686], zDepth: 18, scale: [0.9, 1.1] }, { category: "sclera", x: [135.79643124065768, 165.79643124065768], y: [151.1411621823617, 181.1411621823617], zDepth: 18, scale: [0.9, 1.1] }, { category: "spec", x: [-81.61061285500749, -51.61061285500749], y: [222.22440209267566, 252.22440209267566], zDepth: 26, scale: [0.9, 1.1] }, { category: "spec", x: [113.8478606128549, 143.8478606128549], y: [174.38013826606877, 204.38013826606877], zDepth: 26, scale: [0.9, 1.1] }, { category: "pupil", x: [-59.66204222720478, -29.66204222720478], y: [198.9854260089686, 228.9854260089686], zDepth: 34, scale: [0.1, 0.5] }, { category: "pupil", x: [135.79643124065768, 165.79643124065768], y: [151.1411621823617, 181.1411621823617], zDepth: 34, scale: [0.1, 0.45] }, { category: "nose", x: [31.874999999999922, 61.87499999999992], y: [141.57047850036568, 171.57047850036568], zDepth: 22, scale: [0.15, 0.25] }, { category: "paint", x: [-19.484304932735434, 10.515695067264566], y: [3.684603886397589, 33.68460388639759], zDepth: 18, scale: [0.9, 1.1], opacity: [0.2, 0.65] }], bodyZDepth: 13.000000000000009 },
  "body-cloudc": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 32.29999999999999, scale: [0.7, 1.7] }, { category: "sclera", x: [87.17871122944692, 111.40371122944687], y: [53.088172645739945, 77.31317264573995], zDepth: 31, scale: [0.7, 1.7] }, { category: "mouth", x: [-12.512327167414036, 11.71267283258596], y: [-89.67142656950672, -65.44642656950671], zDepth: 69.72999999999996, scale: [0.95, 1.0924999999999998] }, { category: "spec", x: [-140.11407884902835, -116.11971692825105], y: [76.03509902840052, 106.3034005979072], zDepth: 237.0820000000004 }, { category: "spec", x: [55.20971365844556, 79.43471365844556], y: [84.67617946562032, 108.90117946562034], zDepth: 237.0820000000004, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [85.69931378725707, 114.19931378725707], y: [50.56187317471784, 79.06187317471785], zDepth: 139.45999999999992, scale: [0.65, 1.5] }, { category: "pupil", x: [-106.2386632730214, -75.3213426452187], y: [35.82976224892106, 65.67271815325587], zDepth: 139.45999999999992, scale: [0.6, 0.9] }, { category: "paint", x: [-30.916946935724937, -0.9169469357249351], y: [-14.567918535127085, 15.432081464872915], zDepth: 18, scale: [1, 1.65], rotation: [0, 360], opacity: [0.15, 0.3] }, { category: "accessory", x: [-17.691750747384205, 12.308249252615795], y: [-224.08071748878922, -194.08071748878922], zDepth: 0, scale: [1, 1] }], bodyZDepth: 19.00000000000003 },
  "body-clipping": { slots: [{ category: "sclera", x: [-107.52031483557548, -83.29531483557547], y: [46.75639247010463, 70.98139247010464], zDepth: 34, scale: [0.6174999999999999, 0.95] }, { category: "sclera", x: [92.31405782884904, 116.539057828849], y: [44.157515881913284, 68.38251588191329], zDepth: 32, scale: [0.7124999999999999, 0.9024999999999997] }, { category: "mouth", x: [-12.512327167414036, 11.71267283258596], y: [-89.67142656950672, -65.44642656950671], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "legs", x: [-92.6356275037369, -68.4106275037369], y: [-151.28946425635272, -127.06446425635272], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [68.4106275037369, 92.6356275037369], y: [-151.28946425635272, -127.06446425635272], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [126.42469854260096, 150.649698542601], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [-150.649698542601, -126.42469854260096], y: [-60.23284928998501, -36.00784928998503], zDepth: 0, scale: [0.48449999999999976, 0.76] }, { category: "spec", x: [-155.7274009715994, -131.5024009715994], y: [95.43497290732435, 119.65997290732432], zDepth: 124.77999999999999 }, { category: "spec", x: [44.10697169282509, 68.33197169282509], y: [92.83609631913296, 117.06109631913299], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [96.51010881715246, 125.01010881715246], y: [31.013106358574355, 59.51310635857436], zDepth: 73.39999999999995, scale: [0.5225, 0.9024999999999997] }, { category: "pupil", x: [-98.74730490231886, -70.24730490231886], y: [46.693107727246854, 75.19310772724685], zDepth: 73.39999999999995, scale: [0.19, 0.855] }] },
  "body-egg-flat": { slots: [{ category: "sclera", x: [-140.64461416292974, -116.41961416292973], y: [24.883728045590445, 49.10872804559045], zDepth: 34, scale: [0.6174999999999999, 2.75] }, { category: "sclera", x: [170.64342068385636, 194.8684206838563], y: [20.860150411061245, 45.08515041106125], zDepth: 32, scale: [0.7124999999999999, 2.85] }, { category: "mouth", x: [20.562808295964146, 44.78780829596415], y: [-150.92259435724964, -126.69759435724964], zDepth: 36.699999999999974, scale: [0.95, 1.0924999999999998] }, { category: "legs", x: [-82.15473251121072, -57.92973251121073], y: [-301.24508832212257, -277.0200883221226], zDepth: 0, scale: [0.475, 0.8074999999999999] }, { category: "legs", x: [106.13017159940206, 130.35517159940207], y: [-310.2136981875933, -285.9886981875933], zDepth: 0, scale: [0.48449999999999976, 0.8074999999999999] }, { category: "arms", x: [245.60911558295967, 269.8341155829597], y: [-61.838557436472314, -37.613557436472334], zDepth: 0, scale: [0.48449999999999976, 0.85] }, { category: "arms", x: [-218.17118583707037, -193.94618583707035], y: [-72.36616393871446, -48.14116393871449], zDepth: 0, scale: [0.48449999999999976, 0.76], flip: !0 }, { category: "spec", x: [-189.90854820627803, -165.68354820627803], y: [70.70706745142004, 94.93206745142001], zDepth: 124.77999999999999 }, { category: "spec", x: [114.93913723841553, 139.16413723841555], y: [72.02027980194313, 96.24527980194316], zDepth: 124.77999999999999, scale: [0.8074999999999999, 0.8074999999999999] }, { category: "pupil", x: [169.0096417020553, 197.5096417020553], y: [17.915199034209618, 46.41519903420962], zDepth: 73.39999999999995, scale: [0.65, 1.35] }, { category: "pupil", x: [-144.0057363298226, -115.50573632982258], y: [21.705019162224467, 50.12175589615569], zDepth: 73.39999999999995, scale: [0.7, 1.05] }, { category: "nose", x: [0.14573991031394584, 30.145739910313946], y: [-60.69880418535126, -30.698804185351257], zDepth: 18, scale: [0.2, 0.35] }, { category: "paint", x: [-12.540872571001522, 17.459127428998478], y: [-53.02924140508227, -23.029241405082267], zDepth: 18, scale: [1.05, 1.5], rotation: [0, 360], opacity: [0.4, 1] }] },
  "body-star": { slots: [{ category: "mouth", x: [-0.3588573042168675, -0.3588573042168675], y: [-199, -37.244681852409634], zDepth: 18, scale: [1, 1] }, { category: "sclera", x: [-99.05638177710846, -99.05638177710846], y: [-71, 78.54856927710844], zDepth: 12, scale: [1.4, 1.8] }, { category: "arms", x: [181.94088667168674, 181.94088667168674], y: [-74.8252014307229, -74.8252014307229], zDepth: 0, scale: [0.65, 1] }, { category: "arms", x: [-182.65860128012045, -182.65860128012045], y: [-74.8252014307229, -74.8252014307229], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "legs", x: [-119.94539156626509, -119.94539156626509], y: [-214.09317959337358, -214.09317959337358], zDepth: 0, scale: [0.65, 1] }, { category: "legs", x: [119.22767695783135, 119.22767695783135], y: [-214.09317959337358, -214.09317959337358], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "sclera", x: [98.33866716867472, 98.33866716867472], y: [-71, 78.54856927710844], zDepth: 16, scale: [1.4, 1.8], flip: !0 }, { category: "pupil", x: [-95.83254894578315, -95.83254894578315], y: [68.20053652108433, 68.20053652108433], zDepth: 14, scale: [1, 1] }, { category: "pupil", x: [95.11483433734941, 95.11483433734941], y: [68.20053652108433, 68.20053652108433], zDepth: 20, scale: [1, 1], flip: !0 }, { category: "spec", x: [-115.27555534638554, -115.27555534638554], y: [87.53176769578313, 87.53176769578313], zDepth: 26, scale: [1, 1] }, { category: "spec", x: [82.11949359939763, 82.11949359939763], y: [87.53176769578313, 87.53176769578313], zDepth: 26, scale: [1, 1] }, { category: "ear", x: [80.13107115963855, 80.13107115963855], y: [131.74342055722892, 131.74342055722892], zDepth: 0, scale: [0.65, 1], rotation: [-51, -51] }, { category: "ear", x: [-80.84878576807229, -80.84878576807229], y: [131.74342055722892, 131.74342055722892], zDepth: 0, scale: [0.65, 1], flip: !0, rotation: [-51, -51] }, { category: "brows", x: [-106.87476468373494, -106.87476468373494], y: [195.47722138554218, 195.47722138554218], zDepth: 26, scale: [0.5, 0.8] }, { category: "brows", x: [106.1570500753012, 106.1570500753012], y: [195.47722138554218, 195.47722138554218], zDepth: 26, scale: [0.5, 0.8], flip: !0 }, { category: "shadow", x: [-2.570860976846809, -2.570860976846809], y: [-439.7435897435897, -439.7435897435897], zDepth: 9, scale: [1, 1] }, { category: "horns", x: [236.5507033475784, 236.5507033475784], y: [71.33640491452992, 71.33640491452992], zDepth: 18, scale: [0.1, 1], rotation: [-70, -70] }, { category: "horns", x: [-236.15562678062682, -236.15562678062682], y: [45.623041310541296, 45.623041310541296], zDepth: 18, scale: [0.1, 1], flip: !0, rotation: [-118, -118] }, { category: "nose", x: [-0.31717414529914534, -0.31717414529914534], y: [-143, -0.37838319088319083], zDepth: 18, scale: [0.25, 0.6] }], bodyZDepth: 10 },
  "body-plainball": { slots: [{ category: "sclera", x: [-164.68142750373696, -164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19.000000000000018, scale: [0.65, 1.35] }, { category: "sclera", x: [164.68142750373696, 164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19.000000000000018, scale: [0.65, 1.35], flip: !0 }, { category: "nose", x: [-8.507333707025412, -8.507333707025412], y: [20.039237668161434, 20.039237668161434], zDepth: 34, scale: [0.3, 0.6] }, { category: "mouth", x: [-2.896113602391629, -2.896113602391629], y: [-40.25364349775785, -40.25364349775785], zDepth: 28, scale: [0.65, 1] }, { category: "pupil", x: [-164.68142750373696, -164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 19, scale: [1, 1.5] }, { category: "pupil", x: [164.68142750373696, 164.68142750373696], y: [7.923439835575465, 7.923439835575465], zDepth: 24, scale: [1, 1.5], flip: !0 }, { category: "legs", x: [93.55730194319878, 93.55730194319878], y: [-138.2497888639761, -138.2497888639761], zDepth: 0, scale: [0.55, 0.85], rotation: [22, 22] }, { category: "legs", x: [-93.55730194319878, -93.55730194319878], y: [-138.2497888639761, -138.2497888639761], zDepth: 0, scale: [0.55, 0.85], flip: !0, rotation: [22, 22] }, { category: "arms", x: [177.68395739910318, 177.68395739910318], y: [-55.88520553064271, -55.88520553064271], zDepth: 0, scale: [0.55, 1] }, { category: "arms", x: [-190.23767563527656, -190.23767563527656], y: [-62.23213191330339, -62.23213191330339], zDepth: 0, scale: [0.55, 1], flip: !0 }, { category: "ear", x: [90.19866405082216, 90.19866405082216], y: [144.6280829596413, 144.6280829596413], zDepth: 0, scale: [0.6, 1], rotation: [-40, -40] }, { category: "ear", x: [-90.19866405082216, -90.19866405082216], y: [144.6280829596413, 144.6280829596413], zDepth: 0, scale: [0.6, 1], flip: !0, rotation: [-40, -40] }, { category: "spec", x: [-183.85650224215246, -183.85650224215246], y: [26.158445440956633, 26.158445440956633], zDepth: 20, scale: [1, 1] }, { category: "spec", x: [145.50635276532145, 145.50635276532145], y: [26.158445440956633, 26.158445440956633], zDepth: 25, scale: [1, 1] }, { category: "brows", x: [-174.52003923766813, -174.52003923766813], y: [51, 120], zDepth: 36, scale: [0.8, 0.8] }, { category: "brows", x: [174.52003923766813, 174.52003923766813], y: [51, 120], zDepth: 36, scale: [0.8, 0.8], flip: !0 }, { category: "horns", x: [-98.71517319277109, -98.71517319277109], y: [156.69554759523635, 156.69554759523635], zDepth: 27, scale: [1, 1] }, { category: "horns", x: [98.71517319277109, 98.71517319277109], y: [156.69554759523635, 156.69554759523635], zDepth: 27, scale: [1, 1], flip: !0 }, { category: "shadow", x: [15.601468373493983, 15.601468373493983], y: [-401.8637048192771, -401.8637048192771], zDepth: -1, scale: [1, 1] }], bodyZDepth: 14.857142857142861, compatibleGradients: ["grad-a9cc8a-f47cda", "grad-c1fdff-f47cda", "grad-fffbb9-f47cda", "grad-fecdfa-f47cda"] },
  "body-heart": { slots: [{ category: "sclera", x: [-166.43287556053812, -136.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 27.90000000000001, scale: [0.9, 1.1] }, { category: "mouth", x: [-15, 15], y: [-111, -81], zDepth: 40.300000000000026, scale: [0.9, 1.1] }, { category: "sclera", x: [136.43287556053812, 166.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 27.90000000000001, scale: [1.25, 2.65] }, { category: "pupil", x: [-166.43287556053812, -136.43287556053812], y: [41.81871263079222, 71.81871263079222], zDepth: 52.69999999999999, scale: [0.9, 1.1] }, { category: "pupil", x: [136.61388266068755, 166.61388266068755], y: [42.00555866965621, 72.00555866965621], zDepth: 52.69999999999999, scale: [0.9, 1.1] }, { category: "legs", x: [-133.9158389387145, -103.91583893871451], y: [-173.19560351270553, -143.19560351270553], zDepth: 0, scale: [0.9, 1.1] }, { category: "legs", x: [103.91583893871451, 133.9158389387145], y: [-173.19560351270553, -143.19560351270553], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [221.79737294469356, 251.79737294469356], y: [-86.00805680119583, -56.008056801195835], zDepth: 0, scale: [0.9, 1.1] }, { category: "arms", x: [-251.79737294469356, -221.79737294469356], y: [-86.00805680119583, -56.008056801195835], zDepth: 0, scale: [0.9, 1.1], flip: !0 }, { category: "paint", x: [-4.583333333333332, 25.416666666666668], y: [-2.7349872111121307, 27.26501278888787], zDepth: 34, scale: [1.1, 1.6], rotation: [0, 360], opacity: [0.25, 0.8] }], bodyZDepth: 15.500000000000018 },
  "body-drip": { slots: [{ category: "sclera", x: [-120.59136771300453, -90.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 28.800000000000008, scale: [0.9, 1.85] }, { category: "mouth", x: [-23.694179745889386, 6.305820254110614], y: [-252.27111360239164, -222.27111360239164], zDepth: 28.800000000000008, scale: [0.6, 0.75] }, { category: "pupil", x: [-120.59136771300453, -90.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 41.60000000000001, scale: [0.9, 1.55] }, { category: "sclera", x: [90.59136771300453, 120.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 28.800000000000008, scale: [0.9, 1.85] }, { category: "pupil", x: [90.59136771300453, 120.59136771300453], y: [-111.37168348281016, -81.37168348281016], zDepth: 41.60000000000001, scale: [0.9, 1.55] }, { category: "legs", x: [-66.02649289985055, -36.02649289985054], y: [-274.09527092675626, -244.09527092675626], zDepth: 0, scale: [0.3, 0.65] }, { category: "legs", x: [30.316010837070188, 60.316010837070195], y: [-280.5940097159941, -250.5940097159941], zDepth: 0, scale: [0.3, 0.65] }, { category: "arms", x: [81.10814461883409, 111.10814461883409], y: [-196.34064275037375, -166.34064275037375], zDepth: 0, scale: [0.4, 0.7] }, { category: "arms", x: [-110.92713751868456, -80.92713751868456], y: [-196.15379671150976, -166.15379671150976], zDepth: 0, scale: [0.4, 0.7], flip: !0 }, { category: "paint", x: [-14.102905455904276, 15.897094544095726], y: [-79.20444423588805, -49.20444423588804], zDepth: 17.600000000000005, scale: [1, 1], opacity: [0.4, 0.75], rotation: [0, 360] }, { category: "nose", x: [-11.598467862481384, -11.598467862481384], y: [-152.02041292974576, -151.0204129297459], zDepth: 32, scale: [0.4, 0.4] }, { category: "brows", x: [-107.31385463378177, -107.31385463378177], y: [-12.42560105896429, -12.42560105896429], zDepth: 49.60000000000001, scale: [0.35, 0.7] }, { category: "brows", x: [107.31385463378177, 107.31385463378177], y: [-12.42560105896429, -12.42560105896429], zDepth: 49.60000000000001, scale: [0.35, 0.7], flip: !0 }, { category: "spec", x: [-147.5903614457832, -147.5903614457832], y: [-49.41473146229495, -49.41473146229495], zDepth: 57.60000000000001, scale: [1, 1] }, { category: "spec", x: [63.02657074157142, 63.02657074157142], y: [-54.61796932862072, -54.61796932862072], zDepth: 57.60000000000001, scale: [1, 1] }, { category: "shadow", x: [-20.760777484939762, -20.760777484939762], y: [-415.0590643825301, -415.0590643825301], zDepth: 9, scale: [0.5, 0.5] }], bodyZDepth: 16.000000000000007, compatibleGradients: ["grad-c1fdff-53a0ff", "grad-fecdfa-53a0ff", "grad-ffd877-53a0ff"] },
  "body-blobb": { slots: [{ category: "sclera", x: [-139.37523355754854, -109.37523355754854], y: [130.75158819133037, 160.75158819133037], zDepth: 25.200000000000003, scale: [0.9, 1.5] }, { category: "sclera", x: [30.134529147982093, 60.13452914798209], y: [124.92479446935727, 154.92479446935727], zDepth: 25.200000000000003, scale: [0.9, 1.5] }, { category: "mouth", x: [-58.932174887892415, -28.932174887892415], y: [11.199318011958134, 41.199318011958134], zDepth: 25.200000000000003, scale: [0.75, 1.55] }, { category: "arms", x: [234.56129297458887, 264.56129297458887], y: [-58.88618647234672, -28.886186472346722], zDepth: 0, scale: [0.7, 0.7] }, { category: "arms", x: [-264.56129297458887, -234.56129297458887], y: [-58.88618647234672, -28.886186472346722], zDepth: 0, scale: [0.7, 0.7], flip: !0 }, { category: "legs", x: [-201.4256483557549, -171.4256483557549], y: [-178.5382324364724, -148.5382324364724], zDepth: 0, scale: [0.7, 0.7] }, { category: "legs", x: [171.4256483557549, 201.4256483557549], y: [-178.5382324364724, -148.5382324364724], zDepth: 0, scale: [0.7, 0.7] }, { category: "pupil", x: [-139.37523355754854, -109.37523355754854], y: [130.75158819133037, 160.75158819133037], zDepth: 36.40000000000001, scale: [0.9, 1.4] }, { category: "pupil", x: [30.134529147982093, 60.13452914798209], y: [125.02195440956652, 155.02195440956652], zDepth: 36.40000000000001, scale: [0.9, 1.4] }, { category: "spec", x: [-180.9192825112108, -150.9192825112108], y: [171.09865470852017, 201.09865470852017], zDepth: 47.59999999999998, scale: [0.5, 0.5] }, { category: "spec", x: [-11.409519805680162, 18.590480194319838], y: [165.27186098654707, 195.27186098654707], zDepth: 47.59999999999998, scale: [0.5, 0.5] }, { category: "paint", x: [15.706978699551595, 45.7069786995516], y: [-26.22827914798208, 3.7717208520179213], zDepth: 15.399999999999999, scale: [1.3, 1.3], rotation: [0, 360], opacity: [0.4, 0.8] }], bodyZDepth: 14.000000000000007 },
  "body-roundbee": { slots: [{ category: "sclera", x: [-106.61318198804184, -106.61318198804184], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 17, scale: [0.85, 2] }, { category: "sclera", x: [106.26284566517188, 106.26284566517188], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 21, scale: [0.85, 2], flip: !0 }, { category: "mouth", x: [-0.17516816143497757, -0.17516816143497757], y: [-131, -131], zDepth: 19, scale: [0.7, 1] }, { category: "arms", x: [158.2753251121076, 158.2753251121076], y: [-67.72073430493273, -67.72073430493273], zDepth: 0, scale: [0.6, 1] }, { category: "arms", x: [-158.62566143497756, -158.62566143497756], y: [-67.72073430493273, -67.72073430493273], zDepth: 0, scale: [0.6, 1], flip: !0 }, { category: "legs", x: [107.50652653213751, 107.50652653213751], y: [-175.89926569506724, -175.89926569506724], zDepth: 0, scale: [0.5, 0.8], rotation: [13, 13] }, { category: "legs", x: [-107.85686285500748, -107.85686285500748], y: [-175.89926569506724, -175.89926569506724], zDepth: 0, scale: [0.5, 0.8], flip: !0, rotation: [13, 13] }, { category: "pupil", x: [-106.61318198804184, -106.61318198804184], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 27, scale: [1, 1.65] }, { category: "pupil", x: [106.26284566517188, 106.26284566517188], y: [-1.7224869207772795, -1.7224869207772795], zDepth: 42, scale: [1, 1.65], flip: !0 }, { category: "ear", x: [107.9140041106129, 107.9140041106129], y: [109.4017656950673, 109.4017656950673], zDepth: 0, scale: [0.7, 1], rotation: [-46, -46] }, { category: "ear", x: [-108.26434043348286, -108.26434043348286], y: [109.4017656950673, 109.4017656950673], zDepth: 0, scale: [0.7, 1], flip: !0, rotation: [-46, -46] }, { category: "spec", x: [-132.68988228699547, -132.68988228699547], y: [25.300121449925236, 25.300121449925236], zDepth: 28, scale: [1, 1] }, { category: "spec", x: [77.6053344544095, 77.6053344544095], y: [28.785967862481236, 28.785967862481236], zDepth: 43, scale: [1, 1] }, { category: "nose", x: [0, 0], y: [-34.02073845425821, -34.02073845425821], zDepth: 30, scale: [0.4, 0.4] }, { category: "horns", x: [3.0362481315396757, 3.0362481315396757], y: [132.3804185351271, 132.3804185351271], zDepth: 23, scale: [1, 1] }, { category: "brows", x: [-110.74715059790736, -110.74715059790736], y: [63.79621001960689, 63.79621001960689], zDepth: 143, scale: [0.7, 0.7] }, { category: "brows", x: [110.3968142750374, 110.3968142750374], y: [63.79621001960689, 63.79621001960689], zDepth: 167.2, scale: [0.7, 0.7], flip: !0 }, { category: "shadow", x: [-4.156626506024096, -4.156626506024096], y: [-390.0914009725475, -390.0914009725475], zDepth: -1, scale: [0.8, 0.8] }], bodyZDepth: 11, compatibleGradients: ["grad-fffbb9-a39400", "grad-fffbb9-f7ed1a", "grad-ecf8c6-f7ed1a", "grad-c1fdff-f7ed1a"] },
  "body-squirc": { slots: [{ category: "sclera", x: [-95, -171], y: [-38.26316388733179, -38.26316388733179], zDepth: 21, scale: [1.45, 2.25] }, { category: "sclera", x: [171, 95], y: [-38.26316388733179, -38.26316388733179], zDepth: 28, scale: [1.45, 2.25], flip: !0 }, { category: "pupil", x: [-143.45099999999985, -243.86669999999984], y: [-38.26316388733179, -38.26316388733179], zDepth: 26, scale: [2.4125849999999973, 1.8909449999999979], rotation: [0, -3] }, { category: "pupil", x: [243.86669999999984, 143.45099999999985], y: [-38.26316388733179, -38.26316388733179], zDepth: 29, scale: [2.4125849999999973, 1.8909449999999979], flip: !0, rotation: [3, 0] }, { category: "mouth", x: [-9.72004127693936, -9.72004127693936], y: [-163, -138], zDepth: 16, scale: [0.6, 0.95] }, { category: "nose", x: [-0.228436799327354, -0.228436799327354], y: [-45.80919282511201, -45.80919282511201], zDepth: 57, scale: [0.25, 0.5] }, { category: "ear", x: [116.86042266811964, 116.86042266811964], y: [161.3002417952277, 161.3002417952277], zDepth: 0, scale: [0.35, 0.95], rotation: [-60, -6], flip: !1 }, { category: "ear", x: [-118.53581305781901, -118.53581305781901], y: [164.15705149672024, 164.15705149672024], zDepth: 0, scale: [0.35, 0.95], flip: !0, rotation: [6, 60] }, { category: "legs", x: [61.99929824503022, 61.99929824503022], y: [-157.40352540796277, -157.40352540796277], zDepth: 0, scale: [0.5216399999999994, 0.95], rotation: [18, 18] }, { category: "legs", x: [-100.76074273920736, -100.76074273920736], y: [-169.95599742288812, -169.95599742288812], zDepth: 0, scale: [0.5216399999999994, 0.95], flip: !0, rotation: [18, 18] }, { category: "arms", x: [169.95634390934313, 169.95634390934313], y: [-116.43087007532114, -116.43087007532114], zDepth: 0, scale: [0.55, 0.8] }, { category: "arms", x: [-158.3271634035204, -158.3271634035204], y: [-128.05633649323153, -128.05633649323153], zDepth: 0, scale: [0.55, 0.8], flip: !0 }, { category: "brows", x: [-147.85608518506112, -147.85608518506112], y: [87.5509371762853, 87.5509371762853], zDepth: 50.6625, scale: [0.45643499999999954, 1.15] }, { category: "brows", x: [196.25277361789696, 97.37217660297168], y: [66.39571307144888, 97.34837165353845], zDepth: 50.6625, scale: [0.45643499999999954, 1.15], flip: !0 }, { category: "spec", x: [-210.02106635497185, -210.02106635497185], y: [11.553053721660934, 11.553053721660934], zDepth: 41.16250000000001, scale: [1.3040999999999991, 1.3040999999999991] }, { category: "spec", x: [156.8438898163851, 156.8438898163851], y: [6.6498354380787426, 6.6498354380787426], zDepth: 33, scale: [1.3040999999999991, 1.3040999999999991] }, { category: "horns", x: [-92.13005555922365, -92.13005555922365], y: [159.68396537438167, 159.68396537438167], zDepth: 24, scale: [0.35, 1.3040999999999991] }, { category: "horns", x: [106.77216837265088, 106.77216837265088], y: [153.15994485199357, 153.15994485199357], zDepth: 24, scale: [0.35, 1.3040999999999991], flip: !0 }, { category: "shadow", x: [15.520250729480404, 15.520250729480404], y: [-513.2300648296306, -513.2300648296306], zDepth: -1, scale: [1.0432799999999989, 1.0432799999999989] }], bodyZDepth: 13.125000000000005, compatibleGradients: ["grad-c1fdff-a39400", "grad-fecdfa-a39400", "grad-fffbb9-a39400", "grad-c1fdff-a9cc8a", "grad-e8d5b5-a9cc8a", "grad-ecf8c6-a9cc8a", "grad-fecdfa-a9cc8a"] },
  "body-egg": { slots: [{ category: "sclera", x: [-114.1570908071749, -114.1570908071749], y: [-25.510323243647235, -25.510323243647235], zDepth: 28.80000000000001, scale: [1.3, 2] }, { category: "sclera", x: [106.2394899103139, 106.2394899103139], y: [-25.39354446935725, -25.39354446935725], zDepth: 28.80000000000001, scale: [1.3, 2], flip: !0 }, { category: "mouth", x: [-6.580483931240657, -6.580483931240657], y: [-169.5160687593423, -169.5160687593423], zDepth: 41.600000000000016, scale: [0.8076923076923077, 0.8076923076923077] }, { category: "arms", x: [99.61150784753362, 99.61150784753362], y: [-140.84176382660686, -140.84176382660686], zDepth: 0, scale: [0.5, 0.75] }, { category: "arms", x: [-99.61150784753362, -99.61150784753362], y: [-140.84176382660686, -140.84176382660686], zDepth: 0, scale: [0.5, 0.75], flip: !0 }, { category: "legs", x: [48.095328849028384, 48.095328849028384], y: [-228.24916853512698, -228.24916853512698], zDepth: 0, scale: [0.5, 0.95], rotation: [15, 15] }, { category: "legs", x: [-48.095328849028384, -48.095328849028384], y: [-228.24916853512698, -228.24916853512698], zDepth: 0, scale: [0.5, 0.95], flip: !0, rotation: [15, 15] }, { category: "paint", x: [0, 0], y: [0, 0], zDepth: 17.600000000000005, scale: [1, 1], rotation: [0, 360], opacity: [0.1, 0.4] }, { category: "nose", x: [-8.670823991031401, -8.670823991031401], y: [-80.93352952167417, -80.93352952167417], zDepth: 36, scale: [0.3, 0.5] }, { category: "pupil", x: [-114.1570908071749, -114.1570908071749], y: [-25.510323243647235, -25.510323243647235], zDepth: 54.40000000000001, scale: [1, 2.2] }, { category: "pupil", x: [106.2394899103139, 106.2394899103139], y: [-25.39354446935725, -25.39354446935725], zDepth: 54.40000000000001, scale: [1, 2.2], flip: !0 }, { category: "brows", x: [-119.72159940209269, -119.72159940209269], y: [85.11138095672618, 85.11138095672618], zDepth: 54.40000000000001, scale: [1, 1] }, { category: "brows", x: [119.72159940209269, 119.72159940209269], y: [85.11138095672618, 85.11138095672618], zDepth: 54.40000000000001, scale: [1, 1], flip: !0 }, { category: "spec", x: [-143.07228915662654, -143.07228915662654], y: [15.709622160263578, 15.709622160263578], zDepth: 62.40000000000001, scale: [1, 1] }, { category: "spec", x: [77.32429156086226, 77.32429156086226], y: [15.826400934553561, 15.826400934553561], zDepth: 62.40000000000001, scale: [1, 1] }, { category: "horns", x: [-0.07647778614459355, -0.07647778614459355], y: [177.3429649411792, 177.3429649411792], zDepth: 33, scale: [1, 1] }], bodyZDepth: 16.000000000000007, compatibleGradients: ["grad-ecf8c6-a9cc8a"] },
  "body-bloba": { slots: [{ category: "ear", x: [49.506276709401696, 49.506276709401696], y: [239.53476673789174, 239.53476673789174], zDepth: 0, scale: [1, 1], rotation: [-35, -103] }, { category: "ear", x: [-81.20143340455843, -81.20143340455843], y: [251.7765758547009, 251.7765758547009], zDepth: 0, scale: [1, 1], flip: !0, rotation: [103, 35] }, { category: "sclera", x: [-105.75253739316241, -105.75253739316241], y: [194.8193541936209, 194.8193541936209], zDepth: 22, scale: [0.95, 1.3], rotation: [12, 0] }, { category: "sclera", x: [35.97422542735045, 35.97422542735045], y: [188.96554365231037, 188.96554365231037], zDepth: 22, scale: [0.95, 1.3], flip: !0, rotation: [0, -12] }, { category: "mouth", x: [-40.336761039886014, -40.336761039886014], y: [101.28080362382036, 101.28080362382036], zDepth: 18, scale: [0.1, 0.6923076923076923] }, { category: "pupil", x: [-105.75253739316241, -105.75253739316241], y: [194.8193541936209, 194.8193541936209], zDepth: 30, scale: [0.5, 1.95], rotation: [3, 0] }, { category: "pupil", x: [35.97422542735045, 35.97422542735045], y: [188.96554365231037, 188.96554365231037], zDepth: 30, scale: [0.5, 1.95], flip: !0, rotation: [0, -3] }, { category: "legs", x: [1.5380039173789095, 1.5380039173789095], y: [-141.06701866962692, -141.06701866962692], zDepth: 0, scale: [0.45, 0.75], rotation: [-15, -15] }, { category: "legs", x: [88.04978098290599, 88.04978098290599], y: [-145.50189224512548, -145.50189224512548], zDepth: 0, scale: [0.45, 0.75], flip: !0, rotation: [-10, -10] }, { category: "arms", x: [215.35075142450148, 215.35075142450148], y: [25.327240589632268, 25.327240589632268], zDepth: 0, scale: [0.4, 1], rotation: [18, 23] }, { category: "arms", x: [-82.56607371794878, -82.56607371794878], y: [-7.219278285011612, -7.219278285011612], zDepth: 0, scale: [0.4, 1], flip: !0, rotation: [-23, -18] }, { category: "brows", x: [-108.74065170940176, -108.74065170940176], y: [272.5548420853588, 272.5548420853588], zDepth: 38, scale: [0.4, 0.4] }, { category: "brows", x: [31.355724715099743, 31.355724715099743], y: [272.6828246352164, 272.6828246352164], zDepth: 38, scale: [0.4, 0.4], flip: !0 }, { category: "paint", x: [36.92018340455848, 36.92018340455848], y: [62.13483674347842, 62.13483674347842], zDepth: 11, scale: [1, 1], rotation: [-180, 180], opacity: [0.15, 0.6], parts: ["paint-cow", "paint-drips", "paint-stripes", "paint-shapes", "paint-dots", "paint-cowpink-copy"] }, { category: "spec", x: [-125.48410790598291, -125.48410790598291], y: [213.60753500998183, 213.60753500998183], zDepth: 31, scale: [1, 1] }, { category: "spec", x: [16.242654914529965, 16.242654914529965], y: [207.7537244686713, 207.7537244686713], zDepth: 31, scale: [1, 1] }, { category: "nose", x: [-39.59112357549859, -39.59112357549859], y: [180.38771663391344, 180.38771663391344], zDepth: 38, scale: [0.1, 0.3], rotation: [3, 0] }, { category: "shadow", x: [49, 36], y: [-313, -256], zDepth: -1, scale: [0.7, 0.7] }], bodyZDepth: 10, compatibleGradients: ["grad-e8d5b5-68412b", "grad-ebc164-68412b", "grad-fffbb9-68412b", "grad-ecf8c6-68412b"] },
  "body-eggnew": { slots: [{ category: "sclera", x: [-131.69079228237734, -132.50818900602405], y: [-76.55713478915663, 82], zDepth: 16, scale: [1.65, 2.25], rotation: [0, -3] }, { category: "sclera", x: [120.18349962349397, 119.36610289984726], y: [-76.55713478915663, 82], zDepth: 14, scale: [1.65, 2.25], flip: !0, rotation: [3, 0] }, { category: "pupil", x: [-131.40544617036517, -131.40544617036517], y: [-78.89490654927408, -78.89490654927408], zDepth: 20, scale: [0.9, 1.9] }, { category: "pupil", x: [119.44846359261834, 119.44846359261834], y: [-79.93832635563624, -79.93832635563624], zDepth: 26, scale: [0.9, 1.9], flip: !0 }, { category: "mouth", x: [-10.09252018758805, -10.09252018758805], y: [-204.27204946924462, -204.27204946924462], zDepth: 13, scale: [1, 1] }, { category: "legs", x: [-78.154228988604, -78.154228988604], y: [-273.29707977207977, -273.29707977207977], zDepth: 0, scale: [0.5, 0.7142857142857143], rotation: [0, -19] }, { category: "legs", x: [78.154228988604, 78.154228988604], y: [-273.29707977207977, -273.29707977207977], zDepth: 0, scale: [0.5, 0.7142857142857143], flip: !0, rotation: [19, 0] }, { category: "arms", x: [142.78038850916488, 142.78038850916488], y: [-199.61390284428325, -199.61390284428325], zDepth: 0, scale: [0.65, 1] }, { category: "arms", x: [-111.93042615976736, -111.93042615976736], y: [-198.22553688042774, -198.22553688042774], zDepth: 0, scale: [0.65, 1], flip: !0 }, { category: "shadow", x: [-3.4473832831325244, -3.4473832831325244], y: [-397.8284106040383, -397.8284106040383], zDepth: -1, scale: [1, 1] }, { category: "horns", x: [-74.30778133903134, -74.30778133903134], y: [254.29580662393164, 254.29580662393164], zDepth: 20, scale: [0.55, 1] }, { category: "horns", x: [74.30778133903134, 74.30778133903134], y: [254.29580662393164, 254.29580662393164], zDepth: 19, scale: [0.55, 1], flip: !0 }, { category: "spec", x: [-148.1389299183915, -148.1389299183915], y: [-59.778057877879064, -59.778057877879064], zDepth: 21, scale: [1, 1] }, { category: "spec", x: [104.9798988957969, 104.9798988957969], y: [-52.685417819783396, -52.685417819783396], zDepth: 27, scale: [1, 1] }, { category: "nose", x: [-6.371187876506051, -6.371187876506051], y: [-127.73555780045047, -127.73555780045047], zDepth: 25, scale: [0.4, 0.4] }], compatibleGradients: ["grad-ffd877-f1966a", "grad-fecdfa-f1966a", "grad-c1fdff-f1966a", "grad-ecf8c6-f1966a"], bodyZDepth: 10 },
  "body-superdrip": { slots: [{ category: "sclera", x: [-41, -113], y: [-151, -3.1179405120481896], zDepth: 27.973809523809532, scale: [0.8, 1.3] }, { category: "sclera", x: [113, 41], y: [-151, -3.1179405120481896], zDepth: 27.973809523809532, scale: [0.8, 1.3], flip: !0 }, { category: "mouth", x: [2.6120105421686755, 2.6120105421686755], y: [-218, -94.2922628012048], zDepth: 20.223809523809532, scale: [0.6538461538461539, 0.6538461538461539] }, { category: "pupil", x: [-71.10080948795182, -71.10080948795182], y: [-3.1179405120481896, -3.1179405120481896], zDepth: 40.373809523809534, scale: [0.8, 1.35] }, { category: "pupil", x: [71.10080948795182, 71.10080948795182], y: [-3.1179405120481896, -3.1179405120481896], zDepth: 40.373809523809534, scale: [0.8, 1.35], flip: !0 }, { category: "spec", x: [-88.85542168674701, -88.85542168674701], y: [10.542168674698816, 10.542168674698816], zDepth: 41.373809523809534, scale: [1, 1] }, { category: "spec", x: [53.346197289156635, 53.346197289156635], y: [10.542168674698816, 10.542168674698816], zDepth: 41.373809523809534, scale: [1, 1] }, { category: "brows", x: [-68.11229292168679, -68.11229292168679], y: [52.11078689759036, 52.11078689759036], zDepth: 65.17380952380952, scale: [0.35, 0.7] }, { category: "brows", x: [68.11229292168679, 68.11229292168679], y: [52.11078689759036, 52.11078689759036], zDepth: 65.17380952380952, scale: [0.35, 0.7], flip: !0 }, { category: "legs", x: [57.61450677710849, 57.61450677710849], y: [-247.33223644578322, -247.33223644578322], zDepth: 0.0738095238095239, scale: [0.35, 0.5714285714285715] }, { category: "legs", x: [-68.59789344879525, -68.59789344879525], y: [-240.8492733433735, -240.8492733433735], zDepth: 0.0738095238095239, scale: [0.35, 0.5714285714285715], flip: !0 }, { category: "arms", x: [149.28897402108444, 149.28897402108444], y: [-108.93323418674697, -108.93323418674697], zDepth: 0.0738095238095239, scale: [0.35, 0.65] }, { category: "arms", x: [-149.28897402108444, -149.28897402108444], y: [-108.92735128012046, -108.92735128012046], zDepth: 0.0738095238095239, scale: [0.35, 0.65], flip: !0 }, { category: "horns", x: [-62.15879141566257, -62.15879141566257], y: [92.9654179216868, 92.9654179216868], zDepth: 27.973809523809532, scale: [0.25, 0.75] }, { category: "horns", x: [62.15879141566257, 62.15879141566257], y: [92.9654179216868, 92.9654179216868], zDepth: 27.973809523809532, scale: [0.25, 0.75], flip: !0 }, { category: "nose", x: [-2.553181475903652, -2.553181475903652], y: [-187, -72], zDepth: 52.77380952380953, scale: [0.15, 0.3] }, { category: "shadow", x: [-3.923378967377077, -3.923378967377077], y: [-357.3771649096386, -357.3771649096386], zDepth: -0.9261904761904761, scale: [1, 1] }], compatibleGradients: ["grad-c1fdff-53a0ff", "grad-fecdfa-53a0ff", "grad-ffd877-53a0ff", "grad-c1fdff-7c41ad", "grad-fecdfa-7c41ad", "grad-fffbb9-f7ed1a"], bodyZDepth: 10 },
  "body-dill": { slots: [{ category: "sclera", x: [-77.7249623493976, -77.7249623493976], y: [-58, 168.46879706325302], zDepth: 18, scale: [1.1, 1.45] }, { category: "sclera", x: [77.7249623493976, 77.7249623493976], y: [-58, 168.46879706325302], zDepth: 18, scale: [1.1, 1.45], flip: !0 }, { category: "pupil", x: [-76.80722891566265, -76.80722891566265], y: [168.49232868975903, 168.49232868975903], zDepth: 26, scale: [1, 1] }, { category: "pupil", x: [80.5958207831325, 80.5958207831325], y: [170.1924887048193, 170.1924887048193], zDepth: 26, scale: [1, 1] }, { category: "mouth", x: [2.0060711596385543, 2.0060711596385543], y: [-235.78101468373492, 52], zDepth: 18, scale: [1, 1] }, { category: "legs", x: [-87.39914156626507, -87.39914156626507], y: [-263.7573117469879, -263.7573117469879], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "legs", x: [87.39914156626507, 87.39914156626507], y: [-263.7573117469879, -263.7573117469879], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "arms", x: [117.5414815512048, 117.5414815512048], y: [-146.44103915662652, -146.44103915662652], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "arms", x: [-117.5414815512048, -117.5414815512048], y: [-146.44103915662652, -146.44103915662652], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "shadow", x: [0, 0], y: [-412.2905089426753, -412.2905089426753], zDepth: -1, scale: [1, 1] }, { category: "nose", x: [1.029508659638557, 1.029508659638557], y: [-145, 52], zDepth: 26, scale: [0.4, 0.4] }, { category: "spec", x: [-94.87951807228919, -101.04480421686748], y: [188.79241650913204, 187.2275633464814], zDepth: 27, scale: [1, 1] }, { category: "spec", x: [60.57040662650601, 60.57040662650601], y: [187.2275633464814, 187.2275633464814], zDepth: 27, scale: [1, 1] }, { category: "ear", x: [-120.87608245481928, -120.87608245481928], y: [57, 211], zDepth: 0, scale: [0.4, 0.7], rotation: [89, 89] }, { category: "ear", x: [120.87608245481928, 120.87608245481928], y: [57, 211], zDepth: 0, scale: [0.4, 0.7], flip: !0, rotation: [89, 89] }, { category: "horns", x: [0.4588667168674698, 0.4588667168674698], y: [280.1452967802163, 280.1452967802163], zDepth: 34, scale: [0.5, 0.5] }, { category: "brows", x: [-77.12490587349399, -77.12490587349399], y: [246.00368345190304, 246.00368345190304], zDepth: 34, scale: [0.6, 0.6] }, { category: "brows", x: [77.12490587349399, 77.12490587349399], y: [246.00368345190304, 246.00368345190304], zDepth: 34, scale: [0.6, 0.6], flip: !0 }], compatibleGradients: [], bodyZDepth: 10 },
  "body-bloop": { slots: [{ category: "sclera", x: [-100.42121611445783, -100.42121611445783], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1.6666666666666667, 1.6666666666666667] }, { category: "sclera", x: [103.25677710843375, 103.25677710843375], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1.6666666666666667, 1.6666666666666667], flip: !0 }, { category: "pupil", x: [-100.42121611445783, -100.42121611445783], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1, 1] }, { category: "pupil", x: [103.25677710843375, 103.25677710843375], y: [22.184440888554207, 22.184440888554207], zDepth: 10, scale: [1, 1], flip: !0 }, { category: "mouth", x: [-3.87683546686747, -3.87683546686747], y: [-105.55111069277115, -105.55111069277115], zDepth: 10, scale: [1, 1] }, { category: "legs", x: [172.20176204819276, 172.20176204819276], y: [-91.75877070783133, -91.75877070783133], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "legs", x: [-169.36620105421687, -169.36620105421687], y: [-91.75877070783133, -91.75877070783133], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "arms", x: [193.51922063253014, 193.51922063253014], y: [-44.57262801204817, -44.57262801204817], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "arms", x: [-190.68365963855425, -190.68365963855425], y: [-44.57262801204817, -44.57262801204817], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "shadow", x: [7327471962526033e-30, 7327471962526033e-30], y: [-240.10371489147047, -240.10371489147047], zDepth: -1, scale: [1, 1] }, { category: "brows", x: [-102.59789156626505, -102.59789156626505], y: [141.2132906626506, 141.2132906626506], zDepth: 18, scale: [1, 1] }, { category: "brows", x: [105.43345256024097, 105.43345256024097], y: [141.2132906626506, 141.2132906626506], zDepth: 18, scale: [1, 1], flip: !0 }, { category: "ear", x: [135.57746611445785, 135.57746611445785], y: [73.220265436747, 73.220265436747], zDepth: -1, scale: [1, 1], rotation: [-42, -42] }, { category: "ear", x: [-132.74190512048196, -132.74190512048196], y: [73.220265436747, 73.220265436747], zDepth: -1, scale: [1, 1], flip: !0, rotation: [-42, -42] }] },
  "body-proof": { slots: [{ category: "sclera", x: [-119.67008659638556, -119.67008659638556], y: [38.0859375, 38.0859375], zDepth: 29, scale: [1.4, 2.166666666666667] }, { category: "arms", x: [233.7230045180723, 233.7230045180723], y: [-35.47765436746985, -35.47765436746985], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143] }, { category: "legs", x: [160.10650602409638, 160.10650602409638], y: [-120.64384224397591, -120.64384224397591], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715] }, { category: "sclera", x: [127.78849774096388, 127.78849774096388], y: [38.0859375, 38.0859375], zDepth: 29, scale: [1.4, 2.166666666666667], flip: !0 }, { category: "pupil", x: [-115.8108998493976, -115.8108998493976], y: [38.04475715361447, 38.04475715361447], zDepth: 37, scale: [1, 1] }, { category: "pupil", x: [123.92931099397592, 123.92931099397592], y: [38.04475715361447, 38.04475715361447], zDepth: 37, scale: [1, 1], flip: !0 }, { category: "spec", x: [-139.01308358433738, -139.01308358433738], y: [49.516425075301214, 49.516425075301214], zDepth: 45, scale: [1, 1] }, { category: "spec", x: [108.44550075301206, 108.44550075301206], y: [49.516425075301214, 49.516425075301214], zDepth: 45, scale: [1, 1] }, { category: "mouth", x: [1.229527484939759, 1.229527484939759], y: [-110.5751129518072, -110.5751129518072], zDepth: 37, scale: [1, 1] }, { category: "arms", x: [-225.60459337349397, -225.60459337349397], y: [-35.47765436746985, -35.47765436746985], zDepth: 0, scale: [0.7142857142857143, 0.7142857142857143], flip: !0 }, { category: "legs", x: [-151.98809487951806, -151.98809487951806], y: [-120.64384224397591, -120.64384224397591], zDepth: 0, scale: [0.5714285714285715, 0.5714285714285715], flip: !0 }, { category: "shadow", x: [-17763568394002505e-31, -17763568394002505e-31], y: [-268.9887864276151, -268.9887864276151], zDepth: -1, scale: [1, 1] }, { category: "brows", x: [-112.79296875000001, -112.79296875000001], y: [197.20091302710844, 197.20091302710844], zDepth: 45, scale: [0.65, 1], rotation: [-5, 7] }, { category: "brows", x: [120.91137989457833, 120.91137989457833], y: [197.20091302710844, 197.20091302710844], zDepth: 45, scale: [0.65, 1], flip: !0, rotation: [-7, 5] }, { category: "ear", x: [175.7871329066265, 175.7871329066265], y: [73.14967055722893, 73.14967055722893], zDepth: -1, scale: [0.55, 1], rotation: [-36, -36] }, { category: "ear", x: [-167.6687217620482, -167.6687217620482], y: [73.14967055722893, 73.14967055722893], zDepth: -1, scale: [0.55, 1], flip: !0, rotation: [-36, -36] }, { category: "nose", x: [1.294239457831325, 1.294239457831325], y: [-29.996940888554207, -29.996940888554207], zDepth: 45, scale: [0.4, 0.4] }], compatibleGradients: ["grad-e8d5b5-68412b", "grad-ecf8c6-68412b", "grad-fffbb9-68412b"], bodyZDepth: 0 },
  "body-derp-copy": { slots: [{ category: "sclera", x: [-92.54400414156626, -92.54400414156626], y: [-5, 30.755835843373493], zDepth: 18, scale: [0.95, 1.6666666666666667], linked: !1 }, { category: "sclera", x: [129.61219879518075, 129.61219879518075], y: [68.0652296686747, 68.0652296686747], zDepth: 18, scale: [1.6666666666666667, 1.6666666666666667], flip: !0, linked: !1 }, { category: "mouth", x: [-68, 81], y: [-92.06944967369482, -92.06944967369482], zDepth: 26, scale: [0.6, 1] }, { category: "pupil", x: [-89.85551581325302, -89.85551581325302], y: [28.090879141566266, 28.090879141566266], zDepth: 34, scale: [0.5, 1.75], linked: !1 }, { category: "pupil", x: [130.41227409638557, 130.41227409638557], y: [66.00621234939759, 66.00621234939759], zDepth: 34, scale: [1, 2.05], flip: !0, linked: !1 }, { category: "arms", x: [177.8993298192771, 177.8993298192771], y: [-32.12118222891567, -32.12118222891567], zDepth: 0, scale: [0.45, 1], linked: !1 }, { category: "legs", x: [-89.85298381024097, -89.85298381024097], y: [-146.29702560240966, -146.29702560240966], zDepth: 0, scale: [0.4, 0.7142857142857143], linked: !0 }, { category: "legs", x: [174.06090926204823, 174.06090926204823], y: [-134.14294051204823, -134.14294051204823], zDepth: 0, scale: [0.4, 0.7142857142857143], flip: !0, linked: !0 }, { category: "arms", x: [-164.13921121987954, -164.13921121987954], y: [-59.447283509036154, -59.447283509036154], zDepth: 0, scale: [0.4, 1], flip: !0, linked: !1 }, { category: "ear", x: [131.1241057981928, 131.1241057981928], y: [128.56665097891565, 128.56665097891565], zDepth: 0, scale: [0.75, 1], rotation: [-47, -47], linked: !1 }, { category: "ear", x: [-95.85608057228917, -95.85608057228917], y: [114.82418109939758, 114.82418109939758], zDepth: 0, scale: [0.75, 1], flip: !0, rotation: [-47, -47], linked: !1 }, { category: "brows", x: [-115.40497929216868, -115.40497929216868], y: [151.04951054216866, 151.04951054216866], zDepth: 42, scale: [0.7, 0.7], rotation: [11, 11], linked: !0 }, { category: "brows", x: [145.1901355421687, 145.1901355421687], y: [191.85923381024094, 191.85923381024094], zDepth: 42, scale: [0.7, 0.7], flip: !0, rotation: [8, 8], linked: !0 }, { category: "shadow", x: [-0.17648719879518487, -0.17648719879518487], y: [-331.7282058319586, -331.7282058319586], zDepth: -1, scale: [1, 1] }, { category: "horns", x: [9.400884789156628, 9.400884789156628], y: [175.59916615599323, 175.59916615599323], zDepth: 23, scale: [1, 1], linked: !1 }, { category: "horns", x: [148.79941641566265, 148.79941641566265], y: [-61.87330184099474, -61.87330184099474], zDepth: 6, scale: [0.4, 1], rotation: [-126, -126], linked: !1 }, { category: "horns", x: [-151.7644013554217, -151.7644013554217], y: [-120.3348511632839, -120.3348511632839], zDepth: 23, scale: [0.15, 0.65], flip: !0, rotation: [-137, -137], linked: !1 }, { category: "spec", x: [-123.82341867469887, -123.82341867469887], y: [51.29301969514982, 51.29301969514982], zDepth: 35, scale: [1, 1] }, { category: "spec", x: [98.33278426204814, 98.33278426204814], y: [88.60241352045104, 88.60241352045104], zDepth: 35, scale: [1, 1] }], bodyZDepth: 10 },
  "body-cloud": { slots: [{ category: "mouth", x: [8.912603539156626, 8.912603539156626], y: [-195.53605045180723, -195.53605045180723], zDepth: 18, scale: [1, 1] }, { category: "sclera", x: [-179.39923757530124, -179.39923757530124], y: [-33.77376694277108, -33.77376694277108], zDepth: 26, scale: [1.75, 3] }, { category: "sclera", x: [179.7639777861446, 179.7639777861446], y: [-33.77376694277108, -33.77376694277108], zDepth: 26, scale: [1.75, 3], flip: !0 }, { category: "pupil", x: [-179.39923757530124, -179.39923757530124], y: [-33.77376694277108, -33.77376694277108], zDepth: 34, scale: [1, 1] }, { category: "pupil", x: [179.7639777861446, 179.7639777861446], y: [-33.77376694277108, -33.77376694277108], zDepth: 34, scale: [1, 1], flip: !0 }, { category: "arms", x: [186.03538968373493, 186.03538968373493], y: [-192.27154932228913, -192.27154932228913], zDepth: 0, scale: [0.5, 1] }, { category: "arms", x: [-185.67064947289157, -185.67064947289157], y: [-192.27154932228913, -192.27154932228913], zDepth: 0, scale: [0.5, 1], flip: !0 }, { category: "legs", x: [-98.57867469879518, -98.57867469879518], y: [-228.6945538403615, -228.6945538403615], zDepth: 0, scale: [0.5, 0.75] }, { category: "legs", x: [98.94341490963855, 98.94341490963855], y: [-228.6945538403615, -228.6945538403615], zDepth: 0, scale: [0.5, 0.75], flip: !0 }, { category: "shadow", x: [-0.18824109111923767, -0.18824109111923767], y: [-476.4029689629348, -476.4029689629348], zDepth: -1, scale: [1, 1] }, { category: "ear", x: [231.16881588855424, 231.16881588855424], y: [17.444427710843396, 17.444427710843396], zDepth: -1, scale: [0.45, 1], rotation: [-53, -53] }, { category: "ear", x: [-230.80407567771087, -230.80407567771087], y: [17.444427710843396, 17.444427710843396], zDepth: -1, scale: [0.45, 1], flip: !0, rotation: [-53, -53] }, { category: "brows", x: [-175.8518448795181, -175.8518448795181], y: [163.9507247740964, 163.9507247740964], zDepth: 34, scale: [0.6, 1] }, { category: "brows", x: [176.21658509036146, 176.21658509036146], y: [163.9507247740964, 163.9507247740964], zDepth: 34, scale: [0.6, 1], flip: !0 }, { category: "nose", x: [-4.323936370481928, -4.323936370481928], y: [-96.03256777108433, -96.03256777108433], zDepth: 44, scale: [0.4, 0.4] }, { category: "spec", x: [-196.50084713855426, -196.50084713855426], y: [-9.912697665662694, -9.912697665662694], zDepth: 35, scale: [1, 1] }, { category: "spec", x: [162.6623682228916, 162.6623682228916], y: [-9.912697665662694, -9.912697665662694], zDepth: 35, scale: [1, 1] }, { category: "horns", x: [18.478209713855428, 18.478209713855428], y: [173.33349294327604, 173.33349294327604], zDepth: 26, scale: [1.4, 1.4], flip: !0 }], bodyZDepth: 10 }
}, Xe = Ue, Q0 = Object.fromEntries(
  Object.entries(Xe).filter(([l]) => !l.startsWith("_"))
), Ee = [
  { id: "grad-e8d5b5-68412b", startHex: "#E8D5B5", endHex: "#68412b" },
  { id: "grad-fffbb9-68412b", startHex: "#fffbb9", endHex: "#68412b" },
  { id: "grad-ecf8c6-68412b", startHex: "#ecf8c6", endHex: "#68412b" },
  { id: "grad-a9cc8a-f47cda", startHex: "#a9cc8a", endHex: "#f47cda" },
  { id: "grad-c1fdff-f47cda", startHex: "#c1fdff", endHex: "#f47cda" },
  { id: "grad-fffbb9-f47cda", startHex: "#fffbb9", endHex: "#f47cda" },
  { id: "grad-fecdfa-f47cda", startHex: "#fecdfa", endHex: "#f47cda" },
  { id: "grad-c1fdff-7c41ad", startHex: "#c1fdff", endHex: "#7c41ad" },
  { id: "grad-fecdfa-7c41ad", startHex: "#fecdfa", endHex: "#7c41ad" },
  { id: "grad-fffbb9-7c41ad", startHex: "#fffbb9", endHex: "#7c41ad" },
  { id: "grad-ecf8c6-e0576a", startHex: "#ecf8c6", endHex: "#e0576a" },
  { id: "grad-c1fdff-e0576a", startHex: "#c1fdff", endHex: "#e0576a" },
  { id: "grad-febed0-e0576a", startHex: "#febed0", endHex: "#e0576a" },
  { id: "grad-fffbb9-e0576a", startHex: "#fffbb9", endHex: "#e0576a" },
  { id: "grad-ecf8c6-f1966a", startHex: "#ecf8c6", endHex: "#f1966a" },
  { id: "grad-fecdfa-f1966a", startHex: "#fecdfa", endHex: "#f1966a" },
  { id: "grad-ffd877-f1966a", startHex: "#ffd877", endHex: "#f1966a" },
  { id: "grad-e8d5b5-a9cc8a", startHex: "#E8D5B5", endHex: "#a9cc8a" },
  { id: "grad-ecf8c6-a9cc8a", startHex: "#ecf8c6", endHex: "#a9cc8a" },
  { id: "grad-fecdfa-a9cc8a", startHex: "#fecdfa", endHex: "#a9cc8a" },
  { id: "grad-c1fdff-f7ed1a", startHex: "#c1fdff", endHex: "#f7ed1a" },
  { id: "grad-ecf8c6-f7ed1a", startHex: "#ecf8c6", endHex: "#f7ed1a" },
  { id: "grad-c1fdff-53a0ff", startHex: "#c1fdff", endHex: "#53a0ff" },
  { id: "grad-9ee4fd-53a0ff", startHex: "#9ee4fd", endHex: "#53a0ff" },
  { id: "grad-abe8e8-53a0ff", startHex: "#abe8e8", endHex: "#53a0ff" },
  { id: "grad-ffd9ad-653d2a", startHex: "#ffd9ad", endHex: "#653d2a" },
  { id: "grad-fffbb9-9c9500", startHex: "#fffbb9", endHex: "#9c9500" },
  { id: "grad-c1fdff-538328", startHex: "#c1fdff", endHex: "#538328" }
];
function z0() {
  return Object.keys(Q0).filter(
    (l) => hA.some((A) => A.id === l) || KA.some((A) => A.id === l)
  );
}
const xe = new Ve();
function We(l = {}) {
  const A = l.preferredBodyId ?? xe.next(z0());
  return { parts: fe(
    A,
    null,
    null,
    KA,
    {
      matchPairs: l.matchPairs,
      bodyConfigs: Q0,
      partManifest: hA,
      gradientManifest: Ee
    }
  ) };
}
function He(l, A = {}) {
  if (l <= 0) return [];
  const i = z0();
  for (let t = i.length - 1; t > 0; t--) {
    const a = Math.floor(Math.random() * (t + 1));
    [i[t], i[a]] = [i[a], i[t]];
  }
  const s = Math.min(l, i.length), e = [];
  for (let t = 0; t < s; t++)
    e.push(We({ preferredBodyId: i[t], matchPairs: A.matchPairs }));
  return e;
}
export {
  de as ANIMATION_NAMES,
  HA as DEFAULT_ANIMATION_CONFIG,
  x0 as DEFAULT_LIGHTING,
  ke as Mascot,
  ze as MascotRenderer,
  HA as RUNTIME_ANIMATION_CONFIG,
  Ee as RUNTIME_GRADIENT_MANIFEST,
  Fe as RUNTIME_LIGHTING_CONFIG,
  he as RUNTIME_LIGHTING_CONFIG_DARK,
  Qe as RUNTIME_LIGHTING_CONFIG_LIGHT,
  hA as RUNTIME_PART_MANIFEST,
  We as randomizeMascot,
  He as randomizeMascots
};
//# sourceMappingURL=index.js.map
