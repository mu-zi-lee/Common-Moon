import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { taskBuilding, type BuildingKind, type MoonTask } from "./project";
import { constructionProgress } from "./moon-experience";
import { spherePoint } from "./moon-path";
import { crewColors } from "./village-model";

const up = new THREE.Vector3(0, 1, 0);

export function Building({ kind, miniature = false }: { kind: BuildingKind; miniature?: boolean }) {
  return (
    <group scale={miniature ? 0.55 : 1}>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.15, 0.165, 0.03, 6]} />
        <meshStandardMaterial color="#9eae9d" flatShading roughness={1} />
      </mesh>
      {kind === "habitat" && (
        <>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.17]} />
            <meshStandardMaterial color="#eee7d8" roughness={1} />
          </mesh>
          <mesh position={[0, 0.175, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.17, 0.1, 4]} />
            <meshStandardMaterial color="#c57c60" flatShading />
          </mesh>
          {[-0.055, 0.045].map((x) => (
            <mesh key={x} position={[x, 0.085, 0.087]}>
              <boxGeometry args={[0.04, 0.05, 0.008]} />
              <meshBasicMaterial color="#ffe2a0" />
            </mesh>
          ))}
          <mesh position={[0.05, 0.205, -0.04]}>
            <boxGeometry args={[0.035, 0.09, 0.035]} />
            <meshStandardMaterial color="#8b7167" />
          </mesh>
        </>
      )}
      {kind === "workshop" && (
        <>
          <mesh position={[0, 0.084, 0]}>
            <boxGeometry args={[0.23, 0.14, 0.18]} />
            <meshStandardMaterial color="#e2a584" flatShading roughness={1} />
          </mesh>
          <mesh position={[0, 0.164, 0]}>
            <boxGeometry args={[0.26, 0.025, 0.22]} />
            <meshStandardMaterial color="#456b6c" flatShading />
          </mesh>
          <mesh position={[0, 0.09, 0.097]}>
            <boxGeometry args={[0.105, 0.095, 0.012]} />
            <meshStandardMaterial color="#3f6264" />
          </mesh>
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.19, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.055, 6]} />
              <meshBasicMaterial color="#f9cf88" />
            </mesh>
          ))}
          <mesh position={[-0.13, 0.17, -0.055]}>
            <cylinderGeometry args={[0.022, 0.032, 0.2, 6]} />
            <meshStandardMaterial color="#bc7664" flatShading />
          </mesh>
        </>
      )}
      {kind === "greenhouse" && (
        <>
          <mesh position={[0, 0.033, 0]}>
            <cylinderGeometry args={[0.135, 0.135, 0.04, 8]} />
            <meshStandardMaterial color="#5b937d" flatShading />
          </mesh>
          {[-0.06, 0, 0.06].map((x, i) => (
            <mesh key={x} position={[x, 0.095, 0]} scale={[0.7, 1.2, 0.7]}>
              <icosahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial color={i === 1 ? "#c1d888" : "#85b884"} flatShading />
            </mesh>
          ))}
          <mesh position={[0, 0.047, 0]}>
            <sphereGeometry args={[0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#b9e9df"
              transparent
              opacity={0.38}
              roughness={0.35}
              depthWrite={false}
              flatShading
            />
          </mesh>
          <mesh position={[0, 0.047, 0]}>
            <sphereGeometry args={[0.142, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color="#d8ede5" wireframe transparent opacity={0.6} />
          </mesh>
        </>
      )}
      {kind === "observatory" && (
        <>
          <mesh position={[0, 0.078, 0]}>
            <cylinderGeometry args={[0.105, 0.13, 0.12, 8]} />
            <meshStandardMaterial color="#e6e2da" flatShading />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.12, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#80a6b4" flatShading roughness={0.8} />
          </mesh>
          <mesh position={[0.075, 0.2, 0]} rotation={[0, 0, -Math.PI / 3]}>
            <cylinderGeometry args={[0.027, 0.04, 0.18, 8]} />
            <meshStandardMaterial color="#e8e9dc" flatShading />
          </mesh>
          <mesh position={[0, 0.075, 0.116]}>
            <boxGeometry args={[0.045, 0.055, 0.01]} />
            <meshBasicMaterial color="#f5d09a" />
          </mesh>
        </>
      )}
      {kind === "relay" && (
        <>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.025, 0.065, 0.22, 6]} />
            <meshStandardMaterial color="#e1d4bd" flatShading />
          </mesh>
          <mesh position={[0.025, 0.24, 0]} rotation={[0, 0, -0.7]}>
            <coneGeometry args={[0.11, 0.05, 10, 1, true]} />
            <meshStandardMaterial color="#8db3bf" side={THREE.DoubleSide} flatShading />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.019, 6, 4]} />
            <meshBasicMaterial color="#f2b177" />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.12, 0.095, 0]} rotation={[-0.3, 0, side * 0.1]}>
              <boxGeometry args={[0.13, 0.014, 0.12]} />
              <meshStandardMaterial color="#476d84" roughness={0.5} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export function SiteDetail({ kind, variant }: { kind: BuildingKind; variant: number }) {
  if (kind === "greenhouse")
    return (
      <group>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.14, 5]} />
          <meshStandardMaterial color="#7a9d78" />
        </mesh>
        <mesh position={[0, 0.15, 0]} scale={[1, 1.15, 1]}>
          <icosahedronGeometry args={[variant === 1 ? 0.08 : 0.06, 0]} />
          <meshStandardMaterial color={variant === 1 ? "#95ba81" : "#c3d498"} flatShading />
        </mesh>
      </group>
    );
  if (kind === "observatory")
    return (
      <group>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.025, 0.04, 0.12, 6]} />
          <meshStandardMaterial color="#eee6d4" flatShading />
        </mesh>
        <mesh position={[0, 0.15, 0]} rotation={[0.5, variant * 0.7, 0]}>
          <cylinderGeometry args={[0.047, 0.02, 0.095, 8]} />
          <meshStandardMaterial color="#78aab2" flatShading />
        </mesh>
      </group>
    );
  if (kind === "relay")
    return (
      <group>
        <mesh position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.011, 0.02, 0.17, 6]} />
          <meshStandardMaterial color="#e4d6bc" />
        </mesh>
        <mesh position={[0, 0.17, 0]} rotation={[0, variant * 0.9, 0]}>
          <boxGeometry args={[0.16, 0.065, 0.01]} />
          <meshStandardMaterial color="#6c9fa6" flatShading />
        </mesh>
      </group>
    );
  if (kind === "workshop")
    return (
      <group>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.13, 0.1, 0.105]} />
          <meshStandardMaterial color={variant === 1 ? "#ce8f73" : "#82a7a1"} flatShading />
        </mesh>
        <mesh position={[0, 0.107, 0]}>
          <boxGeometry args={[0.14, 0.014, 0.115]} />
          <meshStandardMaterial color="#f1dac0" flatShading />
        </mesh>
      </group>
    );
  return <Building kind="habitat" miniature />;
}

