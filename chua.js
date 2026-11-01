// Chính điện 3D: dựng cảnh bằng hình khối Three.js (không cần file mô hình) + nghi thức dâng hương.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, SKINS } from './avatar.js';

const $ = (id) => document.getElementById(id);

/* ===== Renderer, cảnh, camera ===== */
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a0c06');
scene.fog = new THREE.Fog('#2a0c06', 16, 34);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
camera.rotation.order = 'YXZ';
scene.add(camera);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 72 : 58;   // màn dọc cần góc rộng hơn
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ===== Texture vẽ bằng canvas ===== */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const glowTex = (inner, outer) => canvasTex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(0.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const FLAME = glowTex('rgba(255,250,220,1)', 'rgba(255,160,40,.6)');
const EMBER = glowTex('rgba(255,230,160,1)', 'rgba(255,80,20,.7)');
const SMOKE = glowTex('rgba(255,255,255,.55)', 'rgba(230,225,215,.18)');
const HALO = glowTex('rgba(255,250,210,1)', 'rgba(255,200,80,.55)');

const floorTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#9a4a24'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#b0582c'; g.fillRect(4, 4, 120, 120); g.fillRect(132, 132, 120, 120);
  g.fillStyle = '#a65028'; g.fillRect(132, 4, 120, 120); g.fillRect(4, 132, 120, 120);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 9);

function textPlane(text, w, h, { vertical = false, size = 0.7 } = {}) {
  const px = 128, cw = Math.round(w * px), ch = Math.round(h * px);
  const tex = canvasTex(cw, ch, (g) => {
    g.fillStyle = '#2a0806'; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = '#f2b53a'; g.lineWidth = 6; g.strokeRect(8, 8, cw - 16, ch - 16);
    g.fillStyle = '#ffd970'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text];
    if (vertical) {
      const step = (ch - 40) / chars.length;
      g.font = `bold ${Math.min(cw * size, step * 0.85)}px serif`;
      chars.forEach((c, i) => g.fillText(c, cw / 2, 20 + step * (i + 0.5)));
    } else {
      const step = (cw - 40) / chars.length;
      g.font = `bold ${Math.min(ch * size, step * 0.85)}px serif`;
      chars.forEach((c, i) => g.fillText(c, 20 + step * (i + 0.5), ch / 2));
    }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 }));
}

/* ===== Vật liệu ===== */
const M = {
  gold: new THREE.MeshStandardMaterial({ color: '#e8b33a', metalness: 1, roughness: 0.28 }),
  goldSoft: new THREE.MeshStandardMaterial({ color: '#d9a040', metalness: 0.8, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: '#a01e16', roughness: 0.5 }),
  redDark: new THREE.MeshStandardMaterial({ color: '#5a0e0a', roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: '#6a3818', roughness: 0.7 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#7a4a1e', metalness: 0.9, roughness: 0.35 }),
  ash: new THREE.MeshStandardMaterial({ color: '#b8b0a4', roughness: 1 }),
  lotus: new THREE.MeshStandardMaterial({ color: '#f7a8c0', roughness: 0.5, emissive: '#ec5f92', emissiveIntensity: 0.15 }),
  wax: new THREE.MeshStandardMaterial({ color: '#fff4e0', roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.2 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3a8a4a', roughness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.1 }),
};
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* ===== Gian điện ===== */
add(new THREE.PlaneGeometry(14, 18), M.floor, 0, 0, 1).rotation.x = -Math.PI / 2;
add(new THREE.PlaneGeometry(14, 7.5), M.redDark, 0, 3.75, -8);
for (const s of [-1, 1]) add(new THREE.PlaneGeometry(18, 7.5), M.redDark, s * 7, 3.75, 1).rotation.y = -s * Math.PI / 2;
add(new THREE.PlaneGeometry(14, 18), M.wood, 0, 7.5, 1).rotation.x = Math.PI / 2;
for (let z = -7; z <= 9; z += 2.5) {
  add(box(14, 0.35, 0.3), M.wood, 0, 7.2, z);
  add(box(14, 0.06, 0.32), M.gold, 0, 7.0, z);
}

// Cột son + câu đối
const COUPLETS = [['Phúc Huệ Song Tu Đức Viên Mãn', 'Từ Bi Hỷ Xả Phổ Độ Chúng Sinh'], ['Phật Quang Phổ Chiếu', 'Pháp Luân Thường Chuyển']];
[-5, -1.5, 2.5, 6.5].forEach((z, zi) => {
  for (const s of [-1, 1]) {
    const x = s * 4.6;
    add(new THREE.CylinderGeometry(0.34, 0.34, 7.5, 24), M.red, x, 3.75, z);
    add(new THREE.CylinderGeometry(0.46, 0.5, 0.35, 24), M.gold, x, 0.17, z);
    add(new THREE.TorusGeometry(0.35, 0.04, 8, 24), M.gold, x, 6.6, z).rotation.x = Math.PI / 2;
    if (zi < 2) {
      const p = textPlane(COUPLETS[zi][s < 0 ? 0 : 1], 0.42, 3.6, { vertical: true });
      p.position.set(x - s * 0.36, 3.6, z); p.rotation.y = -s * Math.PI / 2;
      // Câu đối quay vào giữa lối đi
      scene.add(p);
    }
  }
});

// Hoành phi
add(box(4.6, 1.3, 0.15), M.gold, 0, 5.9, -7.85);
const plaque = textPlane('ĐẠI HÙNG BẢO ĐIỆN', 4.3, 1.05, { size: 0.75 });
plaque.position.set(0, 5.9, -7.76); scene.add(plaque);

// Đèn lồng
const lanternMat = new THREE.MeshStandardMaterial({ color: '#d42a22', emissive: '#ff4020', emissiveIntensity: 0.6, roughness: 0.4 });
for (const z of [-3, 1.5, 6]) for (const s of [-1, 1]) {
  const g = new THREE.Group(); g.position.set(s * 3, 5.4, z); scene.add(g);
  add(new THREE.CylinderGeometry(0.01, 0.01, 1.6), M.gold, 0, 1.2, 0, g);
  add(new THREE.SphereGeometry(0.42, 20, 14), lanternMat, 0, 0, 0, g).scale.set(1, 1.15, 1);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), M.gold, 0, 0.5, 0, g);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), M.gold, 0, -0.5, 0, g);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME, color: '#ff7040', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(2.2); g.add(glow);
}

/* ===== Bệ thờ & tượng Phật ===== */
const BZ = -6.4;
add(box(8.4, 0.35, 4), M.red, 0, 0.17, BZ + 0.3);
add(box(8.5, 0.05, 4.05), M.gold, 0, 0.36, BZ + 0.3);
add(box(6, 0.4, 3), M.red, 0, 0.58, BZ);
add(box(6.1, 0.05, 3.05), M.gold, 0, 0.8, BZ);

