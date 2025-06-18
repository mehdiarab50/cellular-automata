// (دستورات import حذف شده‌اند)
// اسکریپت اصلی برنامه اتوماتای سلولی سه‌بعدی در اینجا قرار خواهد گرفت.
// با بارگذاری سنتی، THREE و dat.GUI به عنوان متغیرهای گلوبال در دسترس هستند.

console.log("main.js loaded (Traditional script loading) - Ensuring global variables are used.");

// 2. تعریف متغیرهای اصلی و ثابت‌ها
let scene, camera, renderer, controls, gui; // gui اضافه شد
let cellStates;

const gridSize = 20;
const gridHeight = 20;
const cellSize = 1;
const cellSpacing = 0.1;

const aliveMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const deadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

// متغیرهای مربوط به قوانین و شبیه‌سازی
let isSimulating = false;
let simulationSpeed = 200;
let timeSinceLastUpdate = 0;
let lastTimestamp = 0;

let birthRule = [];
let survivalRule = [];

// شیء پارامترها برای dat.GUI
const guiParams = {
    isSimulating: false,
    simulationSpeed: 200,
    birthRuleString: '5',
    survivalRuleString: '4,5',
    step: function() {
        applyAutomataRules();
        updateCellVisuals();
        console.log("Simulation stepped forward by one generation.");
    },
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
                    cellStates[x][y][z] = Math.random() > 0.7 ? 1 : 0;
                }
            }
        }
        updateCellVisuals();
        console.log("Grid randomized.");
    }
};

// تابع init()
function init() {
    isSimulating = guiParams.isSimulating;
    simulationSpeed = guiParams.simulationSpeed;
    birthRule = guiParams.birthRuleString.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
    survivalRule = guiParams.survivalRuleString.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
    console.log("Initial simulation parameters set. Birth Rules:", birthRule, "Survival Rules:", survivalRule, "Speed (ms):", simulationSpeed);

    scene = new THREE.Scene(); // استفاده مستقیم از THREE گلوبال
    scene.background = new THREE.Color(0xcccccc);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const centerOffset = (gridSize * (cellSize + cellSpacing)) / 2 - (cellSize + cellSpacing) / 2;
    camera.position.set(centerOffset * 1.8, gridHeight * (cellSize + cellSpacing) * 1.5, centerOffset * 1.8);
    camera.lookAt(centerOffset, (gridHeight * (cellSize + cellSpacing)) / 4, centerOffset);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement); // استفاده مستقیم از THREE.OrbitControls
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(centerOffset, 0, centerOffset);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(gridSize, gridHeight * 1.5, gridSize * 1.2);
    scene.add(directionalLight);

    createGrid();

    gui = new dat.GUI(); // استفاده مستقیم از dat.GUI گلوبال

    const simFolder = gui.addFolder('Simulation Controls');
    simFolder.add(guiParams, 'isSimulating').name('Run Simulation').onChange(value => {
        isSimulating = value;
        if (isSimulating) {
            timeSinceLastUpdate = 0;
            lastTimestamp = performance.now();
        }
    });
    simFolder.add(guiParams, 'simulationSpeed', 50, 1000, 10).name('Speed (ms)').onChange(value => {
        simulationSpeed = value;
    });
    simFolder.add(guiParams, 'step').name('Step Forward');
    simFolder.open();

    const gridFolder = gui.addFolder('Grid Controls');
    gridFolder.add(guiParams, 'resetGrid').name('Reset Grid');
    gridFolder.add(guiParams, 'randomizeGrid').name('Randomize Grid');
    gridFolder.open();

    const rulesFolder = gui.addFolder('Rules (e.g., "B3/S23")');
    rulesFolder.add(guiParams, 'birthRuleString').name('Birth (B)').onChange(value => {
        birthRule = value.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
        console.log('Birth Rule updated to:', birthRule);
    });
    rulesFolder.add(guiParams, 'survivalRuleString').name('Survival (S)').onChange(value => {
        survivalRule = value.split(',').map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 26);
        console.log('Survival Rule updated to:', survivalRule);
    });
    rulesFolder.open();

    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('click', onMouseClick, false);

    animate(0);
}

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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

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
        }
    }
}

function countAliveNeighbors(x, y, z) {
    let aliveCount = 0;
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

function applyAutomataRules() {
    const newCellStates = [];
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
            // اطمینان از کپی عمیق برای هر ردیف از بعد سوم
            if (newCellStates[x][y]) { // بررسی اینکه آیا ردیف تعریف شده است
                 cellStates[x][y] = [...newCellStates[x][y]];
            } else {
                // این حالت نباید رخ دهد اگر newCellStates به درستی ایجاد شده باشد
                cellStates[x][y] = [];
            }
        }
    }
}

function updateCellVisuals() {
    scene.children.forEach(object => {
        if (object.userData.isCell) {
            const { x, y, z } = object.userData;
            const currentState = cellStates[x][y][z];
            const expectedMaterial = currentState === 1 ? aliveMaterial : deadMaterial;
            if (object.material !== expectedMaterial) {
                object.material = expectedMaterial;
            }
        }
    });
}

function animate(currentTime) {
    requestAnimationFrame(animate);

    if (isSimulating && lastTimestamp === 0 && timeSinceLastUpdate === 0 && currentTime > 0) {
        lastTimestamp = currentTime; // مقداردهی اولیه دقیق‌تر برای اولین فریم شبیه‌سازی
    }

    const deltaTime = currentTime - lastTimestamp;
    lastTimestamp = currentTime;

    if (isSimulating && deltaTime > 0) {
        timeSinceLastUpdate += deltaTime;
        if (timeSinceLastUpdate >= simulationSpeed) {
            applyAutomataRules();
            updateCellVisuals();
            timeSinceLastUpdate %= simulationSpeed;
        }
    }

    controls.update();
    renderer.render(scene, camera);
}

init();

console.log("main.js imports removed, using global THREE and dat variables.");
