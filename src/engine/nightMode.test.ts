import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createNightModeController, type NightModeHost } from "./nightMode.ts";

function createHost(): { host: NightModeHost; scene: THREE.Scene } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fcdf0);
  scene.fog = new THREE.Fog(0xbfe7f7, 70, 200);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcab98a, 1.25);
  const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.7);
  return { host: { scene, hemiLight, sunLight }, scene };
}

function meshWithColor(color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color }));
}

function taggedMesh(kind: string, color: number): THREE.Mesh {
  const mesh = meshWithColor(color);
  mesh.userData.kind = kind;
  return mesh;
}

describe("createNightModeController", () => {
  it("starts disabled", () => {
    const { host } = createHost();
    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    expect(controller.isEnabled()).toBe(false);
  });

  it("toggle flips the enabled state", () => {
    const { host } = createHost();
    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.toggle();
    expect(controller.isEnabled()).toBe(true);
    controller.toggle();
    expect(controller.isEnabled()).toBe(false);
  });

  it("darkens the fog and dims both lights, restoring the exact originals when disabled again", () => {
    const { host } = createHost();
    const dayFogColor = (host.scene.fog as THREE.Fog).color.getHex();
    const dayHemiIntensity = host.hemiLight.intensity;
    const daySunIntensity = host.sunLight.intensity;
    const daySunColor = host.sunLight.color.getHex();

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);
    expect(host.hemiLight.intensity).toBeLessThan(dayHemiIntensity);
    expect(host.sunLight.intensity).toBeLessThan(daySunIntensity);
    expect((host.scene.fog as THREE.Fog).color.getHex()).not.toBe(dayFogColor);

    controller.setEnabled(false);
    expect(host.hemiLight.intensity).toBe(dayHemiIntensity);
    expect(host.sunLight.intensity).toBe(daySunIntensity);
    expect(host.sunLight.color.getHex()).toBe(daySunColor);
    expect((host.scene.fog as THREE.Fog).color.getHex()).toBe(dayFogColor);
  });

  it("swaps the sky background at night and restores the exact original by day", () => {
    const { host } = createHost();
    const daySky = host.scene.background;

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);
    expect(host.scene.background).not.toBe(daySky);

    controller.setEnabled(false);
    expect(host.scene.background).toBe(daySky);
  });

  it("makes a building glow in its own colour at night, on an island", () => {
    const { host, scene } = createHost();
    const workshop = taggedMesh("WORKSHOP", 0x8fe0b8);
    scene.add(workshop);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);

    const material = workshop.material as THREE.MeshStandardMaterial;
    expect(material.emissive.getHex()).toBe(0x8fe0b8);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
  });

  it("makes a building glow on the mainland too, not just on islands", () => {
    const { host, scene } = createHost();
    const office = taggedMesh("QUAY_OFFICE", 0xc9b389);
    scene.add(office);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);

    expect((office.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0xc9b389);
  });

  it("reaches a building's own decorative child even though only the building itself carries the kind tag", () => {
    const { host, scene } = createHost();
    const workshop = taggedMesh("WORKSHOP", 0x8fe0b8);
    const roofCap = meshWithColor(0x5c4a3d);
    workshop.add(roofCap);
    scene.add(workshop);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);

    expect((roofCap.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x5c4a3d);
  });

  it("darkens the ground instead of glowing it — island grass, the wall, and the mainland's own land all stay unlit", () => {
    const { host, scene } = createHost();
    const grass = taggedMesh("ISLAND_LAND", 0x3fae74);
    const wall = taggedMesh("ISLAND_WALL", 0x2d7a52);
    const mainlandLand = taggedMesh("MAINLAND_LAND", 0xc9b389);
    scene.add(grass, wall, mainlandLand);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);

    for (const mesh of [grass, wall, mainlandLand]) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.emissive.getHex(), mesh.userData.kind as string).toBe(0x000000);
    }
  });

  it("never glows anything untagged — the sea, the whale, decorative meshes with no kind", () => {
    const { host, scene } = createHost();
    const sea = meshWithColor(0x3aa0d8);
    scene.add(sea);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);

    const material = sea.material as THREE.MeshStandardMaterial;
    expect(material.emissive.getHex()).toBe(0x000000);
    expect(material.emissiveIntensity).toBe(1);
  });

  it("restores a building's exact original emissive state when night mode turns off", () => {
    const { host, scene } = createHost();
    const gate = taggedMesh("GATE1_HARBOURMASTER", 0xf2a934);
    (gate.material as THREE.MeshStandardMaterial).emissive.setHex(0x111111);
    (gate.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
    scene.add(gate);

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.setEnabled(true);
    controller.setEnabled(false);

    const material = gate.material as THREE.MeshStandardMaterial;
    expect(material.emissive.getHex()).toBe(0x111111);
    expect(material.emissiveIntensity).toBe(0.2);
  });

  it("stays correct across repeated toggling", () => {
    const { host, scene } = createHost();
    const ferry = taggedMesh("FERRY", 0x57c98f);
    scene.add(ferry);
    const material = ferry.material as THREE.MeshStandardMaterial;

    const controller = createNightModeController(host, { nightSky: new THREE.Texture() });
    controller.toggle();
    controller.toggle();
    controller.toggle();

    expect(controller.isEnabled()).toBe(true);
    expect(material.emissive.getHex()).toBe(0x57c98f);
  });
});