const buddha = new THREE.Group(); buddha.position.set(0, 0.82, BZ); scene.add(buddha);
// Hào quang phía sau
const mandorla = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
mandorla.scale.set(5.2, 5.2, 1); mandorla.position.set(0, 2.2, -0.6); buddha.add(mandorla);
add(new THREE.TorusGeometry(0.72, 0.045, 10, 64), M.gold, 0, 2.62, -0.4, buddha);
add(new THREE.TorusGeometry(1.75, 0.06, 10, 80), M.gold, 0, 1.95, -0.5, buddha);
// Đài sen: 2 vòng cánh
add(new THREE.CylinderGeometry(1.25, 1.45, 0.35, 32), M.goldSoft, 0, 0.18, 0, buddha);
[[16, 1.3, 0.45, 0.5], [12, 1.0, 0.7, 0.25]].forEach(([n, r, y, tilt]) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = add(new THREE.SphereGeometry(0.32, 16, 10), M.lotus, Math.sin(a) * r, y, Math.cos(a) * r, buddha);
    p.scale.set(0.75, 0.55, 1.35); p.rotation.set(-tilt, a, 0);
  }
});
// Khối trụ bo tròn nối 2 điểm (tay, chân)
function limb(a, b, r, mat = M.gold) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = add(new THREE.CapsuleGeometry(r, len, 6, 14), mat, 0, 0, 0, buddha);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
// Chân xếp bằng (kiết già)
add(new THREE.SphereGeometry(0.6, 28, 16), M.gold, 0, 0.72, 0.15, buddha).scale.set(1.75, 0.42, 1.05);
limb([-0.85, 0.75, 0.35], [0.35, 0.8, 0.62], 0.2);
limb([0.85, 0.75, 0.35], [-0.35, 0.82, 0.58], 0.2);
// Thân: hông → eo → ngực → vai
const torso = new THREE.LatheGeometry([
  [0, 0], [0.6, 0.02], [0.58, 0.35], [0.52, 0.6], [0.58, 0.95], [0.66, 1.18], [0.5, 1.32], [0.18, 1.4], [0, 1.41],
].map(([x, y]) => new THREE.Vector2(x, y)), 40);
add(torso, M.gold, 0, 0.82, 0, buddha).scale.set(1, 1, 0.62);
// Áo cà sa vắt vai trái
const robe = add(new THREE.TorusGeometry(0.5, 0.06, 8, 30, Math.PI * 1.1), M.goldSoft, 0.02, 1.62, 0.12, buddha);
robe.rotation.set(0.25, 0, 2.2);
// Tay: vai → khuỷu → bàn tay đặt trong lòng (thiền định ấn)
for (const s of [-1, 1]) {
  limb([s * 0.6, 1.95, 0], [s * 0.72, 1.35, 0.2], 0.14);
  limb([s * 0.72, 1.35, 0.2], [s * 0.18, 1.12, 0.48], 0.12);
}
add(new THREE.SphereGeometry(0.16, 16, 12), M.goldSoft, 0, 1.12, 0.5, buddha).scale.set(1.7, 0.55, 1);
// Cổ, đầu, nhục kế, tai
add(new THREE.CylinderGeometry(0.13, 0.17, 0.22, 16), M.gold, 0, 2.28, 0, buddha);
const head = add(new THREE.SphereGeometry(0.33, 32, 24), M.gold, 0, 2.6, 0.02, buddha); head.scale.set(0.9, 1.08, 0.95);
add(new THREE.SphereGeometry(0.15, 20, 14), M.gold, 0, 2.98, 0, buddha);
const curls = new THREE.MeshStandardMaterial({ color: '#c8902a', metalness: 1, roughness: 0.5 });
add(new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), curls, 0, 2.62, 0.01, buddha).scale.set(0.92, 1.08, 0.97);
for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.055, 0.26, 6, 10), M.gold, s * 0.31, 2.5, 0, buddha);
// Mặt: mắt khép, bạch hào, miệng
const faceMat = new THREE.MeshStandardMaterial({ color: '#8a5a14', metalness: 0.6, roughness: 0.5 });
for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), faceMat, s * 0.1, 2.6, 0.32, buddha).rotation.z = Math.PI;
add(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: '#d23c2e' }), 0, 2.7, 0.31, buddha);
add(new THREE.TorusGeometry(0.04, 0.007, 6, 12, Math.PI), faceMat, 0, 2.47, 0.31, buddha).rotation.z = Math.PI;

const spot = new THREE.SpotLight('#ffe0a0', 60, 18, 0.5, 0.6, 1.5);
spot.position.set(0, 6.5, -1.5); spot.target = buddha; scene.add(spot);
scene.add(new THREE.HemisphereLight('#ffd9a0', '#3a1008', 0.9));
const fill = new THREE.PointLight('#ffb070', 12, 14, 1.5); fill.position.set(0, 3, 2); scene.add(fill);

/* ===== Bàn thờ phía trước ===== */
const TZ = -3.3, TY = 1.08;
add(box(3.8, 1, 1.25), M.red, 0, 0.5, TZ);
add(box(4, 0.08, 1.4), M.wood, 0, TY - 0.04, TZ);
add(box(3.2, 0.05, 0.02), M.gold, 0, 0.8, TZ + 0.63);
add(box(3.2, 0.05, 0.02), M.gold, 0, 0.2, TZ + 0.63);

// Bát hương
const bowl = new THREE.LatheGeometry([[0.18, 0], [0.3, 0.05], [0.36, 0.2], [0.34, 0.32], [0.37, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
add(bowl, M.bronze, 0, TY, TZ).material.side = THREE.DoubleSide;
const ASH_Y = TY + 0.3;
add(new THREE.CircleGeometry(0.34, 32), M.ash, 0, ASH_Y, TZ).rotation.x = -Math.PI / 2;
const BOWL = new THREE.Vector3(0, ASH_Y, TZ);

// Nến
const flames = [];
for (const s of [-1, 1]) {
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 16), M.gold, s * 1.4, TY + 0.04, TZ);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16), M.wax, s * 1.4, TY + 0.33, TZ);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  f.position.set(s * 1.4, TY + 0.66, TZ); f.scale.set(0.16, 0.3, 1); scene.add(f);
  const l = new THREE.PointLight('#ff9a40', 3, 5, 1.6); l.position.copy(f.position); scene.add(l);
  flames.push({ f, l, seed: Math.random() * 10 });
}
// Bình hoa sen
for (const s of [-1, 1]) {
  const vase = new THREE.LatheGeometry([[0, 0], [0.12, 0.02], [0.16, 0.18], [0.08, 0.36], [0.11, 0.45]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  add(vase, M.gold, s * 0.8, TY, TZ - 0.2);
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 0.12, h = 0.45 + (i === 1 ? 0.2 : 0);
    add(new THREE.CylinderGeometry(0.01, 0.01, h), M.leaf, s * 0.8 + dx / 2, TY + 0.45 + h / 2, TZ - 0.2);
    add(new THREE.SphereGeometry(0.09, 12, 10), M.lotus, s * 0.8 + dx, TY + 0.45 + h, TZ - 0.2).scale.set(1, 1.3, 1);
  }
}
// Mâm quả
add(new THREE.CylinderGeometry(0.28, 0.2, 0.06, 24), M.gold, 0, TY + 0.03, TZ - 0.42);
[['#f2a03a', 0, 0.14], ['#e8463a', -0.12, 0.1], ['#9ac84a', 0.12, 0.1], ['#f2c84a', 0, 0.26]].forEach(([c, x, y], i) =>
  add(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }), x, TY + y, TZ - 0.42 + (i === 3 ? 0 : 0.03)));

