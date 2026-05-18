import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Stars } from "@react-three/drei";
import type { PerspectiveCamera } from "three";
import { useWorld } from "../store/worldStore.js";
import { Pill } from "./Pill.js";
import { Building } from "./Building.js";
import { Ground } from "./Ground.js";
import { Decor } from "./Decor.js";
import { Roads } from "./Roads.js";
import { Items } from "./Items.js";

function CameraRig() {
  const mode = useWorld(s => s.cameraMode);
  const followPillId = useWorld(s => s.followPillId);
  const pills = useWorld(s => s.pills);
  const meta = useWorld(s => s.meta);
  const size = meta?.size ?? 200;
  const { camera } = useThree();
  const cam = camera as PerspectiveCamera;
  const prevMode = useRef(mode);
  const orbitResetTicks = useRef(60);

  useFrame((_, dt) => {
    const t = 1 - Math.exp(-dt * 4);
    if (prevMode.current !== mode) {
      prevMode.current = mode;
      if (mode === "orbit") orbitResetTicks.current = 30;
    }
    if (mode === "orbit" && orbitResetTicks.current > 0) {
      orbitResetTicks.current--;
      // Hero shot: tilted in close enough that pills read as figures, not dots.
      cam.position.x += (size * 0.18 - cam.position.x) * t;
      cam.position.y += (size * 0.28 - cam.position.y) * t;
      cam.position.z += (size * 0.34 - cam.position.z) * t;
      cam.lookAt(0, 0, 0);
    } else if (mode === "overhead") {
      // Top-down, but not so high the town shrinks into haze.
      cam.position.x += (0 - cam.position.x) * t;
      cam.position.y += (size * 0.7 - cam.position.y) * t;
      cam.position.z += (0.001 - cam.position.z) * t;
      cam.lookAt(0, 0, 0);
    } else if (mode === "follow" && followPillId) {
      const p = pills.get(followPillId);
      if (p) {
        const tx = p.position.x, tz = p.position.z;
        const dx = tx + Math.sin(p.facingRad + Math.PI) * 7;
        const dz = tz + Math.cos(p.facingRad + Math.PI) * 7;
        cam.position.x += (dx - cam.position.x) * t;
        cam.position.y += (5 - cam.position.y) * t;
        cam.position.z += (dz - cam.position.z) * t;
        cam.lookAt(tx, p.shell.height / 2, tz);
      }
    } else if (mode === "first_person" && followPillId) {
      const p = pills.get(followPillId);
      if (p) {
        const fwdX = Math.sin(p.facingRad);
        const fwdZ = Math.cos(p.facingRad);
        cam.position.x += (p.position.x - cam.position.x) * t;
        cam.position.y += (p.shell.height - 0.1 - cam.position.y) * t;
        cam.position.z += (p.position.z - cam.position.z) * t;
        cam.lookAt(p.position.x + fwdX * 5, p.shell.height - 0.2, p.position.z + fwdZ * 5);
      }
    }
  });
  return null;
}

/** Sun position from hour-of-day, traversing east → up → west. */
function sunPosition(hour: number): [number, number, number] {
  // Map hour [0..24] to angle [-90°..270°] where 6h = horizon east, 12h = zenith, 18h = horizon west.
  const angle = ((hour - 6) / 12) * Math.PI; // 6=0, 12=π/2, 18=π
  const dist = 80;
  const x = -Math.cos(angle) * dist;
  const y = Math.sin(angle) * dist;
  const z = Math.cos(angle * 0.7) * 30;
  return [x, y, z];
}

