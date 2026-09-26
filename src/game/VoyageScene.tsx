import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Voyage } from "./moon-experience";
import { voyageDurations } from "./moon-experience";

type Props = { voyage: Voyage | null; startedAt: number; arrived: boolean; reducedMotion: boolean };

function Earth({ voyage, startedAt, arrived }: Omit<Props, "reducedMotion">) {
  const texture = useTexture("/earth-color.jpg");
  const globe = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!globe.current) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    if (voyage === "outbound") {
      const p = Math.min(1, elapsed / voyageDurations.outbound);
      globe.current.position.set(-0.7 - p * 7.5, -0.25, -3);
      globe.current.scale.setScalar(1 - p * 0.62);
    } else if (voyage === "homebound") {
      const p = Math.min(1, elapsed / voyageDurations.homebound);
      globe.current.position.set(7 - p * 6.6, -0.15, -3);
      globe.current.scale.setScalar(0.35 + p * 0.65);
    } else {
      globe.current.position.set(arrived ? 0.45 : -12, -0.15, -3);
      globe.current.scale.setScalar(1);
    }
    globe.current.rotation.y += delta * 0.035;
  });
  return (
    <group ref={globe} visible={voyage !== null || arrived}>
      <mesh>
        <sphereGeometry args={[2.35, 48, 32]} />
        <meshStandardMaterial
          map={texture}
          color="#c9dce2"
          roughness={1}
          emissive="#4f7290"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.38, 32, 24]} />
        <meshBasicMaterial color="#8bcde0" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function Rocket({
  voyage,
  startedAt,
  reducedMotion,
}: Pick<Props, "voyage" | "startedAt" | "reducedMotion">) {
  const body = useRef<THREE.Group>(null);
  const exhaust = useRef<THREE.Mesh>(null);
  const { size } = useThree();
  const [parts, setParts] = useState<THREE.Group[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (parts || failed) return;
    let active = true;
    const loader = new GLTFLoader();
    Promise.all(
      ["finsA", "fuelA", "sidesA", "topA"].map((name) =>
        loader.loadAsync(`/models/rocket_${name}.glb`),
      ),
    )
      .then((models) => {
        if (active) setParts(models.map((model) => model.scene));
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [parts, failed]);
  useFrame(({ clock }) => {
    if (!body.current || !voyage) return;
    const t = Math.min(
      1,
      Math.max(0, (performance.now() - startedAt) / (voyageDurations[voyage] * 1000)),
    );
    const flight = voyage === "outbound" ? t : 1 - t;
    body.current.position.set(
      size.width < 720 ? -0.85 + flight * 1.9 : -2.3 + flight * 4.1,
      -0.35 + Math.sin(t * Math.PI) * 1.65,
      2.1,
    );
    body.current.rotation.z = voyage === "outbound" ? -0.55 : 2.6;
    body.current.scale.setScalar(
      (0.85 + Math.sin(t * Math.PI) * 0.35) * (t > 0.95 ? (1 - t) * 20 : 1),
    );
    if (exhaust.current)
      exhaust.current.scale.y = reducedMotion ? 1 : 0.85 + Math.sin(clock.elapsedTime * 22) * 0.18;
  });
  if (!voyage) return null;
  return (
    <group ref={body}>
      {parts ? (
        <group scale={0.37}>
          <group position={[-2, -1.5, -1.5]}>
            {parts.map((part, index) => (
              <group key={index} position={[0, [0, 0.7, 1.2, 2.2][index], 0]}>
                <primitive object={part} />
              </group>
            ))}
          </group>
        </group>
      ) : (
        <>
          <mesh>
            <cylinderGeometry args={[0.09, 0.12, 0.52, 8]} />
            <meshStandardMaterial color="#f4f1e5" metalness={0.25} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.09, 0.21, 8]} />
            <meshStandardMaterial color="#c96e59" flatShading />
          </mesh>
          <mesh position={[0, 0.05, 0.09]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#86bbca" emissive="#39697b" emissiveIntensity={0.5} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.1, -0.22, 0]} rotation={[0, 0, side * -0.3]}>
              <boxGeometry args={[0.09, 0.16, 0.07]} />
              <meshStandardMaterial color="#c96e59" />
            </mesh>
          ))}
        </>
      )}
      <mesh position={[0, parts ? -0.68 : -0.32, 0]} ref={exhaust}>
        <coneGeometry args={[0.075, 0.34, 7]} />
        <meshBasicMaterial color="#ffca83" />
      </mesh>
      <pointLight
        position={[0, parts ? -0.85 : -0.5, 0]}
        color="#f7a96b"
        intensity={1.6}
        distance={2.2}
      />
    </group>
  );
}

function SkyPhenomenon({ startedAt }: { startedAt: number }) {
  const texture = useTexture("/moon-color.jpg");
  const moon = useRef<THREE.Group>(null);
  const surface = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    if (!moon.current || !surface.current) return;
    moon.current.visible = elapsed >= 3 && elapsed < 12;
    surface.current.uniforms.uPhase.value =
      elapsed < 6 ? THREE.MathUtils.clamp((elapsed - 3) / 3, 0, 1) * 0.55 : 0.35;
    surface.current.uniforms.uEarthshine.value = elapsed >= 6 && elapsed < 9 ? 1 : 0;
    surface.current.uniforms.uEclipse.value =
      elapsed >= 9 ? THREE.MathUtils.clamp((elapsed - 9) / 1.2, 0, 1) : 0;
    moon.current.rotation.y = -0.2 + elapsed * 0.055;
  });
  return (
    <group ref={moon} position={[0, 0.8, 1.1]} visible={false}>
      <mesh>
        <sphereGeometry args={[0.58, 40, 28]} />
        <shaderMaterial
          ref={surface}
          uniforms={{
            uMap: { value: texture },
            uPhase: { value: 0 },
            uEarthshine: { value: 0 },
            uEclipse: { value: 0 },
          }}
          vertexShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D uMap;
            uniform float uPhase;
            uniform float uEarthshine;
            uniform float uEclipse;
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vec3 sun = normalize(mix(
                vec3(-0.85, 0.2, mix(-0.45, 0.6, uPhase)),
                vec3(0.1, 0.1, 1.0),
                uEclipse
              ));
              float day = smoothstep(-0.08, 0.12, dot(normalize(vNormal), sun));
              vec3 lunar = texture2D(uMap, vUv).rgb;
              vec3 night = lunar * mix(vec3(0.09), vec3(0.14, 0.23, 0.28), uEarthshine);
              vec3 color = mix(night, lunar * 0.95, day);
              color = mix(color, lunar * vec3(0.57, 0.19, 0.13), uEclipse);
              gl_FragColor = vec4(color, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </group>
  );
}

export function VoyageScene(props: Props) {
  return (
    <>
      <Earth voyage={props.voyage} startedAt={props.startedAt} arrived={props.arrived} />
      <Rocket
        voyage={props.voyage}
        startedAt={props.startedAt}
        reducedMotion={props.reducedMotion}
      />
      {props.voyage === "homebound" && <SkyPhenomenon startedAt={props.startedAt} />}
    </>
  );
}