// Bồ đoàn (đệm quỳ)
// 20 chỗ quỳ (4 hàng × 5), mỗi người trong phòng một chỗ — khớp ROOM_SIZE ở máy chủ
const SLOTS = [];
for (const z of [-0.9, 0.5, 1.9, 3.3]) for (const x of [0, -1.2, 1.2, -2.4, 2.4]) SLOTS.push(new THREE.Vector3(x, 0, z));
const cushionMat = new THREE.MeshStandardMaterial({ color: '#c8902a', roughness: 0.9 });
for (const s of SLOTS) add(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 28), cushionMat, s.x, 0.08, s.z);

/* ===== Khói hương ===== */
const smokeMat = new THREE.SpriteMaterial({ map: SMOKE, transparent: true, depthWrite: false, opacity: 0.5 });
const puffs = [];
const emitters = new Set();   // các đầu nhang đang cháy (Object3D)
function emitSmoke(dt) {
  const p = new THREE.Vector3();
  for (const tip of emitters) {
    tip.userData.acc = (tip.userData.acc || 0) + dt;
    if (tip.userData.acc < 0.18) continue;
    tip.userData.acc = 0;
    tip.getWorldPosition(p);
    let s = puffs.find((x) => !x.visible);
    if (!s) { if (puffs.length > 160) continue; s = new THREE.Sprite(smokeMat.clone()); puffs.push(s); scene.add(s); }
    s.visible = true; s.position.copy(p); s.userData = { life: 0, max: 3 + Math.random() * 1.5, drift: (Math.random() - 0.5) * 0.15 };
  }
  for (const s of puffs) {
    if (!s.visible) continue;
    const d = s.userData; d.life += dt;
    const k = d.life / d.max;
    if (k >= 1) { s.visible = false; continue; }
    s.position.y += dt * 0.32;
    s.position.x += Math.sin(d.life * 1.7 + d.drift * 40) * dt * 0.06 + d.drift * dt;
    s.scale.setScalar(0.06 + k * 0.5);
    s.material.opacity = 0.45 * Math.sin(Math.PI * k);
  }
}

/* ===== Nhang ===== */
const stickMat = new THREE.MeshStandardMaterial({ color: '#8a4a2a', roughness: 0.8 });
const handleMat = new THREE.MeshStandardMaterial({ color: '#c0281e', roughness: 0.6 });
const emberMat = new THREE.MeshStandardMaterial({ color: '#ff7020', emissive: '#ff5a10', emissiveIntensity: 0 });
function makeIncense(n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const st = new THREE.Group();
    const spread = n === 1 ? 0 : (i / (n - 1) - 0.5);
    st.position.x = spread * 0.08; st.rotation.z = -spread * 0.35;
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.16), handleMat, 0, 0.08, 0, st);
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.34), stickMat, 0, 0.33, 0, st);
    const tip = add(new THREE.SphereGeometry(0.01, 8, 6), emberMat.clone(), 0, 0.5, 0, st);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: EMBER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.07); tip.add(glow);
    tip.userData.glow = glow;
    g.add(st);
  }
  return g;
}
const tipsOf = (g) => g.children.map((st) => st.children[2]);

/* ===== Tween & điều khiển nhìn ===== */
const tweens = [];
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const tween = (ms, fn) => new Promise((done) => tweens.push({ t0: performance.now(), ms, fn, done }));

const look = { yaw: 0, pitch: 0, dPitch: 0 };
const pos = new THREE.Vector3(0, 1.7, 10);        // vị trí camera
const ENTRY = new THREE.Vector3(0, 0, 8.5);      // người khác bước vào từ cửa
const cam = { yaw: 0 };                           // góc camera quanh nhân vật (kéo chuột để xoay)
const ALTAR = new THREE.Vector3(0, 1.6, BZ);

/* ===== Di chuyển: phím WASD / mũi tên, hoặc click/chạm lên sàn ===== */
const SPEED = 2.4;
const BOUNDS = { x: 6.2, zMin: -2.3, zMax: 9.2 };   // trong gian điện, trước bàn thờ
const COLUMNS = [];
for (const z of [-5, -1.5, 2.5, 6.5]) for (const s of [-1, 1]) COLUMNS.push(new THREE.Vector2(s * 4.6, z));
// Giữ một điểm trong gian và đẩy ra khỏi chân cột
function constrain(p) {
  p.x = THREE.MathUtils.clamp(p.x, -BOUNDS.x, BOUNDS.x);
  p.z = THREE.MathUtils.clamp(p.z, BOUNDS.zMin, BOUNDS.zMax);
  for (const c of COLUMNS) {
    const dx = p.x - c.x, dz = p.z - c.y, d = Math.hypot(dx, dz);
    if (d < 0.65) { const k = 0.65 / (d || 1); p.x = c.x + dx * k; p.z = c.y + dz * k; }
  }
  return p;
}

const keys = new Set();
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input') || !KEYMAP[e.code]) return;
  keys.add(KEYMAP[e.code]); e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(KEYMAP[e.code]));
addEventListener('blur', () => keys.clear());

// Điểm đến khi click sàn + vòng đánh dấu
const marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 32), new THREE.MeshBasicMaterial({ color: '#ffd970', transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.position.y = 0.02; scene.add(marker);
const raycaster = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function clickFloor(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;
  me.target = constrain(hit);
  marker.position.set(hit.x, 0.02, hit.z); marker.material.opacity = 1; marker.scale.setScalar(1);
}

// Kéo = xoay camera; chạm nhanh không kéo = đi tới điểm đó
let dragging = null;
$('scene').addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }; });
addEventListener('pointerup', (e) => {
  if (dragging && Math.hypot(e.clientX - dragging.x0, e.clientY - dragging.y0) < 6 && performance.now() - dragging.t < 500
      && e.target === $('scene') && me.free) clickFloor(e);
  dragging = null;
});
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - dragging.x) * 0.005;
  look.dPitch = THREE.MathUtils.clamp(look.dPitch + (e.clientY - dragging.y) * 0.003, -0.4, 0.4);
  dragging.x = e.clientX; dragging.y = e.clientY;
  if (Math.hypot(e.clientX - dragging.x0, e.clientY - dragging.y0) > 6) $('hint').style.opacity = 0;
});

// Bước đi cho một nhân vật hướng tới đích; trả về true nếu đang di chuyển
function stepToward(actor, dest, dt) {
  const p = actor.avatar.root.position, dx = dest.x - p.x, dz = dest.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.03) return false;
  const s = Math.min(d, SPEED * dt);
  p.x += (dx / d) * s; p.z += (dz / d) * s;
  faceToward(actor, Math.atan2(dx, dz), dt);
  return true;
}
function faceToward(actor, ry, dt) {
  const r = actor.avatar.root;
  let diff = ry - r.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  r.rotation.y += diff * Math.min(1, dt * 10);
}
// Chờ tới khi nhân vật đến đích (dùng cho: đi tới đệm rồi mới quỳ)
const arrived = (actor) => new Promise((res) => {
  const chk = () => (actor.avatar.root.position.distanceTo(actor.target) < 0.04 ? res() : requestAnimationFrame(chk));
  chk();
});

