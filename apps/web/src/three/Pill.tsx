import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { Pill as PillT } from "@pumpworld/protocol";
import { useWorld } from "../store/worldStore.js";
import { hashString } from "./util.js";

interface Props { pill: PillT }

/** Tiny FNV-style hash → deterministic per-pill leg phase offset. */
function phaseOffset(id: string): number {
  return (hashString(id) % 628) / 100; // 0..2π
}

export function Pill({ pill }: Props) {
  const groupRef = useRef<Group | null>(null);
  const leftLegRef = useRef<Mesh | null>(null);
  const rightLegRef = useRef<Mesh | null>(null);
  const leftArmRef = useRef<Mesh | null>(null);
  const rightArmRef = useRef<Mesh | null>(null);

  const selectedId = useWorld(s => s.selectedPillId);
  const selectPill = useWorld(s => s.selectPill);
  const setCamera = useWorld(s => s.setCamera);
  const brains = useWorld(s => s.brains);

  const offset = useMemo(() => phaseOffset(pill.id), [pill.id]);

  // Per-frame: lerp position; animate legs/arms based on speed.
  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const t = 1 - Math.exp(-dt * 6);
    const targetY = pill.status === "dead" ? 0.1 : 0;
    g.position.x += (pill.position.x - g.position.x) * t;
    g.position.z += (pill.position.z - g.position.z) * t;
    g.position.y += (targetY - g.position.y) * t;
    g.rotation.y += (pill.facingRad - g.rotation.y) * t;

    // Detect motion by velocity magnitude (set by physics each tick).
    const speed = Math.hypot(pill.velocity.x, pill.velocity.z);
    const moving = pill.status === "alive" && speed > 0.05;
    const phase = state.clock.elapsedTime * 6 + offset;
    const swing = moving ? 0.7 : 0;
    if (leftLegRef.current)  leftLegRef.current.rotation.x  =  Math.sin(phase) * swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(phase) * swing;
    if (leftArmRef.current)  leftArmRef.current.rotation.x  = -Math.sin(phase) * swing * 0.6;
    if (rightArmRef.current) rightArmRef.current.rotation.x =  Math.sin(phase) * swing * 0.6;
  });

  const selected = selectedId === pill.id;
  const dead = pill.status === "dead";
  const exiled = pill.status === "exiled";
  const sleeping = pill.status === "sleeping";
  const incarcerated = pill.status === "incarcerated";
  const condemned = pill.status === "awaiting_execution";

  const opacity = dead ? 0.4 : exiled ? 0.45 : 1;
  const tiltX = dead ? Math.PI / 2 : sleeping ? Math.PI / 2.5 : 0;

  const ping = brains.get(pill.id);
  const showSpeech = ping && Date.now() - ping.ms < 6000 && ping.intent === "speak";

  const h = pill.shell.height;
  const r = pill.shell.radius;
  const bodyH = Math.max(h - r * 2, r * 0.4);
  const legH = 0.45;
  const armL = 0.5;

  const hpFrac = pill.health;
  const energyFrac = pill.needs.energy;

  return (
    <group ref={groupRef}>
      {/* Body group — sits above legs */}
      <group position={[0, legH + h / 2, 0]} rotation-x={tiltX}>
        {/* Translucent top hemisphere (with slight subsurface look) */}
        <mesh position={[0, bodyH / 2, 0]} castShadow>
          <sphereGeometry args={[r, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={pill.shell.topColor}
            transparent opacity={opacity * 0.96}
            roughness={0.35} metalness={0.05}
          />
        </mesh>
        {/* Middle cylinder */}
        <mesh castShadow>
          <cylinderGeometry args={[r, r, bodyH, 28]} />
          <meshStandardMaterial
            color={pill.shell.topColor}
            transparent opacity={opacity * 0.96}
            roughness={0.35} metalness={0.05}
          />
        </mesh>
        {/* Band */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[r * 1.01, r * 1.01, 0.06, 28]} />
          <meshStandardMaterial color={pill.shell.bandColor} transparent opacity={opacity} />
        </mesh>
        {/* Bottom hemisphere */}
        <mesh position={[0, -bodyH / 2, 0]} castShadow>
          <sphereGeometry args={[r, 28, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color={pill.shell.bottomColor}
            transparent opacity={opacity * 0.96}
            roughness={0.35} metalness={0.05}
          />
        </mesh>

        {/* Face — eyes, mouth (front = +Z) */}
        <group position={[0, bodyH / 2 - 0.06, r * 0.92]}>
          <mesh position={[-r * 0.32, 0, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color="#0d0d12" />
          </mesh>
          <mesh position={[r * 0.32, 0, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color="#0d0d12" />
          </mesh>
          {/* Tiny eye-shine highlight */}
          <mesh position={[-r * 0.32 + 0.03, 0.025, 0.06]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[r * 0.32 + 0.03, 0.025, 0.06]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Mouth */}
          <mesh position={[0, -0.16, 0]}>
            <boxGeometry args={[0.16, 0.03, 0.03]} />
            <meshStandardMaterial color="#3a1818" />
          </mesh>
        </group>

        {/* Arms — pinned to a small shoulder offset, swinging when moving */}
        <group position={[0, 0.05, 0]}>
          <group position={[-r * 0.95, 0, 0]}>
            <mesh ref={leftArmRef} position={[0, -armL / 2, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, armL, 8]} />
              <meshStandardMaterial color={pill.shell.topColor} transparent opacity={opacity} />
            </mesh>
          </group>
          <group position={[r * 0.95, 0, 0]}>
            <mesh ref={rightArmRef} position={[0, -armL / 2, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, armL, 8]} />
              <meshStandardMaterial color={pill.shell.topColor} transparent opacity={opacity} />
            </mesh>
          </group>
        </group>

        {/* Selection ring underneath */}
        {selected && !dead && (
          <mesh rotation-x={-Math.PI / 2} position={[0, -h / 2 - 0.02, 0]}>
            <ringGeometry args={[r * 1.4, r * 1.65, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        )}
        {/* Incarcerated cage */}
        {incarcerated && (
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[r * 2.4, h * 1.1, r * 2.4]} />
            <meshBasicMaterial color="#9aa" wireframe transparent opacity={0.5} />
          </mesh>
        )}
        {/* Condemned — red aura */}
        {condemned && (
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[r * 1.4, 12, 10]} />
            <meshBasicMaterial color="#ff3344" wireframe transparent opacity={0.5} />
          </mesh>
        )}
      </group>

      {/* Legs — anchored at hip, swing forward/back when walking */}
      {!dead && (
        <group position={[0, legH, 0]}>
          <group position={[-r * 0.45, 0, 0]}>
            <mesh ref={leftLegRef} position={[0, -legH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, legH, 8]} />
              <meshStandardMaterial color={pill.shell.bottomColor} transparent opacity={opacity} />
            </mesh>
          </group>
          <group position={[r * 0.45, 0, 0]}>
            <mesh ref={rightLegRef} position={[0, -legH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, legH, 8]} />
              <meshStandardMaterial color={pill.shell.bottomColor} transparent opacity={opacity} />
            </mesh>
          </group>
        </group>
      )}

      {/* HP + energy bars + name label.
       *  occlude: hide when behind geometry (so a row of pills doesn't show
       *  five overlapping nametags through walls). distanceFactor controls
       *  how aggressively they shrink on zoom-out — large enough that you
       *  can still read names from the orbit hero shot but they don't take
       *  over the screen when you pull the camera way back. */}
      <Html
        position={[0, h + legH + 0.5, 0]}
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
            display: "flex", gap: 2, padding: "1px 5px",
            background: "rgba(7,9,12,0.6)",
            borderRadius: 3,
            borderLeft: `2px solid ${pill.shell.topColor}`,
          }}>
            <span style={{ color: "#f7fafc", fontSize: 9, fontWeight: 700 }}>{pill.name}</span>
            <span style={{ color: "#a8b2c1", fontSize: 9 }}>· {pill.soul.label}</span>
            {(sleeping || incarcerated || condemned || exiled) && (
              <span style={{ color: "#f0c674", fontSize: 9 }}>· {
                sleeping ? "sleep" : incarcerated ? "jail" : condemned ? "condemned" : "exiled"
              }</span>
            )}
          </div>
          {!dead && (
            <div style={{ display: "flex", gap: 1 }}>
              <Bar v={hpFrac}      color="#ff5577" />
              <Bar v={energyFrac}  color="#ffd23f" />
            </div>
          )}
        </div>
      </Html>

      {/* Click target — large invisible box covering the whole figure */}
      <mesh
        position={[0, h / 2 + legH, 0]}
        onClick={e => { e.stopPropagation(); selectPill(pill.id); }}
        onDoubleClick={e => { e.stopPropagation(); selectPill(pill.id); setCamera("follow", pill.id); }}
        visible={false}
      >
        <boxGeometry args={[r * 2.4, h + legH, r * 2.4]} />
        <meshBasicMaterial />
      </mesh>

      {showSpeech && (
        <Html
          position={[0, h + legH + 1.5, 0]}
          distanceFactor={11}
          center
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            maxWidth: 200,
            padding: "4px 8px",
            background: "rgba(255,255,255,0.96)",
            color: "#111",
            fontSize: 11,
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
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
      background: "rgba(0,0,0,0.6)",
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
