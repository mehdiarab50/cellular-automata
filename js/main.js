// اسکریپت اصلی برنامه اتوماتای سلولی سه‌بعدی در اینجا قرار خواهد گرفت.
// این فایل به عنوان یک ماژول ES6 بارگذاری می‌شود.

import * as THREE from 'three';
// OrbitControls و dat.GUI از طریق تگ <script> در index.html بارگذاری شده و به صورت گلوبال در دسترس هستند.

console.log("main.js loaded (CDN setup) - Implementing dat.GUI...");

// 2. تعریف متغیرهای اصلی و ثابت‌ها
let scene, camera, renderer, controls;
let cellStates;

const gridSize = 20;
const gridHeight = 20;
const cellSize = 1;
const cellSpacing = 0.1;

const aliveMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const deadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

// متغیرهای مربوط به قوانین و شبیه‌سازی
let isSimulating = false; // این متغیر توسط guiParams.isSimulating کنترل خواهد شد
let simulationSpeed = 200; // این متغیر توسط guiParams.simulationSpeed کنترل خواهد شد
let timeSinceLastUpdate = 0;
let lastTimestamp = 0;

// قوانین پیش‌فرض - این آرایه‌ها توسط مقادیر اولیه guiParams.birthRuleString و survivalRuleString در init() مقداردهی می‌شوند.
// این آرایه‌ها حاوی اعداد صحیح نشان‌دهنده تعداد همسایگان لازم برای تولد/بقا هستند.
let birthRule = []; // مثال: [5] یعنی سلول مرده با 5 همسایه زنده، متولد می‌شود.
let survivalRule = []; // مثال: [4, 5] یعنی سلول زنده با 4 یا 5 همسایه، زنده می‌ماند.

// 2. ایجاد شیء پارامترها برای dat.GUI
// این شیء مقادیر و توابع مورد استفاده توسط کنترل پنل را نگهداری می‌کند.
const guiParams = {
    isSimulating: false,      // وضعیت فعلی شبیه‌سازی (اجرا/توقف)
    simulationSpeed: 200,   // سرعت شبیه‌سازی بر حسب میلی‌ثانیه بین هر گام
    birthRuleString: '5',   // رشته ورودی کاربر برای قوانین تولد (پیش‌فرض B5)
    survivalRuleString: '4,5',// رشته ورودی کاربر برای قوانین بقا (پیش‌فرض S45)

    // تابع برای اجرای یک گام از شبیه‌سازی
    step: function() {
        applyAutomataRules();
        updateCellVisuals();
        console.log("Simulation stepped forward by one generation.");
    },
    // تابع برای بازنشانی شبکه به حالت تمام سلول‌ها خاموش
    resetGrid: function() {
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridHeight; y++) {
                for (let z = 0; z < gridSize; z++) {
                    cellStates[x][y][z] = 0;
                }
            }
        }
        updateCellVisuals();
        console.log("Grid reset.");
    },
    randomizeGrid: function() {
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridHeight; y++) {
                for (let z = 0; z < gridSize; z++) {
                    cellStates[x][y][z] = Math.random() > 0.7 ? 1 : 0; // حدود 30% روشن
                }
            }
        }
        updateCellVisuals();
        console.log("Grid randomized.");
    }
};