let lastSent = 0, wasMoving = false;
function moveLocal(dt) {
  if (me.kneeling) return;
  const input = new THREE.Vector3((keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), 0, (keys.has('b') ? 1 : 0) - (keys.has('f') ? 1 : 0));
  let moving = false;
  if (me.free && input.lengthSq()) {
    input.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);   // hướng theo camera
    const p = me.avatar.root.position, next = constrain(p.clone().addScaledVector(input, SPEED * dt));
    faceToward(me, Math.atan2(input.x, input.z), dt);
    p.copy(next); me.target = null; moving = true;
  } else if (me.target) {
    moving = stepToward(me, me.target, dt);
    if (!moving && me.free) me.target = null;
  }
  me.avatar.pose.walk = moving ? 1 : 0;
  // Gửi vị trí cho người khác ~5 lần/giây khi đang đi, và 1 lần khi dừng
  const now = performance.now();
  if ((moving && now - lastSent > 200) || (!moving && wasMoving)) {
    lastSent = now;
    const p = me.avatar.root.position;
    act('move', { x: +p.x.toFixed(2), z: +p.z.toFixed(2) });
  }
  wasMoving = moving;
}

// Camera bám sau lưng nhân vật theo góc cam.yaw, nhìn về phía trước
function followCamera(dt) {
  const p = me.avatar.root.position;
  const back = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cam.yaw);
  const want = p.clone().addScaledVector(back, 3.4); want.y = 2.4;
  want.x = THREE.MathUtils.clamp(want.x, -6.6, 6.6);
  pos.lerp(want, 1 - Math.exp(-dt * 5));
  // Đi lại: nhìn thẳng phía trước. Đang quỳ: nhìn về giữa nhân vật và tượng Phật
  aimAt(me.kneeling ? p.clone().lerp(ALTAR, 0.55).setY(1.3) : p.clone().addScaledVector(back, -3).setY(1.1));
}
function aimAt(target) {
  const d = target.clone().sub(pos);
  look.yaw = Math.atan2(-d.x, -d.z);
  look.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}

/* ===== Âm thanh ===== */
let actx;
function bell(vol = 1) {
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime;
  [[196, 0.45, 6], [392, 0.25, 4.5], [494, 0.18, 3.5], [587, 0.12, 3], [784, 0.06, 2]].forEach(([fq, v, dur]) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = fq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  });
}

/* ===== Nghi thức ===== */
const KEY = 'tichduc_chua_v1';
let stats;
try { stats = JSON.parse(localStorage.getItem(KEY)) || { times: 0 }; } catch { stats = { times: 0 }; }
const showCount = () => { $('count').textContent = stats.times ? `🪔 Đã dâng hương ${stats.times} lần` : ''; };
showCount();

let count = 3;
const planted = [];

/* ===== Hành động của một nhân vật — dùng chung cho mình và người khác ===== */
// actor: { avatar, held, slot, queue } — queue xếp hàng các hành động để chạy lần lượt
const enqueue = (actor, fn) => (actor.queue = actor.queue.then(fn).catch(() => {}));

// Quỳ xuống đệm (quay mặt về tượng Phật) / đứng dậy
async function kneelDown(actor, ms = 700) {
  const a = actor.avatar, r0 = a.root.rotation.y;
  actor.kneeling = true; a.pose.walk = 0;
  await tween(ms, (k) => {
    a.pose.kneel = ease(k); a.root.position.y = 0.16 * ease(k);
    a.root.rotation.y = r0 + (Math.atan2(Math.sin(Math.PI - r0), Math.cos(Math.PI - r0))) * ease(k);
    if (a.tag) a.tag.material.opacity = actor === me ? 1 - k : 1 - 0.3 * k;   // ẩn tên mình, giữ tên người khác
  });
}
async function standUp(actor, ms = 600) {
  const a = actor.avatar;
  await tween(ms, (k) => {
    a.pose.kneel = 1 - ease(k); a.root.position.y = 0.16 * (1 - ease(k));
    if (a.tag) a.tag.material.opacity = actor === me ? ease(k) : 0.7 + 0.3 * k;
  });
  actor.kneeling = false;
}
async function lightIncense(actor, n, instant = false) {
  const g = actor.held = makeIncense(n);
  g.position.set(0, -0.05, 0); g.rotation.x = 0.15;
  actor.avatar.hands.add(g);
  const tips = tipsOf(g);
  const set = (k) => { actor.avatar.pose.hold = k; tips.forEach((t) => { t.material.emissiveIntensity = 2 * k; t.userData.glow.material.opacity = k; }); };
  if (instant) set(1); else { await tween(700, (k) => set(ease(k) * 0.3)); await tween(900, (k) => set(0.3 + 0.7 * ease(k))); }
  tips.forEach((t) => emitters.add(t));
}
async function bowOnce(actor, sound) {
  await tween(900, (k) => { actor.avatar.pose.bow = ease(k); });
  if (sound) bell(0.6);
  await tween(900, (k) => { actor.avatar.pose.bow = 1 - ease(k); });
}
function bowlSpot(off) { return BOWL.clone().add(new THREE.Vector3(off[0], -0.12, off[1])); }
function startBurning(g, ageMs = 0) { g.userData.born = performance.now() - ageMs; planted.push(g); }
async function plantIncense(actor, off) {
  const g = actor.held; if (!g) return;
  actor.held = null;
  scene.attach(g);                       // tách khỏi tay, giữ nguyên vị trí trong không gian
  tween(800, (k) => { actor.avatar.pose.hold = 1 - ease(k); });
  const from = g.position.clone(), q0 = g.quaternion.clone(), q1 = new THREE.Quaternion(), to = bowlSpot(off);
  await tween(1400, (k) => {
    const e = ease(k);
    g.position.lerpVectors(from, to, e); g.position.y += Math.sin(Math.PI * e) * 0.25;
    g.quaternion.slerpQuaternions(q0, q1, e);
  });
  startBurning(g);
}
// Hương người khác đã cắm trước khi mình vào: dựng thẳng trong bát, cháy tiếp theo thời gian thực
function plantStatic(n, off, ageMs) {
  const g = makeIncense(n); g.position.copy(bowlSpot(off)); scene.add(g);
  tipsOf(g).forEach((t) => { t.material.emissiveIntensity = 2; t.userData.glow.material.opacity = 1; emitters.add(t); });
  startBurning(g, ageMs);
}
function showEmote(actor, e) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 11; s.scale.setScalar(0.45); s.position.set(0, 1.6, 0);
  actor.avatar.root.add(s);
  tween(2200, (k) => { s.position.y = 1.6 + k * 0.8; s.material.opacity = 1 - k * k; }).then(() => actor.avatar.root.remove(s));
}

function panel(step, title, desc, html) {
  $('p-step').textContent = step; $('p-title').textContent = title; $('p-desc').textContent = desc;
  $('p-body').innerHTML = html; $('panel').classList.remove('hide');
}
const hidePanel = () => $('panel').classList.add('hide');

