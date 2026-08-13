/*
=========================================================
 MYCRAFT WEB ENGINE
 CHUNK SYSTEM v2
=========================================================

 Мир:
   Chunk = 16 x 16 блоков
   Высота мира = 64

 Система:
   - динамическая загрузка чанков
   - выгрузка дальних чанков
   - генерация terrain
   - деревья
   - блоки
   - игрок
   - физика
   - raycast
=========================================================
*/


/* =====================================================
   НАСТРОЙКИ
===================================================== */

const CHUNK_SIZE = 16;

const WORLD_HEIGHT = 64;

const RENDER_DISTANCE = 4;

const BLOCK_REACH = 6;

const GRAVITY = 22;

const PLAYER_SPEED = 5.5;

const JUMP_POWER = 8;


/* =====================================================
   THREE.JS
===================================================== */

let scene;

let camera;

let renderer;


/* =====================================================
   СОСТОЯНИЕ ИГРЫ
===================================================== */

const chunks = new Map();

const worldBlocks = new Map();

let generatedChunks = new Set();


/* =====================================================
   ИГРОК
===================================================== */

const player = {

    x: 0,

    y: 20,

    z: 0,

    velocityY: 0,

    height: 1.8,

    radius: 0.3,

    grounded: false

};


/* =====================================================
   УПРАВЛЕНИЕ
===================================================== */

const keys = {};

let yaw = 0;

let pitch = 0;

let pointerLocked = false;


/* =====================================================
   ВЫБРАННЫЙ БЛОК
===================================================== */

let selectedBlock = "grass";


/* =====================================================
   ТИПЫ БЛОКОВ
===================================================== */