function dayMix(hour: number, weather: string) {
  // Smoothly map hour to a "daylight" amount in [0..1]
  let day = 0;
  if (hour >= 7 && hour <= 19) day = 1;
  else if (hour > 19 && hour < 21) day = 1 - (hour - 19) / 2;
  else if (hour > 5 && hour < 7)  day = (hour - 5) / 2;
  if (weather === "overcast") day *= 0.6;
  if (weather === "rain") day *= 0.5;
  if (weather === "fog") day *= 0.7;
  return day;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function fogColorForTime(hour: number, weather: string): string {
  const daySky: [number, number, number] = [194, 220, 239];
  const nightSky: [number, number, number] = [22, 28, 48];
  const sunset: [number, number, number]  = [232, 150, 110];
  // sunrise/sunset window
  let baseDay = hour >= 7 && hour <= 19 ? 1 :
    hour > 19 && hour < 21 ? 1 - (hour - 19) / 2 :
    hour > 5 && hour < 7   ? (hour - 5) / 2 : 0;
  const isGoldenHour = (hour > 5.5 && hour < 7.5) || (hour > 18 && hour < 20);
  let col = lerpRgb(nightSky, daySky, baseDay);
  if (isGoldenHour) {
    const k = 1 - Math.abs((hour - (hour < 12 ? 6.5 : 19)) / 1.5);
    col = lerpRgb(col, sunset, Math.max(0, Math.min(1, k)) * 0.8);
  }
  if (weather === "rain" || weather === "overcast") {
    col = lerpRgb(col, [110, 118, 128], 0.5);
  }
  if (weather === "fog") {
    col = lerpRgb(col, [180, 188, 200], 0.5);
  }
  return rgbToHex(col);
}

export function Scene() {
  const meta = useWorld(s => s.meta);
  const pills = useWorld(s => s.pills);
  const buildings = useWorld(s => s.buildings);
  const plots = useWorld(s => s.plots);
  const cameraMode = useWorld(s => s.cameraMode);
  const setSelected = useWorld(s => s.selectPill);

  const pillList = useMemo(() => [...pills.values()], [pills]);
  const buildingList = useMemo(() => [...buildings.values()], [buildings]);
  const plotList = useMemo(() => [...plots.values()], [plots]);
  const size = meta?.size ?? 200;
  const seed = meta?.seed ?? "pumpworld-genesis";
  const hour = meta?.hourOfDay ?? 12;
  const weather = meta?.weather ?? "clear";

  const sunPos = sunPosition(hour);
  const day = dayMix(hour, weather);
  const fogCol = fogColorForTime(hour, weather);
  const dirIntensity = lerp(0.05, 1.3, day);
  const ambientIntensity = lerp(0.06, 0.32, day);
  const hemiIntensity = lerp(0.15, 0.55, day);
  const skyColor = day > 0.7 ? "#cfe4ff" : day > 0.2 ? "#fbd6b1" : "#2a3050";
  const groundHemi = day > 0.5 ? "#3a5a2c" : "#1a2218";

  return (
    <Canvas
      shadows
      camera={{ position: [size * 0.18, size * 0.28, size * 0.34], fov: 50 }}
      onPointerMissed={() => setSelected(null)}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
    >
      <CameraRig />
      <color attach="background" args={[fogCol]} />
      {/* Fog should haze the *edges* of town, not the middle. With size=200
       *  this puts the fog band at 120–280m so pills + buildings near origin
       *  read clearly while distant trees fade into atmosphere. */}
      <fog attach="fog" args={[fogCol, size * 0.6, size * 1.4]} />

      <hemisphereLight args={[skyColor, groundHemi, hemiIntensity]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={sunPos}
        intensity={dirIntensity}
        color={day > 0.5 ? "#fff2d6" : "#9bb6e4"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-size / 2}
        shadow-camera-right={size / 2}
        shadow-camera-top={size / 2}
        shadow-camera-bottom={-size / 2}
        shadow-camera-near={1}
        shadow-camera-far={size * 2}
        shadow-bias={-0.0005}
      />
      {day > 0.05 && (
        <Sky
          distance={4500}
          sunPosition={sunPos}
          inclination={0.49}
          azimuth={0.25}
          turbidity={weather === "clear" ? 4 : 8}
          rayleigh={1.5}
        />
      )}
      <Stars radius={400} depth={60} count={day > 0.6 ? 0 : 1800} factor={4} fade speed={0.5} />

      <Ground size={size} plots={plotList} seed={seed} />
      <Roads size={size} plots={plotList} />
      <Decor size={size} seed={seed} plots={plotList} buildings={buildingList} />
      {buildingList.map(b => <Building key={b.id} b={b} />)}
      <Items />
      {pillList.map(p => <Pill key={p.id} pill={p} />)}

      {cameraMode === "orbit" && (
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={6}
          // Was size*1.4 — at 200m that let the camera escape into the fog
          // and pills shrunk to single pixels. Cap closer to keep them legible.
          maxDistance={size * 0.7}
          target={[0, 0, 0]}
        />
      )}
    </Canvas>
  );
}