function stepChoose() {
  panel('BƯỚC 1/4', 'Chọn số nén hương', 'Thường dâng 1 nén (tâm thành) hoặc 3 nén (Phật – Pháp – Tăng).',
    `<div class="row">${[1, 3, 5].map((n) => `<button class="opt ${n === count ? 'on' : ''}" data-n="${n}">${n} nén<small>${{ 1: 'Nhất tâm', 3: 'Tam bảo', 5: 'Ngũ phương' }[n]}</small></button>`).join('')}</div>
     <button class="btn" id="a-next">Tiếp tục</button>`);
  $('p-body').querySelectorAll('[data-n]').forEach((b) => b.onclick = () => {
    count = +b.dataset.n; $('p-body').querySelectorAll('.opt').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('a-next').onclick = stepLight;
}

function stepLight() {
  panel('BƯỚC 2/4', 'Thắp hương', 'Châm lửa từ ngọn nến trên bàn thờ.', '<button class="btn" id="a-light">🔥 Thắp hương</button>');
  $('a-light').onclick = async () => {
    $('a-light').disabled = true;
    act('light', { count });
    await lightIncense(me, count);
    stepBow(0);
  };
}

function stepBow(done) {
  panel('BƯỚC 3/4', 'Vái ba vái', 'Nâng hương ngang trán, cúi đầu thành kính.',
    `<button class="btn" id="a-bow">🙏 Vái (${done}/3)</button>`);
  $('a-bow').onclick = async () => {
    $('a-bow').disabled = true;
    act('bow');
    await bowOnce(me, true);
    done < 2 ? stepBow(done + 1) : stepPlant();
  };
}

function stepPlant() {
  panel('BƯỚC 4/4', 'Cắm hương vào bát', 'Cắm hương ngay ngắn vào bát hương trên bàn thờ.', '<button class="btn" id="a-plant">Cắm hương</button>');
  $('a-plant').onclick = async () => {
    hidePanel();
    const r = await act('plant');
    await plantIncense(me, r?.off || [Math.random() * 0.4 - 0.2, Math.random() * 0.2 - 0.1]);
    bell(1);
    stopAmbient(); act('stand'); await standUp(me); me.free = true;
    stats.times++; stats.last = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch {}
    showCount();
    stepWish();
  };
}

function stepWish() {
  panel('NGUYỆN CẦU', 'Gửi lời nguyện', 'Lời nguyện chỉ hiện trên màn hình của bạn, không lưu lại.',
    `<input class="wish" id="a-wish" maxlength="80" placeholder="Con nguyện…">
     <div class="row"><button class="btn ghost" id="a-skip">Bỏ qua</button><button class="btn" id="a-send">Gửi lời nguyện</button></div>`);
  const finish = (text) => {
    if (text) {
      const el = document.createElement('div'); el.className = 'wish-float'; el.textContent = text;
      document.body.append(el); setTimeout(() => el.remove(), 4200);
    }
    panel('', 'Công đức viên mãn 🙏', 'Nguyện cho bạn và người thân được bình an. Bạn có thể đi dạo quanh chính điện.',
      `<div class="row"><button class="btn ghost" id="a-again">Dâng thêm</button><a class="btn" href="./" style="text-decoration:none">Về gõ mõ</a></div>`);
    $('a-again').onclick = startRitual;
  };
  $('a-send').onclick = () => finish($('a-wish').value.trim());
  $('a-skip').onclick = () => finish('');
}

// Đang đi lại tự do: chọn dâng hương hoặc tụng kinh
function stepFree() {
  panel('', 'Chính điện', 'Đi lại bằng phím WASD / mũi tên hoặc chạm lên sàn. Kéo để xoay góc nhìn.',
    `<div class="row"><button class="btn" id="a-start">🪔 Dâng hương</button><button class="btn" id="a-tung">📿 Tụng kinh</button></div>`);
  $('a-start').onclick = startRitual;
  $('a-tung').onclick = startChantMode;
}
async function startRitual() {
  hidePanel();
  await gotoCushion();
  stepChoose();
}
// Đi tới đệm của mình rồi quỳ xuống (bỏ qua nếu đang quỳ sẵn)
async function gotoCushion() {
  if (me.kneeling) return;
  me.free = false; keys.clear(); marker.material.opacity = 0;
  me.target = SLOTS[me.slot].clone();
  await arrived(me);
  const s = SLOTS[me.slot];
  me.avatar.root.position.set(s.x, 0, s.z);
  act('move', { x: s.x, z: s.z });                // báo đúng vị trí đệm trước khi quỳ
  act('kneel');
  // Xoay camera sang góc chéo 3/4 để thấy dáng vái
  const y0 = cam.yaw, y1 = SLOTS[me.slot].x > 0.6 ? -0.55 : 0.55;
  tween(900, (k) => { cam.yaw = y0 + (y1 - y0) * ease(k); });
  await kneelDown(me);
}

/* ===== Tụng kinh, dâng lễ, giọng đọc ===== */
// Thứ tự câu kinh phải khớp SUTRA_COUNT ở máy chủ: mạng chỉ gửi số thứ tự, không gửi chữ tự do
const SUTRA = ['Nam mô A Di Đà Phật', 'Nam mô Bổn Sư Thích Ca Mâu Ni Phật', 'Nam mô Đại Bi Quán Thế Âm Bồ Tát',
  'Nam mô Đại Thế Chí Bồ Tát', 'Nam mô Địa Tạng Vương Bồ Tát', 'Nguyện gia đạo an vui',
  'Nguyện cha mẹ thân tâm an lạc', 'Nguyện đem công đức này hướng về khắp tất cả'];
const OFFER = {
  hoa:    { icon: '🌸', label: 'hoa', pts: 1, cd: 3 },
  huong:  { icon: '🪔', label: 'hương', pts: 3, cd: 8 },
  sen:    { icon: '🪷', label: 'hoa sen', pts: 9, cd: 20 },
  chuong: { icon: '🔔', label: 'chuông', pts: 27, cd: 45 },
};
const PRAYERS = ['gia đình bình an', 'cha mẹ mạnh khỏe', 'mọi người an lạc', 'chúng sinh thoát khổ', 'tâm luôn thanh tịnh'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Khung tin nhắn: chỉ dùng textContent nên tên/bình luận không chèn được HTML
function feed(name, text, gift = false) {
  const d = document.createElement('div'), b = document.createElement('b');
  d.className = 'msg' + (gift ? ' gift' : '');
  b.textContent = name; d.append(b, ' ' + text);
  $('feed').append(d);
  while ($('feed').children.length > (document.body.classList.contains('live') ? 4 : 6)) $('feed').firstChild.remove();
  setTimeout(() => d.classList.add('old'), 15000);
}
function renderBoard(list = []) {
  $('board').hidden = !list.length;
  const ol = $('board-list'); ol.textContent = '';
  list.slice(0, 5).forEach((e, i) => {
    const li = document.createElement('li'), s = document.createElement('span');
    li.textContent = `${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${e.name}`; s.textContent = e.pts.toLocaleString('vi-VN');
    li.append(s); ol.append(li);
  });
}
let bannerTimer;
function banner(text) {
  $('banner').textContent = text; $('banner').classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => $('banner').classList.remove('show'), 4500);
}

// Giọng đọc tiếng Việt có sẵn trong trình duyệt (Edge/Windows có giọng Hoài My, Nam Minh)
let voiceOn = true, viVoice = null, ttsQueue = 0, ttsWarned = false;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  viVoice = vs.find((v) => /^vi/i.test(v.lang) && /Natural|Online/i.test(v.name)) || vs.find((v) => /^vi/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); }
function speak(text) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  if (!viVoice) pickVoice();
  if (!viVoice) {
    if (!ttsWarned) {
      ttsWarned = true;
      const msg = 'máy này chưa có giọng tiếng Việt nên không đọc thành tiếng.';
      LIVE ? console.warn('[giọng đọc]', msg) : feed('Hệ thống', msg);   // không hiện lên màn hình phát cho người xem
    }
    return;
  }
  if (ttsQueue >= 5) return;                     // chống spam: tối đa 5 câu chờ đọc
  const u = new SpeechSynthesisUtterance(String(text).slice(0, 220));
  u.voice = viVoice; u.lang = viVoice.lang; u.rate = 0.95;
  ttsQueue++; u.onend = u.onerror = () => { ttsQueue = Math.max(0, ttsQueue - 1); };
  speechSynthesis.speak(u);
}