export function Construction({
  task,
  normal,
  radius,
  rate,
  reducedMotion,
}: {
  task: MoonTask;
  normal: THREE.Vector3;
  radius: number;
  rate: number;
  reducedMotion: boolean;
}) {
  const shell = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const crane = useRef<THREE.Group>(null);
  const rotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(up, normal), [normal]);
  useFrame(({ clock }) => {
    const growth = constructionProgress(task, Date.now(), rate);
    if (shell.current) {
      shell.current.visible = growth > 0;
      shell.current.scale.y = Math.max(0.12, growth);
    }
    if (frame.current) frame.current.visible = growth > 0.25;
    if (crane.current) crane.current.visible = task.status === "focusing";
    if (crane.current && !reducedMotion && task.status === "focusing") {
      crane.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.7;
    }
  });
  return (
    <group position={normal.clone().multiplyScalar(radius)} quaternion={rotation}>
      <group ref={shell}>
        <mesh position={[0, 0.012, 0]}>
          <cylinderGeometry args={[0.16, 0.17, 0.025, 6]} />
          <meshStandardMaterial color="#bead91" flatShading />
        </mesh>
        <Building kind={taskBuilding(task)} />
        <group ref={frame}>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.25, 0.19, 0.22]} />
            <meshStandardMaterial color="#dde6d7" wireframe transparent opacity={0.38} />
          </mesh>
        </group>
      </group>
      <group position={[0.18, 0, -0.04]} ref={crane}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.025, 0.32, 0.025]} />
          <meshStandardMaterial color="#d3a262" />
        </mesh>
        <mesh position={[-0.08, 0.31, 0]}>
          <boxGeometry args={[0.24, 0.025, 0.025]} />
          <meshStandardMaterial color="#d3a262" />
        </mesh>
        <mesh position={[-0.18, 0.245, 0]}>
          <boxGeometry args={[0.005, 0.12, 0.005]} />
          <meshStandardMaterial color="#8c938d" />
        </mesh>
      </group>
    </group>
  );
}