// 3. تابع init()
function init() {
    // همگام‌سازی اولیه مقادیر شبیه‌سازی اصلی با مقادیر تعریف شده در guiParams.
    // این کار اطمینان می‌دهد که شبیه‌سازی با تنظیمات پیش‌فرض GUI شروع می‌شود.
    isSimulating = guiParams.isSimulating;
    simulationSpeed = guiParams.simulationSpeed;
    // تبدیل رشته‌های قوانین از guiParams به آرایه‌های عددی برای استفاده در منطق شبیه‌سازی.
    // فیلتر کردن مقادیر نامعتبر (NaN، خارج از محدوده 0-26 همسایه ممکن).
    birthRule = guiParams.birthRuleString.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
    survivalRule = guiParams.survivalRuleString.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
    console.log("Initial simulation parameters set. Birth Rules:", birthRule, "Survival Rules:", survivalRule, "Speed (ms):", simulationSpeed);


    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const centerOffset = (gridSize * (cellSize + cellSpacing)) / 2 - (cellSize + cellSpacing) / 2;
    camera.position.set(centerOffset * 1.8, gridHeight * (cellSize + cellSpacing) * 1.5, centerOffset * 1.8);
    camera.lookAt(centerOffset, (gridHeight * (cellSize + cellSpacing)) / 4, centerOffset);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(centerOffset, 0, centerOffset);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(gridSize, gridHeight * 1.5, gridSize * 1.2);
    scene.add(directionalLight);

    createGrid(); // شبکه را قبل از GUI ایجاد کنید تا resetGrid بتواند روی آن کار کند

    // 3. مقداردهی اولیه dat.GUI در تابع init()
    const gui = new dat.GUI();

    // 4. افزودن کنترل‌ها به GUI
    // پوشه "Simulation Controls"
    const simFolder = gui.addFolder('Simulation Controls');
    simFolder.add(guiParams, 'isSimulating').name('Run Simulation').onChange(value => {
        isSimulating = value;
        if (isSimulating) { // اگر شبیه‌سازی شروع می‌شود، تایمر را ریست کن
            timeSinceLastUpdate = 0;
            lastTimestamp = performance.now(); // برای جلوگیری از پرش اولیه بزرگ در deltaTime
        }
    });
    simFolder.add(guiParams, 'simulationSpeed', 50, 1000, 10).name('Speed (ms)').onChange(value => {
        simulationSpeed = value;
    });
    simFolder.add(guiParams, 'step').name('Step Forward');
    simFolder.open();

    // پوشه "Grid Controls"
    const gridFolder = gui.addFolder('Grid Controls');
    gridFolder.add(guiParams, 'resetGrid').name('Reset Grid');
    gridFolder.add(guiParams, 'randomizeGrid').name('Randomize Grid');
    gridFolder.open();

    // پوشه "Rules (B/S Notation)" - برای تعریف قوانین اتوماتای سلولی
    // B (Birth): تعداد همسایگان زنده که باعث تولد یک سلول مرده می‌شود.
    // S (Survival): تعداد همسایگان زنده که باعث بقای یک سلول زنده می‌شود.
    const rulesFolder = gui.addFolder('Rules (e.g., "B3/S23")');
    rulesFolder.add(guiParams, 'birthRuleString').name('Birth (B)').onChange(value => {
        // به‌روزرسانی قوانین تولد هنگام تغییر ورودی کاربر.
        // رشته ورودی (اعداد جدا شده با کاما) به آرایه‌ای از اعداد معتبر تبدیل می‌شود.
        birthRule = value.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
        console.log('Birth Rule updated to:', birthRule);
    });
    rulesFolder.add(guiParams, 'survivalRuleString').name('Survival (S)').onChange(value => {
        // به‌روزرسانی قوانین بقا هنگام تغییر ورودی کاربر.
        survivalRule = value.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
        console.log('Survival Rule updated to:', survivalRule);
    });
    rulesFolder.open();


    window.addEventListener('resize', onWindowResize, false); // شنونده برای تغییر اندازه پنجره
    renderer.domElement.addEventListener('click', onMouseClick, false);

    animate(0);
}

// تابع createGrid() ... (بدون تغییر از مرحله قبل)
function createGrid() {
    cellStates = [];
    const geometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);

    for (let x = 0; x < gridSize; x++) {
        cellStates[x] = [];
        for (let y = 0; y < gridHeight; y++) {
            cellStates[x][y] = [];
            for (let z = 0; z < gridSize; z++) {
                cellStates[x][y][z] = 0;
                const mesh = new THREE.Mesh(geometry, deadMaterial.clone());
                mesh.position.set(
                    x * (cellSize + cellSpacing),
                    y * (cellSize + cellSpacing),
                    z * (cellSize + cellSpacing)
                );
                mesh.userData = { x, y, z, isCell: true };
                scene.add(mesh);
            }
        }
    }
}


// تابع onWindowResize() ... (بدون تغییر)
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// تابع onMouseClick(event) ... (بدون تغییر)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, false);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (intersectedObject.userData.isCell) {
            const { x, y, z } = intersectedObject.userData;
            cellStates[x][y][z] = 1 - cellStates[x][y][z];
            intersectedObject.material = cellStates[x][y][z] === 1 ? aliveMaterial : deadMaterial;
            // console.log(`Cell (${x},${y},${z}) clicked. New state: ${cellStates[x][y][z]}`);
        }
    }
}

