/*
=========================================================
 MYCRAFT WEB
 Первый 3D voxel-мир
=========================================================
*/

const game = document.getElementById("game");

let scene;
let camera;
let renderer;

let world = new Map();

let player = {
    x: 0,
    y: 4,
    z: 0,

    velocityY: 0,

    height: 1.8,
    radius: 0.3,

    speed: 5.5,
    jumpPower: 8,

    grounded: false
};

let keys = {};

let yaw = 0;
let pitch = 0;

let pointerLocked = false;

let selectedBlock = "grass";

const BLOCKS = {
    grass: {
        name: "Трава",
        top: 0x59b83f,
        side: 0x65a94c,
        bottom: 0x8b5a32
    },

    dirt: {
        name: "Земля",
        color: 0x8b5a32
    },

    stone: {
        name: "Камень",
        color: 0x777777
    },

    wood: {
        name: "Дерево",
        color: 0x8b5a2b
    },

    leaves: {
        name: "Листья",
        color: 0x3e9b35
    }
};

/* =====================================================
   ИНИЦИАЛИЗАЦИЯ
===================================================== */

function init() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x87ceeb);

    scene.fog = new THREE.Fog(
        0x87ceeb,
        20,
        100
    );

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.05,
        300
    );

    camera.rotation.order = "YXZ";

    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 1.5)
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.shadowMap.enabled = false;

    game.appendChild(renderer.domElement);

    createLights();

    generateWorld();

    createPlayer();

    setupControls();

    window.addEventListener(
        "resize",
        onResize
    );

    animate();

    setTimeout(() => {

        document.getElementById("loading").style.display = "none";

    }, 500);
}

/* =====================================================
   ОСВЕЩЕНИЕ
===================================================== */

function createLights() {

    const ambient = new THREE.HemisphereLight(
        0xffffff,
        0x6b6b6b,
        1.5
    );

    scene.add(ambient);

    const sun = new THREE.DirectionalLight(
        0xffffff,
        1.2
    );

    sun.position.set(
        30,
        60,
        20
    );

    scene.add(sun);
}

/* =====================================================
   КЛЮЧ БЛОКА
===================================================== */

function blockKey(x, y, z) {

    return `${x},${y},${z}`;
}

/* =====================================================
   СОЗДАНИЕ БЛОКА
===================================================== */

function createBlock(x, y, z, type) {

    const key = blockKey(x, y, z);

    if (world.has(key)) {
        return;
    }

    const geometry =
        new THREE.BoxGeometry(1, 1, 1);

    let materials;

    if (type === "grass") {

        materials = [
            new THREE.MeshLambertMaterial({
                color: 0x65a94c
            }),

            new THREE.MeshLambertMaterial({
                color: 0x65a94c
            }),

            new THREE.MeshLambertMaterial({
                color: 0x59b83f
            }),

            new THREE.MeshLambertMaterial({
                color: 0x8b5a32
            }),

            new THREE.MeshLambertMaterial({
                color: 0x65a94c
            }),

            new THREE.MeshLambertMaterial({
                color: 0x65a94c
            })
        ];

    } else {

        const color =
            BLOCKS[type]?.color || 0xffffff;

        const material =
            new THREE.MeshLambertMaterial({
                color
            });

        materials = [
            material,
            material,
            material,
            material,
            material,
            material
        ];
    }

    const mesh =
        new THREE.Mesh(
            geometry,
            materials
        );

    mesh.position.set(
        x + 0.5,
        y + 0.5,
        z + 0.5
    );

    mesh.userData.block = true;
    mesh.userData.type = type;

    scene.add(mesh);

    world.set(key, {
        mesh,
        type
    });
}

/* =====================================================
   УДАЛЕНИЕ БЛОКА
===================================================== */

function removeBlock(x, y, z) {

    const key = blockKey(x, y, z);

    const block = world.get(key);

    if (!block) {
        return;
    }

    scene.remove(block.mesh);

    block.mesh.geometry.dispose();

    if (Array.isArray(block.mesh.material)) {

        block.mesh.material.forEach(
            material => material.dispose()
        );

    } else {

        block.mesh.material.dispose();

    }

    world.delete(key);
}