export function CrewWalker({
  home,
  anchors,
  owner,
  activity,
  kind,
  selected,
  reducedMotion,
  onSelect,
}: {
  home: THREE.Vector3;
  anchors: THREE.Vector3[];
  owner: number;
  activity: "working" | "review" | "blocked" | "celebrate" | "idle";
  kind: BuildingKind;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const actor = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const position = useRef<THREE.Vector3 | null>(null);
  useFrame(({ clock }, delta) => {
    if (!actor.current) return;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    const working = activity === "working";
    const first = anchors[0] ?? home;
    const cycle = (time + owner * 2) % 18;
    const site = working
      ? cycle < 4
        ? spherePoint(home, first, cycle / 4)
        : cycle > 14
          ? spherePoint(first, home, (cycle - 14) / 4)
          : spherePoint(first, anchors[1] ?? first, (Math.sin(time * 0.7) + 1) * 0.25)
      : first;
    normal.copy(activity === "idle" && !anchors.length ? home : site).normalize();
    if (!position.current || reducedMotion) position.current = normal.clone();
    position.current.lerp(normal, 1 - Math.exp(-delta * (working ? 0.85 : 1.4))).normalize();
    actor.current.position.copy(position.current).multiplyScalar(2.14);
    actor.current.position.addScaledVector(
      position.current,
      working ? Math.abs(Math.sin(time * 6)) * 0.006 : 0,
    );
    actor.current.quaternion.setFromUnitVectors(up, position.current);
    const swing = Math.sin(time * 6) * (working ? 0.55 : 0.08);
    if (rightArm.current)
      rightArm.current.rotation.z = selected
        ? 2 + Math.sin(time * 5) * 0.35
        : activity === "celebrate"
          ? 2.3 + Math.sin(time * 7) * 0.28
          : activity === "blocked"
            ? 1.6
            : activity === "review"
              ? 0.85
              : working
                ? 0.65 + swing
                : 0.1;
    if (leftArm.current)
      leftArm.current.rotation.z =
        activity === "celebrate" ? -2.3 - Math.sin(time * 7) * 0.28 : -swing;
    if (leftLeg.current) leftLeg.current.rotation.x = working ? swing * 0.35 : 0;
    if (rightLeg.current) rightLeg.current.rotation.x = working ? -swing * 0.35 : 0;
  });
  return (
    <group
      ref={actor}
      scale={1.55}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, 0.074, 0]}>
        <capsuleGeometry args={[0.027, 0.05, 2, 6]} />
        <meshStandardMaterial color={crewColors[(owner - 1) % 4]} flatShading />
      </mesh>
      <mesh position={[0, 0.136, 0]}>
        <sphereGeometry args={[0.039, 8, 6]} />
        <meshStandardMaterial color="#f4f1e5" flatShading />
      </mesh>
      <mesh position={[0, 0.139, 0.027]} scale={[1, 0.7, 0.4]}>
        <sphereGeometry args={[0.029, 8, 5]} />
        <meshStandardMaterial color="#3d5b64" roughness={0.3} />
      </mesh>
      <group ref={rightArm} position={[0.033, 0.09, 0]}>
        <mesh position={[0, -0.018, 0]}>
          <capsuleGeometry args={[0.012, 0.032, 2, 5]} />
          <meshStandardMaterial color="#d5dace" />
        </mesh>
      </group>
      <group ref={leftArm} position={[-0.033, 0.09, 0]} scale={[-1, 1, 1]}>
        <mesh position={[0, -0.018, 0]}>
          <capsuleGeometry args={[0.012, 0.032, 2, 5]} />
          <meshStandardMaterial color="#d5dace" />
        </mesh>
      </group>
      <group ref={leftLeg} position={[-0.016, 0.052, 0]}>
        <mesh position={[0, -0.026, 0]}>
          <boxGeometry args={[0.02, 0.052, 0.028]} />
          <meshStandardMaterial color="#c5cec5" />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.016, 0.052, 0]}>
        <mesh position={[0, -0.026, 0]}>
          <boxGeometry args={[0.02, 0.052, 0.028]} />
          <meshStandardMaterial color="#c5cec5" />
        </mesh>
      </group>
      {(activity === "review" || (activity === "working" && kind === "observatory")) && (
        <mesh position={[0.035, 0.09, 0.045]} rotation={[0.5, 0, -0.25]}>
          <boxGeometry args={[0.055, 0.009, 0.04]} />
          <meshStandardMaterial color="#7caca6" emissive="#43716e" emissiveIntensity={0.3} />
        </mesh>
      )}
      {activity === "blocked" && (
        <mesh position={[0, 0.23, 0]}>
          <icosahedronGeometry args={[0.018, 0]} />
          <meshBasicMaterial color="#e2a273" />
        </mesh>
      )}
    </group>
  );
}

export function SupplyRover({
  anchors,
  reducedMotion,
}: {
  anchors: THREE.Vector3[];
  reducedMotion: boolean;
}) {
  const rover = useRef<THREE.Group>(null);
  const normal = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (!rover.current || !anchors.length) return;
    const progress = reducedMotion ? 0.5 : (Math.sin(clock.elapsedTime * 0.95) + 1) / 2;
    normal.copy(spherePoint(anchors[0], anchors[1] ?? anchors[0], progress));
    rover.current.position.copy(normal).multiplyScalar(2.13);
    rover.current.quaternion.setFromUnitVectors(up, normal);
    if (progress <= 0.5) rover.current.rotateY(Math.PI);
  });
  return (
    <group ref={rover} scale={0.75}>
      <mesh position={[0, 0.052, 0]}>
        <boxGeometry args={[0.09, 0.045, 0.12]} />
        <meshStandardMaterial color="#e2aa76" flatShading />
      </mesh>
      <mesh position={[0, 0.096, 0]}>
        <boxGeometry args={[0.058, 0.044, 0.052]} />
        <meshStandardMaterial color="#b5d0b0" flatShading />
      </mesh>
      {[-0.05, 0.05].flatMap((x) =>
        [-0.038, 0.038].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.023, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.018, 8]} />
            <meshStandardMaterial color="#3b5558" flatShading />
          </mesh>
        )),
      )}
    </group>
  );
}
