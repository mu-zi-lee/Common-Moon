import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { moonCells, type MoonCell } from "./moon-grid";
import { taskBuilding, type MoonTask } from "./project";
import { Building, Construction, CrewWalker, SiteDetail, SupplyRover } from "./MoonVillage";
import { VoyageScene } from "./VoyageScene";
import type { Voyage } from "./moon-experience";
import { crewPosts } from "./village-model";
import { spherePoint } from "./moon-path";

type Props = {
  tasks: MoonTask[];
  crewSlots: number[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  intro: boolean;
  reset: number;
  focus: number;
  voyage: Voyage | null;
  voyageStartedAt: number;
  constructionRate: number;
  reducedMotion: boolean;
  arrived: boolean;
};

type TileRegion = {
  top: THREE.BufferGeometry;
  sides: THREE.BufferGeometry;
  normal: THREE.Vector3;
  settlement: THREE.Vector3[];
};

function tileHeight(normal: THREE.Vector3) {
  const variation = Math.sin(normal.x * 77.3 + normal.y * 103.1 + normal.z * 91.7);
  return { radius: 2.055 + variation * 0.024, shade: 0.92 + (variation + 1) * 0.035 };
}

function textureUV(position: THREE.Vector3, anchorU: number) {
  let u = (Math.atan2(position.z, -position.x) / (Math.PI * 2) + 1) % 1;
  if (u - anchorU > 0.5) u -= 1;
  if (anchorU - u > 0.5) u += 1;
  return [
    u,
    0.5 + Math.asin(THREE.MathUtils.clamp(position.y / position.length(), -1, 1)) / Math.PI,
  ];
}

function makeRegion(cells: MoonCell[]): TileRegion {
  const top: number[] = [];
  const uv: number[] = [];
  const shades: number[] = [];
  const sides: number[] = [];
  const centerOfRegion = new THREE.Vector3();
  const normals: THREE.Vector3[] = [];

  for (const { tile } of cells) {
    const normal = new THREE.Vector3(
      tile.centerPoint.x,
      tile.centerPoint.y,
      tile.centerPoint.z,
    ).normalize();
    centerOfRegion.add(normal);
    normals.push(normal);
    const { radius, shade } = tileHeight(normal);
    const center = normal.clone().multiplyScalar(radius);
    const outer = tile.boundary.map((point) => {
      const direction = new THREE.Vector3(point.x, point.y, point.z).normalize();
      return direction.multiplyScalar((radius - 0.012) / direction.dot(normal));
    });
    const inner = outer.map((corner) =>
      center.clone().lerp(corner.clone().addScaledVector(normal, 0.012), 0.8),
    );
    const anchor = textureUV(center, 0)[0];
    const pushFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      for (const position of [a, b, c]) {
        top.push(position.x, position.y, position.z);
        uv.push(...textureUV(position, anchor));
        shades.push(shade, shade, shade);
      }
    };
    for (let i = 0; i < outer.length; i++) {
      const a = inner[i];
      const b = inner[(i + 1) % inner.length];
      const edgeA = outer[i];
      const edgeB = outer[(i + 1) % outer.length];
      const face = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3) => {
        const winding = new THREE.Vector3()
          .subVectors(q, p)
          .cross(new THREE.Vector3().subVectors(r, p))
          .dot(normal);
        if (winding >= 0) pushFace(p, q, r);
        else pushFace(p, r, q);
      };
      face(center, a, b);
      face(a, edgeA, edgeB);
      face(a, edgeB, b);

      const lowerA = edgeA.clone().normalize().multiplyScalar(2.005);
      const lowerB = edgeB.clone().normalize().multiplyScalar(2.005);
      for (const point of [edgeA, edgeB, lowerB, edgeA, lowerB, lowerA]) {
        sides.push(point.x, point.y, point.z);
      }
    }
  }

  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute("position", new THREE.Float32BufferAttribute(top, 3));
  topGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  topGeometry.setAttribute("color", new THREE.Float32BufferAttribute(shades, 3));
  topGeometry.computeVertexNormals();
  const sideGeometry = new THREE.BufferGeometry();
  sideGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sides, 3));
  sideGeometry.computeVertexNormals();
  const centerDirection = centerOfRegion.clone().normalize();
  const settlement: THREE.Vector3[] = [];
  for (const normal of normals.sort((a, b) => b.dot(centerDirection) - a.dot(centerDirection))) {
    if (settlement.every((anchor) => anchor.dot(normal) < 0.985)) settlement.push(normal);
    if (settlement.length === (cells.length >= 25 ? 4 : 3)) break;
  }
  return { top: topGeometry, sides: sideGeometry, normal: centerOfRegion.normalize(), settlement };
}