/* =====================================================
   ГЕНЕРАЦИЯ МИРА
===================================================== */

function generateWorld() {

    const size = 30;

    for (let x = -size; x < size; x++) {

        for (let z = -size; z < size; z++) {

            const height =
                getTerrainHeight(x, z);

            for (let y = 0; y <= height; y++) {

                let type;

                if (y === height) {

                    type = "grass";

                } else if (y >= height - 2) {

                    type = "dirt";

                } else {

                    type = "stone";
                }

                createBlock(
                    x,
                    y,
                    z,
                    type
                );
            }
        }
    }

    generateTrees();
}

/* =====================================================
   ВЫСОТА ТЕРРЕЙНА
===================================================== */

function getTerrainHeight(x, z) {

    const wave1 =
        Math.sin(x * 0.16) * 2;

    const wave2 =
        Math.cos(z * 0.14) * 2;

    const wave3 =
        Math.sin((x + z) * 0.08) * 2;

    let height =
        Math.floor(
            3 +
            wave1 +
            wave2 +
            wave3
        );

    return Math.max(
        1,
        Math.min(
            9,
            height
        )
    );
}

/* =====================================================
   ДЕРЕВЬЯ
===================================================== */

function generateTrees() {

    for (let x = -25; x < 25; x++) {

        for (let z = -25; z < 25; z++) {

            const random =
                Math.random();

            if (random > 0.97) {

                const y =
                    getTerrainHeight(x, z) + 1;

                createTree(
                    x,
                    y,
                    z
                );
            }
        }
    }
}

function createTree(x, y, z) {

    const trunkHeight = 4;

    for (let i = 0; i < trunkHeight; i++) {

        createBlock(
            x,
            y + i,
            z,
            "wood"
        );
    }

    const leafStart =
        y + trunkHeight - 2;

    for (
        let lx = -2;
        lx <= 2;
        lx++
    ) {

        for (
            let lz = -2;
            lz <= 2;
            lz++
        ) {

            for (
                let ly = 0;
                ly <= 2;
                ly++
            ) {

                const distance =
                    Math.abs(lx) +
                    Math.abs(lz);

                if (
                    distance <= 3
                ) {

                    createBlock(
                        x + lx,
                        leafStart + ly,
                        z + lz,
                        "leaves"
                    );
                }
            }
        }
    }
}

/* =====================================================
   ИГРОК
===================================================== */

function createPlayer() {

    player.y =
        getTerrainHeight(0, 0) + 1.01;

    updateCamera();
}

/* =====================================================
   УПРАВЛЕНИЕ
===================================================== */

function setupControls() {

    window.addEventListener(
        "keydown",
        event => {

            keys[event.code] = true;

            if (
                event.code === "Space" &&
                player.grounded
            ) {

                player.velocityY =
                    player.jumpPower;

                player.grounded = false;
            }

            if (
                event.code.startsWith("Digit")
            ) {

                const number =
                    parseInt(
                        event.code.replace(
                            "Digit",
                            ""
                        )
                    );

                selectSlot(number);
            }
        }
    );

    window.addEventListener(
        "keyup",
        event => {

            keys[event.code] = false;

        }
    );

    document.getElementById(
        "playButton"
    ).addEventListener(
        "click",
        startGame
    );

    renderer.domElement.addEventListener(
        "click",
        () => {

            if (!pointerLocked) {

                lockPointer();

            }
        }
    );

    document.addEventListener(
        "pointerlockchange",
        () => {

            pointerLocked =
                document.pointerLockElement ===
                renderer.domElement;

        }
    );

    document.addEventListener(
        "mousemove",
        event => {

            if (!pointerLocked) {
                return;
            }

            const sensitivity = 0.002;

            yaw -=
                event.movementX *
                sensitivity;

            pitch -=
                event.movementY *
                sensitivity;

            const limit =
                Math.PI / 2 - 0.05;

            pitch =
                Math.max(
                    -limit,
                    Math.min(
                        limit,
                        pitch
                    )
                );
        }
    );

    renderer.domElement.addEventListener(
        "mousedown",
        event => {

            if (!pointerLocked) {
                return;
            }

            if (event.button === 0) {

                breakBlock();

            } else if (event.button === 2) {

                placeBlock();
            }
        }
    );

    renderer.domElement.addEventListener(
        "contextmenu",
        event => {
            event.preventDefault();
        }
    );

    document.querySelectorAll(
        ".slot"
    ).forEach(
        slot => {

            slot.addEventListener(
                "click",
                () => {

                    const slots =
                        Array.from(
                            document.querySelectorAll(
                                ".slot"
                            )
                        );

                    const index =
                        slots.indexOf(slot);

                    selectSlot(index + 1);
                }
            );
        }
    );
}