// تابع countAliveNeighbors(x, y, z)
// این تابع تعداد همسایگان زنده یک سلول با مختصات (x,y,z) را شمارش می‌کند.
// یک سلول در فضای سه‌بعدی می‌تواند حداکثر 26 همسایه داشته باشد.
function countAliveNeighbors(x, y, z) {
    let aliveCount = 0;
    // پیمایش در تمام همسایگان ممکن (مکعب 3x3x3 حول سلول مرکزی)
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridHeight && nz >= 0 && nz < gridSize) {
                    if (cellStates[nx][ny][nz] === 1) {
                        aliveCount++;
                    }
                }
            }
        }
    }
    return aliveCount;
}

// تابع applyAutomataRules()
// این تابع قوانین اتوماتای سلولی را به تمام سلول‌های شبکه اعمال می‌کند.
// وضعیت جدید سلول‌ها ابتدا در یک آرایه موقت (newCellStates) محاسبه و سپس به cellStates اصلی منتقل می‌شود
// تا از تأثیر تغییرات آنی بر محاسبات همسایگان در همان گام جلوگیری شود.
function applyAutomataRules() {
    const newCellStates = []; // آرایه موقت برای ذخیره وضعیت‌های جدید
    for (let x = 0; x < gridSize; x++) {
        newCellStates[x] = [];
        for (let y = 0; y < gridHeight; y++) {
            newCellStates[x][y] = [];
            for (let z = 0; z < gridSize; z++) {
                const aliveNeighbors = countAliveNeighbors(x, y, z);
                const currentState = cellStates[x][y][z];
                let newState = currentState;
                if (currentState === 1) {
                    if (!survivalRule.includes(aliveNeighbors)) newState = 0;
                } else {
                    if (birthRule.includes(aliveNeighbors)) newState = 1;
                }
                newCellStates[x][y][z] = newState;
            }
        }
    }
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridHeight; y++) {
            cellStates[x][y] = [...newCellStates[x][y]]; // کپی کردن صحیح آرایه داخلی
        }
    }
}


// تابع updateCellVisuals()
// این تابع نمایش بصری سلول‌ها (متریال آن‌ها) را بر اساس وضعیت منطقی‌شان در cellStates به‌روز می‌کند.
// فقط در صورتی متریال یک سلول تغییر می‌کند که وضعیت نمایش داده شده فعلی با وضعیت منطقی آن متفاوت باشد.
function updateCellVisuals() {
    scene.children.forEach(object => { // پیمایش در تمام اشیاء صحنه
        if (object.userData.isCell) { // بررسی اینکه آیا شیء یک سلول است
            const { x, y, z } = object.userData;
            const currentState = cellStates[x][y][z];
            const expectedMaterial = currentState === 1 ? aliveMaterial : deadMaterial;
            if (object.material !== expectedMaterial) {
                object.material = expectedMaterial;
            }
        }
    });
}

// تابع animate(currentTime) ... (بدون تغییر عمده، فقط lastTimestamp برای شروع شبیه سازی)
function animate(currentTime) {
    requestAnimationFrame(animate);

    // اگر اولین فریم پس از توقف/شروع است، lastTimestamp را به‌روز کن تا از پرش بزرگ جلوگیری شود
    if (isSimulating && lastTimestamp === 0 && timeSinceLastUpdate === 0) {
        lastTimestamp = currentTime;
    }

    const deltaTime = currentTime - lastTimestamp;
    lastTimestamp = currentTime;

    if (isSimulating && deltaTime > 0) { // deltaTime > 0 برای جلوگیری از اجرای چندباره در یک فریم در برخی موارد
        timeSinceLastUpdate += deltaTime;
        if (timeSinceLastUpdate >= simulationSpeed) {
            applyAutomataRules();
            updateCellVisuals();
            timeSinceLastUpdate %= simulationSpeed; // باقی‌مانده برای دقت بیشتر در سرعت‌های بالا
            // console.log("Simulation step");
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

// فراخوانی init() برای شروع برنامه
init();

console.log("dat.GUI panel implemented.");
