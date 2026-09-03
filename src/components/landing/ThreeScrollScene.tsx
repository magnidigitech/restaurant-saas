"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * ThreeScrollScene - Elegant 3D Culinary Wave Flow
 * Replaces the clumsy geometric polygon block with a smooth, luxurious 3D fluid wave surface
 * and floating warm spice particles that respond organically to scroll and mouse motion.
 */
export default function ThreeScrollScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE & CAMERA
    const scene = new THREE.Scene();
    // Warm culinary atmosphere (#FCF9F5)
    scene.fog = new THREE.FogExp2(0xfcf9f5, 0.028);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 3, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xfcf9f5, 1);
    container.appendChild(renderer.domElement);

    // AMBIENT & DIRECTIONAL WARM LIGHTING
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.8);
    scene.add(ambientLight);

    const goldLight = new THREE.DirectionalLight(0xd97706, 2.5);
    goldLight.position.set(5, 10, 8);
    scene.add(goldLight);

    const warmLight = new THREE.PointLight(0xea580c, 2.0, 30);
    warmLight.position.set(-6, 2, 4);
    scene.add(warmLight);

    const sageLight = new THREE.PointLight(0x15803d, 1.2, 25);
    sageLight.position.set(6, -2, 6);
    scene.add(sageLight);

    // ROOT WAVE GROUP
    const waveGroup = new THREE.Group();
    scene.add(waveGroup);
    waveGroup.position.set(1.5, -2.8, 0);
    waveGroup.rotation.x = -Math.PI * 0.32;
    waveGroup.rotation.z = Math.PI * 0.08;

    // 1. PRIMARY FLUID WAVE MESH (Warm Golden Saffron)
    const waveWidth = 28;
    const waveHeight = 22;
    const segX = 70;
    const segY = 55;

    const waveGeo1 = new THREE.PlaneGeometry(waveWidth, waveHeight, segX, segY);
    const waveMat1 = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      wireframe: true,
      transparent: true,
      opacity: 0.20,
      roughness: 0.2,
      metalness: 0.6,
    });
    const waveMesh1 = new THREE.Mesh(waveGeo1, waveMat1);
    waveGroup.add(waveMesh1);

    // 2. SECONDARY SOFT WAVE MESH (Warm Terracotta / Honey)
    const waveGeo2 = new THREE.PlaneGeometry(waveWidth, waveHeight, segX, segY);
    const waveMat2 = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      wireframe: false,
      transparent: true,
      opacity: 0.06,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const waveMesh2 = new THREE.Mesh(waveGeo2, waveMat2);
    waveMesh2.position.z = -0.3;
    waveGroup.add(waveMesh2);

    // Store original vertex coordinates for sine wave calculations
    const pos1 = waveGeo1.attributes.position;
    const pos2 = waveGeo2.attributes.position;
    const count = pos1.count;
    const baseCoords = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      baseCoords[i * 2] = pos1.getX(i);
      baseCoords[i * 2 + 1] = pos1.getY(i);
    }

    // 3. CURVED AROMA STREAM RIBBONS (Elegant Smooth Sine Ribbons)
    const ribbons: THREE.Line[] = [];
    const ribbonCount = 4;

    for (let r = 0; r < ribbonCount; r++) {
      const curvePoints: THREE.Vector3[] = [];
      const ptCount = 60;
      for (let i = 0; i < ptCount; i++) {
        const t = (i / ptCount) * 26 - 13;
        curvePoints.push(new THREE.Vector3(t, 0, 0));
      }
      const ribbonGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const ribbonMat = new THREE.LineBasicMaterial({
        color: r % 2 === 0 ? 0xd97706 : 0xf59e0b,
        transparent: true,
        opacity: 0.32 - r * 0.06,
      });
      const ribbonLine = new THREE.Line(ribbonGeo, ribbonMat);
      ribbonLine.position.y = (r - 1.5) * 1.4;
      waveGroup.add(ribbonLine);
      ribbons.push(ribbonLine);
    }

    // 4. FLOATING GOLDEN SPICE EMBERS (Subtle, elegant drifting particles)
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const warmPalette = [
      new THREE.Color(0xd97706),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0xea580c),
      new THREE.Color(0x15803d),
    ];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 32;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 22;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 16;

      const col = warmPalette[Math.floor(Math.random() * warmPalette.length)];
      particleColors[i * 3] = col.r;
      particleColors[i * 3 + 1] = col.g;
      particleColors[i * 3 + 2] = col.b;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // SCROLL & MOUSE TRACKING
    let currentScroll = 0;
    let targetScroll = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0) {
        targetScroll = window.scrollY / maxScroll;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("resize", handleResize);

    handleScroll();

    // ANIMATION LOOP
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth interpolation
      currentScroll += (targetScroll - currentScroll) * 0.05;
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // 3D WAVE GEOMETRY SINE DISTORTION
      for (let i = 0; i < count; i++) {
        const x = baseCoords[i * 2];
        const y = baseCoords[i * 2 + 1];

        // Smooth harmonic sine waves
        const wave1 =
          Math.sin(x * 0.35 + time * 0.85 + currentScroll * 3.5) *
          Math.cos(y * 0.3 + time * 0.65) *
          1.1;

        const wave2 =
          Math.sin(x * 0.18 - time * 0.45 + y * 0.22) *
          Math.sin(y * 0.25 + time * 0.55) *
          0.8;

        const z = wave1 + wave2;

        pos1.setZ(i, z);
        pos2.setZ(i, z * 0.85);
      }

      pos1.needsUpdate = true;
      pos2.needsUpdate = true;
      waveGeo1.computeVertexNormals();

      // Animate ribbon curves
      ribbons.forEach((ribbon, rIdx) => {
        const rPos = ribbon.geometry.attributes.position;
        const ptTotal = rPos.count;
        for (let j = 0; j < ptTotal; j++) {
          const xVal = rPos.getX(j);
          const yVal =
            Math.sin(xVal * 0.3 + time * 1.1 + rIdx + currentScroll * 3.0) * 0.8 +
            Math.cos(xVal * 0.15 + time * 0.55) * 0.5;
          const zVal = Math.sin(xVal * 0.2 + time * 0.75) * 0.6;
          rPos.setY(j, yVal);
          rPos.setZ(j, zVal);
        }
        rPos.needsUpdate = true;
      });

      // Subtle scene camera parallax and scroll rotation
      waveGroup.rotation.z = Math.PI * 0.08 + currentScroll * 0.4 + mouseX * 0.05;
      waveGroup.rotation.x = -Math.PI * 0.32 + currentScroll * 0.35 + mouseY * 0.04;
      waveGroup.position.y = -2.8 + Math.sin(time * 0.4) * 0.25 - currentScroll * 2.5;
      waveGroup.position.x = 1.5 + mouseX * 0.8;

      // Drifting spice particles
      particles.rotation.y = time * 0.02 + currentScroll * 0.4;
      particles.rotation.x = Math.sin(time * 0.05) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // CLEANUP
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);

      waveGeo1.dispose();
      waveMat1.dispose();
      waveGeo2.dispose();
      waveMat2.dispose();
      particleGeo.dispose();
      particleMat.dispose();

      ribbons.forEach((r) => {
        r.geometry.dispose();
        if (Array.isArray(r.material)) {
          r.material.forEach((m) => m.dispose());
        } else {
          r.material.dispose();
        }
      });

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
