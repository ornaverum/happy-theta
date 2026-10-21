/* Stitch Sculpt — 3D viewport (three.js). Knows how to draw parts; the app owns the data. */
(function (root) {
  'use strict';
  const SS = root.SS;
  const THREE = root.THREE;
  const MESH_COLS = 64, MESH_ROWS = 72;

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  class Viewport {
    constructor(el, cb) {
      this.el = el;
      this.cb = cb || {};
      this.items = new Map(); // id -> {mesh, part}
      this.mode = 'translate';
      this.selectedId = null;

      const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);

      const scene = this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
      this.camera.position.set(13, 11, 20);

      scene.add(new THREE.HemisphereLight(0xfff6ea, 0x8c7462, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.9);
      sun.position.set(8, 16, 12);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xffe7d6, 0.6);
      fill.position.set(-10, 4, -8);
      scene.add(fill);

      this.grid = new THREE.GridHelper(40, 40, 0xb9a893, 0xd8cbb8);
      this.grid.material.transparent = true;
      this.grid.material.opacity = 0.7;
      scene.add(this.grid);

      const orbit = this.orbit = new THREE.OrbitControls(this.camera, renderer.domElement);
      orbit.target.set(0, 3, 0);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.12;
      orbit.update();

      const tc = this.tc = new THREE.TransformControls(this.camera, renderer.domElement);
      tc.setSize(0.85);
      tc.addEventListener('dragging-changed', e => {
        orbit.enabled = !e.value;
        if (!e.value && this.cb.onTransformEnd) this.cb.onTransformEnd();
      });
      tc.addEventListener('objectChange', () => {
        const o = tc.object;
        if (o && this.cb.onTransform) this.cb.onTransform(o.userData.id, o.position, o.rotation, o.scale);
      });
      scene.add(tc.getHelper());

      // overlays
      this.overlay = new THREE.Group();
      scene.add(this.overlay);
      this.showRounds = true;

      // sculpt cursor
      const ringGeo = new THREE.RingGeometry(0.94, 1, 48);
      this.cursor = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x2f7d8c, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.9 }));
      this.cursor.renderOrder = 10;
      this.cursor.visible = false;
      scene.add(this.cursor);

      // reference image
      this.ref = null;

      this.raycaster = new THREE.Raycaster();
      this.sculpting = false;
      this.brushRadius = 1.2;
      this.bindPointer();

      new ResizeObserver(() => this.resize()).observe(el);
      this.resize();
      this.setBackground();
      const loop = () => { orbit.update(); renderer.render(scene, this.camera); requestAnimationFrame(loop); };
      loop();
    }

    setBackground() {
      const bg = new THREE.Color(css('--vp') || '#efe6d8');
      this.renderer.setClearColor(bg, 1);
      const dark = bg.r + bg.g + bg.b < 1.2;
      const visible = this.grid.visible;
      this.scene.remove(this.grid);
      this.grid.geometry.dispose(); this.grid.material.dispose();
      this.grid = new THREE.GridHelper(40, 40, dark ? 0x6b5c50 : 0xb9a893, dark ? 0x3d342d : 0xd8cbb8);
      this.grid.material.transparent = true;
      this.grid.material.opacity = 0.7;
      this.grid.visible = visible;
      this.scene.add(this.grid);
    }

    resize() {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    // ---------- parts ----------
    buildGeometry(part) {
      const g = SS.buildGrid(part, MESH_COLS, MESH_ROWS);
      const C = MESH_COLS + 1, R = MESH_ROWS + 1;
      const pos = new Float32Array(C * R * 3), uv = new Float32Array(C * R * 2);
      for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
        const src = (j * MESH_COLS + (i % MESH_COLS)) * 3, dst = (j * C + i);
        pos[dst * 3] = g.pos[src]; pos[dst * 3 + 1] = g.pos[src + 1]; pos[dst * 3 + 2] = g.pos[src + 2];
        uv[dst * 2] = i / MESH_COLS; uv[dst * 2 + 1] = j / MESH_ROWS;
      }
      const idx = [];
      for (let j = 0; j < MESH_ROWS; j++) for (let i = 0; i < MESH_COLS; i++) {
        const a = j * C + i, b = a + 1, c = a + C, d = c + 1;
        // wind so normals point outward for a bottom-to-top profile
        idx.push(a, c, b, b, c, d);
      }
      let geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      this.fixNormals(geo, part);
      geo.computeBoundingSphere();
      return geo;
    }
    fixNormals(geo, part) {
      const n = geo.attributes.normal, C = MESH_COLS + 1, R = MESH_ROWS + 1;
      const v = new THREE.Vector3(), w = new THREE.Vector3();
      for (let j = 0; j < R; j++) { // seam
        const a = j * C, b = j * C + MESH_COLS;
        v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
        n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
      }
      const poles = [];
      if (SS.isStartClosed(part)) poles.push([0, -1]);
      if (SS.isEndClosed(part)) poles.push([R - 1, 1]);
      poles.forEach(([j, s]) => { for (let i = 0; i < C; i++) n.setXYZ(j * C + i, 0, s, 0); });
      n.needsUpdate = true;
    }

    syncParts(parts, selectedId) {
      const seen = new Set();
      parts.forEach(p => {
        seen.add(p.id);
        let it = this.items.get(p.id);
        if (!it) {
          const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(this.buildGeometry(p), mat);
          mesh.userData.id = p.id;
          this.scene.add(mesh);
          it = { mesh, part: p, geoKey: '' };
          this.items.set(p.id, it);
        }
        it.part = p;
        const key = JSON.stringify(p.profile) + (p.disp ? p.disp.data.length + ':' + hashArr(p.disp.data) : '');
        if (key !== it.geoKey) {
          it.mesh.geometry.dispose();
          it.mesh.geometry = this.buildGeometry(p);
          it.geoKey = key;
        }
        it.mesh.material.color.set(p.color);
        it.mesh.visible = p.visible !== false;
        if (!(this.tc.dragging && this.tc.object === it.mesh)) {
          it.mesh.position.fromArray(p.position);
          it.mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2]);
          it.mesh.scale.fromArray(p.scale);
        }
      });
      for (const [id, it] of this.items) {
        if (!seen.has(id)) { this.scene.remove(it.mesh); it.mesh.geometry.dispose(); it.mesh.material.dispose(); this.items.delete(id); }
      }
      this.select(selectedId);
    }

    /** Fast path while sculpting: rebuild one part's geometry now. */
    refreshPart(part) {
      const it = this.items.get(part.id);
      if (!it) return;
      it.mesh.geometry.dispose();
      it.mesh.geometry = this.buildGeometry(part);
      it.geoKey = JSON.stringify(part.profile) + (part.disp ? part.disp.data.length + ':' + hashArr(part.disp.data) : '');
    }

    select(id) {
      this.selectedId = id;
      for (const [pid, it] of this.items) {
        it.mesh.material.emissive.set(pid === id ? 0x3a1a0c : 0x000000);
      }
      const it = id && this.items.get(id);
      if (it && this.mode !== 'sculpt' && it.mesh.visible) { if (this.tc.object !== it.mesh) this.tc.attach(it.mesh); }
      else this.tc.detach();
    }

    setMode(mode) {
      this.mode = mode;
      if (mode !== 'sculpt') this.tc.setMode(mode);
      this.el.classList.toggle('sculpting', mode === 'sculpt');
      this.cursor.visible = false;
      this.select(this.selectedId);
    }

    // ---------- rounds overlay ----------
    setRounds(results) {
      this.lastResults = results;
      this.overlay.clear();
      if (!this.showRounds || !results) return;
      const linePts = [];
      const incs = [], decs = [];
      results.forEach(res => {
        const it = this.items.get(res.partId);
        if (!it || !it.mesh.visible) return;
        res.rounds.forEach(r => {
          const p = r.ring.pts, n = p.length / 3;
          if (r.ring.perimeter < 0.05) return;
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            linePts.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
          }
        });
        SS.markers(res).forEach(m => (m.kind === 'inc' ? incs : decs).push(m.p[0], m.p[1], m.p[2]));
      });
      if (linePts.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
        const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3a2e28, transparent: true, opacity: 0.28 }));
        this.overlay.add(l);
      }
      const addPts = (arr, color) => {
        if (!arr.length) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        this.overlay.add(new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.32, sizeAttenuation: true })));
      };
      addPts(incs, 0x3b9b5b);
      addPts(decs, 0xc4463a);
    }

    /** Thick accent ring for the round being hovered in the pattern list. */
    highlight(res, roundIdx) {
      if (this.hl) { this.scene.remove(this.hl); this.hl.geometry.dispose(); this.hl = null; }
      if (!res || roundIdx == null) return;
      const pts = [];
      [].concat(roundIdx).forEach(k => {
        const r = res.rounds[k];
        if (!r || r.ring.perimeter < 0.05) return;
        const p = r.ring.pts, n = p.length / 3;
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; pts.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], p[j * 3], p[j * 3 + 1], p[j * 3 + 2]); }
      });
      if (!pts.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.hl = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xdf7b5c, depthTest: false }));
      this.hl.renderOrder = 5;
      this.scene.add(this.hl);
    }

    // ---------- pointer ----------
    ndc(e) {
      const rc = this.renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    }
    raycast(e, onlyId) {
      this.raycaster.setFromCamera(this.ndc(e), this.camera);
      const meshes = [];
      for (const [id, it] of this.items) if (it.mesh.visible && (!onlyId || id === onlyId)) meshes.push(it.mesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      return hits[0] || null;
    }
    bindPointer() {
      const dom = this.renderer.domElement;
      let downAt = null;
      dom.addEventListener('pointerdown', e => {
        downAt = [e.clientX, e.clientY];
        if (this.mode === 'sculpt' && e.button === 0 && !e.altKey) {
          const hit = this.raycast(e);
          if (hit) {
            const id = hit.object.userData.id;
            if (id !== this.selectedId && this.cb.onPick) this.cb.onPick(id);
            this.sculpting = true;
            this.orbit.enabled = false;
            dom.setPointerCapture(e.pointerId);
            this.emitSculpt(hit, e, true);
          }
        }
      }, true);
      dom.addEventListener('pointermove', e => {
        if (this.mode !== 'sculpt') return;
        const hit = this.raycast(e, this.sculpting ? this.selectedId : null);
        this.placeCursor(hit);
        if (this.sculpting && hit) this.emitSculpt(hit, e, false);
      });
      const end = e => {
        if (this.sculpting) {
          this.sculpting = false;
          this.orbit.enabled = true;
          if (this.cb.onSculptEnd) this.cb.onSculptEnd();
          downAt = null;
          return;
        }
        if (downAt && e.button === 0 && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5 && !this.tc.dragging && this.tc.axis === null) {
          const hit = this.raycast(e);
          if (this.cb.onPick) this.cb.onPick(hit ? hit.object.userData.id : null);
        }
        downAt = null;
      };
      dom.addEventListener('pointerup', end);
      dom.addEventListener('pointerleave', () => { this.cursor.visible = false; });
    }
    placeCursor(hit) {
      if (!hit || this.mode !== 'sculpt') { this.cursor.visible = false; return; }
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      this.cursor.position.copy(hit.point).addScaledVector(n, 0.02);
      this.cursor.lookAt(hit.point.clone().add(n));
      const s = this.brushRadius;
      this.cursor.scale.set(s, s, s);
      this.cursor.visible = true;
    }
    emitSculpt(hit, e, first) {
      if (!this.cb.onSculpt) return;
      const local = hit.object.worldToLocal(hit.point.clone());
      this.cb.onSculpt(hit.object.userData.id, local, hit.uv, { invert: e.shiftKey, first });
    }

    // ---------- camera ----------
    view(name) {
      const t = this.orbit.target.clone();
      const d = this.camera.position.distanceTo(t);
      const dirs = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.0001], persp: [0.5, 0.42, 0.76] };
      const v = new THREE.Vector3().fromArray(dirs[name] || dirs.persp).normalize().multiplyScalar(d);
      this.camera.position.copy(t).add(v);
      this.camera.lookAt(t);
      this.orbit.update();
    }
    frame(parts) {
      const box = new THREE.Box3();
      let any = false;
      for (const [, it] of this.items) if (it.mesh.visible && (!parts || parts.includes(it.part.id))) { box.expandByObject(it.mesh); any = true; }
      if (!any) return;
      const c = box.getCenter(new THREE.Vector3()), r = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);
      const dir = this.camera.position.clone().sub(this.orbit.target).normalize();
      this.orbit.target.copy(c);
      this.camera.position.copy(c).addScaledVector(dir, r / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 1.1);
      this.orbit.update();
    }

    // ---------- reference image ----------
    setReference(img, heightCm, opacity) {
      if (this.ref) { this.scene.remove(this.ref); this.ref.geometry.dispose(); this.ref.material.map.dispose(); this.ref.material.dispose(); this.ref = null; }
      if (!img) return;
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const aspect = img.naturalWidth / img.naturalHeight || 1;
      const geo = new THREE.PlaneGeometry(aspect, 1);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = -1;
      this.ref = m;
      this.scene.add(m);
      this.updateReference(heightCm, opacity);
    }
    updateReference(heightCm, opacity) {
      if (!this.ref) return;
      this.ref.scale.set(heightCm, heightCm, 1);
      this.ref.position.set(0, heightCm / 2, 0);
      this.ref.material.opacity = opacity;
    }

    snapshot() { return this.renderer.domElement.toDataURL('image/png'); }
  }

  function hashArr(a) {
    let h = 0;
    for (let i = 0; i < a.length; i++) h = (h * 31 + Math.round(a[i] * 1000)) | 0;
    return h;
  }

  SS.Viewport = Viewport;
  SS.MESH_COLS = MESH_COLS;
  SS.MESH_ROWS = MESH_ROWS;
})(window);
