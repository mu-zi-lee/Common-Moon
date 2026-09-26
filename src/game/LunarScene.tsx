import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ROUTES, SITES, type MissionState, type Role, type Site } from "./rules";

type SceneProps = {
  state: MissionState;
  role: Role | null;
  selected: Site | null;
  onSelect: (site: Site) => void;
  introActive: boolean;
  resetView: number;
};

const CRATERS = [
  { x: -4.2, z: -4.6, radius: 3.2, depth: 1.7 },
  { x: -11, z: -8, radius: 2.1, depth: 0.9 },
  { x: 9, z: 8, radius: 2.8, depth: 1.1 },
  { x: 0.7, z: 7.9, radius: 1.5, depth: 0.5 },
];

export function lunarHeight(x: number, z: number) {
  let value =
    Math.sin(x * 0.45) * Math.cos(z * 0.62) * 0.21 +
    Math.sin(x * 1.53 + z * 1.17) * 0.07 +
    Math.cos(z * 2.4 - x * 0.73) * 0.035;
  value += 0.7 * Math.exp(-(((x - 5.8) / 2.8) ** 2)) * Math.exp(-(((z - 4.3) / 2.2) ** 2));
  for (const crater of CRATERS) {
    const d = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
    value -= crater.depth * Math.exp(-((d / 0.65) ** 4));
    value += crater.depth * 0.34 * Math.exp(-(((d - 1) / 0.16) ** 2));
  }
  return value;
}

function Terrain({ night }: { night: boolean }) {
  const geometry = useMemo(() => {
    const mesh = new THREE.PlaneGeometry(40, 34, 160, 136);
    mesh.rotateX(-Math.PI / 2);
    const positions = mesh.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const y = lunarHeight(x, z);
      positions.setY(i, y);
      const granular = Math.sin(x * 11.3 + z * 7.1) * Math.cos(z * 9.7 - x * 5.9) * 0.034;
      const shade = Math.max(0.27, Math.min(0.66, 0.46 + y * 0.075 + granular));
      colors[i * 3] = shade * 1.04;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade * 0.92;
    }
    positions.needsUpdate = true;
    mesh.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.computeVertexNormals();
    return mesh;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -4.2, 0]} receiveShadow>
        <boxGeometry args={[40, 4.0, 34]} />
        <meshStandardMaterial color={night ? "#22262a" : "#383936"} roughness={1} />
      </mesh>
      <Rocks />
    </group>
  );
}