const BLOCKS = {

    grass: {

        name: "Трава",

        color: 0x59b83f

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
   ТЕКУЩЕЕ ВРЕМЯ
===================================================== */

let lastTime = performance.now();


/* =====================================================
   RAYCAST
===================================================== */

const raycaster = new THREE.Raycaster();


/* =====================================================
   ИНИЦИАЛИЗАЦИЯ
===================================================== */

function init() {

    const game =
        document.getElementById("game");


    /*
    -----------------------------------------------------
    SCENE
    -----------------------------------------------------
    */

    scene =
        new THREE.Scene();


    scene.background =
        new THREE.Color(
            0x87ceeb
        );


    scene.fog =
        new THREE.Fog(
            0x87ceeb,
            30,
            CHUNK_SIZE *
            (RENDER_DISTANCE + 1)
        );


    /*
    -----------------------------------------------------
    CAMERA
    -----------------------------------------------------
    */

    camera =
        new THREE.PerspectiveCamera(

            75,

            window.innerWidth /
            window.innerHeight,

            0.05,

            300

        );


    camera.rotation.order =
        "YXZ";


    /*
    -----------------------------------------------------
    RENDERER
    -----------------------------------------------------
    */

    renderer =
        new THREE.WebGLRenderer({

            antialias: false,

            powerPreference:
                "high-performance"

        });


    renderer.setPixelRatio(

        Math.min(

            window.devicePixelRatio,

            1.5

        )

    );


    renderer.setSize(

        window.innerWidth,

        window.innerHeight

    );


    game.appendChild(
        renderer.domElement
    );


    /*
    -----------------------------------------------------
    LIGHT
    -----------------------------------------------------
    */

    createLighting();


    /*
    -----------------------------------------------------
    CONTROLS
    -----------------------------------------------------
    */

    setupControls();


    /*
    -----------------------------------------------------
    PLAYER
    -----------------------------------------------------
    */

    spawnPlayer();


    /*
    -----------------------------------------------------
    RESIZE
    -----------------------------------------------------
    */

    window.addEventListener(

        "resize",

        resize

    );


    /*
    -----------------------------------------------------
    START
    -----------------------------------------------------
    */

    animate();

}


/* =====================================================
   ОСВЕЩЕНИЕ
===================================================== */

function createLighting() {

    const ambient =
        new THREE.HemisphereLight(

            0xffffff,

            0x555555,

            1.6

        );


    scene.add(
        ambient
    );


    const sun =
        new THREE.DirectionalLight(

            0xffffff,

            1.2

        );


    sun.position.set(

        50,

        100,

        30

    );


    scene.add(
        sun
    );

}


/* =====================================================
   ЧАНКОВАЯ СИСТЕМА
===================================================== */


/*
Получить координату чанка.
*/

function worldToChunk(value) {

    return Math.floor(
        value / CHUNK_SIZE
    );

}


/*
Ключ чанка.
*/

function chunkKey(cx, cz) {

    return `${cx},${cz}`;

}


/*
Получить локальную координату блока.
*/

function localCoordinate(value) {

    let result =
        value % CHUNK_SIZE;


    if (result < 0) {

        result +=
            CHUNK_SIZE;

    }


    return result;

}


/* =====================================================
   ЗАГРУЗКА ЧАНКОВ
===================================================== */

function updateChunks() {

    const playerChunkX =
        worldToChunk(player.x);


    const playerChunkZ =
        worldToChunk(player.z);


    const needed =
        new Set();


    for (

        let dx =
            -RENDER_DISTANCE;

        dx <=
            RENDER_DISTANCE;

        dx++

    ) {

        for (

            let dz =
                -RENDER_DISTANCE;

            dz <=
                RENDER_DISTANCE;

            dz++

        ) {

            /*
            Круглая область
            */

            if (

                dx * dx +
                dz * dz >
                RENDER_DISTANCE *
                RENDER_DISTANCE

            ) {

                continue;

            }


            const cx =
                playerChunkX + dx;


            const cz =
                playerChunkZ + dz;


            const key =
                chunkKey(cx, cz);


            needed.add(key);


            if (
                !chunks.has(key)
            ) {

                createChunk(
                    cx,
                    cz
                );

            }

        }

    }


    /*
    -----------------------------------------------------
    ВЫГРУЗКА ДАЛЬНИХ ЧАНКОВ
    -----------------------------------------------------
    */

    for (
        const [key, chunk]
        of chunks
    ) {

        if (
            !needed.has(key)
        ) {

            unloadChunk(
                chunk.cx,
                chunk.cz
            );

        }

    }

}


/* =====================================================
   СОЗДАНИЕ ЧАНКА
===================================================== */

function createChunk(cx, cz) {

    const key =
        chunkKey(
            cx,
            cz
        );


    if (
        chunks.has(key)
    ) {

        return;

    }


    const chunk = {

        cx,

        cz,

        blocks: new Map(),

        meshes: []

    };


    chunks.set(
        key,
        chunk
    );


    generateChunk(
        chunk
    );

}


/* =====================================================
   ГЕНЕРАЦИЯ ЧАНКА
===================================================== */

function generateChunk(chunk) {

    const startX =
        chunk.cx *
        CHUNK_SIZE;


    const startZ =
        chunk.cz *
        CHUNK_SIZE;


    for (

        let lx = 0;

        lx < CHUNK_SIZE;

        lx++

    ) {

        for (

            let lz = 0;

            lz < CHUNK_SIZE;

            lz++

        ) {

            const x =
                startX + lx;


            const z =
                startZ + lz;


            const height =
                getTerrainHeight(
                    x,
                    z
                );


            /*
            ------------------------------------------------
            БЛОКИ ЗЕМЛИ
            ------------------------------------------------
            */

            for (

                let y = 0;

                y <= height;

                y++

            ) {

                let type;


                if (
                    y === height
                ) {

                    type =
                        "grass";

                }

                else if (
                    y >=
                    height - 3
                ) {

                    type =
                        "dirt";

                }

                else {

                    type =
                        "stone";

                }


                addBlockToChunk(

                    chunk,

                    x,

                    y,

                    z,

                    type

                );

            }


            /*
            ------------------------------------------------
            ДЕРЕВЬЯ
            ------------------------------------------------
            */

            if (
                shouldGenerateTree(
                    x,
                    z
                )
            ) {

                generateTree(

                    chunk,

                    x,

                    height + 1,

                    z

                );

            }

        }

    }


    /*
    После генерации создаём mesh.
    */

    buildChunkMesh(
        chunk
    );

}


/* =====================================================
   ВЫСОТА ТЕРРЕЙНА
===================================================== */

function getTerrainHeight(x, z) {

    const a =
        Math.sin(
            x * 0.08
        ) * 4;


    const b =
        Math.cos(
            z * 0.07
        ) * 4;


    const c =
        Math.sin(
            (x + z) *
            0.035
        ) * 7;


    const d =
        Math.cos(
            (x - z) *
            0.02
        ) * 3;


    let height =
        Math.floor(

            10 +
            a +
            b +
            c +
            d

        );


    return Math.max(

        1,

        Math.min(

            WORLD_HEIGHT - 5,

            height

        )

    );

}


/* =====================================================
   ДЕРЕВЬЯ
===================================================== */

function shouldGenerateTree(x, z) {

    /*
    Детеминированное значение.

    Это важно:

    один и тот же мир
    должен генерироваться
    одинаково после перезагрузки.
    */

    const value =
        Math.abs(

            Math.sin(

                x * 12.9898 +
                z * 78.233

            ) *

            43758.5453

        );


    const random =
        value -
        Math.floor(value);


    return random > 0.985;

}


/* =====================================================
   СОЗДАНИЕ ДЕРЕВА
===================================================== */

function generateTree(
    chunk,
    x,
    y,
    z
) {

    const height = 4;


    /*
    Ствол
    */

    for (
        let i = 0;
        i < height;
        i++
    ) {

        addBlockToChunk(

            chunk,

            x,

            y + i,

            z,

            "wood"

        );

    }


    /*
    Листья
    */

    for (
        let dx = -2;
        dx <= 2;
        dx++
    ) {

        for (
            let dz = -2;
            dz <= 2;
            dz++
        ) {

            for (
                let dy = 0;
                dy <= 2;
                dy++
            ) {

                const distance =
                    Math.abs(dx) +
                    Math.abs(dz);


                if (
                    distance <= 3
                ) {

                    addBlockToChunk(

                        chunk,

                        x + dx,

                        y + height - 2 + dy,

                        z + dz,

                        "leaves"

                    );

                }

            }

        }

    }

}


/* =====================================================
   ДОБАВЛЕНИЕ БЛОКА В ЧАНК
===================================================== */

function addBlockToChunk(
    chunk,
    x,
    y,
    z,
    type
) {

    if (
        y < 0 ||
        y >= WORLD_HEIGHT
    ) {

        return;

    }


    const lx =
        localCoordinate(x);


    const lz =
        localCoordinate(z);


    const key =
        `${lx},${y},${lz}`;


    if (
        chunk.blocks.has(key)
    ) {

        return;

    }


    chunk.blocks.set(

        key,

        {

            x,

            y,

            z,

            type

        }

    );


    worldBlocks.set(

        blockKey(
            x,
            y,
            z
        ),

        {

            type,

            chunkKey:
                chunkKey(
                    chunk.cx,
                    chunk.cz
                )

        }

    );

}


/* =====================================================
   ПОСТРОЕНИЕ MESH ЧАНКА
===================================================== */

function buildChunkMesh(chunk) {

    /*
    В этой версии используем
    face culling.

    Невидимые грани блоков
    не создаются.
    */


    for (
        const block
        of chunk.blocks.values()
    ) {

        createVisibleBlock(
            chunk,
            block
        );

    }

}


/* =====================================================
   СОЗДАНИЕ ВИДИМОГО БЛОКА
===================================================== */

function createVisibleBlock(
    chunk,
    block
) {

    const {

        x,

        y,

        z,

        type

    } = block;


    const visibleFaces = {

        px: !hasBlock(
            x + 1,
            y,
            z
        ),

        nx: !hasBlock(
            x - 1,
            y,
            z
        ),

        py: !hasBlock(
            x,
            y + 1,
            z
        ),

        ny: !hasBlock(
            x,
            y - 1,
            z
        ),

        pz: !hasBlock(
            x,
            y,
            z + 1
        ),

        nz: !hasBlock(
            x,
            y,
            z - 1
        )

    };


    /*
    Если блок полностью
    окружён другими блоками,
    он не нужен для рендера.
    */

    if (

        !visibleFaces.px &&
        !visibleFaces.nx &&
        !visibleFaces.py &&
        !visibleFaces.ny &&
        !visibleFaces.pz &&
        !visibleFaces.nz

    ) {

        return;

    }


    /*
    Пока создаём cube.
    Следующим этапом заменим
    это на настоящий greedy meshing.
    */

    const geometry =
        new THREE.BoxGeometry(
            1,
            1,
            1
        );


    const color =
        BLOCKS[type]
            ? BLOCKS[type].color
            : 0xffffff;


    const material =
        new THREE.MeshLambertMaterial({

            color

        });


    const mesh =
        new THREE.Mesh(

            geometry,

            material

        );


    mesh.position.set(

        x + 0.5,

        y + 0.5,

        z + 0.5

    );


    mesh.userData.block = true;

    mesh.userData.x = x;

    mesh.userData.y = y;

    mesh.userData.z = z;

    mesh.userData.type = type;


    scene.add(
        mesh
    );


    chunk.meshes.push(
        mesh
    );

}


/* =====================================================
   ПРОВЕРКА БЛОКА
===================================================== */

function hasBlock(x, y, z) {

    return worldBlocks.has(

        blockKey(
            x,
            y,
            z
        )

    );

}


/* =====================================================
   ВЫГРУЗКА ЧАНКА
===================================================== */

function unloadChunk(cx, cz) {

    const key =
        chunkKey(
            cx,
            cz
        );


    const chunk =
        chunks.get(key);


    if (!chunk) {

        return;

    }


    /*
    Удаляем mesh.
    */

    for (
        const mesh
        of chunk.meshes
    ) {

        scene.remove(
            mesh
        );


        mesh.geometry.dispose();


        if (
            mesh.material
        ) {

            mesh.material.dispose();

        }

    }


    /*
    Удаляем блоки.
    */

    for (
        const block
        of chunk.blocks.values()
    ) {

        worldBlocks.delete(

            blockKey(

                block.x,

                block.y,

                block.z

            )

        );

    }


    chunks.delete(
        key
    );

}


/* =====================================================
   SPAWN
===================================================== */

function spawnPlayer() {

    const ground =
        getTerrainHeight(
            0,
            0
        );


    player.x =
        0.5;


    player.z =
        0.5;


    player.y =
        ground + 1.01;


    updateCamera();

}


/* =====================================================
   УПРАВЛЕНИЕ
===================================================== */

function setupControls() {

    window.addEventListener(

        "keydown",

        event => {

            keys[event.code] =
                true;


            /*
            Прыжок
            */

            if (

                event.code === "Space" &&

                player.grounded

            ) {

                player.velocityY =
                    JUMP_POWER;

                player.grounded =
                    false;

            }


            /*
            Слоты
            */

            if (
                event.code.startsWith(
                    "Digit"
                )
            ) {

                const number =
                    parseInt(

                        event.code
                            .replace(
                                "Digit",
                                ""
                            )

                    );


                selectSlot(
                    number
                );

            }

        }

    );


    window.addEventListener(

        "keyup",

        event => {

            keys[event.code] =
                false;

        }

    );


    /*
    Кнопка игры
    */

    const playButton =
        document.getElementById(
            "playButton"
        );


    if (playButton) {

        playButton.addEventListener(

            "click",

            startGame

        );

    }


    /*
    Pointer Lock
    */

    renderer.domElement.addEventListener(

        "click",

        () => {

            if (
                !pointerLocked
            ) {

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

            if (
                !pointerLocked
            ) {

                return;

            }


            const sensitivity =
                0.002;


            yaw -=
                event.movementX *
                sensitivity;


            pitch -=
                event.movementY *
                sensitivity;


            const limit =
                Math.PI / 2 -
                0.05;


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


    /*
    Клики
    */

    renderer.domElement.addEventListener(

        "mousedown",

        event => {

            if (
                !pointerLocked
            ) {

                return;

            }


            if (
                event.button === 0
            ) {

                breakBlock();

            }


            if (
                event.button === 2
            ) {

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


    /*
    Слоты
    */

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
                        slots.indexOf(
                            slot
                        );


                    selectSlot(
                        index + 1
                    );

                }

            );

        }

    );

}


/* =====================================================
   СТАРТ
===================================================== */

function startGame() {

    const screen =
        document.getElementById(
            "start-screen"
        );


    if (screen) {

        screen.style.display =
            "none";

    }


    lockPointer();

}


/* =====================================================
   POINTER LOCK
===================================================== */

function lockPointer() {

    if (

        renderer &&

        renderer.domElement.requestPointerLock

    ) {

        renderer.domElement.requestPointerLock();

    }

}


/* =====================================================
   ВЫБОР СЛОТА
===================================================== */

function selectSlot(number) {

    const slots =
        document.querySelectorAll(
            ".slot"
        );


    if (

        number < 1 ||

        number >
            slots.length

    ) {

        return;

    }


    slots.forEach(

        slot => {

            slot.classList.remove(
                "selected"
            );

        }

    );


    const slot =
        slots[number - 1];


    slot.classList.add(
        "selected"
    );


    selectedBlock =
        slot.dataset.block;


    const label =
        document.getElementById(
            "selectedBlock"
        );


    if (label) {

        label.textContent =
            BLOCKS[
                selectedBlock
            ].name;

    }

}


/* =====================================================
   ИГРОК
===================================================== */

function updatePlayer(delta) {

    if (
        !pointerLocked
    ) {

        return;

    }


    let forward = 0;

    let right = 0;


    if (
        keys["KeyW"]
    ) {

        forward += 1;

    }


    if (
        keys["KeyS"]
    ) {

        forward -= 1;

    }


    if (
        keys["KeyD"]
    ) {

        right += 1;

    }


    if (
        keys["KeyA"]
    ) {

        right -= 1;

    }


    const length =
        Math.sqrt(

            forward *
                forward +

            right *
                right

        );


    if (
        length > 0
    ) {

        forward /=
            length;

        right /=
            length;


        const speed =
            PLAYER_SPEED *
            delta;


        const sin =
            Math.sin(
                yaw
            );


        const cos =
            Math.cos(
                yaw
            );


        const moveX =

            (

                right *
                    cos +

                forward *
                    sin

            ) * speed;


        const moveZ =

            (

                forward *
                    cos -

                right *
                    sin

            ) * speed;


        movePlayer(

            moveX,

            moveZ

        );

    }


    /*
    Гравитация
    */

    player.velocityY -=

        GRAVITY *
        delta;


    const vertical =

        player.velocityY *
        delta;


    if (
        vertical <= 0
    ) {

        if (
            isGroundBelow()
        ) {

            player.grounded =
                true;

            player.velocityY =
                0;

        }

        else {

            player.grounded =
                false;

            player.y +=
                vertical;

        }

    }

    else {

        player.grounded =
            false;

        player.y +=
            vertical;

    }


    /*
    Проверка земли
    */

    if (
        isGroundBelow()
    ) {

        player.grounded =
            true;

        player.velocityY =
            0;


        const blockY =
            Math.floor(
                player.y
            );


        player.y =
            blockY + 0.001;

    }


    updateCamera();

}


/* =====================================================
   ДВИЖЕНИЕ
===================================================== */

function movePlayer(
    dx,
    dz
) {

    const newX =
        player.x + dx;


    if (
        !collides(
            newX,
            player.y,
            player.z
        )
    ) {

        player.x =
            newX;

    }


    const newZ =
        player.z + dz;


    if (
        !collides(
            player.x,
            player.y,
            newZ
        )
    ) {

        player.z =
            newZ;

    }

}


/* =====================================================
   КОЛЛИЗИЯ
===================================================== */

function collides(
    x,
    y,
    z
) {

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
        Math.floor(
            y
        );


    const maxY =
        Math.floor(

            y +
            player.height

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

        let bx =
            minX;

        bx <=
            maxX;

        bx++

    ) {

        for (

            let by =
                minY;

            by <=
                maxY;

            by++

        ) {

            for (

                let bz =
                    minZ;

                bz <=
                    maxZ;

                bz++

            ) {

                if (

                    hasBlock(

                        bx,

                        by,

                        bz

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
   ЗЕМЛЯ
===================================================== */

function isGroundBelow() {

    const feet =
        player.y -
        0.05;


    const bx =
        Math.floor(
            player.x
        );


    const by =
        Math.floor(
            feet
        );


    const bz =
        Math.floor(
            player.z
        );


    return hasBlock(

        bx,

        by,

        bz

    );

}


/* =====================================================
   КАМЕРА
===================================================== */

function updateCamera() {

    camera.position.set(

        player.x,

        player.y +
            player.height -
            0.15,

        player.z

    );


    camera.rotation.y =
        yaw;


    camera.rotation.x =
        pitch;

}


/* =====================================================
   TARGET BLOCK
===================================================== */

function getTargetBlock() {

    raycaster.setFromCamera(

        new THREE.Vector2(
            0,
            0
        ),

        camera

    );


    const meshes = [];


    for (
        const chunk
        of chunks.values()
    ) {

        for (
            const mesh
            of chunk.meshes
        ) {

            meshes.push(
                mesh
            );

        }

    }


    const hits =
        raycaster.intersectObjects(

            meshes,

            false

        );


    if (
        hits.length === 0
    ) {

        return null;

    }


    const hit =
        hits[0];


    if (
        hit.distance >
        BLOCK_REACH
    ) {

        return null;

    }


    return hit;

}


/* =====================================================
   ЛОМАНИЕ
===================================================== */

function breakBlock() {

    const hit =
        getTargetBlock();


    if (!hit) {

        return;

    }


    const x =
        hit.object.userData.x;


    const y =
        hit.object.userData.y;


    const z =
        hit.object.userData.z;


    if (
        y <= 0
    ) {

        return;

    }


    setBlock(

        x,

        y,

        z,

        null

    );

}


/* =====================================================
   УСТАНОВКА
===================================================== */

function placeBlock() {

    const hit =
        getTargetBlock();


    if (!hit) {

        return;

    }


    const normal =
        hit.face.normal;


    const x =
        hit.object.userData.x +
        normal.x;


    const y =
        hit.object.userData.y +
        normal.y;


    const z =
        hit.object.userData.z +
        normal.z;


    if (
        hasBlock(
            x,
            y,
            z
        )
    ) {

        return;

    }


    /*
    Не разрешаем поставить
    блок внутрь игрока.
    */

    if (

        Math.abs(
            x + 0.5 -
            player.x
        ) < 0.8 &&

        Math.abs(
            y + 0.5 -
            player.y
        ) < 1.8 &&

        Math.abs(
            z + 0.5 -
            player.z
        ) < 0.8

    ) {

        return;

    }


    setBlock(

        x,

        y,

        z,

        selectedBlock

    );

}


/* =====================================================
   ИЗМЕНЕНИЕ БЛОКА
===================================================== */

function setBlock(
    x,
    y,
    z,
    type
) {

    const cx =
        worldToChunk(
            x
        );


    const cz =
        worldToChunk(
            z
        );


    const key =
        chunkKey(
            cx,
            cz
        );


    let chunk =
        chunks.get(key);


    /*
    Если чанк не загружен,
    ничего не делаем.
    */

    if (!chunk) {

        return;

    }


    const localX =
        localCoordinate(
            x
        );


    const localZ =
        localCoordinate(
            z
        );


    const blockKeyLocal =
        `${localX},${y},${localZ}`;


    /*
    -----------------------------------------------------
    УДАЛЕНИЕ
    -----------------------------------------------------
    */

    if (
        type === null
    ) {

        chunk.blocks.delete(
            blockKeyLocal
        );


        worldBlocks.delete(

            blockKey(
                x,
                y,
                z
            )

        );

    }


    /*
    -----------------------------------------------------
    ДОБАВЛЕНИЕ
    -----------------------------------------------------
    */

    else {

        chunk.blocks.set(

            blockKeyLocal,

            {

                x,

                y,

                z,

                type

            }

        );


        worldBlocks.set(

            blockKey(
                x,
                y,
                z
            ),

            {

                type,

                chunkKey:
                    key

            }

        );

    }


    /*
    Перестраиваем чанк
    */

    rebuildChunk(
        chunk
    );


    /*
    Также соседние чанки,
    если блок находится
    на границе.
    */

    rebuildNeighbors(
        x,
        z
    );

}


/* =====================================================
   ПЕРЕСТРОЙКА ЧАНКА
===================================================== */

function rebuildChunk(chunk) {

    for (
        const mesh
        of chunk.meshes
    ) {

        scene.remove(
            mesh
        );


        mesh.geometry.dispose();


        mesh.material.dispose();

    }


    chunk.meshes =
        [];


    buildChunkMesh(
        chunk
    );

}


/* =====================================================
   СОСЕДНИЕ ЧАНКИ
===================================================== */

function rebuildNeighbors(
    x,
    z
) {

    const lx =
        localCoordinate(
            x
        );


    const lz =
        localCoordinate(
            z
        );


    if (
        lx === 0
    ) {

        rebuildChunkByWorld(

            x - 1,

            z

        );

    }


    if (
        lx ===
        CHUNK_SIZE - 1
    ) {

        rebuildChunkByWorld(

            x + 1,

            z

        );

    }


    if (
        lz === 0
    ) {

        rebuildChunkByWorld(

            x,

            z - 1

        );

    }


    if (
        lz ===
        CHUNK_SIZE - 1
    ) {

        rebuildChunkByWorld(

            x,

            z + 1

        );

    }

}


/* =====================================================
   REBUILD ПО МИРОВЫМ КООРДИНАТАМ
===================================================== */

function rebuildChunkByWorld(
    x,
    z
) {

    const cx =
        worldToChunk(
            x
        );


    const cz =
        worldToChunk(
            z
        );


    const chunk =
        chunks.get(

            chunkKey(
                cx,
                cz
            )

        );


    if (
        chunk
    ) {

        rebuildChunk(
            chunk
        );

    }

}


/* =====================================================
   BLOCK KEY
===================================================== */

function blockKey(
    x,
    y,
    z
) {

    return `${x},${y},${z}`;

}


/* =====================================================
   КООРДИНАТЫ HUD
===================================================== */

function updateCoordinates() {

    const x =
        document.getElementById(
            "x"
        );


    const y =
        document.getElementById(
            "y"
        );


    const z =
        document.getElementById(
            "z"
        );


    if (x) {

        x.textContent =
            Math.floor(
                player.x
            );

    }


    if (y) {

        y.textContent =
            Math.floor(
                player.y
            );

    }


    if (z) {

        z.textContent =
            Math.floor(
                player.z
            );

    }

}


/* =====================================================
   GAME LOOP
===================================================== */

function animate() {

    requestAnimationFrame(
        animate
    );


    const now =
        performance.now();


    let delta =
        (
            now -
            lastTime
        ) / 1000;


    lastTime =
        now;


    delta =
        Math.min(
            delta,
            0.05
        );


    /*
    Обновляем чанки.
    */

    updateChunks();


    /*
    Игрок.
    */

    updatePlayer(
        delta
    );


    /*
    HUD.
    */

    updateCoordinates();


    /*
    Рендер.
    */

    renderer.render(

        scene,

        camera

    );

}


/* =====================================================
   RESIZE
===================================================== */

function resize() {

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
   START
===================================================== */

init();