// Mõ tụng kinh: tiếng gỗ tổng hợp, nhịp đều
function mok() {
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.1);
  g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.16);
}
let chanting = false, mokTimer = null, bellTimer = null, sutraIdx = 0;
function startAmbient() {
  if (chanting) return;
  chanting = true; bell(0.5);
  mokTimer = setInterval(mok, 1250); bellTimer = setInterval(() => bell(0.5), 50e3);
}
function stopAmbient() { chanting = false; clearInterval(mokTimer); clearInterval(bellTimer); }

// Câu kinh nổi trên đầu nhân vật
function chantBubble(actor, text) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 112;
  const g = c.getContext('2d');
  g.font = '600 46px "Be Vietnam Pro", system-ui, sans-serif';
  const w = Math.min(760, g.measureText(text).width + 56);
  g.fillStyle = 'rgba(255,250,242,.94)'; g.beginPath(); g.roundRect((768 - w) / 2, 10, w, 90, 45); g.fill();
  g.fillStyle = '#9a2232'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 384, 57, 740);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 12; s.scale.set(1.9, 0.28, 1); s.position.y = 1.75;
  actor.avatar.root.add(s);
  tween(3200, (k) => { s.position.y = 1.75 + k * 0.5; s.material.opacity = k < 0.75 ? 1 : (1 - k) * 4; })
    .then(() => { actor.avatar.root.remove(s); tex.dispose(); });
}
function chantLine(actor, text, name) {
  chantBubble(actor, text);
  feed(name, text);
  enqueue(actor, () => bowOnce(actor, false));
}

async function startChantMode() {
  hidePanel();
  await gotoCushion();
  startAmbient();
  stepChant();
}
function stepChant() {
  panel('TỤNG KINH', 'Đang tụng kinh', 'Mõ tự gõ theo nhịp, chuông ngân mỗi 50 giây. Chạm "Niệm" để niệm một câu cùng mọi người.',
    `<button class="btn" id="a-niem">📿 Niệm: ${SUTRA[sutraIdx]}</button>
     <div class="row"><button class="btn ghost" id="a-ritual">🪔 Dâng hương</button><button class="btn ghost" id="a-up">Đứng dậy</button></div>`);
  $('a-niem').onclick = () => {
    const i = sutraIdx; sutraIdx = (sutraIdx + 1) % SUTRA.length;
    chantLine(me, SUTRA[i], profile.name); act('chant', { i });
    $('a-niem').disabled = true;
    setTimeout(() => { if ($('a-niem')) { $('a-niem').disabled = false; $('a-niem').textContent = `📿 Niệm: ${SUTRA[sutraIdx]}`; } }, 1500);
  };
  $('a-ritual').onclick = () => { stopAmbient(); stepChoose(); };
  $('a-up').onclick = async () => { hidePanel(); stopAmbient(); act('stand'); await standUp(me); me.free = true; stepFree(); };
}

/* Hiệu ứng dâng lễ trong cảnh 3D */
const fxList = [];
const addFx = (obj, life, step) => { scene.add(obj); fxList.push({ obj, t: 0, life, step }); };
const petalMat = new THREE.MeshBasicMaterial({ color: '#ffb3cb', side: THREE.DoubleSide, transparent: true });
function fx(kind, actor) {
  const from = actor.avatar.root.position.clone().setY(1.3);
  if (kind === 'hoa') {                          // cánh hoa rơi quanh bàn thờ
    for (let i = 0; i < 36; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), petalMat);
      p.scale.y = 0.6; p.position.set((Math.random() - 0.5) * 6, 5 + Math.random() * 2, -5 + Math.random() * 5);
      const vx = (Math.random() - 0.5) * 0.4, spin = Math.random() * 4, y0 = p.position.y;
      addFx(p, 4 + Math.random() * 2, (k, dt) => {
        p.position.y = y0 - k * 5; p.position.x += Math.sin(k * 12 + spin) * dt * 0.4 + vx * dt;
        p.rotation.set(k * spin * 3, k * spin * 2, 0);
      });
    }
  }
  if (kind === 'huong') {                        // làn khói lớn bốc lên từ bát hương
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(smokeMat.clone()); s.position.copy(BOWL);
      const d = Math.random() * 0.6;
      addFx(s, 3.5, (k) => { s.position.y = BOWL.y + k * 2.4 + d; s.position.x = BOWL.x + Math.sin(k * 6 + i) * 0.2; s.scale.setScalar(0.2 + k * 1.2); s.material.opacity = 0.5 * Math.sin(Math.PI * k); });
    }
  }
  if (kind === 'sen') {                          // hoa sen bay từ người dâng lên trước tượng Phật
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.lotus);
      const a = (i / 8) * Math.PI * 2; p.position.set(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1); p.scale.set(0.7, 0.5, 1.4); p.rotation.y = a; g.add(p);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.8); g.add(glow);
    const to = new THREE.Vector3(0, 2.2, BZ + 1.4);
    addFx(g, 2.8, (k) => { const e = ease(k); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(Math.PI * e) * 0.8; g.rotation.y = k * 6; g.scale.setScalar(k > 0.85 ? (1 - k) / 0.15 : 1); });
  }
  if (kind === 'chuong') {                       // tiếng chuông + vòng hào quang lan ra từ tượng Phật
    bell(1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: '#ffd970', transparent: true }));
    ring.position.set(0, 2.6, BZ + 0.6);
    addFx(ring, 2.2, (k) => { ring.scale.setScalar(0.5 + k * 6); ring.material.opacity = 1 - k; });
    tween(2200, (k) => { mandorla.scale.setScalar(5.2 * (1 + Math.sin(Math.PI * k) * 0.25)); });
  }
}