function Rocks() {
  const instanced = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => {
    let seed = 71431;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: 170 }, () => {
      const x = (random() - 0.5) * 38;
      const z = (random() - 0.5) * 32;
      const size = 0.045 + random() * 0.2;
      return { x, z, size, rotation: random() * Math.PI };
    });
  }, []);
  useEffect(() => {
    if (!instanced.current) return;
    const object = new THREE.Object3D();
    positions.forEach(({ x, z, size, rotation }, i) => {
      object.position.set(x, lunarHeight(x, z) + size * 0.38, z);
      object.scale.set(size * 1.6, size * 0.65, size);
      object.rotation.set(0, rotation, 0.1);
      object.updateMatrix();
      instanced.current?.setMatrixAt(i, object.matrix);
    });
    instanced.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  return (
    <instancedMesh ref={instanced} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#737570" flatShading roughness={1} />
    </instancedMesh>
  );
}

function RouteLines({ state, selected }: { state: MissionState; selected: Site | null }) {
  return (
    <group>
      {ROUTES.filter((route) => !(route.from === "B" && route.to === "C")).map((route) => {
        const from = SITES[route.from];
        const to = SITES[route.to];
        const active = selected === route.to && route.from === state.position;
        const travelled = state.events.some(
          (event) => event.kind === "move" && event.from === route.from && event.to === route.to,
        );
        const points = Array.from({ length: 25 }, (_, index) => {
          const fraction = index / 24;
          const x = from.x + (to.x - from.x) * fraction;
          const z = from.z + (to.z - from.z) * fraction;
          return new THREE.Vector3(x, lunarHeight(x, z) + 0.11, z);
        });
        const curve = new THREE.CatmullRomCurve3(points);
        return (
          <mesh key={`${route.from}-${route.to}`} geometry={new THREE.TubeGeometry(curve, 48, active ? 0.045 : 0.024, 5, false)}>
            <meshBasicMaterial
              color={active ? "#b9f4e7" : travelled ? "#e6ad6a" : "#c9d0c8"}
              transparent
              opacity={active ? 1 : travelled ? 0.72 : 0.38}
            />
          </mesh>
        );
      })}
      {state.position === "B" && (
        <group position={[SITES.C.x + 1.9, lunarHeight(SITES.C.x + 1.9, SITES.C.z - 0.4) + 0.16, SITES.C.z - 0.4]}>
          <mesh rotation={[-Math.PI / 2, 0, -0.5]}>
            <ringGeometry args={[0.28, 0.35, 24]} />
            <meshBasicMaterial color="#e8a067" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

function Lander() {
  return (
    <group>
      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.27, 0.52, 0.7, 6]} />
        <meshStandardMaterial color="#e1e2d9" metalness={0.48} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, 1.16, 0]}>
        <coneGeometry args={[0.32, 0.27, 6]} />
        <meshStandardMaterial color="#db936b" metalness={0.38} />
      </mesh>
      {[0, 1, 2, 3].map((index) => {
        const angle = (index * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={index} rotation={[0, angle, 0]}>
            <mesh position={[0.53, 0.25, 0]} rotation={[0, 0, -0.35]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.72, 6]} />
              <meshStandardMaterial color="#ccd4cd" metalness={0.8} />
            </mesh>
            <mesh position={[0.7, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 0.045, 12]} />
              <meshStandardMaterial color="#adbcb5" metalness={0.6} />
            </mesh>
          </group>
        );
      })}
      <pointLight position={[0, 1.6, 0]} color="#f4c18f" intensity={1.4} distance={4} />
    </group>
  );
}

