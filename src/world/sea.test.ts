import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { theme } from "../core/theme.ts";
import { buildSea } from "./sea.ts";

describe("buildSea", () => {
  it("is coloured with the untrusted palette", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.color.getHex()).toBe(theme.untrusted.sea);
  });

  it("sits at sea level", () => {
    const sea = buildSea();
    expect(sea.position.y).toBe(0);
  });

  it("is tagged for picking as the sea, not mistakable for a trust zone", () => {
    const sea = buildSea();
    expect(sea.userData.kind).toBe("SEA");
  });

  /**
   * The actual wave displacement now happens in a vertex shader injected
   * via onBeforeCompile (see sea.ts's own doc comment), not baked into
   * the geometry — there's no WebGL context in this test environment to
   * compile and run it (CLAUDE.md "Verify the deliverable": shader output
   * itself is browser-verified). What's still a pure, unit-testable claim
   * is the *injection* itself: given a shader source shaped like what
   * three.js actually hands onBeforeCompile, does the material correctly
   * splice in the wave function and override the right variables.
   */
  function fakeCompiledShader() {
    return {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: [
        "void main() {",
        "#include <beginnormal_vertex>",
        "#include <begin_vertex>",
        "#include <project_vertex>",
        "}",
      ].join("\n"),
      fragmentShader: "void main() {}",
    };
  }

  it("installs an animated wave-displacement vertex shader via onBeforeCompile, rather than baking a static shape", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.onBeforeCompile).toBeTypeOf("function");

    const shader = fakeCompiledShader();
    material.onBeforeCompile!(shader as never, null as never);

    expect(shader.uniforms.uTime).toEqual({ value: 0 });
    expect(shader.vertexShader).toContain("uniform float uTime;");
    expect(shader.vertexShader).toContain("float fsaWave(");
    // The height computed while overriding the normal (beginnormal_vertex,
    // which three.js's own template runs before begin_vertex) must still
    // be in scope when begin_vertex applies it — i.e. the override for
    // the normal appears first, textually, and begin_vertex only adds to
    // `transformed`, never redeclares the shared height variable.
    const normalIndex = shader.vertexShader.indexOf("objectNormal = fsaNormal;");
    const heightUseIndex = shader.vertexShader.indexOf("transformed.z += fsaWaveHeight;");
    expect(normalIndex).toBeGreaterThan(-1);
    expect(heightUseIndex).toBeGreaterThan(normalIndex);

    // The same compiled shader object is retained so a controller can
    // advance uTime every frame — see engine/seaController.ts.
    expect((material.userData as { shader?: unknown }).shader).toBe(shader);
  });

  it("never adds a horizontal (Gerstner-style) displacement term — vertical-only by construction, so it can never read as choppy", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    const shader = fakeCompiledShader();
    material.onBeforeCompile!(shader as never, null as never);
    expect(shader.vertexShader).not.toMatch(/transformed\.(x|y)\s*\+=/);
  });

  it("is a soft matte surface, not a reflective one", () => {
    const sea = buildSea() as THREE.Mesh;
    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeGreaterThan(0.5);
  });
});