function taskColor(task: MoonTask, selected: boolean) {
  if (task.status === "approved") return new THREE.Color("#fff1c9");
  if (task.status === "focusing") return new THREE.Color("#f8d5a0");
  if (task.status === "submitted") return new THREE.Color("#c4e4d9");
  return new THREE.Color(selected ? "#e5dbc0" : "#aebfbb");
}

function Footpaths({ anchors, working }: { anchors: THREE.Vector3[]; working: boolean }) {
  const paths = useMemo(
    () =>
      anchors.slice(1).map((end) => {
        const start = anchors[0];
        const points = Array.from({ length: 13 }, (_, index) =>
          start
            .clone()
            .lerp(end, index / 12)
            .normalize()
            .multiplyScalar(2.11),
        );
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.009, 4, false);
      }),
    [anchors],
  );
  useEffect(() => () => paths.forEach((path) => path.dispose()), [paths]);
  return paths.map((path, index) => (
    <mesh geometry={path} key={index}>
      <meshStandardMaterial color={working ? "#a7cbb8" : "#e9d3a6"} roughness={1} />
    </mesh>
  ));
}

function SupplyRoute({ home, site }: { home: THREE.Vector3; site: THREE.Vector3 }) {
  const path = useMemo(() => {
    const points = Array.from({ length: 33 }, (_, index) =>
      spherePoint(home, site, index / 32).multiplyScalar(2.11),
    );
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.006, 4, false);
  }, [home, site]);
  useEffect(() => () => path.dispose(), [path]);
  return (
    <mesh geometry={path}>
      <meshStandardMaterial color="#b4d8b9" transparent opacity={0.58} roughness={1} />
    </mesh>
  );
}

function Signal({ normal, status }: { normal: THREE.Vector3; status: MoonTask["status"] }) {
  const marker = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!marker.current) return;
    marker.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3.3) * 0.17);
  });
  return (
    <mesh ref={marker} position={normal.clone().multiplyScalar(2.15)}>
      <icosahedronGeometry args={[0.068, 0]} />
      <meshBasicMaterial color={status === "focusing" ? "#ffd48e" : "#d9f8cc"} />
    </mesh>
  );
}

