// Nhân vật 3D kiểu chibi dựng bằng hình khối. Gốc toạ độ ở chân, mặt hướng +z.
// pose (0..1): walk, kneel, hold (chắp tay cầm hương), bow (cúi lạy) — gán rồi gọi update() mỗi khung hình.
import * as THREE from 'three';

export const SKINS = ['#f6d5b8', '#e8b48e', '#d4996c', '#b97a52', '#8a5638'];
export const OUTFITS = {
  lam:  { name: 'Áo tràng lam',    color: '#5f7fa6', trim: '#3f5a7a' },
  nau:  { name: 'Áo nâu sồng',     color: '#8a5a34', trim: '#5a3519' },
  xam:  { name: 'Áo chú tiểu xám', color: '#8c8c88', trim: '#5e5e5a' },
};
export const HAIRS = { troc: 'Trọc', ngan: 'Ngắn', bui: 'Búi', dai: 'Dài' };

const mat = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

export function buildAvatar({ gender = 'nam', hair = 'troc', skin = 2, outfit = 'lam', name = '' } = {}) {
  const female = gender === 'nu';
  const robe = mat(OUTFITS[outfit].color), trim = mat(OUTFITS[outfit].trim);
  const skinM = mat(SKINS[skin] || SKINS[2], 0.6);
  const hairM = mat('#1e1410', 0.55);
  const sw = female ? 0.25 : 0.3, hem = female ? 0.42 : 0.36, WAIST = 0.72;

  const root = new THREE.Group();
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

  // Vạt áo dưới (từ eo xuống gấu)
  const skirt = new THREE.Group(); root.add(skirt);
  add(lathe([[0, 0.02], [hem, 0.02], [hem * 0.9, 0.3], [0.27, WAIST], [0, WAIST]]), robe, 0, 0, 0, skirt).scale.z = 0.8;
  add(new THREE.TorusGeometry(hem * 0.98, 0.02, 6, 32), trim, 0, 0.04, 0, skirt).rotation.x = Math.PI / 2;

  // Thân trên xoay quanh eo (để cúi lạy)
  const upper = new THREE.Group(); upper.position.y = WAIST; root.add(upper);
  add(lathe([[0, 0], [0.27, 0], [0.28, 0.25], [sw, 0.48], [sw * 0.55, 0.58], [0.08, 0.62], [0, 0.62]]), robe, 0, 0, 0, upper).scale.z = 0.75;
  add(new THREE.TorusGeometry(0.1, 0.025, 6, 20), trim, 0, 0.6, 0, upper).rotation.x = Math.PI / 2;   // cổ áo
  add(new THREE.BoxGeometry(0.035, 0.5, 0.02), trim, 0.06, 0.32, 0.215, upper).rotation.z = 0.15;      // vạt chéo
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), skinM, 0, 0.66, 0, upper);

  // Đầu
  const head = new THREE.Group(); head.position.y = 0.84; upper.add(head);
  add(new THREE.SphereGeometry(0.21, 28, 20), skinM, 0, 0, 0, head).scale.set(1, 1.04, 0.98);
  const dark = mat('#2a1a10', 0.4);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.024, 10, 8), dark, s * 0.075, 0.01, 0.19, head).scale.set(1, female ? 1.25 : 1, 0.6);
    add(new THREE.SphereGeometry(0.008, 6, 4), mat('#ffffff', 0.2), s * 0.075 + 0.008, 0.02, 0.205, head);
    add(new THREE.SphereGeometry(0.06, 7, 5), skinM, s * 0.205, -0.01, 0, head).scale.set(0.35, 0.7, 0.5);   // tai
    if (female) add(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#f29aa8', transparent: true, opacity: 0.55 }), s * 0.12, -0.05, 0.17, head).scale.set(1, 0.6, 0.4);
  }
  add(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI), mat(female ? '#d2505e' : '#8a3a2a', 0.5), 0, -0.07, 0.19, head).rotation.z = Math.PI;

  // Tóc
  const cap = () => { const c = add(new THREE.SphereGeometry(0.222, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.01, -0.01, head); c.rotation.x = -0.3; return c; };
  if (hair === 'ngan') cap();
  if (hair === 'bui') { cap(); add(new THREE.SphereGeometry(0.085, 16, 12), hairM, 0, 0.17, -0.15, head); }
  if (hair === 'dai') {
    cap();
    add(new THREE.CapsuleGeometry(0.17, 0.32, 6, 14), hairM, 0, -0.14, -0.1, head).scale.set(1.05, 1, 0.5);
  }

  // Tay: khớp vai để xoay; ống tay áo rộng + bàn tay
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * sw * 0.95, 0.47, 0); upper.add(pivot);
    add(new THREE.CylinderGeometry(0.06, 0.1, 0.42, 14), robe, 0, -0.21, 0, pivot);
    add(new THREE.SphereGeometry(0.055, 12, 10), skinM, 0, -0.45, 0, pivot);
    pivot.userData.side = s;
    return pivot;
  });

  // Điểm cầm hương (giữa hai bàn tay khi chắp)
  const hands = new THREE.Object3D(); hands.position.set(0, 0.3, 0.36); upper.add(hands);

  // Bảng tên trên đầu
  let tag = null;
  if (name) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.font = '600 52px "Be Vietnam Pro", system-ui, sans-serif';
    const w = Math.min(500, g.measureText(name).width + 60);
    g.fillStyle = 'rgba(42,12,6,.72)'; g.beginPath(); g.roundRect((512 - w) / 2, 22, w, 84, 42); g.fill();
    g.fillStyle = '#ffe6b0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    tag.scale.set(0.9, 0.225, 1); tag.position.y = 2.0; tag.renderOrder = 10; root.add(tag);
  }

  const pose = { walk: 0, kneel: 0, hold: 0, bow: 0 };
  let phase = 0;
  function update(dt, t) {
    phase += dt * 7 * pose.walk;
    const k = pose.kneel, swing = Math.sin(phase) * 0.45 * pose.walk * (1 - pose.hold);
    // Quỳ: thu vạt áo, hạ thân trên xuống đệm
    skirt.scale.y = 1 - 0.5 * k;
    upper.position.y = WAIST * (1 - 0.5 * k) + Math.abs(Math.sin(phase)) * 0.03 * pose.walk + Math.sin(t * 1.6) * 0.004;
    upper.rotation.x = 0.55 * pose.bow;
    head.rotation.x = 0.15 * pose.bow;
    for (const a of arms) {
      const s = a.userData.side;
      a.rotation.x = -1.15 * pose.hold + swing * s;
      a.rotation.z = (0.42 * pose.hold - 0.08 * (1 - pose.hold)) * -s;
    }
  }

  return { root, hands, pose, tag, update };
}
