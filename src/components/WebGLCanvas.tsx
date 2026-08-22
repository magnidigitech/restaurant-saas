"use client";

import React, { useEffect, useRef } from "react";

export default function WebGLCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      gl.viewport(0, 0, width, height);
    };

    window.addEventListener("resize", handleResize);

    // Shader sources
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      attribute float aSize;
      uniform mat4 uProjection;
      uniform mat4 uModelView;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mvPosition = uModelView * vec4(aPosition, 1.0);
        gl_Position = uProjection * mvPosition;
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (0.5 - dist) * 2.0;
        gl_FragColor = vec4(vColor, alpha * 0.7);
      }
    `;

    // Compile shader helper
    const createShader = (glCtx: WebGLRenderingContext, type: number, source: string) => {
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // Generate 3D Particle Constellation Nodes
    const particleCount = 280;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * 40;
      positions[idx + 1] = (Math.random() - 0.5) * 30;
      positions[idx + 2] = (Math.random() - 0.5) * 30 - 15;

      // HSL tailored neon colors (Indigo/Purple/Cyan)
      const colorType = Math.random();
      if (colorType < 0.4) {
        // Indigo
        colors[idx] = 0.39;
        colors[idx + 1] = 0.4;
        colors[idx + 2] = 0.95;
      } else if (colorType < 0.7) {
        // Cyan
        colors[idx] = 0.06;
        colors[idx + 1] = 0.72;
        colors[idx + 2] = 0.93;
      } else {
        // Purple/Pink
        colors[idx] = 0.65;
        colors[idx + 1] = 0.32;
        colors[idx + 2] = 0.96;
      }

      sizes[i] = Math.random() * 2.5 + 1.2;

      velocities[idx] = (Math.random() - 0.5) * 0.015;
      velocities[idx + 1] = (Math.random() - 0.5) * 0.015;
      velocities[idx + 2] = (Math.random() - 0.5) * 0.015;
    }

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    const aColor = gl.getAttribLocation(program, "aColor");
    const aSize = gl.getAttribLocation(program, "aSize");

    const uProjection = gl.getUniformLocation(program, "uProjection");
    const uModelView = gl.getUniformLocation(program, "uModelView");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.DEPTH_TEST);

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Perspective Projection matrix helper
    const createPerspective = (fovy: number, aspect: number, near: number, far: number) => {
      const f = 1.0 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
      ]);
    };

    let rotation = 0;

    const render = () => {
      rotation += 0.002;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.02, 0.04, 0.08, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Animate particle positions
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        positions[idx] += velocities[idx] + mouseX * 0.003;
        positions[idx + 1] += velocities[idx + 1] - mouseY * 0.003;
        positions[idx + 2] += velocities[idx + 2];

        // Bounds bounce
        if (Math.abs(positions[idx]) > 25) velocities[idx] *= -1;
        if (Math.abs(positions[idx + 1]) > 20) velocities[idx + 1] *= -1;
        if (positions[idx + 2] > 5 || positions[idx + 2] < -35) velocities[idx + 2] *= -1;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

      const projMatrix = createPerspective((45 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100);

      // Model view matrix with rotation and camera tilt
      const cosR = Math.cos(rotation * 0.5);
      const sinR = Math.sin(rotation * 0.5);

      const mvMatrix = new Float32Array([
        cosR, 0, sinR, 0,
        sinR * 0.1, 1, -cosR * 0.1, 0,
        -sinR, 0, cosR, 0,
        mouseX * 2, -mouseY * 2, -18, 1
      ]);

      gl.uniformMatrix4fv(uProjection, false, projMatrix);
      gl.uniformMatrix4fv(uModelView, false, mvMatrix);

      // Attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aPos);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aColor);

      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aSize);

      gl.drawArrays(gl.POINTS, 0, particleCount);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 0.85 }}
    />
  );
}