function Region({
  task,
  geometry,
  selected,
  onSelect,
  texture,
  home,
  constructionRate,
  reducedMotion,
}: {
  task: MoonTask;
  geometry: TileRegion;
  selected: boolean;
  onSelect: () => void;
  texture: THREE.Texture;
  home: THREE.Vector3;
  constructionRate: number;
  reducedMotion: boolean;
}) {
  const surface = useRef<THREE.MeshStandardMaterial>(null);
  const edge = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, delta) => {
    const target = taskColor(task, selected);
    const blend = 1 - Math.exp(-delta * 2.3);
    surface.current?.color.lerp(target, blend);
    edge.current?.color.lerp(target.clone().multiplyScalar(0.77), blend);
  });
  return (
    <group>
      <mesh
        geometry={geometry.top}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <meshStandardMaterial
          ref={surface}
          map={texture}
          color={taskColor(task, selected)}
          vertexColors
          roughness={1}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
      <mesh
        geometry={geometry.sides}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial
          ref={edge}
          color={taskColor(task, selected).multiplyScalar(0.77)}
          roughness={1}
          side={THREE.DoubleSide}
          flatShading
        />
      </mesh>
      {(task.status === "approved" || task.status === "focusing") && (
        <Footpaths anchors={geometry.settlement} working={task.status === "focusing"} />
      )}
      {task.status === "approved" && (
        <>
          {geometry.settlement.map((normal, buildingIndex) => (
            <group
              key={buildingIndex}
              position={normal.clone().multiplyScalar(tileHeight(normal).radius + 0.012)}
              quaternion={new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                normal,
              )}
            >
              {buildingIndex === 0 ? (
                <group scale={1.25}>
                  <Building kind={taskBuilding(task)} />
                </group>
              ) : (
                <SiteDetail kind={taskBuilding(task)} variant={buildingIndex} />
              )}
            </group>
          ))}
        </>
      )}
      {(task.status === "focusing" || task.status === "submitted" || task.focusMs > 0) &&
        task.status !== "approved" &&
        geometry.settlement[0] && (
          <Construction
            task={task}
            normal={geometry.settlement[0]}
            radius={tileHeight(geometry.settlement[0]).radius + 0.016}
            rate={constructionRate}
            reducedMotion={reducedMotion}
          />
        )}
      {task.status === "focusing" && geometry.settlement[0] && (
        <>
          <SupplyRoute home={home} site={geometry.settlement[0]} />
          <SupplyRover anchors={[home, geometry.settlement[0]]} reducedMotion={reducedMotion} />
        </>
      )}
      {(task.status === "focusing" || task.status === "submitted") && (
        <Signal normal={geometry.normal} status={task.status} />
      )}
    </group>
  );
}

function useStorybookTexture(source: THREE.Texture) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 384;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !(source.image instanceof HTMLImageElement)) return source;
    context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const luminance = image.data[i] * 0.3 + image.data[i + 1] * 0.59 + image.data[i + 2] * 0.11;
      const softened = luminance * 0.46 + Math.round(luminance / 26) * 26 * 0.54;
      image.data[i] = Math.min(255, softened * 1.035 + 7);
      image.data[i + 1] = Math.min(255, softened * 1.025 + 5);
      image.data[i + 2] = Math.min(255, softened * 1.01 + 3);
    }
    context.putImageData(image, 0, 0);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.wrapS = THREE.RepeatWrapping;
    result.anisotropy = 4;
    return result;
  }, [source]);
  useEffect(
    () => () => {
      if (texture !== source) texture.dispose();
    },
    [source, texture],
  );
  return texture;
}

