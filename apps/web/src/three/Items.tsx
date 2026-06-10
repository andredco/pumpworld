import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { Item } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { isPillsCurrencyName } from "../util/pillsCurrency.js";

/**
 * Render every world-placed item — $PILLS shards as glowing gold orbs that
 * bob and pulse; weapons as small metallic shapes; food as small spheres.
 * Items in inventory (position == null) are NOT rendered here; they're
 * carried on the pill.
 */
export function Items() {
  const items = useWorld(s => s.items);
  const list = useMemo(
    () => [...items.values()].filter(i => i.position != null),
    [items],
  );
  return (
    <group>
      {list.map(it => {
        if (it.kind === "currency" && isPillsCurrencyName(it.name)) {
          return <PillsShard key={it.id} item={it} />;
        }
        if (it.kind === "weapon")  return <WeaponItem key={it.id} item={it} />;
        if (it.kind === "food")    return <FoodItem key={it.id} item={it} />;
        if (it.kind === "material") return <MaterialItem key={it.id} item={it} />;
        return <GenericItem key={it.id} item={it} />;
      })}
    </group>
  );
}

function PillsShard({ item }: { item: Item }) {
  const g = useRef<Group | null>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime + (item.id.charCodeAt(0) % 100) * 0.1;
    g.current.position.y = 0.45 + Math.sin(t * 2) * 0.15;
    g.current.rotation.y = t * 1.1;
  });
  const size = Math.min(0.5, 0.18 + (item.potency ?? 5) * 0.012);
  return (
    <group ref={g} position={[item.position!.x, 0.45, item.position!.z]}>
      <mesh castShadow>
        <octahedronGeometry args={[size, 0]} />
        <meshStandardMaterial
          color="#b794ff"
          emissive="#a78bfa"
          emissiveIntensity={1.8}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>
      <pointLight color="#a78bfa" intensity={0.7} distance={4} decay={2} />
    </group>
  );
}

function WeaponItem({ item }: { item: Item }) {
  const color = item.name === "pistol" || item.name === "shotgun" ? "#2a2a2e" : "#a0a0a8";
  return (
    <group position={[item.position!.x, 0.15, item.position!.z]}>
      <mesh castShadow rotation-z={Math.PI / 2}>
        <boxGeometry args={[0.6, 0.12, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  );
}

function FoodItem({ item }: { item: Item }) {
  const colors: Record<string, string> = {
    bread: "#caa470", apple: "#c4382e", stew: "#7a4a2a",
    pear:  "#a7c14a", berries: "#5a2a7a", fish: "#88a8b0",
    groceries: "#d8b46c",
  };
  const c = colors[item.name] ?? "#caa470";
  return (
    <mesh position={[item.position!.x, 0.2, item.position!.z]} castShadow>
      <sphereGeometry args={[0.22, 10, 8]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}

function MaterialItem({ item }: { item: Item }) {
  return (
    <mesh position={[item.position!.x, 0.12, item.position!.z]} castShadow>
      <boxGeometry args={[0.3, 0.18, 0.4]} />
      <meshStandardMaterial color="#9a8060" roughness={0.9} />
    </mesh>
  );
}

function GenericItem({ item }: { item: Item }) {
  return (
    <mesh position={[item.position!.x, 0.12, item.position!.z]} castShadow>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color="#aaa" />
    </mesh>
  );
}
