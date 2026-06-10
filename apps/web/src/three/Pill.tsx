import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { Pill as PillT } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { hashString } from "./util.js";

interface Props { pill: PillT }

/** Tiny FNV-style hash → deterministic per-pill animation phase offset. */
function phaseOffset(id: string): number {
  return (hashString(id) % 628) / 100; // 0..2π
}

/**
 * Specimen pills — translucent glass capsules with a glowing soul-core
 * inside. They hover above the dish instead of walking: a soft bob, a
 * forward lean when moving, an emissive halo ring projected on the ground,
 * and an antenna whose tip broadcasts their status colour.
 */
export function Pill({ pill }: Props) {
  const groupRef = useRef<Group | null>(null);
  const bodyRef = useRef<Group | null>(null);
  const coreRef = useRef<Mesh | null>(null);
  const haloRef = useRef<Mesh | null>(null);
  const eyesRef = useRef<Group | null>(null);
  const leftArmRef = useRef<Mesh | null>(null);
  const rightArmRef = useRef<Mesh | null>(null);

  const selectedId = useWorld(s => s.selectedPillId);
  const selectPill = useWorld(s => s.selectPill);
  const setCamera = useWorld(s => s.setCamera);
  const brains = useWorld(s => s.brains);

  const offset = useMemo(() => phaseOffset(pill.id), [pill.id]);

  const selected = selectedId === pill.id;
  const dead = pill.status === "dead";
  const exiled = pill.status === "exiled";
  const sleeping = pill.status === "sleeping";
  const incarcerated = pill.status === "incarcerated";
  const condemned = pill.status === "awaiting_execution";

  const h = pill.shell.height;
  const r = pill.shell.radius;
  const bodyH = Math.max(h - r * 2, r * 0.4);
  const armL = 0.42;

  // Per-frame: lerp position; hover bob; lean; pulse halo + core; blink.
  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const t = 1 - Math.exp(-dt * 6);
    g.position.x += (pill.position.x - g.position.x) * t;
    g.position.z += (pill.position.z - g.position.z) * t;
    g.rotation.y += (pill.facingRad - g.rotation.y) * t;

    const time = state.clock.elapsedTime;
    const speed = Math.hypot(pill.velocity.x, pill.velocity.z);
    const moving = pill.status === "alive" && speed > 0.05;

    const b = bodyRef.current;
    if (b) {
      const bob = dead ? 0 : Math.sin(time * 2.1 + offset) * 0.07;
      const baseY = dead ? 0.22 : sleeping ? 0.34 : 0.52;
      b.position.y = baseY + h / 2 + bob;
      const targetTilt = dead ? Math.PI / 2 : sleeping ? Math.PI / 2.4 : moving ? 0.17 : 0;
      b.rotation.x += (targetTilt - b.rotation.x) * t;
    }

    const phase = time * 6 + offset;
    const swing = moving ? 0.55 : 0;
    if (leftArmRef.current)  leftArmRef.current.rotation.x  = -Math.sin(phase) * swing;
    if (rightArmRef.current) rightArmRef.current.rotation.x =  Math.sin(phase) * swing;

    if (haloRef.current) {
      const s = 1 + Math.sin(time * 2.4 + offset) * 0.08;
      haloRef.current.scale.set(s, s, s);
    }
    if (coreRef.current) {
      const s = 1 + Math.sin(time * 3.1 + offset) * 0.12;
      coreRef.current.scale.set(s, s, s);
    }
    // Occasional quick blink.
    if (eyesRef.current) {
      const blink = Math.sin(time * 0.9 + offset * 2) > 0.985 ? 0.12 : 1;
      eyesRef.current.scale.y += (blink - eyesRef.current.scale.y) * Math.min(1, dt * 22);
    }
  });

  const opacity = dead ? 0.3 : exiled ? 0.4 : 0.82;
  const ping = brains.get(pill.id);
  const showSpeech = ping && Date.now() - ping.ms < 6000 && ping.intent === "speak";

  const statusColor =
    condemned ? "#ff4455" :
    incarcerated ? "#fbbf24" :
    sleeping ? "#38bdf8" :
    dead ? "#52525b" :
    pill.shell.topColor;

  const hpFrac = pill.health;
  const energyFrac = pill.needs.energy;

  return (
    <group ref={groupRef}>
      {/* Ground halo — soul-coloured ring projected beneath the hover */}
      {!dead && !exiled && (
        <mesh ref={haloRef} rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
          <ringGeometry args={[r * 1.0, r * 1.4, 40]} />
          <meshBasicMaterial color={pill.shell.topColor} transparent opacity={0.4} />
        </mesh>
      )}
      {/* Under-glow */}
      {!dead && <pointLight color={pill.shell.topColor} intensity={0.8} distance={3.5} decay={2} position={[0, 0.4, 0]} />}

      {/* Body — hovering capsule */}
      <group ref={bodyRef} position={[0, 0.52 + h / 2, 0]}>
        {/* Glass top hemisphere */}
        <mesh position={[0, bodyH / 2, 0]} castShadow>
          <sphereGeometry args={[r, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={pill.shell.topColor}
            transparent opacity={opacity}
            roughness={0.16} metalness={0.05}
            clearcoat={1} clearcoatRoughness={0.12}
          />
        </mesh>
        {/* Glass middle */}
        <mesh castShadow>
          <cylinderGeometry args={[r, r, bodyH, 32]} />
          <meshPhysicalMaterial
            color={pill.shell.topColor}
            transparent opacity={opacity}
            roughness={0.16} metalness={0.05}
            clearcoat={1} clearcoatRoughness={0.12}
          />
        </mesh>
        {/* Glass bottom hemisphere */}
        <mesh position={[0, -bodyH / 2, 0]} castShadow>
          <sphereGeometry args={[r, 32, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshPhysicalMaterial
            color={pill.shell.bottomColor}
            transparent opacity={opacity}
            roughness={0.16} metalness={0.05}
            clearcoat={1} clearcoatRoughness={0.12}
          />
        </mesh>

        {/* Soul core — glowing heart visible through the glass */}
        <mesh ref={coreRef} position={[0, -bodyH * 0.1, 0]}>
          <sphereGeometry args={[r * 0.42, 18, 14]} />
          <meshStandardMaterial
            color={pill.shell.topColor}
            emissive={pill.shell.topColor}
            emissiveIntensity={dead ? 0.1 : 2.2}
            transparent opacity={0.95}
          />
        </mesh>

        {/* Emissive waist band */}
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[r * 1.02, 0.04, 10, 36]} />
          <meshStandardMaterial
            color={pill.shell.bandColor}
            emissive={pill.shell.topColor}
            emissiveIntensity={dead ? 0 : 1.4}
            transparent opacity={Math.min(1, opacity + 0.15)}
          />
        </mesh>

        {/* Antenna with status beacon */}
        <group position={[0, bodyH / 2 + r * 0.86, 0]}>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.3, 6]} />
            <meshStandardMaterial color="#1a1a22" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial
              color={statusColor}
              emissive={statusColor}
              emissiveIntensity={dead ? 0.15 : 2.6}
            />
          </mesh>
        </group>

        {/* Face — big luminous eyes (front = +Z) */}
        <group ref={eyesRef} position={[0, bodyH / 2 - 0.04, r * 0.8]}>
          <mesh position={[-r * 0.34, 0, 0]}>
            <capsuleGeometry args={[0.075, 0.08, 6, 10]} />
            <meshStandardMaterial
              color="#eef6ff"
              emissive="#dceaff"
              emissiveIntensity={dead ? 0.05 : 1.8}
            />
          </mesh>
          <mesh position={[r * 0.34, 0, 0]}>
            <capsuleGeometry args={[0.075, 0.08, 6, 10]} />
            <meshStandardMaterial
              color="#eef6ff"
              emissive="#dceaff"
              emissiveIntensity={dead ? 0.05 : 1.8}
            />
          </mesh>
          {/* Mouth — minimal dark slot */}
          <mesh position={[0, -0.18, 0.02]}>
            <boxGeometry args={[0.14, 0.026, 0.02]} />
            <meshStandardMaterial color="#11131a" />
          </mesh>
        </group>

        {/* Arms — slim glass stubs that swing when moving */}
        <group position={[0, 0.02, 0]}>
          <group position={[-r * 0.98, 0, 0]}>
            <mesh ref={leftArmRef} position={[0, -armL / 2, 0]} castShadow>
              <capsuleGeometry args={[0.07, armL * 0.7, 6, 10]} />
              <meshPhysicalMaterial
                color={pill.shell.topColor}
                transparent opacity={opacity}
                roughness={0.2} clearcoat={0.8}
              />
            </mesh>
          </group>
          <group position={[r * 0.98, 0, 0]}>
            <mesh ref={rightArmRef} position={[0, -armL / 2, 0]} castShadow>
              <capsuleGeometry args={[0.07, armL * 0.7, 6, 10]} />
              <meshPhysicalMaterial
                color={pill.shell.topColor}
                transparent opacity={opacity}
                roughness={0.2} clearcoat={0.8}
              />
            </mesh>
          </group>
        </group>

        {/* Incarcerated cage */}
        {incarcerated && (
          <mesh>
            <boxGeometry args={[r * 2.5, h * 1.15, r * 2.5]} />
            <meshBasicMaterial color="#fbbf24" wireframe transparent opacity={0.45} />
          </mesh>
        )}
        {/* Condemned — red warning aura */}
        {condemned && (
          <mesh>
            <sphereGeometry args={[r * 1.45, 14, 10]} />
            <meshBasicMaterial color="#ff3344" wireframe transparent opacity={0.45} />
          </mesh>
        )}
      </group>

      {/* Selection — double ring + light beam */}
      {selected && !dead && (
        <group>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
            <ringGeometry args={[r * 1.6, r * 1.75, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
            <ringGeometry args={[r * 1.95, r * 2.02, 48]} />
            <meshBasicMaterial color={pill.shell.topColor} transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[r * 1.7, r * 1.7, 6, 24, 1, true]} />
            <meshBasicMaterial color={pill.shell.topColor} transparent opacity={0.07} side={2} />
          </mesh>
        </group>
      )}

      {/* HP + energy bars + name label */}
      <Html
        position={[0, h + 1.45, 0]}
        distanceFactor={9}
        center
        occlude
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          padding: 0,
          opacity: dead ? 0.5 : 1,
        }}>
          <div style={{
            display: "flex", gap: 3, padding: "2px 7px",
            background: "rgba(8,8,12,0.78)",
            border: "1px solid rgba(167,139,250,0.25)",
            borderLeft: `2px solid ${pill.shell.topColor}`,
            borderRadius: 4,
            backdropFilter: "blur(4px)",
          }}>
            <span style={{ color: "#f4f4f5", fontSize: 9, fontWeight: 700 }}>{pill.name}</span>
            <span style={{ color: "#a1a1aa", fontSize: 9 }}>· {pill.soul.label}</span>
            {(sleeping || incarcerated || condemned || exiled) && (
              <span style={{ color: "#fbbf24", fontSize: 9 }}>· {
                sleeping ? "sleep" : incarcerated ? "jail" : condemned ? "condemned" : "exiled"
              }</span>
            )}
          </div>
          {!dead && (
            <div style={{ display: "flex", gap: 1 }}>
              <Bar v={hpFrac}     color="#fb7185" />
              <Bar v={energyFrac} color="#a78bfa" />
            </div>
          )}
        </div>
      </Html>

      {/* Click target — large invisible box covering the whole figure */}
      <mesh
        position={[0, h / 2 + 0.5, 0]}
        onClick={e => { e.stopPropagation(); selectPill(pill.id); }}
        onDoubleClick={e => { e.stopPropagation(); selectPill(pill.id); setCamera("follow", pill.id); }}
        visible={false}
      >
        <boxGeometry args={[r * 2.6, h + 1.2, r * 2.6]} />
        <meshBasicMaterial />
      </mesh>

      {showSpeech && (
        <Html
          position={[0, h + 2.4, 0]}
          distanceFactor={11}
          center
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            maxWidth: 200,
            padding: "5px 9px",
            background: "rgba(10,10,16,0.92)",
            border: `1px solid ${pill.shell.topColor}66`,
            color: "#f4f4f5",
            fontSize: 11,
            lineHeight: 1.35,
            borderRadius: 8,
            boxShadow: `0 4px 18px rgba(0,0,0,0.5), 0 0 12px ${pill.shell.topColor}22`,
            backdropFilter: "blur(6px)",
          }}>
            {ping!.thought.slice(0, 140)}
          </div>
        </Html>
      )}
    </group>
  );
}

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <div style={{
      width: 22, height: 3,
      background: "rgba(0,0,0,0.65)",
      borderRadius: 1,
      overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(1, v)) * 100}%`,
        height: "100%",
        background: color,
      }} />
    </div>
  );
}
