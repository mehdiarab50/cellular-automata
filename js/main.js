// کد جاوا اسکریپت اصلی در اینجا قرار خواهد گرفت
console.log("main.js loaded");

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// 1. راه‌اندازی اولیه صحنه Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. پیاده‌سازی کنترل‌های دوربین
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.25;
// controls.screenSpacePanning = false; // Xóa comment برای فعال کردن حرکت افقی و عمودی دوربین
// controls.maxPolarAngle = Math.PI / 2; // محدود کردن زاویه قطبی دوربین

camera.position.set(10, 15, 25); // موقعیت اولیه دوربین برای دید بهتر به شبکه
controls.target.set(10, 0, 10); // مرکز شبکه به عنوان هدف دوربین

// 3. ایجاد شبکه سه‌بعدی اولیه
const gridSize = 20;
const cellSize = 1;
const cellSpacing = 0.1; // فاصله بین سلول ها
const cellGroup = new THREE.Group();

const cellGeometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
// متریال‌های پایه برای سلول‌های روشن و خاموش
const aliveMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const deadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

// 1. ساختار داده برای وضعیت سلول‌ها
const cellStates = []; // آرایه برای نگهداری وضعیت هر سلول (0 یا 1)
const gridHeight = gridSize; // برای یک شبکه مکعبی، ارتفاع برابر با اندازه است

for (let i = 0; i < gridSize; i++) {
    cellStates[i] = [];
    for (let j = 0; j < gridHeight; j++) {
        cellStates[i][j] = [];
        for (let k = 0; k < gridSize; k++) {
            cellStates[i][j][k] = 0; // مقداردهی اولیه همه سلول‌ها به خاموش (0)

            const cell = new THREE.Mesh(cellGeometry, deadMaterial.clone()); // شروع با متریال مرده
            cell.position.set(
                i * (cellSize + cellSpacing),
                j * (cellSize + cellSpacing), // موقعیت Y سلول
                k * (cellSize + cellSpacing)
            );
            cell.name = `cell_${i}_${j}_${k}`; // نامگذاری سلول برای شناسایی
            // ذخیره مختصات شبکه در userData برای دسترسی آسان‌تر
            cell.userData = { x: i, y: j, z: k };
            cellGroup.add(cell);
        }
    }
}
scene.add(cellGroup);

// نورپردازی
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // نور محیطی ملایم
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // نور جهت دار قوی تر
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);


let lastUpdateTime = 0;
// const updateInterval = 0.2; // دیگر استفاده نمی‌شود، به جای آن از simulationParams.speed استفاده می‌شود

function animate(currentTime) {
    requestAnimationFrame(animate);

    const deltaTime = (currentTime - (lastUpdateTime || 0)) / 1000; // تبدیل به ثانیه

    controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

    // اجرای منطق اتوماتا و به‌روزرسانی رنگ‌ها در فواصل زمانی مشخص و اگر متوقف نشده باشد
    if (!simulationParams.isPaused && deltaTime >= simulationParams.speed) {
        applyAutomataRules();
        updateCellColors();
        lastUpdateTime = currentTime;
    }

    renderer.render(scene, camera);
}

animate();

// Adjust camera to look at the center of the grid
const boundingBox = new THREE.Box3().setFromObject(cellGroup);
const center = boundingBox.getCenter(new THREE.Vector3());
// camera.lookAt(center); // این خط ممکن است با OrbitControls تداخل داشته باشد، OrbitControls.target جایگزین بهتری است
controls.target.copy(center);
camera.updateProjectionMatrix();


// --- dat.GUI Setup ---
const gui = new dat.GUI();
const simulationParams = {
    isPaused: true,
    birthRule: "5", // مثال: یک سلول مرده با دقیقاً 5 همسایه زنده، زنده می‌شود
    survivalRule: "4,5", // مثال: یک سلول زنده با 4 یا 5 همسایه زنده، زنده می‌ماند
    speed: 0.2, // ثانیه، مشابه updateInterval قبلی
    step: function() {
        applyAutomataRules();
        updateCellColors();
        console.log("Stepped simulation");
    },
    resetGrid: function() {
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridHeight; j++) {
                for (let k = 0; k < gridSize; k++) {
                    cellStates[i][j][k] = 0;
                }
            }
        }
        updateCellColors();
        console.log("Grid reset");
    },
    randomizeGrid: function() {
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridHeight; j++) {
                for (let k = 0; k < gridSize; k++) {
                    cellStates[i][j][k] = Math.random() > 0.7 ? 1 : 0; // حدود 30% سلول‌ها روشن می‌شوند
                }
            }
        }
        updateCellColors();
        console.log("Grid randomized");
    }
};

// افزودن کنترل‌ها به GUI
const rulesFolder = gui.addFolder('Rules (e.g., "2,3" or "5")');
rulesFolder.add(simulationParams, 'birthRule').name('Birth (B)');
rulesFolder.add(simulationParams, 'survivalRule').name('Survival (S)');
// rulesFolder.open(); // باز کردن پوشه به صورت پیش‌فرض

