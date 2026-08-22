"use client";

import React, { useEffect, useRef } from "react";

/**
 * Apple-style Ambient Light WebGL Mesh Background
 * Generates soft, flowing pastel light gradient Orbs in 3D WebGL
 * on an off-white Apple backdrop (#fbfbfd) for maximum text readability and luxury visual depth.
 */
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

    // Vertex Shader
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment Shader - Apple Soft Ambient Light Blobs
    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uMouse;

      void main() {
        vec2 st = gl_FragCoord.xy / uResolution.xy;
        st.x *= uResolution.x / uResolution.y;

        // Base Apple Off-White Background (#fbfbfd)
        vec3 color = vec3(0.984, 0.984, 0.992);

        // Soft Orb 1 - Soft Blue / Indigo
        vec2 orb1 = vec2(0.3 + 0.15 * sin(uTime * 0.4), 0.7 + 0.1 * cos(uTime * 0.3) + uMouse.y * 0.05);
        float d1 = length(st - orb1);
        float alpha1 = smoothstep(0.7, 0.0, d1);
        vec3 color1 = vec3(0.38, 0.52, 0.98); // Vibrant Apple Blue

        // Soft Orb 2 - Soft Purple / Violet
        vec2 orb2 = vec2(0.75 + 0.1 * cos(uTime * 0.5) + uMouse.x * 0.05, 0.3 + 0.15 * sin(uTime * 0.4));
        float d2 = length(st - orb2);
        float alpha2 = smoothstep(0.65, 0.0, d2);
        vec3 color2 = vec3(0.62, 0.45, 0.96); // Soft Purple

        // Soft Orb 3 - Soft Emerald / Mint
        vec2 orb3 = vec2(0.5 + 0.2 * sin(uTime * 0.3), 0.2 + 0.1 * cos(uTime * 0.6));
        float d3 = length(st - orb3);
        float alpha3 = smoothstep(0.6, 0.0, d3);
        vec3 color3 = vec3(0.32, 0.78, 0.68); // Mint Emerald

        // Blend Ambient Light Blobs
        color = mix(color, color1, alpha1 * 0.18);
        color = mix(color, color2, alpha2 * 0.15);
        color = mix(color, color3, alpha3 * 0.12);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

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

    // Quad geometry
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "uTime");
    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uMouse = gl.getUniformLocation(program, "uMouse");

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let startTime = performance.now();

    const render = () => {
      const currentTime = (performance.now() - startTime) * 0.001;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uTime, currentTime);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseX, mouseY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

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
    />
  );
}
