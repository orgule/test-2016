// main.js - Simple 3D FPS arena demo using Three.js

// ----- Three.js basic setup -----
let scene, camera, renderer, controls;
let player, opponent;
let bullets = [];
let opponentBullets = [];

// Init Three.js
init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Controls (PointerLock)
  controls = new THREE.PointerLockControls(camera, document.body);
  const info = document.getElementById('info');
  info.addEventListener('click', () => {
    controls.lock();
  });
  controls.addEventListener('lock', () => (info.style.display = 'none'));
  controls.addEventListener('unlock', () => (info.style.display = ''));

  // Light
  const light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(light);

  // Arena floor
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Simple walls (four)
  const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const wallHeight = 30;
  const wallThickness = 5;
  const wallLength = 200;

  const makeWall = (x, y, z, rotY = 0) => {
    const geo = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    const mesh = new THREE.Mesh(geo, wallMaterial);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
  };

  // back wall
  makeWall(0, wallHeight / 2, -wallLength / 2, 0);
  // front wall
  makeWall(0, wallHeight / 2, wallLength / 2, 0);
  // left wall
  makeWall(-wallLength / 2, wallHeight / 2, 0, Math.PI / 2);
  // right wall
  makeWall(wallLength / 2, wallHeight / 2, 0, Math.PI / 2);

  // Player (invisible, we just use camera)
  // Opponent cube
  const oppGeo = new THREE.BoxGeometry(2, 4, 2);
  const oppMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  opponent = new THREE.Mesh(oppGeo, oppMat);
  opponent.position.set(0, 2, -30);
  scene.add(opponent);

  // Event listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('keydown', onKeyDown);
}

// ----- Resize handling -----
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ----- Player movement (WASD) -----
const move = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowUp':
      move.forward = true;
      break;
    case 'ArrowDown':
      move.backward = true;
      break;
    case 'ArrowLeft':
      move.left = true;
      break;
    case 'ArrowRight':
      move.right = true;
      break;
    case 'Space':
      shootBullet();
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp':
      move.forward = false;
      break;
    case 'ArrowDown':
      move.backward = false;
      break;
    case 'ArrowLeft':
      move.left = false;
      break;
    case 'ArrowRight':
      move.right = false;
      break;
  }
});

function movePlayer(delta) {
  const speed = 10; // units per second
  const velocity = new THREE.Vector3();

  if (move.forward) velocity.z -= 1;
  if (move.backward) velocity.z += 1;
  if (move.left) velocity.x -= 1;
  if (move.right) velocity.x += 1;

  velocity.normalize().multiplyScalar(speed * delta);
  controls.moveRight(velocity.x);
  controls.moveForward(velocity.z);
}

// ----- Shooting -----
function shootBullet() {
  const bulletGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bullet = new THREE.Mesh(bulletGeo, bulletMat);

  // start at camera position
  const start = new THREE.Vector3();
  camera.getWorldPosition(start);
  bullet.position.copy(start);

  // direction camera is facing
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  bullet.userData.velocity = dir.clone().multiplyScalar(60); // speed

  scene.add(bullet);
  bullets.push(bullet);
}

// Opponent simple AI: move left/right and auto-shoot
let oppDirection = 1;
let oppShootTimer = 0;

function updateOpponent(delta) {
  // Move back and forth between x = -30 and x = 30
  const range = 30;
  const speed = 8;

  opponent.position.x += oppDirection * speed * delta;
  if (opponent.position.x > range) oppDirection = -1;
  if (opponent.position.x < -range) oppDirection = 1;

  // Simple shooting every 1.5 seconds
  oppShootTimer -= delta;
  if (oppShootTimer <= 0) {
    oppShootTimer = 1.5;
    opponentShoot();
  }
}

function opponentShoot() {
  const bulletGeo = new THREE.SphereGeometry(0.25, 6, 6);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const bullet = new THREE.Mesh(bulletGeo, bulletMat);

  bullet.position.copy(opponent.position);
  bullet.position.y = 2; // eye level

  // Aim toward player (camera)
  const target = new THREE.Vector3();
  camera.getWorldPosition(target);
  const dir = target.clone().sub(bullet.position).normalize();

  bullet.userData.velocity = dir.clone().multiplyScalar(45);
  scene.add(bullet);
  opponentBullets.push(bullet);
}

// ----- Update bullets -----
function updateBullets(delta) {
  const remove = (list, i) => {
    scene.remove(list[i]);
    list.splice(i, 1);
  };

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.userData.velocity, delta);
    // simple lifetime
    if (b.position.length() > 200) remove(bullets, i);
  }

  for (let i = opponentBullets.length - 1; i >= 0; i--) {
    const b = opponentBullets[i];
    b.position.addScaledVector(b.userData.velocity, delta);
    if (b.position.length() > 200) remove(opponentBullets, i);
  }
}

// ----- Animation loop -----
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000; // seconds
  prevTime = time;

  if (controls.isLocked === true) {
    movePlayer(delta);
    updateOpponent(delta);
    updateBullets(delta);
  }

  renderer.render(scene, camera);
}