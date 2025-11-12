import { useEffect, useRef } from "react";
import * as THREE from "three";

export const ChunkVisualizer = ({ progress, totalChunks, uploadedChunks }: { progress: number; totalChunks: number; uploadedChunks: number }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const chunksRef = useRef<THREE.Mesh[]>([]);

    useEffect(() => {
        if (!containerRef.current) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        camera.position.z = 35;
        camera.position.y = 5;
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(300, 300);
        renderer.setClearColor(0x000000, 0);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0x08A2C8, 1, 100);
        pointLight.position.set(10, 10, 10);
        scene.add(pointLight);

        const pointLight2 = new THREE.PointLight(0x0891b2, 0.8, 100);
        pointLight2.position.set(-10, -10, 10);
        scene.add(pointLight2);

        const chunks: THREE.Mesh[] = [];
        const gridSize = Math.ceil(Math.sqrt(totalChunks));
        const spacing = 2;

        for (let i = 0; i < totalChunks; i++) {
            const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            const material = new THREE.MeshPhongMaterial({
                color: 0x1e293b,
                transparent: true,
                opacity: 0.3,
                emissive: 0x1e293b,
                emissiveIntensity: 0.1,
            });
            const cube = new THREE.Mesh(geometry, material);

            const x = (i % gridSize) * spacing - (gridSize * spacing) / 2;
            const z = Math.floor(i / gridSize) * spacing - (gridSize * spacing) / 2;

            cube.position.set(x, -20, z);
            cube.userData.targetY = 0;
            cube.userData.uploaded = false;

            scene.add(cube);
            chunks.push(cube);
        }
        chunksRef.current = chunks;

        const animate = () => {
            requestAnimationFrame(animate);

            chunks.forEach((cube, idx) => {
                cube.rotation.x += 0.005;
                cube.rotation.y += 0.005;

                if (cube.userData.uploaded) {
                    cube.position.y += (cube.userData.targetY - cube.position.y) * 0.1;
                }
            });

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            renderer.dispose();
            if (containerRef.current && renderer.domElement) {
                containerRef.current.removeChild(renderer.domElement);
            }
        };
    }, [totalChunks]);

    useEffect(() => {
        const chunksToActivate = Math.floor((uploadedChunks / totalChunks) * chunksRef.current.length);

        chunksRef.current.forEach((cube, idx) => {
            if (idx < chunksToActivate && !cube.userData.uploaded) {
                cube.userData.uploaded = true;
                cube.userData.targetY = 0;

                (cube.material as THREE.MeshPhongMaterial).color.setHex(0x08A2C8);
                (cube.material as THREE.MeshPhongMaterial).emissive.setHex(0x08A2C8);
                (cube.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.5;
                (cube.material as THREE.MeshPhongMaterial).opacity = 1;
            }
        });
    }, [uploadedChunks, totalChunks]);

    return (
        <div className="flex items-center justify-center">
            <div ref={containerRef} className="rounded-2xl overflow-hidden" />
        </div>
    );
};