const simulationFolder = gui.addFolder('Simulation Controls');
const pauseController = simulationFolder.add(simulationParams, 'isPaused').name('Pause/Resume');
simulationFolder.add(simulationParams, 'step').name('Step Forward');
simulationFolder.add(simulationParams, 'speed', 0.05, 2, 0.05).name('Speed (sec/step)');
simulationFolder.add(simulationParams, 'resetGrid').name('Reset Grid');
simulationFolder.add(simulationParams, 'randomizeGrid').name('Randomize Grid');
// simulationFolder.open();

// 4. پیاده‌سازی انتخاب سلول با کلیک ماوس (بخش اولیه)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    // تبدیل مختصات ماوس به مختصات نرمال شده دستگاه (-1 تا +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // به‌روزرسانی raycaster با استفاده از دوربین و مختصات ماوس
    raycaster.setFromCamera(mouse, camera);

    // محاسبه اشیائی که توسط ray قطع شده‌اند
    const intersects = raycaster.intersectObjects(cellGroup.children);

    if (intersects.length > 0) {
        // اولین شیء قطع شده نزدیکترین شیء است
        const clickedCellObject = intersects[0].object;
        const { x, y, z } = clickedCellObject.userData; // دریافت مختصات سه‌بعدی از userData

        // تغییر وضعیت سلول در cellStates
        cellStates[x][y][z] = 1 - cellStates[x][y][z]; // تغییر بین 0 و 1

        // به‌روزرسانی رنگ سلول کلیک شده
        if (cellStates[x][y][z] === 1) {
            clickedCellObject.material = aliveMaterial;
        } else {
            clickedCellObject.material = deadMaterial;
        }
        // نیاز به به‌روزرسانی متریال مش
        clickedCellObject.material.needsUpdate = true;
        console.log(`سلول کلیک شده: ${clickedCellObject.name}, وضعیت جدید: ${cellStates[x][y][z]}`);
    }
}

window.addEventListener('click', onMouseClick, false);

// 3. تابع اعمال قوانین اتوماتای سلولی
function applyAutomataRules() {
    const newCellStates = [];
    for (let i = 0; i < gridSize; i++) {
        newCellStates[i] = [];
        for (let j = 0; j < gridHeight; j++) {
            newCellStates[i][j] = [];
            for (let k = 0; k < gridSize; k++) {
                // شمارش همسایگان زنده در سه بعد
                let liveNeighbors = 0;
                for (let ni = -1; ni <= 1; ni++) {
                    for (let nj = -1; nj <= 1; nj++) {
                        for (let nk = -1; nk <= 1; nk++) {
                            if (ni === 0 && nj === 0 && nk === 0) continue; // خود سلول را نشمار

                            const x = i + ni;
                            const y = j + nj;
                            const z = k + nk;

                            // بررسی مرزهای شبکه
                            if (x >= 0 && x < gridSize && y >= 0 && y < gridHeight && z >= 0 && z < gridSize) {
                                if (cellStates[x][y][z] === 1) {
                                    liveNeighbors++;
                                }
                            }
                        }
                    }
                }

                // تجزیه قوانین از رشته‌ها. مثال: "3" یا "2,3"
                // اعداد نشان دهنده تعداد همسایگان لازم برای تولد/بقا هستند.
                const birthValues = simulationParams.birthRule.split(',').map(Number).filter(n => !isNaN(n)); // فیلتر کردن NaN ها
                const survivalValues = simulationParams.survivalRule.split(',').map(Number).filter(n => !isNaN(n)); // فیلتر کردن NaN ها

                const currentState = cellStates[i][j][k];
                newCellStates[i][j][k] = currentState; // پیش‌فرض: وضعیت فعلی باقی می‌ماند

                if (currentState === 1) { // سلول زنده
                    let survives = false;
                    for (const val of survivalValues) {
                        if (liveNeighbors === val) {
                            survives = true;
                            break;
                        }
                    }
                    if (!survives) {
                        newCellStates[i][j][k] = 0; // مرگ
                    }
                } else { // سلول مرده
                    let born = false;
                    for (const val of birthValues) {
                        if (liveNeighbors === val) {
                            born = true;
                            break;
                        }
                    }
                    if (born) {
                        newCellStates[i][j][k] = 1; // تولد
                    }
                }
            }
        }
    }

    // به‌روزرسانی cellStates اصلی با وضعیت‌های جدید
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridHeight; j++) {
            for (let k = 0; k < gridSize; k++) {
                cellStates[i][j][k] = newCellStates[i][j][k];
            }
        }
    }
}

// 4. به‌روزرسانی رنگ سلول‌ها پس از اعمال قوانین
function updateCellColors() {
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridHeight; j++) {
            for (let k = 0; k < gridSize; k++) {
                const cellObject = cellGroup.children.find(child =>
                    child.userData.x === i && child.userData.y === j && child.userData.z === k
                );
                if (cellObject) {
                    const currentState = cellStates[i][j][k];
                const currentMaterial = cellObject.material;

                if (currentState === 1 && currentMaterial !== aliveMaterial) {
                    cellObject.material = aliveMaterial;
                    cellObject.material.needsUpdate = true;
                } else if (currentState === 0 && currentMaterial !== deadMaterial) {
                    cellObject.material = deadMaterial;
                    cellObject.material.needsUpdate = true;
                }
            }
        }
    }
}