function Moon({
  tasks,
  crewSlots,
  selectedId,
  onSelect,
  intro,
  constructionRate,
  reducedMotion,
  voyage,
  voyageStartedAt,
  arrived,
}: Pick<
  Props,
  | "tasks"
  | "crewSlots"
  | "selectedId"
  | "onSelect"
  | "intro"
  | "constructionRate"
  | "reducedMotion"
  | "voyage"
  | "voyageStartedAt"
  | "arrived"
>) {
  const [color, height] = useTexture(["/moon-color.jpg", "/moon-height.jpg"]);
  const { size } = useThree();
  const map = useStorybookTexture(color);
  const taskCount = tasks.length;
  const moonGroup = useRef<THREE.Group>(null);
  const introStart = useRef<number | null>(null);
  const wasIntro = useRef(false);
  const regions = useMemo(() => {
    const cells = moonCells(taskCount);
    return Array.from({ length: taskCount }, (_, index) =>
      makeRegion(cells.filter((cell) => cell.taskIndex === index)),
    );
  }, [taskCount]);
  const posts = crewPosts(tasks, crewSlots, selectedId, Date.now());
  const home = regions[0]?.settlement.at(-1) ?? new THREE.Vector3(0, 0, 1);
  useEffect(
    () => () =>
      regions.forEach(({ top, sides }) => {
        top.dispose();
        sides.dispose();
      }),
    [regions],
  );
  useFrame(({ clock }) => {
    if (!moonGroup.current) return;
    if (voyage) {
      const elapsed = (performance.now() - voyageStartedAt) / 1000;
      const t = Math.min(1, Math.max(0, (elapsed - 2.5) / 6.5));
      const departure = Math.min(1, elapsed / 3);
      moonGroup.current.visible = voyage !== "outbound" || elapsed >= 2.5;
      moonGroup.current.position.x =
        voyage === "outbound" ? (1 - t) * (size.width < 720 ? 3.2 : 7) : -departure * 7;
      moonGroup.current.scale.setScalar(
        voyage === "outbound" ? 0.27 + t * 0.73 : 1 - departure * 0.73,
      );
      moonGroup.current.rotation.y = -0.45 + (voyage === "outbound" ? 1 - t : departure) * 0.6;
      wasIntro.current = false;
      introStart.current = null;
    } else if (intro) {
      moonGroup.current.visible = true;
      wasIntro.current = true;
      introStart.current ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - introStart.current) / 5.2);
      const ease = t * t * (3 - 2 * t);
      moonGroup.current.rotation.y = -1.4 + ease * 0.95;
      moonGroup.current.scale.setScalar(0.8 + ease * 0.2);
    } else {
      moonGroup.current.visible = !arrived;
      moonGroup.current.position.x = arrived ? -7 : 0;
      moonGroup.current.rotation.y = -0.45;
      moonGroup.current.scale.setScalar(arrived ? 0.27 : 1);
      introStart.current = null;
      wasIntro.current = false;
    }
  });

  return (
    <group ref={moonGroup} rotation={[0.08, -0.45, 0]}>
      <mesh>
        <sphereGeometry args={[2.005, 48, 32]} />
        <meshStandardMaterial
          map={map}
          bumpMap={height}
          bumpScale={0.035}
          color="#f5eaca"
          emissive="#a7a999"
          emissiveIntensity={0.2}
          roughness={1}
          flatShading
        />
      </mesh>
      {tasks.map((task, index) => (
        <Region
          key={task.id}
          task={task}
          geometry={regions[index]}
          texture={map}
          home={home}
          selected={task.id === selectedId}
          onSelect={() => onSelect(task.id)}
          constructionRate={constructionRate}
          reducedMotion={reducedMotion}
        />
      ))}
      {posts.map((post) => {
        const task = post.taskIndex === null ? null : tasks[post.taskIndex];
        const anchors = post.taskIndex === null ? [] : regions[post.taskIndex].settlement;
        return (
          <CrewWalker
            key={post.owner}
            home={home}
            anchors={anchors}
            owner={post.owner}
            activity={post.activity}
            kind={task ? taskBuilding(task) : "habitat"}
            selected={task?.id === selectedId}
            reducedMotion={reducedMotion}
            onSelect={() => task && onSelect(task.id)}
          />
        );
      })}
    </group>
  );
}