function Beacon({ repaired }: { repaired: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.46, 0.6, 0.3, 8]} />
        <meshStandardMaterial color="#b9c4c0" metalness={0.6} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.04, 0.09, 2.2, 8]} />
        <meshStandardMaterial color="#b8beb8" metalness={0.85} />
      </mesh>
      <mesh position={[0, 2.55, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial
          color={repaired ? "#75f0c9" : "#d98067"}
          emissive={repaired ? "#5cf5c5" : "#b45439"}
          emissiveIntensity={repaired ? 2.4 : 0.9}
        />
      </mesh>
      {[0.4, 0.65].map((offset) => (
        <mesh key={offset} position={[offset, 0.38, 0]} rotation={[0, 0, -0.4]} castShadow>
          <boxGeometry args={[0.55, 0.035, 0.35]} />
          <meshStandardMaterial color="#356b71" metalness={0.4} roughness={0.45} />
        </mesh>
      ))}
      {repaired && (
        <>
          <pointLight position={[0, 2.5, 0]} color="#6dffcf" intensity={5} distance={7} />
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.02, 0.24, 4, 16, 1, true]} />
            <meshBasicMaterial color="#6dffcf" transparent opacity={0.23} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

function SiteMarkers({ state, selected, onSelect }: Pick<SceneProps, "state" | "selected" | "onSelect">) {
  return (
    <>
      {(Object.keys(SITES) as Site[]).map((site) => {
        const { x, z, name } = SITES[site];
        const active = selected === site;
        return (
          <group key={site} position={[x, lunarHeight(x, z), z]}>
            <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[active ? 0.91 : 0.72, active ? 1.01 : 0.77, 32]} />
              <meshBasicMaterial color={active ? "#91f3d7" : "#e5b67d"} transparent opacity={active ? 0.95 : 0.55} side={THREE.DoubleSide} />
            </mesh>
            {site === "L" && <Lander />}
            {site === "B" && <Beacon repaired={state.repaired} />}
            {(site === "C" || site === "R") && (
              <mesh position={[0, 0.38, 0]} castShadow>
                <octahedronGeometry args={[0.3, 0]} />
                <meshStandardMaterial color={site === "C" ? "#dd9f72" : "#a9b9b5"} emissive={active ? "#397e6f" : "#16191b"} />
              </mesh>
            )}
            <Html position={[0, site === "B" ? 3.2 : 1.8, 0]} center distanceFactor={14} zIndexRange={[15, 2]}>
              <button
                type="button"
                className={`lunar-site-label ${active ? "is-selected" : ""}`}
                onClick={() => onSelect(site)}
                aria-label={`Inspect ${name.toLowerCase()}`}
              >
                <span className="lunar-site-code">{site}</span>
                <span>{name}</span>
              </button>
            </Html>
            <mesh position={[0, 0.35, 0]} onClick={(event) => { event.stopPropagation(); onSelect(site); }}>
              <sphereGeometry args={[1.05, 12, 8]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Rover({ position }: { position: Site }) {
  const rover = useRef<THREE.Group>(null);
  const target = SITES[position];
  useFrame((_, delta) => {
    if (!rover.current) return;
    const speed = Math.min(1, delta * 1.55);
    rover.current.position.lerp(
      new THREE.Vector3(target.x, lunarHeight(target.x, target.z) + 0.45, target.z),
      speed,
    );
  });
  return (
    <group ref={rover} position={[SITES.L.x, lunarHeight(SITES.L.x, SITES.L.z) + 0.45, SITES.L.z]}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color="#ecf5e9" emissive="#87e6cd" emissiveIntensity={0.8} metalness={0.6} />
      </mesh>
      <pointLight intensity={1.3} distance={2.6} color="#8df4dc" />
    </group>
  );
}

function CameraRig({ introActive, resetView }: Pick<SceneProps, "introActive" | "resetView">) {
  const { camera } = useThree();
  const [ready, setReady] = useState(!introActive);
  const start = useRef<number | null>(null);
  const lastReset = useRef(resetView);
  useFrame(({ clock }) => {
    if (introActive) {
      start.current ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - start.current) / 5);
      const eased = t * t * (3 - 2 * t);
      camera.position.set(
        3 + (1 - eased) * 20,
        29 + (1 - eased) * 23,
        35 + (1 - eased) * 27,
      );
      camera.lookAt(0, 0, 0);
      if (t >= 1 && !ready) setReady(true);
    } else if (!ready || lastReset.current !== resetView) {
      camera.position.set(3, 29, 35);
      camera.lookAt(0, 0, 0);
      lastReset.current = resetView;
      setReady(true);
    }
  });
  return (
    <OrbitControls
      makeDefault
      enabled={!introActive && ready}
      enablePan={false}
      minDistance={17}
      maxDistance={65}
      minPolarAngle={0.34}
      maxPolarAngle={1.22}
      maxAzimuthAngle={Math.PI * 0.75}
      minAzimuthAngle={-Math.PI * 0.75}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.1}
    />
  );
}

export function LunarScene(props: SceneProps) {
  const [contextLost, setContextLost] = useState(false);
  if (contextLost) return <div className="lunar-scene-fallback">3D unavailable. Choose a destination from the location list.</div>;
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [23, 52, 62], fov: 39, near: 0.1, far: 190 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      fallback={<div className="lunar-scene-fallback">3D unavailable. Choose a destination from the location list.</div>}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", () => setContextLost(true), { once: true });
      }}
    >
      <color attach="background" args={["#080d11"]} />
      <fog attach="fog" args={["#080d11", 51, 110]} />
      <ambientLight intensity={props.state.position === "B" ? 0.48 : 0.82} color="#c9d4dc" />
      <directionalLight
        position={[-13, 24, 9]}
        intensity={props.state.position === "B" ? 2.1 : 3.2}
        color="#fff0d5"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.0005}
      />
      <Stars radius={85} depth={35} count={1100} factor={2.4} saturation={0} fade speed={0} />
      <Terrain night={props.state.position === "B"} />
      <RouteLines state={props.state} selected={props.selected} />
      <SiteMarkers state={props.state} selected={props.selected} onSelect={props.onSelect} />
      <Rover position={props.state.position} />
      <CameraRig introActive={props.introActive} resetView={props.resetView} />
    </Canvas>
  );
}