// Dâng lễ: hiệu ứng + khung tin + giọng xướng tên hồi hướng
// gift: tên quà TikTok + câu hồi hướng do bộ phát LIVE gửi kèm (nếu có)
function doOffer(actor, kind, name, gift) {
  const o = OFFER[kind], what = gift?.name || o.label;
  fx(kind, actor);
  feed(name, `dâng ${what} ${o.icon}`, true);
  if (o.pts >= 20 || gift) banner(`${o.icon} ${name} dâng ${what}`);
  speak(gift?.line || `Tích Đức xin ghi nhận đạo hữu ${name} đã dâng ${o.label}. Nguyện ${pick(PRAYERS)}. Công đức vô lượng.`);
}
let localPts = 0;
$('offers').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-kind]'); if (!b || b.disabled) return;
  const kind = b.dataset.kind, o = OFFER[kind];
  b.disabled = true; setTimeout(() => (b.disabled = false), o.cd * 1000);
  const r = await act('offer', { kind });
  if (net.pid && !r) return;                     // máy chủ từ chối (đang chờ)
  doOffer(me, kind, profile.name);
  if (r?.board) renderBoard(r.board);
  else { localPts += o.pts; renderBoard([{ name: profile.name, pts: localPts }]); }   // chơi một mình
});
$('btn-voice').addEventListener('click', () => {
  voiceOn = !voiceOn;
  $('btn-voice').textContent = voiceOn ? '🗣️' : '🔇';
  if (!voiceOn) speechSynthesis?.cancel();
});

/* ===== Nhân vật & màn tạo nhân vật ===== */
const AV_KEY = 'tichduc_avatar_v1', MAIN_KEY = 'tichduc_state_v1';
const NAMES = ['Diệu Tâm', 'Chánh Giác', 'Minh Tâm', 'Thiện Hạnh', 'Tâm An', 'Như Ý', 'Diệu Hiền', 'Hạnh Nguyên', 'Thanh Tịnh', 'Quảng Huệ', 'Diệu Âm', 'Minh Đức'];
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const main = readJSON(MAIN_KEY);
const profile = { gender: 'nam', hair: 'troc', skin: 2, outfit: 'lam', ...readJSON(AV_KEY) };
profile.name ||= main.name || '';

const START = new THREE.Vector3(0, 0, 5.2);       // chỗ nhân vật đứng lúc tạo
let avatar, inside = false;
const me = { avatar: null, held: null, slot: 0, queue: Promise.resolve(), target: null, free: false, kneeling: false };
function rebuild() {
  const rot = avatar ? avatar.root.rotation.y : 0;
  if (avatar) scene.remove(avatar.root);
  avatar = me.avatar = buildAvatar({ ...profile, name: profile.name.trim() });
  avatar.root.position.copy(START); avatar.root.rotation.y = rot;
  scene.add(avatar.root);
}
// Camera xem trước: nhân vật nằm ở nửa trên màn hình, phía trên bảng chọn
pos.set(0, 1.5, 9.4);
aimAt(new THREE.Vector3(0, 0.2, START.z));
$('hint').style.opacity = 0;
const entryLight = new THREE.PointLight('#ffe2b8', 10, 7, 1.5); entryLight.position.set(0.8, 2.4, 8.4); scene.add(entryLight);
rebuild();

function syncChips() {
  document.querySelectorAll('.chips').forEach((box) => box.querySelectorAll('button').forEach((b) =>
    b.classList.toggle('on', String(profile[box.dataset.key]) === b.dataset.v)));
}
$('creator').querySelector('[data-key=skin]').innerHTML =
  SKINS.map((c, i) => `<button data-v="${i}" style="background:${c}" aria-label="Màu da ${i + 1}"></button>`).join('');
document.querySelectorAll('.chips').forEach((box) => box.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const key = box.dataset.key;
  profile[key] = key === 'skin' ? +b.dataset.v : b.dataset.v;
  if (key === 'gender' && !readJSON(AV_KEY).hair) profile.hair = profile.gender === 'nu' ? 'dai' : 'troc';   // gợi ý tóc theo giới tính lần đầu
  syncChips(); rebuild();
}));
$('cr-name').value = profile.name;
let nameTimer;
$('cr-name').addEventListener('input', () => { profile.name = $('cr-name').value; clearTimeout(nameTimer); nameTimer = setTimeout(rebuild, 250); });
$('cr-dice').onclick = () => { profile.name = $('cr-name').value = NAMES[Math.floor(Math.random() * NAMES.length)]; rebuild(); };
syncChips();

// Lưu nhân vật; đồng bộ tên sang trang gõ mõ (và máy chủ nếu đã có tài khoản)
function saveProfile() {
  profile.name = profile.name.trim().slice(0, 20);
  try { localStorage.setItem(AV_KEY, JSON.stringify(profile)); } catch {}
  const s = readJSON(MAIN_KEY);
  if (profile.name && s.name !== profile.name) {
    s.name = profile.name;
    try { localStorage.setItem(MAIN_KEY, JSON.stringify(s)); } catch {}
    if (s.uid && s.code) fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: s.uid, code: s.code, name: profile.name, province: s.province || '' }) }).catch(() => {});
  }
}

/* ===== Vào chính điện ===== */
$('btn-enter').textContent = 'Vào chính điện';
$('btn-enter').disabled = false;
$('btn-enter').onclick = async () => {
  if (!profile.name.trim()) { $('cr-name').focus(); $('cr-name').placeholder = 'Hãy đặt pháp danh trước nhé'; return; }
  saveProfile(); rebuild();
  bell(0.7);
  $('creator').classList.add('hide');
  $('btn-enter').disabled = true;
  await joinRoom();                       // nhận chỗ quỳ; không có máy chủ thì vào một mình ở chỗ đầu tiên
  // Đi vào tới cạnh đệm quỳ của mình; camera tự vòng ra sau lưng và bám theo
  inside = true; cam.yaw = 0;
  if (me.avatar.tag) me.avatar.tag.visible = false;   // tên mình đã có trên bảng của người khác, ẩn để không che tượng
  const s = SLOTS[me.slot];
  me.target = constrain(new THREE.Vector3(s.x, 0, s.z + 0.9));
  await arrived(me);
  me.free = true;
  $('emotes').hidden = false; $('offers').hidden = false;
  feed(profile.name, 'đã vào chính điện');
  stepFree();
  $('hint').textContent = 'WASD / mũi tên hoặc chạm sàn để đi · kéo để xoay';
  $('hint').style.opacity = 1;
  setTimeout(() => ($('hint').style.opacity = 0), 6000);
};

/* ===== Nhiều người: vào phòng, nhận sự kiện người khác ===== */
const net = { pid: null, token: null, es: null };
const remotes = new Map();   // pid → actor

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}
async function joinRoom() {
  try {
    const r = await post('/api/room/join', { ...profile, slot: me.slot });
    net.pid = r.pid; net.token = r.token; me.slot = r.slot;
    openStream();
  } catch { /* không có máy chủ: vẫn dâng hương một mình */ }
}
async function act(type, data = {}) {
  if (!net.pid) return null;
  try { return await post('/api/room/act', { pid: net.pid, token: net.token, type, ...data }); } catch { return null; }
}