function Camera({
  intro,
  voyage,
  arrived,
  reset,
  focus,
  selectedId,
  tasks,
}: Pick<Props, "intro" | "voyage" | "arrived" | "reset" | "focus" | "selectedId" | "tasks">) {
  const { camera, size } = useThree();
  const lastReset = useRef(-1);
  const lastFocus = useRef(0);
  const flyTo = useRef<THREE.Vector3 | null>(null);
  const wasIntro = useRef(false);
  const started = useRef<number | null>(null);
  const [controlsReady, setControlsReady] = useState(!intro);
  const distance = size.width < 720 ? 13.8 : size.width < 1050 ? 9.5 : 8.6;
  const selectedDirection = useMemo(() => {
    const index = tasks.findIndex((task) => task.id === selectedId);
    if (index < 0) return null;
    const direction = moonCells(tasks.length).reduce((sum, cell) => {
      if (cell.taskIndex === index) {
        const { x, y, z } = cell.tile.centerPoint;
        sum.add(new THREE.Vector3(x, y, z).normalize());
      }
      return sum;
    }, new THREE.Vector3());
    return direction.normalize().applyEuler(new THREE.Euler(0.08, -0.45, 0));
  }, [selectedId, tasks]);
  useFrame(({ clock }, delta) => {
    if (voyage || arrived) {
      flyTo.current = null;
      camera.position.set(0, 0.25, distance);
      camera.lookAt(0, 0, 0);
      lastReset.current = reset;
    } else if (intro) {
      wasIntro.current = true;
      flyTo.current = null;
      started.current ??= clock.elapsedTime;
      const t = Math.min(1, (clock.elapsedTime - started.current) / 5);
      const ease = t * t * (3 - 2 * t);
      camera.position.set((1 - ease) * 2, (1 - ease) * 2.5 + 0.25, distance + (1 - ease) * 11);
      camera.lookAt(0, 0, 0);
      if (t === 1 && !controlsReady) setControlsReady(true);
    } else if (!controlsReady || wasIntro.current || lastReset.current !== reset) {
      camera.position.set(0, 0.25, distance);
      camera.lookAt(0, 0, 0);
      flyTo.current = null;
      lastReset.current = reset;
      wasIntro.current = false;
      started.current = null;
      setControlsReady(true);
    } else {
      if (lastFocus.current !== focus) {
        lastFocus.current = focus;
        if (selectedDirection) {
          flyTo.current = selectedDirection.clone().multiplyScalar(size.width < 720 ? 10.6 : 7.6);
        }
      }
      if (flyTo.current) {
        camera.position.lerp(flyTo.current, 1 - Math.exp(-delta * 3.2));
        camera.lookAt(0, 0, 0);
        if (camera.position.distanceTo(flyTo.current) < 0.025) flyTo.current = null;
      }
    }
  });
  return (
    <OrbitControls
      makeDefault
      enabled={!intro && !voyage && !arrived && controlsReady}
      enablePan={false}
      minDistance={4.3}
      maxDistance={13}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      onStart={() => {
        flyTo.current = null;
      }}
    />
  );
}

export function MoonScene(props: Props) {
  const [lost, setLost] = useState(false);
  if (lost)
    return (
      <div className="moon-scene-fallback">3D unavailable. Select sectors from the task list.</div>
    );
  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{ position: [0, 0, 14], fov: 40, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      fallback={
        <div className="moon-scene-fallback">
          3D unavailable. Select sectors from the task list.
        </div>
      }
      onCreated={({ gl }) =>
        gl.domElement.addEventListener("webglcontextlost", () => setLost(true), { once: true })
      }
    >
      <color attach="background" args={["#122024"]} />
      <ambientLight color="#dce6d9" intensity={1.1} />
      <directionalLight position={[4, 3, 5]} intensity={2} color="#fff7e9" />
      <pointLight position={[-5, -2, -3]} intensity={2.2} color="#b7d6cb" distance={16} />
      <Stars radius={65} depth={30} count={1300} factor={2.2} saturation={0} fade speed={0} />
      <Moon
        tasks={props.tasks}
        crewSlots={props.crewSlots}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        intro={props.intro}
        constructionRate={props.constructionRate}
        reducedMotion={props.reducedMotion}
        voyage={props.voyage}
        voyageStartedAt={props.voyageStartedAt}
        arrived={props.arrived}
      />
      <VoyageScene
        voyage={props.voyage}
        startedAt={props.voyageStartedAt}
        arrived={props.arrived}
        reducedMotion={props.reducedMotion}
      />
      <Camera
        intro={props.intro}
        voyage={props.voyage}
        arrived={props.arrived}
        reset={props.reset}
        focus={props.focus}
        selectedId={props.selectedId}
        tasks={props.tasks}
      />
    </Canvas>
  );
}
