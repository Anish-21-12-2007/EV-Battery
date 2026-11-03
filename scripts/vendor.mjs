import { mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const files = ['build/three.module.js','build/three.core.js','examples/jsm/controls/OrbitControls.js','examples/jsm/controls/TransformControls.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/environments/RoomEnvironment.js','LICENSE'];
for (const file of files) {
  const destination = `vendor/three/${file}`;
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(`node_modules/three/${file}`, destination);
}
console.log('Vendored Three.js r180 runtime and license.');