/* =====================================================
   СТАРТ ИГРЫ
===================================================== */

function startGame() {

    document.getElementById(
        "start-screen"
    ).style.display = "none";

    lockPointer();
}

function lockPointer() {

    if (
        renderer &&
        renderer.domElement.requestPointerLock
    ) {

        renderer.domElement.requestPointerLock();

    }
}

/* =====================================================
   ВЫБОР БЛОКА
===================================================== */

function selectSlot(number) {

    const slots =
        document.querySelectorAll(
            ".slot"
        );

    if (
        number < 1 ||
        number > slots.length
    ) {
        return;
    }

    slots.forEach(
        slot =>
            slot.classList.remove(
                "selected"
            )
    );

    const selected =
        slots[number - 1];

    selected.classList.add(
        "selected"
    );

    selectedBlock =
        selected.dataset.block;

    document.getElementById(
        "selectedBlock"
    ).textContent =
        BLOCKS[selectedBlock].name;
}

/* =====================================================
   ДВИЖЕНИЕ
===================================================== */

function updatePlayer(delta) {

    if (!pointerLocked) {
        return;
    }

    let forward = 0;
    let right = 0;

    if (keys["KeyW"]) {
        forward += 1;
    }

    if (keys["KeyS"]) {
        forward -= 1;
    }

    if (keys["KeyD"]) {
        right += 1;
    }

    if (keys["KeyA"]) {
        right -= 1;
    }

    const length =
        Math.sqrt(
            forward * forward +
            right * right
        );

    if (length > 0) {

        forward /= length;
        right /= length;

        const speed =
            player.speed * delta;

        const sin =
            Math.sin(yaw);

        const cos =
            Math.cos(yaw);

        const moveX =
            (
                right * cos +
                forward * sin
            ) * speed;

        const moveZ =
            (
                forward * cos -
                right * sin
            ) * speed;

        tryMove(
            moveX,
            0,
            moveZ
        );
    }

    player.velocityY -=
        22 * delta;

    const vertical =
        player.velocityY * delta;

    if (
        vertical <= 0 &&
        isGroundBelow()
    ) {

        player.grounded = true;
        player.velocityY = 0;

        player.y =
            Math.floor(player.y) + 0.001;

    } else {

        player.grounded = false;

        player.y += vertical;

        if (isGroundBelow()) {

            player.grounded = true;
            player.velocityY = 0;

            player.y =
                Math.floor(player.y) + 0.001;
        }
    }

    updateCamera();
}

/* =====================================================
   ДВИЖЕНИЕ С КОЛЛИЗИЯМИ
===================================================== */

function tryMove(dx, dy, dz) {

    const newX =
        player.x + dx;

    const newZ =
        player.z + dz;

    if (
        !collides(
            newX,
            player.y,
            player.z
        )
    ) {

        player.x = newX;
    }

    if (
        !collides(
            player.x,
            player.y,
            newZ
        )
    ) {

        player.z = newZ;
    }
}

/* =====================================================
   КОЛЛИЗИЯ
===================================================== */

