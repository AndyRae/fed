import * as THREE from "three";
import { theme } from "../core/theme.ts";

/**
 * A low-poly whale, built once and then puppeteered by
 * engine/whaleController.ts (position, rotation, scale, visibility) — this
 * module only shapes it. Purely decorative: no `userData.kind`, so it can
 * never be picked or shown in the inspector, matching the precedent set by
 * the sea's own swell and the ferries' wake dots. It never crosses an
 * island wall or the mainland's coastline — the controller's own exclusion
 * zones keep it confined to open water, same rule that governs every other
 * piece of ambient motion in this world.
 */
export function buildWhale(): THREE.Group {
  const group = new THREE.Group();
  group.userData.decoration = "WHALE";

  const skin = new THREE.MeshStandardMaterial({ color: theme.untrusted.whale, roughness: 0.75, metalness: 0.05 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), skin);
  body.scale.set(2.4, 1.0, 1.15);
  group.add(body);

  const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.3, 4), skin);
  fluke.rotation.z = Math.PI / 2;
  fluke.rotation.y = Math.PI / 4;
  fluke.scale.set(1, 1, 0.4);
  fluke.position.set(-2.3, 0, 0);
  group.add(fluke);

  const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 4), skin);
  dorsalFin.position.set(0.1, 0.78, 0);
  dorsalFin.rotation.z = -0.25;
  group.add(dorsalFin);

  return group;
}