// Nghe sự kiện phòng: dùng chung cho phòng chính điện và màn hình LIVE (url khác nhau)
function listen(url) {
  net.es?.close();
  const es = net.es = new EventSource(url);
  es.addEventListener('snapshot', (e) => {
    const d = JSON.parse(e.data);
    d.members.forEach((m) => addRemote(m, false));
    (d.incense || []).forEach((i) => { if (!seenIncense.has(i.id)) { seenIncense.add(i.id); plantStatic(i.count, i.off, d.now - i.at); } });
    renderBoard(d.board);
    updatePeople();
  });
  es.addEventListener('join', (e) => {
    const m = JSON.parse(e.data);
    if (remotes.has(m.pid)) return;
    addRemote(m, true); updatePeople();
    feed(m.name, 'đã vào chính điện');
    speak(`Chào mừng đạo hữu ${m.name} đến chính điện`);
  });
  es.addEventListener('leave', (e) => { removeRemote(JSON.parse(e.data).pid); updatePeople(); });
  es.addEventListener('act', (e) => onRemoteAct(JSON.parse(e.data)));
  return es;
}
function openStream() {
  const es = listen(`/api/room/stream?pid=${net.pid}&token=${net.token}`);
  es.onerror = () => {
    // Máy chủ đã xoá phiên (mất mạng lâu): vào lại phòng, giữ chỗ cũ nếu còn trống
    if (es.readyState !== EventSource.CLOSED) return;
    remotes.forEach((_, pid) => removeRemote(pid)); updatePeople();
    setTimeout(joinRoom, 3000);
  };
}
const seenIncense = new Set();

function addRemote(m, walkIn) {
  if (remotes.has(m.pid) || m.pid === net.pid) return;
  const spot = SLOTS[m.slot] || SLOTS[0];
  const target = m.pos ? new THREE.Vector3(m.pos[0], 0, m.pos[1]) : spot.clone().setZ(spot.z + 0.9);
  const actor = { avatar: buildAvatar(m), held: null, slot: m.slot, queue: Promise.resolve(), target, kneeling: false };
  remotes.set(m.pid, actor);
  scene.add(actor.avatar.root);
  const r = actor.avatar.root;
  r.rotation.y = Math.PI;
  if (walkIn) r.position.copy(ENTRY);             // người mới: bước vào từ cửa (vòng lặp sẽ đưa tới target)
  else {
    r.position.copy(target);
    if (m.kneel) enqueue(actor, async () => { await kneelDown(actor, 1); if (m.held) await lightIncense(actor, m.held, true); });
  }
}
function removeRemote(pid) {
  const actor = remotes.get(pid); if (!actor) return;
  remotes.delete(pid);
  if (actor.held) tipsOf(actor.held).forEach((t) => emitters.delete(t));
  tween(600, (k) => actor.avatar.root.scale.setScalar(1 - k * 0.999)).then(() => scene.remove(actor.avatar.root));
}
function onRemoteAct(ev) {
  const actor = remotes.get(ev.pid); if (!actor) return;
  if (ev.type === 'emote') return showEmote(actor, ev.e);          // biểu cảm hiện ngay, không cần chờ
  if (ev.type === 'move') return actor.target.set(ev.x, 0, ev.z);
  if (ev.type === 'chant') return chantLine(actor, SUTRA[ev.i] || SUTRA[0], ev.name);
  if (ev.type === 'say') return chantLine(actor, ev.text, ev.name);  // bình luận TikTok (chỉ ở màn hình LIVE)
  if (ev.type === 'offer') {
    if (OFFER[ev.kind]) doOffer(actor, ev.kind, ev.name, ev.gift);
    if (ev.board) renderBoard(ev.board);
    return;
  }
  enqueue(actor, async () => {
    if (ev.type === 'kneel') { await arrived(actor); await kneelDown(actor); }
    if (ev.type === 'stand') await standUp(actor);
    if (ev.type === 'light') await lightIncense(actor, ev.count);
    if (ev.type === 'bow') await bowOnce(actor, false);
    if (ev.type === 'plant') { seenIncense.add(ev.id); await plantIncense(actor, ev.off); }
  });
}
function updatePeople() {
  const n = remotes.size + (LIVE ? 0 : 1);
  $('people').hidden = !net.pid && !LIVE;
  $('people').textContent = `👥 ${n} đạo hữu trong chính điện`;
}

// Biểu cảm nhanh
$('emotes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-e]'); if (!b || b.disabled) return;
  showEmote(me, b.dataset.e); act('emote', { e: b.dataset.e });
  b.disabled = true; setTimeout(() => (b.disabled = false), 1500);
});

/* ===== Màn hình LIVE (chua.html?live): người xem TikTok là các nhân vật, góc máy rộng cho khung 9:16 =====
   Bộ phát live/server.mjs phát cùng kiểu sự kiện như phòng chính điện, thêm "tts" (câu cần đọc) và "settings". */
const LIVE = new URLSearchParams(location.search).has('live');
if (LIVE) {
  document.body.classList.add('live');
  $('creator').classList.add('hide');
  scene.remove(avatar.root);
  pos.set(0, 5.4, 10.8); aimAt(new THREE.Vector3(0, 1.0, -3.2));
  $('live-start').hidden = false;
  $('live-start').onclick = () => { $('live-start').hidden = true; bell(0.7); startAmbient(); };   // trình duyệt cần một lần bấm mới cho phát tiếng
  const es = listen('/live/events');
  es.addEventListener('tts', (e) => speak(JSON.parse(e.data).text));
  es.addEventListener('settings', (e) => {
    const s = JSON.parse(e.data);
    voiceOn = s.tts !== false;
    if (s.ambient === false) stopAmbient(); else if (actx) startAmbient();
  });
}

/* ===== Vòng lặp ===== */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now(), t = clock.elapsedTime;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i], k = Math.min(1, (now - tw.t0) / tw.ms);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.done(); }
  }
  if (inside) { moveLocal(dt); followCamera(dt); }
  else if (!$('creator').classList.contains('hide')) avatar.root.rotation.y = Math.sin(t * 0.6) * 0.5;   // xem trước: xoay nhẹ
  camera.position.copy(pos);
  camera.rotation.set(look.pitch + look.dPitch, look.yaw, 0);
  avatar.update(dt, t);
  for (const r of remotes.values()) {
    if (!r.kneeling) r.avatar.pose.walk = stepToward(r, r.target, dt) ? 1 : 0;
    r.avatar.update(dt, t);
  }
  if (marker.material.opacity > 0) { marker.material.opacity -= dt * 0.8; marker.scale.multiplyScalar(1 + dt * 0.4); }
  for (const { f, l, seed } of flames) {
    const k = 1 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 23 + seed) * 0.05;
    f.scale.set(0.16 * k, 0.3 * k, 1); l.intensity = 3 * k;
  }
  // Nhang đã cắm cháy ngắn dần trong ~3 phút
  for (const g of planted) {
    const k = Math.min(1, (now - g.userData.born) / 180e3);
    g.children.forEach((st) => { st.children[1].scale.y = 1 - k * 0.8; st.children[1].position.y = 0.16 + 0.17 * (1 - k * 0.8); st.children[2].position.y = 0.16 + 0.34 * (1 - k * 0.8); });
    if (k >= 1) tipsOf(g).forEach((tp) => { emitters.delete(tp); tp.userData.glow.material.opacity = 0; tp.material.emissiveIntensity = 0; });
  }
  mandorla.material.opacity = 0.75 + Math.sin(t * 0.8) * 0.1;
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i]; f.t += dt;
    const k = Math.min(1, f.t / f.life);
    f.step(k, dt);
    if (k >= 1) { scene.remove(f.obj); fxList.splice(i, 1); }
  }
  emitSmoke(dt);
  renderer.render(scene, camera);
});