function collides(x, y, z) {

    const radius =
        player.radius;

    const minX =
        Math.floor(
            x - radius
        );

    const maxX =
        Math.floor(
            x + radius
        );

    const minY =
        Math.floor(y);

    const maxY =
        Math.floor(
            y + player.height
        );

    const minZ =
        Math.floor(
            z - radius
        );

    const maxZ =
        Math.floor(
            z + radius
        );

    for (
        let bx = minX;
        bx <= maxX;
        bx++
    ) {

        for (
            let by = minY;
            by <= maxY;
            by++
        ) {

            for (
                let bz = minZ;
                bz <= maxZ;
                bz++
            ) {

                if (
                    world.has(
                        blockKey(
                            bx,
                            by,
                            bz
                        )
                    )
                ) {

                    return true;
                }
            }
        }
    }

    return false;
}

/* =====================================================
   ЗЕМЛЯ ПОД ИГРОКОМ
===================================================== */

function isGroundBelow() {

    const feet =
        player.y - 0.05;

    const bx =
        Math.floor(player.x);

    const by =
        Math.floor(feet);

    const bz =
        Math.floor(player.z);

    return world.has(
        blockKey(
            bx,
            by,
            bz
        )
    );
}

/* =====================================================
   КАМЕРА
===================================================== */

function updateCamera() {

    camera.position.set(
        player.x,
        player.y + player.height - 0.15,
        player.z
    );

    camera.rotation.y =
        yaw;

    camera.rotation.x =
        pitch;
}

/* =====================================================
   RAYCAST
===================================================== */

const raycaster =
    new THREE.Raycaster();

function getTargetBlock() {

    raycaster.setFromCamera(
        new THREE.Vector2(0, 0),
        camera
    );

    const meshes = [];

    world.forEach(
        block => {
            meshes.push(
                block.mesh
            );
        }
    );

    const hits =
        raycaster.intersectObjects(
            meshes,
            false
        );

    if (hits.length === 0) {
        return null;
    }

    const hit =
        hits[0];

    if (hit.distance > 6) {
        return null;
    }

    return hit;
}

/* =====================================================
   ЛОМАНИЕ БЛОКА
===================================================== */

function breakBlock() {

    const hit =
        getTargetBlock();

    if (!hit) {
        return;
    }

    const position =
        hit.object.position;

    const x =
        Math.floor(
            position.x
        );

    const y =
        Math.floor(
            position.y
        );

    const z =
        Math.floor(
            position.z
        );

    if (y <= 0) {
        return;
    }

    removeBlock(
        x,
        y,
        z
    );
}

/* =====================================================
   УСТАНОВКА БЛОКА
===================================================== */

function placeBlock() {

    const hit =
        getTargetBlock();

    if (!hit) {
        return;
    }

    const normal =
        hit.face.normal;

    const position =
        hit.object.position;

    const x =
        Math.floor(
            position.x +
            normal.x
        );

    const y =
        Math.floor(
            position.y +
            normal.y
        );

    const z =
        Math.floor(
            position.z +
            normal.z
        );

    if (
        world.has(
            blockKey(
                x,
                y,
                z
            )
        )
    ) {
        return;
    }

    if (
        Math.abs(
            x - player.x
        ) < 1 &&
        Math.abs(
            y - player.y
        ) < 2 &&
        Math.abs(
            z - player.z
        ) < 1
    ) {
        return;
    }

    createBlock(
        x,
        y,
        z,
        selectedBlock
    );
}

/* =====================================================
   КООРДИНАТЫ
===================================================== */

function updateCoordinates() {

    document.getElementById(
        "x"
    ).textContent =
        Math.floor(player.x);

    document.getElementById(
        "y"
    ).textContent =
        Math.floor(player.y);

    document.getElementById(
        "z"
    ).textContent =
        Math.floor(player.z);
}

/* =====================================================
   ИГРОВОЙ ЦИКЛ
===================================================== */

let previousTime =
    performance.now();

function animate() {

    requestAnimationFrame(
        animate
    );

    const currentTime =
        performance.now();

    let delta =
        (currentTime - previousTime)
        / 1000;

    previousTime =
        currentTime;

    delta =
        Math.min(
            delta,
            0.05
        );

    updatePlayer(delta);

    updateCoordinates();

    renderer.render(
        scene,
        camera
    );
}

/* =====================================================
   RESIZE
===================================================== */

function onResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
}

/* =====================================================
   ЗАПУСК
===================================================== */

init();
