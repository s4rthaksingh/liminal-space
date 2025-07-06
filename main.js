import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

// Add lighting for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// First-person player object
const player = new THREE.Object3D();
scene.add(player);

// Place camera at player's head
player.add(camera);
camera.position.set(0, 1.7, 0); // typical eye height

// Pointer lock and mouse look
let isPointerLocked = false;
let yaw = 0; // horizontal rotation (player/camera)
let pitch = 0; // vertical rotation (camera)
const pitchLimit = Math.PI / 2 - 0.1;

document.body.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
});
document.addEventListener('mousemove', (e) => {
    if (!isPointerLocked) return;
    const sensitivity = 0.002;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
});

// Load your GLB file
const loader = new GLTFLoader();
let yourMap; // Variable to store your loaded model
let mapCenter = new THREE.Vector3();
let move = { w: false, a: false, s: false, d: false };
const moveSpeed = 0.04;
let collisionMeshes = [];

function handleKeyDown(e) {
    if (e.code === 'KeyW') move.w = true;
    if (e.code === 'KeyA') move.a = true;
    if (e.code === 'KeyS') move.s = true;
    if (e.code === 'KeyD') move.d = true;
}
function handleKeyUp(e) {
    if (e.code === 'KeyW') move.w = false;
    if (e.code === 'KeyA') move.a = false;
    if (e.code === 'KeyS') move.s = false;
    if (e.code === 'KeyD') move.d = false;
}
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

loader.load('/a_liminal_space.glb',
    function (gltf) {
        yourMap = gltf.scene;
        scene.add(yourMap);
        
        // Optional: Center the model
        const box = new THREE.Box3().setFromObject(yourMap);
        const center = box.getCenter(new THREE.Vector3());
        yourMap.position.sub(center);
        mapCenter.copy(center);
        
        // Spawn player at map center, slightly above ground
        player.position.set(center.x, box.max.y + 2 - 10 + 3 , center.z + 5 - 10 );
        // Create invisible collision meshes for each mesh (wall-like only)
        yourMap.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.computeBoundingBox();
                const bbox = obj.geometry.boundingBox.clone();
                bbox.applyMatrix4(obj.matrixWorld);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                const centerBox = new THREE.Vector3();
                bbox.getCenter(centerBox);
                // Wall-like: tall and thin (height > 2, width or depth < 1)
                if ((size.y > 2.0) && (size.x < 1.0 || size.z < 1.0)) {
                    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
                    const boxMat = new THREE.MeshBasicMaterial({ visible: true, color: 0xff0000, wireframe: true });
                    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
                    boxMesh.position.copy(centerBox);
                    boxMesh.updateMatrixWorld();
                    collisionMeshes.push(boxMesh);
                    scene.add(boxMesh); // Visible for debugging
                }
            }
        });
    },
    function (progress) {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    function (error) {
        console.error('Error loading GLB file:', error);
    }
);

function willCollide(nextPos) {
    // Player's head/camera position
    const playerRadius = 0.3;
    const playerBox = new THREE.Box3().setFromCenterAndSize(
        nextPos,
        new THREE.Vector3(playerRadius * 2, 1.7, playerRadius * 2)
    );
    for (const mesh of collisionMeshes) {
        mesh.geometry.computeBoundingBox();
        const meshBox = mesh.geometry.boundingBox.clone();
        meshBox.applyMatrix4(mesh.matrixWorld);
        if (playerBox.intersectsBox(meshBox)) return true;
    }
    return false;
}

function animate() {
    // Apply yaw to player (horizontal rotation)
    player.rotation.y = yaw;
    // Apply pitch to camera (vertical look)
    camera.rotation.x = pitch;
    camera.rotation.z = 0;

    // WASD movement relative to camera direction, with collision
    let forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0));
    let right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, yaw, 0));
    let moveVec = new THREE.Vector3();
    if (move.w) moveVec.add(forward);
    if (move.s) moveVec.add(forward.clone().negate());
    if (move.a) moveVec.add(right.clone().negate());
    if (move.d) moveVec.add(right);
    if (moveVec.lengthSq() > 0) {
        moveVec.normalize().multiplyScalar(moveSpeed);
        const nextPos = player.position.clone().add(moveVec);
        if (!willCollide(nextPos)) {
            player.position.copy(nextPos);
        }
    }

    renderer.render( scene, camera );
}