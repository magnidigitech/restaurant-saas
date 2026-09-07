"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface RestoBirdThreeSceneProps {
  focusedZone?: "all" | "kitchen" | "storage" | "dining" | "pos";
  onSelectZone?: (zone: "all" | "kitchen" | "storage" | "dining" | "pos") => void;
}

export default function RestoBirdThreeScene({
  focusedZone = "all",
  onSelectZone,
}: RestoBirdThreeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const targetPosRef = useRef(new THREE.Vector3(14, 17, 16));
  const targetLookRef = useRef(new THREE.Vector3(0, 0, 0));
  const currentLookRef = useRef(new THREE.Vector3(0, 0, 0));
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Update target camera positions when focusedZone changes
  useEffect(() => {
    switch (focusedZone) {
      case "kitchen":
        targetPosRef.current.set(-2, 11, 8);
        targetLookRef.current.set(-4.5, 0.5, -3.5);
        break;
      case "storage":
        targetPosRef.current.set(8, 12, -1);
        targetLookRef.current.set(5.5, 0.5, -4);
        break;
      case "dining":
        targetPosRef.current.set(4, 13, 11);
        targetLookRef.current.set(1.5, 0.5, 2.5);
        break;
      case "pos":
        targetPosRef.current.set(-8, 11, 7);
        targetLookRef.current.set(-4.5, 0.5, 4);
        break;
      case "all":
      default:
        targetPosRef.current.set(14, 17, 16);
        targetLookRef.current.set(0, 0, 0);
        break;
    }
  }, [focusedZone]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. SCENE & CAMERA (Bird's-eye perspective ~35-45° isometric angle)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080909);
    scene.fog = new THREE.FogExp2(0x080909, 0.022);

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.5, 120);
    camera.position.copy(targetPosRef.current);
    camera.lookAt(targetLookRef.current);

    // 2. RENDERER
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 3. LIGHTING (Atmospheric warm amber + soft silver key light)
    const ambientLight = new THREE.AmbientLight(0x202428, 1.6);
    scene.add(ambientLight);

    const mainKeyLight = new THREE.DirectionalLight(0xfff6ea, 2.4);
    mainKeyLight.position.set(15, 25, 15);
    scene.add(mainKeyLight);

    // Warm amber restaurant accent lights
    const amberPoint1 = new THREE.PointLight(0xf59e0b, 2.8, 18);
    amberPoint1.position.set(2, 4, 3);
    scene.add(amberPoint1);

    const amberPoint2 = new THREE.PointLight(0xd97706, 2.2, 16);
    amberPoint2.position.set(-4, 3.5, -3);
    scene.add(amberPoint2);

    const kitchenCoolLight = new THREE.PointLight(0x38bdf8, 1.4, 14);
    kitchenCoolLight.position.set(-5, 4, -4);
    scene.add(kitchenCoolLight);

    // 4. RESTAURANT ARCHITECTURE SLAB (Isometric Foundation)
    const rootRestaurant = new THREE.Group();
    scene.add(rootRestaurant);

    // Base Floor Slab
    const floorGeo = new THREE.BoxGeometry(18, 0.4, 18);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.35,
      metalness: 0.2,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.2;
    rootRestaurant.add(floorMesh);

    // Subtle Isometric Grid Plane
    const gridHelper = new THREE.GridHelper(18, 18, 0xf59e0b, 0x22262c);
    gridHelper.position.y = 0.02;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.25;
    rootRestaurant.add(gridHelper);

    // Low Architectural Wall Perimeters (Cutaway view)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d22,
      roughness: 0.8,
    });

    const backWallGeo = new THREE.BoxGeometry(18, 1.6, 0.4);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 0.8, -8.8);
    rootRestaurant.add(backWall);

    const leftWallGeo = new THREE.BoxGeometry(0.4, 1.6, 18);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-8.8, 0.8, 0);
    rootRestaurant.add(leftWall);

    // Interior Divider Wall (Separating Kitchen from Dining Floor)
    const dividerWallGeo = new THREE.BoxGeometry(0.3, 1.4, 9);
    const dividerWall = new THREE.Mesh(dividerWallGeo, wallMat);
    dividerWall.position.set(-1, 0.7, -4.5);
    rootRestaurant.add(dividerWall);

    // 5. DINING FLOOR (Tables with warm glows & chairs)
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x2b231c,
      roughness: 0.3,
      metalness: 0.1,
    });
    const chairMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e22,
      roughness: 0.6,
    });
    const lampGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
    });

    const tablePositions = [
      { x: 2.5, z: 1.5, id: "T-04", label: "Table 4" },
      { x: 5.5, z: 1.5, id: "T-07", label: "Table 7" },
      { x: 2.5, z: 5.5, id: "T-12", label: "Table 12" },
      { x: 5.5, z: 5.5, id: "T-18", label: "Table 18 (Delay Alert)" },
      { x: -4.5, z: 5.5, id: "T-01", label: "Table 1" },
    ];

    tablePositions.forEach((pos) => {
      const tableGroup = new THREE.Group();
      tableGroup.position.set(pos.x, 0, pos.z);

      // Table Top
      const topGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24);
      const topMesh = new THREE.Mesh(topGeo, tableMat);
      topMesh.position.y = 0.72;
      tableGroup.add(topMesh);

      // Table Pedestal
      const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.72, 12);
      const legMesh = new THREE.Mesh(legGeo, tableMat);
      legMesh.position.y = 0.36;
      tableGroup.add(legMesh);

      // 4 Surrounding Chairs
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const chair = new THREE.Mesh(
          new THREE.BoxGeometry(0.32, 0.45, 0.32),
          chairMat
        );
        chair.position.set(
          Math.cos(angle) * 1.15,
          0.25,
          Math.sin(angle) * 1.15
        );
        chair.rotation.y = -angle;
        tableGroup.add(chair);
      }

      // Miniature glowing centerpiece lamp
      const lampMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        lampGlowMat
      );
      lampMesh.position.y = 0.82;
      tableGroup.add(lampMesh);

      rootRestaurant.add(tableGroup);
    });

    // 6. COMMERCIAL KITCHEN LINE (Prep benches, hoods, ovens)
    const kitchenLineGroup = new THREE.Group();
    kitchenLineGroup.position.set(-5, 0, -4);

    const stainlessMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.25,
      metalness: 0.85,
    });

    // Central Kitchen Prep Island
    const prepBench = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.85, 1.4),
      stainlessMat
    );
    prepBench.position.set(0, 0.42, 0);
    kitchenLineGroup.add(prepBench);

    // Range Cooktop / Stoves along back
    const cooktop = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.9, 1.1),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.4,
        metalness: 0.7,
      })
    );
    cooktop.position.set(0, 0.45, -2.4);
    kitchenLineGroup.add(cooktop);

    // Exhaust Hood suspended overhead
    const exhaustHood = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.7, 1.4),
      stainlessMat
    );
    exhaustHood.position.set(0, 2.6, -2.4);
    kitchenLineGroup.add(exhaustHood);

    rootRestaurant.add(kitchenLineGroup);

    // 7. COLD STORAGE & PANTRY RACKS
    const storageGroup = new THREE.Group();
    storageGroup.position.set(5.5, 0, -4.5);

    const rackFrameMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.5,
      metalness: 0.6,
    });
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.7,
    });

    // Heavy-duty storage racks
    for (let r = 0; r < 2; r++) {
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 2.2, 0.8),
        rackFrameMat
      );
      rack.position.set(0, 1.1, r * 1.5 - 0.7);
      storageGroup.add(rack);

      // Ingredient crates
      for (let c = 0; c < 3; c++) {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.4, 0.6),
          crateMat
        );
        crate.position.set((c - 1) * 0.85, 0.5 + (c % 2) * 0.55, r * 1.5 - 0.7);
        storageGroup.add(crate);
      }
    }
    rootRestaurant.add(storageGroup);

    // 8. POS / DISPATCH / BAR DESK
    const posDeskGroup = new THREE.Group();
    posDeskGroup.position.set(-5, 0, 3.5);

    const posCounter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.95, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.3,
      })
    );
    posCounter.position.set(0, 0.47, 0);
    posDeskGroup.add(posCounter);

    // Terminal Screen
    const terminalScreen = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    terminalScreen.position.set(0.4, 1.15, 0);
    terminalScreen.rotation.x = -0.2;
    posDeskGroup.add(terminalScreen);

    rootRestaurant.add(posDeskGroup);

    // 9. ANIMATED FLAME / SPICE PARTICLES IN KITCHEN
    const flameCount = 45;
    const flameGeo = new THREE.BufferGeometry();
    const flamePositions = new Float32Array(flameCount * 3);
    const flameColors = new Float32Array(flameCount * 3);

    for (let i = 0; i < flameCount; i++) {
      flamePositions[i * 3] = -5 + (Math.random() - 0.5) * 2.5;
      flamePositions[i * 3 + 1] = 0.9 + Math.random() * 0.9;
      flamePositions[i * 3 + 2] = -6.4 + (Math.random() - 0.5) * 0.6;

      flameColors[i * 3] = 1.0;
      flameColors[i * 3 + 1] = 0.45 + Math.random() * 0.3;
      flameColors[i * 3 + 2] = 0.05;
    }
    flameGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(flamePositions, 3)
    );
    flameGeo.setAttribute("color", new THREE.BufferAttribute(flameColors, 3));

    const flameMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const flameParticles = new THREE.Points(flameGeo, flameMat);
    scene.add(flameParticles);

    // 10. THE BIRD INTELLIGENCE BEACON (Stylized Sleek Gliding Marker)
    const birdGroup = new THREE.Group();
    scene.add(birdGroup);

    // Stylized minimalist sleek bird silhouette: central body + swept wing prisms
    const birdBody = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.7, 4),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.8,
        roughness: 0.2,
      })
    );
    birdBody.rotation.x = Math.PI / 2;
    birdGroup.add(birdBody);

    // Wings
    const wingGeo = new THREE.BufferGeometry();
    const wingVertices = new Float32Array([
      0, 0, 0.2,
      -1.1, 0, -0.2,
      0, 0, -0.3,
      0, 0, 0.2,
      1.1, 0, -0.2,
      0, 0, -0.3,
    ]);
    wingGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(wingVertices, 3)
    );
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
    });
    const wingsMesh = new THREE.Mesh(wingGeo, wingMat);
    birdGroup.add(wingsMesh);

    // Soft downward scanner cone light from bird
    const birdScannerLight = new THREE.SpotLight(
      0xf59e0b,
      5.0,
      14,
      Math.PI / 6,
      0.4,
      1.2
    );
    birdScannerLight.position.set(0, 0, 0);
    birdScannerLight.target.position.set(0, -6, 0);
    birdGroup.add(birdScannerLight);
    birdGroup.add(birdScannerLight.target);

    // 11. MOUSE PARALLAX TRACKING
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 12. ANIMATION LOOP
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse interpolation
      mouseRef.current.x +=
        (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y +=
        (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      // Glide the bird silhouette along a cinematic surveillance orbit
      const birdOrbitRadius = 6.2;
      const birdSpeed = 0.55;
      const birdX = Math.cos(elapsedTime * birdSpeed) * birdOrbitRadius;
      const birdZ =
        Math.sin(elapsedTime * birdSpeed * 1.4) * (birdOrbitRadius * 0.85);
      const birdY = 4.2 + Math.sin(elapsedTime * 1.8) * 0.4;

      birdGroup.position.set(birdX, birdY, birdZ);
      // Orient bird along motion tangent
      const nextX =
        Math.cos((elapsedTime + 0.05) * birdSpeed) * birdOrbitRadius;
      const nextZ =
        Math.sin((elapsedTime + 0.05) * birdSpeed * 1.4) *
        (birdOrbitRadius * 0.85);
      birdGroup.lookAt(nextX, birdY, nextZ);

      // Subtle wing flap
      wingsMesh.rotation.z = Math.sin(elapsedTime * 6) * 0.12;

      // Animate flame particles rising
      const posAttr = flameGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < flameCount; i++) {
        let y = posAttr.getY(i);
        y += 0.018;
        if (y > 2.2) {
          y = 0.95;
          posAttr.setX(i, -5 + (Math.random() - 0.5) * 2.5);
        }
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;

      // Camera position LERP towards target position + subtle mouse parallax
      const offsetPos = targetPosRef.current.clone();
      offsetPos.x += mouseRef.current.x * 1.2;
      offsetPos.y += -mouseRef.current.y * 0.9;
      camera.position.lerp(offsetPos, 0.05);

      // Stable camera lookAt point LERP (eliminates rotational jitter and settling glitch)
      currentLookRef.current.lerp(targetLookRef.current, 0.06);
      camera.lookAt(currentLookRef.current);

      renderer.render(scene, camera);
    };

    animate();

    // 13. RESIZE HANDLER & RESIZE OBSERVER
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // CLEANUP
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px] select-none">
      <div ref={mountRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Subtle Spatial Horizon Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#080909] via-transparent to-[#080909]/60" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#080909]/80 via-transparent to-[#080909]/80" />
    </div>
  );
}
