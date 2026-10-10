import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

export default function GlobeViewer({
  isPlaying,
  simSpeed,
  thresholdKm,
  layers,
  isManeuverDone,
  isKesslerActive,
  onTelemetryUpdate,
  cameraFocusTarget,
}) {
  const mountRef = useRef(null);
  const [hoveredObj, setHoveredObj] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Store dynamic props in refs so the Three.js scene is NEVER destroyed and rebuilt on state changes
  const isPlayingRef = useRef(isPlaying);
  const simSpeedRef = useRef(simSpeed);
  const thresholdKmRef = useRef(thresholdKm);
  const layersRef = useRef(layers);
  const isManeuverDoneRef = useRef(isManeuverDone);
  const isKesslerActiveRef = useRef(isKesslerActive);
  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  const cameraFocusTargetRef = useRef(cameraFocusTarget);

  // Sync props to refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { thresholdKmRef.current = thresholdKm; }, [thresholdKm]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { isManeuverDoneRef.current = isManeuverDone; }, [isManeuverDone]);
  useEffect(() => { isKesslerActiveRef.current = isKesslerActive; }, [isKesslerActive]);
  useEffect(() => { onTelemetryUpdateRef.current = onTelemetryUpdate; }, [onTelemetryUpdate]);
  useEffect(() => { cameraFocusTargetRef.current = cameraFocusTarget; }, [cameraFocusTarget]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // --- Three.js Scene Setup (Runs ONCE on mount) ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 80, 220);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    dirLight.position.set(100, 50, 100);
    scene.add(dirLight);

    // --- Earth Globe ---
    const EARTH_RADIUS = 35; // visual units (~6,371 km)
    const KM_SCALE = EARTH_RADIUS / 6371;

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // Earth Sphere
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 48, 48);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x0f172a,
      emissive: 0x071e3d,
      specular: 0x38bdf8,
      shininess: 15,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Earth Latitude / Longitude Wireframe Grid
    const gridGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_RADIUS + 0.1, 24, 24));
    const gridMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.25 });
    const gridMesh = new THREE.LineSegments(gridGeo, gridMat);
    earthGroup.add(gridMesh);

    // Atmosphere Glow
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    earthGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    // --- Label Sprite Generator Helper ---
    function createLabelSprite(primaryText, subText, themeHex = '#38bdf8', isThreat = false) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 140;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = isThreat ? 'rgba(35, 10, 15, 0.92)' : 'rgba(10, 17, 34, 0.88)';
      ctx.strokeStyle = isThreat ? '#ef4444' : themeHex;
      ctx.lineWidth = 4;

      const r = 18;
      const x = 8, y = 8, w = 496, h = 124;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isThreat ? '#ef4444' : themeHex;
      ctx.beginPath();
      ctx.arc(42, 50, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(primaryText, 70, 58);

      ctx.font = '24px monospace, sans-serif';
      ctx.fillStyle = isThreat ? '#fca5a5' : '#94a3b8';
      ctx.fillText(subText, 70, 100);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(15, 4.2, 1);
      sprite.center.set(0.05, -0.45);
      return sprite;
    }

    // --- Orbital Coordinate Resolver ---
    function getOrbitalVector(obj, time, altBoost = 0) {
      const r = EARTH_RADIUS + ((obj.alt + altBoost) * KM_SCALE);
      const theta = obj.meanAnom + obj.speed * time;
      const xp = r * Math.cos(theta);
      const yp = r * Math.sin(theta);

      const x = xp * Math.cos(obj.raan) - yp * Math.cos(obj.inc) * Math.sin(obj.raan);
      const y = yp * Math.sin(obj.inc);
      const z = xp * Math.sin(obj.raan) + yp * Math.cos(obj.inc) * Math.cos(obj.raan);
      return new THREE.Vector3(x, y, z);
    }

    // --- Primary Active Satellites ---
    const primarySats = [
      { id: 'ISS', name: 'ISS (ZARYA)', norad: '25544', type: 'Station', alt: 420, inc: 51.6 * Math.PI / 180, raan: 0.8, meanAnom: 0.4, speed: 0.0016, color: 0x38bdf8, hex: '#38bdf8', size: 1.4 },
      { id: 'HST', name: 'Hubble Telescope', norad: '20580', type: 'Observatory', alt: 540, inc: 28.5 * Math.PI / 180, raan: 2.1, meanAnom: 1.2, speed: 0.0014, color: 0x34d399, hex: '#34d399', size: 1.1 },
      { id: 'STARLINK', name: 'Starlink-3120', norad: '51234', type: 'Constellation', alt: 550, inc: 53.2 * Math.PI / 180, raan: 1.5, meanAnom: 3.8, speed: 0.0014, color: 0xfacc15, hex: '#facc15', size: 1.0 },
      { id: 'SENTINEL', name: 'Sentinel-1A', norad: '39634', type: 'Earth Obs', alt: 693, inc: 98.1 * Math.PI / 180, raan: 4.0, meanAnom: 2.5, speed: 0.0013, color: 0xa78bfa, hex: '#a78bfa', size: 1.1 },
    ];

    // --- Critical Threat Debris ---
    const threatDebris = {
      id: 'COSMOS-DEB',
      name: '⚠️ COSMOS-2251 DEB',
      norad: '34000',
      type: 'Hypervelocity Debris',
      alt: 422,
      inc: 51.5 * Math.PI / 180,
      raan: 0.78,
      meanAnom: 0.38,
      speed: 0.00159,
      color: 0xef4444,
      hex: '#ef4444',
      size: 1.2,
      isThreat: true,
    };

    // --- Major Tracked Space Debris Pieces ---
    const trackedDebrisList = [
      { id: 'FENGYUN', name: 'FENGYUN-1C DEB', norad: '29712', type: 'ASAT Debris', alt: 850, inc: 98.6 * Math.PI / 180, raan: 3.1, meanAnom: 1.8, speed: 0.0012, color: 0xf87171, hex: '#f87171', size: 0.95, isDebris: true },
      { id: 'SL16', name: 'SL-16 R/B (Zenit)', norad: '22676', type: 'Rocket Body (9t)', alt: 840, inc: 71.0 * Math.PI / 180, raan: 5.2, meanAnom: 0.9, speed: 0.00125, color: 0xfb923c, hex: '#fb923c', size: 1.2, isDebris: true },
      { id: 'IRIDIUM', name: 'IRIDIUM-33 DEB', norad: '33750', type: 'Collision Frag', alt: 775, inc: 86.4 * Math.PI / 180, raan: 1.9, meanAnom: 4.2, speed: 0.0013, color: 0xf43f5e, hex: '#f43f5e', size: 0.9, isDebris: true },
      { id: 'CZ4B', name: 'CZ-4B DEB', norad: '26042', type: 'Upper Stage', alt: 720, inc: 98.2 * Math.PI / 180, raan: 0.4, meanAnom: 2.1, speed: 0.00135, color: 0xfbbf24, hex: '#fbbf24', size: 0.9, isDebris: true },
      { id: 'ENVISAT', name: 'ENVISAT (Derelict)', norad: '27386', type: 'Dead Sat (8t)', alt: 765, inc: 98.5 * Math.PI / 180, raan: 2.7, meanAnom: 5.1, speed: 0.0013, color: 0xe879f9, hex: '#e879f9', size: 1.1, isDebris: true },
    ];

    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);

    const interactiveMeshes = [];

    // Satellite Meshes & Labels
    const satMeshes = primarySats.map((sat) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(sat.size, 16, 16),
        new THREE.MeshBasicMaterial({ color: sat.color })
      );
      mesh.userData = sat;
      scene.add(mesh);
      interactiveMeshes.push(mesh);

      const label = createLabelSprite(sat.name, `Alt: ${sat.alt}km • 7.6 km/s`, sat.hex, false);
      labelsGroup.add(label);

      return { sat, mesh, label };
    });

    // Threat Debris Mesh & Label
    const threatMesh = new THREE.Mesh(
      new THREE.SphereGeometry(threatDebris.size, 16, 16),
      new THREE.MeshBasicMaterial({ color: threatDebris.color })
    );
    threatMesh.userData = threatDebris;
    scene.add(threatMesh);
    interactiveMeshes.push(threatMesh);

    const threatLabel = createLabelSprite(
      threatDebris.name,
      `NORAD ${threatDebris.norad} • Rel V: 14.3 km/s`,
      '#ef4444',
      true
    );
    labelsGroup.add(threatLabel);

    // Tracked Debris Meshes & Labels
    const trackedDebrisMeshes = trackedDebrisList.map((deb) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(deb.size, 14, 14),
        new THREE.MeshBasicMaterial({ color: deb.color })
      );
      mesh.userData = deb;
      scene.add(mesh);
      interactiveMeshes.push(mesh);

      const label = createLabelSprite(deb.name, `Alt: ${deb.alt}km • ${deb.type}`, deb.hex, true);
      labelsGroup.add(label);

      return { deb, mesh, label };
    });

    // Orbit Path Rings
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    primarySats.forEach((sat) => {
      const pts = [];
      for (let a = 0; a <= Math.PI * 2; a += 0.08) {
        const r = EARTH_RADIUS + (sat.alt * KM_SCALE);
        const xp = r * Math.cos(a);
        const yp = r * Math.sin(a);
        pts.push(new THREE.Vector3(
          xp * Math.cos(sat.raan) - yp * Math.cos(sat.inc) * Math.sin(sat.raan),
          yp * Math.sin(sat.inc),
          xp * Math.sin(sat.raan) + yp * Math.cos(sat.inc) * Math.cos(sat.raan)
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: sat.color, opacity: 0.35, transparent: true }));
      orbitGroup.add(line);
    });

    // Threat Orbit Path
    const threatPts = [];
    for (let a = 0; a <= Math.PI * 2; a += 0.08) {
      const r = EARTH_RADIUS + (threatDebris.alt * KM_SCALE);
      const xp = r * Math.cos(a);
      const yp = r * Math.sin(a);
      threatPts.push(new THREE.Vector3(
        xp * Math.cos(threatDebris.raan) - yp * Math.cos(threatDebris.inc) * Math.sin(threatDebris.raan),
        yp * Math.sin(threatDebris.inc),
        xp * Math.sin(threatDebris.raan) + yp * Math.cos(threatDebris.inc) * Math.cos(threatDebris.raan)
      ));
    }
    const threatOrbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(threatPts),
      new THREE.LineBasicMaterial({ color: 0xef4444, opacity: 0.45, transparent: true })
    );
    orbitGroup.add(threatOrbitLine);

    // 600+ Space Debris Particles Cloud
    const NUM_DEBRIS = 600;
    const debrisGeo = new THREE.BufferGeometry();
    const debrisPos = new Float32Array(NUM_DEBRIS * 3);
    const debrisParams = [];

    for (let i = 0; i < NUM_DEBRIS; i++) {
      const alt = 300 + Math.random() * 1100;
      const inc = (Math.random() * 120) * Math.PI / 180;
      const raan = Math.random() * Math.PI * 2;
      const meanAnom = Math.random() * Math.PI * 2;
      const speed = (0.0012 + Math.random() * 0.0006) * (Math.random() > 0.5 ? 1 : -1);
      debrisParams.push({ alt, inc, raan, meanAnom, speed });
    }

    debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
    const debrisMat = new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.85, transparent: true, opacity: 0.75 });
    const debrisCloudMesh = new THREE.Points(debrisGeo, debrisMat);
    scene.add(debrisCloudMesh);

    // Conjunction Warning Laser Line
    const threatLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const threatLineMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, linewidth: 2 });
    const threatLine = new THREE.Line(threatLineGeo, threatLineMat);
    scene.add(threatLine);

    // Kessler Fragmentation Cloud
    let kesslerParticles = [];
    const kesslerGroup = new THREE.Group();
    scene.add(kesslerGroup);
    let kesslerSpawned = false;

    // Camera Orbit Controls
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: 220, theta: 0.5, phi: 1.2 };
    let targetSpherical = null; // Used for smooth camera focus lerp

    function updateCameraFromSpherical() {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    }
    updateCameraFromSpherical();

    // Raycaster for Hover detection
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2();

    const onMouseDown = (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMove = (e) => {
      if (isDragging) {
        targetSpherical = null; // Cancel automated lerp on manual drag
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        spherical.theta -= dx * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.005));
        updateCameraFromSpherical();
        prevMouse = { x: e.clientX, y: e.clientY };
      }

      // Check hover
      const rect = currentMount.getBoundingClientRect();
      mouse2D.x = ((e.clientX - rect.left) / currentMount.clientWidth) * 2 - 1;
      mouse2D.y = -((e.clientY - rect.top) / currentMount.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse2D, camera);
      const intersects = raycaster.intersectObjects(interactiveMeshes);

      if (intersects.length > 0) {
        currentMount.style.cursor = 'pointer';
        setHoveredObj(intersects[0].object.userData);
        setTooltipPos({
          x: Math.min(window.innerWidth - 260, e.clientX + 16),
          y: Math.min(window.innerHeight - 160, e.clientY + 16),
        });
      } else {
        currentMount.style.cursor = isDragging ? 'grabbing' : 'grab';
        setHoveredObj(null);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      targetSpherical = null;
      spherical.radius = Math.max(70, Math.min(450, spherical.radius + e.deltaY * 0.2));
      updateCameraFromSpherical();
    };

    currentMount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    currentMount.addEventListener('wheel', onWheel, { passive: false });

    // Window Resize
    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    let simTime = 0;
    let animId = null;
    let lastTelemetryTime = 0;
    let prevFocusTrigger = null;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Check if camera focus on threat was requested
      if (cameraFocusTargetRef.current && cameraFocusTargetRef.current !== prevFocusTrigger) {
        prevFocusTrigger = cameraFocusTargetRef.current;
        targetSpherical = { radius: 105, theta: 0.95, phi: 1.15 };
      }

      // Smoothly interpolate (lerp) camera if targetSpherical is active
      if (targetSpherical) {
        spherical.radius += (targetSpherical.radius - spherical.radius) * 0.05;
        spherical.theta += (targetSpherical.theta - spherical.theta) * 0.05;
        spherical.phi += (targetSpherical.phi - spherical.phi) * 0.05;
        updateCameraFromSpherical();
        if (Math.abs(spherical.radius - targetSpherical.radius) < 0.5) {
          targetSpherical = null;
        }
      }

      if (isPlayingRef.current) {
        simTime += simSpeedRef.current * 0.05;
      }

      // Earth slow rotation
      earthGroup.rotation.y = simTime * 0.0001;

      // Update Primary Satellites & Attached Labels
      const altOffset = isManeuverDoneRef.current ? 18 : 0;
      satMeshes.forEach(({ sat, mesh, label }) => {
        const offset = sat.id === 'ISS' ? altOffset : 0;
        const v = getOrbitalVector(sat, simTime, offset);
        mesh.position.copy(v);
        label.position.copy(v);
      });

      // Update Threat Debris & Label
      const threatV = getOrbitalVector(threatDebris, simTime);
      threatMesh.position.copy(threatV);
      threatLabel.position.copy(threatV);

      // Update Tracked Debris & Labels
      trackedDebrisMeshes.forEach(({ deb, mesh, label }) => {
        const v = getOrbitalVector(deb, simTime);
        mesh.position.copy(v);
        label.position.copy(v);
      });

      // Conjunction Proximity Check
      const issMesh = satMeshes[0].mesh;
      const distUnits = issMesh.position.distanceTo(threatMesh.position);
      const distKm = distUnits / KM_SCALE;

      // Collision probability approx (simplified display model)
      // sigma represents combined positional uncertainty envelope (~5 km for TLE-tracked objects)
      const sigma = 5.0;  // km — realistic TLE uncertainty scale
      const combinedRadius = 0.015;  // km — 15m hard body radius
      let Pc = (Math.pow(combinedRadius, 2) / (2.0 * Math.PI * Math.pow(sigma, 2))) * Math.exp(-Math.pow(distKm, 2) / (2 * Math.pow(sigma, 2)));
      if (isManeuverDoneRef.current) Pc = 1.2e-8;

      // THROTTLE TELEMETRY UPDATE TO REACT: 4 times/sec instead of 60 times/sec to prevent React re-render thrashing
      const now = performance.now();
      if (now - lastTelemetryTime > 250) {
        lastTelemetryTime = now;
        if (onTelemetryUpdateRef.current) {
          onTelemetryUpdateRef.current({
            distKm,
            Pc,
            reqDeltaV: isManeuverDoneRef.current ? 0 : 0.42,
          });
        }
      }

      // Conjunction Threat Vector Laser
      if (distKm <= thresholdKmRef.current && !isManeuverDoneRef.current) {
        threatLine.visible = true;
        const posAttr = threatLine.geometry.attributes.position;
        posAttr.setXYZ(0, issMesh.position.x, issMesh.position.y, issMesh.position.z);
        posAttr.setXYZ(1, threatMesh.position.x, threatMesh.position.y, threatMesh.position.z);
        posAttr.needsUpdate = true;
      } else {
        threatLine.visible = false;
      }

      // Update Debris Cloud
      const positions = debrisCloudMesh.geometry.attributes.position.array;
      for (let i = 0; i < NUM_DEBRIS; i++) {
        const p = debrisParams[i];
        const v = getOrbitalVector(p, simTime);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      }
      debrisCloudMesh.geometry.attributes.position.needsUpdate = true;

      // Trigger Kessler Cascade fragments without destroying the scene
      if (isKesslerActiveRef.current && !kesslerSpawned) {
        kesslerSpawned = true;
        for (let k = 0; k < 300; k++) {
          const fragGeo = new THREE.SphereGeometry(0.4, 8, 8);
          const fragMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xef4444 : 0xf97316 });
          const frag = new THREE.Mesh(fragGeo, fragMat);
          frag.position.copy(issMesh.position);
          const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 0.9
          );
          kesslerGroup.add(frag);
          kesslerParticles.push({ mesh: frag, velocity });
        }
      }

      if (kesslerParticles.length > 0) {
        kesslerParticles = kesslerParticles.filter((p) => {
          p.velocity.multiplyScalar(0.985); // gentle dampen — simulate drag/spread
          p.mesh.position.add(p.velocity);
          // Cull particles that drift beyond visible range to free GPU resources
          if (p.mesh.position.length() > 300) {
            kesslerGroup.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            return false;
          }
          return true;
        });
      }

      // Layer Toggles applied dynamically without re-creating scene
      const curLayers = layersRef.current || {};
      orbitGroup.visible = !!curLayers.orbits;
      debrisCloudMesh.visible = !!curLayers.debris;
      gridMesh.visible = !!curLayers.grid;
      labelsGroup.visible = !!curLayers.labels;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      currentMount.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      currentMount.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);

      // Dispose all Three.js GPU resources to prevent WebGL context leaks
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();

      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []); // Mounted strictly ONCE

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive Telemetry Hover Card */}
      {hoveredObj && (
        <div
          className="fixed pointer-events-none z-50 p-3 rounded-xl hud-glass shadow-2xl text-xs space-y-1.5 transition-opacity duration-150"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className="flex items-center space-x-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: hoveredObj.hex || '#38bdf8' }}
            />
            <span className="font-bold font-mono text-sm text-white">{hoveredObj.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300 font-mono">
            <div>NORAD ID: <strong className="text-cyan-300">{hoveredObj.norad || 'N/A'}</strong></div>
            <div>Type: <strong className="text-slate-100">{hoveredObj.type}</strong></div>
            <div>Altitude: <strong className="text-emerald-400">{hoveredObj.alt} km</strong></div>
            <div>Velocity: <strong className="text-amber-400">7.6 km/s</strong></div>
          </div>
          {hoveredObj.isThreat && (
            <div className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
              CONJUNCTION THREAT OBJECT
            </div>
          )}
        </div>
      )}
    </div>
  );
}
