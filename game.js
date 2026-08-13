/*
=========================================================
 MYCRAFT WEB ENGINE
 CHUNK MESH v3

 Главное изменение:
     1 чанк = 1 общий THREE.Mesh

 Вместо:
     1000 блоков = 1000 Mesh

 Получаем:
     1000 блоков = 1 Mesh

 Также:
     - скрытые грани не создаются
     - соседние блоки не рисуют внутренние поверхности
     - чанки загружаются вокруг игрока
     - чанки выгружаются вдали
     - блоки можно ломать
     - блоки можно ставить
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
   THREE
===================================================== */

let scene;

let camera;

let renderer;


/* =====================================================
   WORLD
===================================================== */

const chunks = new Map();

const worldBlocks = new Map();


/* =====================================================
   PLAYER
===================================================== */

const player = {

    x: 0.5,

    y: 20,

    z: 0.5,

    velocityY: 0,

    height: 1.8,

    radius: 0.3,

    grounded: false

};


/* =====================================================
   INPUT
===================================================== */

const keys = {};

let yaw = 0;

let pitch = 0;

let pointerLocked = false;


/* =====================================================
   BLOCKS
===================================================== */

let selectedBlock = "grass";


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
   RAYCAST
===================================================== */

const raycaster =
    new THREE.Raycaster();


/* =====================================================
   TIME
===================================================== */

let lastTime =
    performance.now();


let chunkUpdateTimer = 0;


/* =====================================================
   CHUNK CLASS
===================================================== */

class Chunk {

    constructor(cx, cz) {

        this.cx = cx;

        this.cz = cz;

        this.blocks = new Map();

        this.mesh = null;

        this.dirty = true;

    }

}


/* =====================================================
   INIT
===================================================== */

function init() {

    const game =
        document.getElementById(
            "game"
        );


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
    INPUT
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
    LOOP
    -----------------------------------------------------
    */

    animate();

}


/* =====================================================
   LIGHTING
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
   CHUNK COORDINATES
===================================================== */

function worldToChunk(value) {

    return Math.floor(

        value /
        CHUNK_SIZE

    );

}


function chunkKey(cx, cz) {

    return `${cx},${cz}`;

}


function localCoordinate(value) {

    let result =
        value %
        CHUNK_SIZE;


    if (result < 0) {

        result +=
            CHUNK_SIZE;

    }


    return result;

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
   BLOCK EXISTS
===================================================== */

function hasBlock(
    x,
    y,
    z
) {

    return worldBlocks.has(

        blockKey(
            x,
            y,
            z
        )

    );

}


/* =====================================================
   CHUNK LOADING
===================================================== */

function updateChunks() {

    const playerChunkX =
        worldToChunk(
            player.x
        );


    const playerChunkZ =
        worldToChunk(
            player.z
        );


    const required =
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

            const distance =
                Math.sqrt(

                    dx * dx +
                    dz * dz

                );


            if (
                distance >
                RENDER_DISTANCE
            ) {

                continue;

            }


            const cx =
                playerChunkX +
                dx;


            const cz =
                playerChunkZ +
                dz;


            const key =
                chunkKey(
                    cx,
                    cz
                );


            required.add(
                key
            );


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
    REMOVE FAR CHUNKS
    -----------------------------------------------------
    */

    for (
        const [key, chunk]
        of chunks
    ) {

        if (
            !required.has(key)
        ) {

            unloadChunk(
                chunk
            );

        }

    }

}


/* =====================================================
   CREATE CHUNK
===================================================== */

function createChunk(
    cx,
    cz
) {

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


    const chunk =
        new Chunk(
            cx,
            cz
        );


    chunks.set(
        key,
        chunk
    );


    generateChunk(
        chunk
    );


    rebuildChunk(
        chunk
    );

}


/* =====================================================
   GENERATE CHUNK
===================================================== */

function generateChunk(
    chunk
) {

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
                startX +
                lx;


            const z =
                startZ +
                lz;


            const height =
                getTerrainHeight(
                    x,
                    z
                );


            /*
            ------------------------------------------------
            TERRAIN
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


                addBlock(

                    chunk,

                    x,

                    y,

                    z,

                    type

                );

            }


            /*
            ------------------------------------------------
            TREE
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

}


/* =====================================================
   TERRAIN
===================================================== */

function getTerrainHeight(
    x,
    z
) {

    const n1 =
        Math.sin(
            x * 0.08
        ) * 4;


    const n2 =
        Math.cos(
            z * 0.07
        ) * 4;


    const n3 =
        Math.sin(
            (x + z) *
            0.035
        ) * 7;


    const n4 =
        Math.cos(
            (x - z) *
            0.02
        ) * 3;


    let height =
        Math.floor(

            10 +
            n1 +
            n2 +
            n3 +
            n4

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
   TREE RANDOM
===================================================== */

function shouldGenerateTree(
    x,
    z
) {

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
        Math.floor(
            value
        );


    return random > 0.985;

}


/* =====================================================
   TREE
===================================================== */

function generateTree(
    chunk,
    x,
    y,
    z
) {

    const trunkHeight =
        4;


    for (
        let i = 0;

        i < trunkHeight;

        i++
    ) {

        addBlock(

            chunk,

            x,

            y + i,

            z,

            "wood"

        );

    }


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

                    addBlock(

                        chunk,

                        x + dx,

                        y +
                        trunkHeight -
                        2 +
                        dy,

                        z + dz,

                        "leaves"

                    );

                }

            }

        }

    }

}


/* =====================================================
   ADD BLOCK
===================================================== */

function addBlock(
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
        localCoordinate(
            x
        );


    const lz =
        localCoordinate(
            z
        );


    const key =
        `${lx},${y},${lz}`;


    if (
        chunk.blocks.has(key)
    ) {

        return;

    }


    const data = {

        x,

        y,

        z,

        type

    };


    chunk.blocks.set(
        key,
        data
    );


    worldBlocks.set(

        blockKey(
            x,
            y,
            z
        ),

        data

    );

}


/* =====================================================
   REMOVE CHUNK MESH
===================================================== */

function disposeChunkMesh(
    chunk
) {

    if (
        !chunk.mesh
    ) {

        return;

    }


    scene.remove(
        chunk.mesh
    );


    if (
        chunk.mesh.geometry
    ) {

        chunk.mesh.geometry.dispose();

    }


    if (
        chunk.mesh.material
    ) {

        chunk.mesh.material.dispose();

    }


    chunk.mesh =
        null;

}


/* =====================================================
   REBUILD CHUNK
===================================================== */

function rebuildChunk(
    chunk
) {

    disposeChunkMesh(
        chunk
    );


    /*
    Общие массивы
    */

    const positions = [];

    const normals = [];

    const colors = [];

    const indices = [];


    let vertexCount = 0;


    /*
    -----------------------------------------------------
    BLOCKS
    -----------------------------------------------------
    */

    for (
        const block
        of chunk.blocks.values()
    ) {

        /*
        Проверяем каждую сторону.
        */

        if (
            !hasBlock(
                block.x + 1,
                block.y,
                block.z
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "px",

                vertexCount
            );

            vertexCount += 4;

        }


        if (
            !hasBlock(
                block.x - 1,
                block.y,
                block.z
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "nx",

                vertexCount
            );

            vertexCount += 4;

        }


        if (
            !hasBlock(
                block.x,
                block.y + 1,
                block.z
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "py",

                vertexCount
            );

            vertexCount += 4;

        }


        if (
            !hasBlock(
                block.x,
                block.y - 1,
                block.z
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "ny",

                vertexCount
            );

            vertexCount += 4;

        }


        if (
            !hasBlock(
                block.x,
                block.y,
                block.z + 1
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "pz",

                vertexCount
            );

            vertexCount += 4;

        }


        if (
            !hasBlock(
                block.x,
                block.y,
                block.z - 1
            )
        ) {

            addFace(
                positions,
                normals,
                colors,
                indices,

                block,

                "nz",

                vertexCount
            );

            vertexCount += 4;

        }

    }


    /*
    Если ничего нет
    */

    if (
        positions.length === 0
    ) {

        chunk.mesh =
            null;

        return;

    }


    /*
    -----------------------------------------------------
    BUFFER GEOMETRY
    -----------------------------------------------------
    */

    const geometry =
        new THREE.BufferGeometry();


    geometry.setAttribute(

        "position",

        new THREE.Float32BufferAttribute(

            positions,

            3

        )

    );


    geometry.setAttribute(

        "normal",

        new THREE.Float32BufferAttribute(

            normals,

            3

        )

    );


    geometry.setAttribute(

        "color",

        new THREE.Float32BufferAttribute(

            colors,

            3

        )

    );


    geometry.setIndex(
        indices
    );


    /*
    -----------------------------------------------------
    MATERIAL
    -----------------------------------------------------
    */

    const material =
        new THREE.MeshLambertMaterial({

            vertexColors: true

        });


    /*
    -----------------------------------------------------
    MESH
    -----------------------------------------------------
    */

    const mesh =
        new THREE.Mesh(

            geometry,

            material

        );


    mesh.userData.chunk = {

        cx:
            chunk.cx,

        cz:
            chunk.cz

    };


    scene.add(
        mesh
    );


    chunk.mesh =
        mesh;


    chunk.dirty =
        false;

}


/* =====================================================
   ADD FACE
===================================================== */

function addFace(
    positions,
    normals,
    colors,
    indices,

    block,

    side,

    offset
) {

    const x =
        block.x;


    const y =
        block.y;


    const z =
        block.z;


    const color =
        getBlockColor(
            block.type,
            side
        );


    let vertices;

    let normal;


    /*
    -----------------------------------------------------
    +X
    -----------------------------------------------------
    */

    if (
        side === "px"
    ) {

        vertices = [

            x + 1, y, z,

            x + 1, y + 1, z,

            x + 1, y + 1, z + 1,

            x + 1, y, z + 1

        ];


        normal = [
            1,
            0,
            0
        ];

    }


    /*
    -----------------------------------------------------
    -X
    -----------------------------------------------------
    */

    else if (
        side === "nx"
    ) {

        vertices = [

            x, y, z + 1,

            x, y + 1, z + 1,

            x, y + 1, z,

            x, y, z

        ];


        normal = [
            -1,
            0,
            0
        ];

    }


    /*
    -----------------------------------------------------
    +Y
    -----------------------------------------------------
    */

    else if (
        side === "py"
    ) {

        vertices = [

            x, y + 1, z,

            x, y + 1, z + 1,

            x + 1, y + 1, z + 1,

            x + 1, y + 1, z

        ];


        normal = [
            0,
            1,
            0
        ];

    }


    /*
    -----------------------------------------------------
    -Y
    -----------------------------------------------------
    */

    else if (
        side === "ny"
    ) {

        vertices = [

            x, y, z + 1,

            x, y, z,

            x + 1, y, z,

            x + 1, y, z + 1

        ];


        normal = [
            0,
            -1,
            0
        ];

    }


    /*
    -----------------------------------------------------
    +Z
    -----------------------------------------------------
    */

    else if (
        side === "pz"
    ) {

        vertices = [

            x + 1, y, z + 1,

            x + 1, y + 1, z + 1,

            x, y + 1, z + 1,

            x, y, z + 1

        ];


        normal = [
            0,
            0,
            1
        ];

    }


    /*
    -----------------------------------------------------
    -Z
    -----------------------------------------------------
    */

    else {

        vertices = [

            x, y, z,

            x, y + 1, z,

            x + 1, y + 1, z,

            x + 1, y, z

        ];


        normal = [
            0,
            0,
            -1
        ];

    }


    /*
    -----------------------------------------------------
    POSITIONS
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i < vertices.length;

        i++
    ) {

        positions.push(
            vertices[i]
        );

    }


    /*
    -----------------------------------------------------
    NORMALS
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i < 4;

        i++
    ) {

        normals.push(

            normal[0],

            normal[1],

            normal[2]

        );

    }


    /*
    -----------------------------------------------------
    COLORS
    -----------------------------------------------------
    */

    for (
        let i = 0;

        i < 4;

        i++
    ) {

        colors.push(

            color.r,

            color.g,

            color.b

        );

    }


    /*
    -----------------------------------------------------
    INDICES
    -----------------------------------------------------
    */

    indices.push(

        offset,

        offset + 1,

        offset + 2,

        offset,

        offset + 2,

        offset + 3

    );

}


/* =====================================================
   BLOCK COLOR
===================================================== */

function getBlockColor(
    type,
    side
) {

    let color;


    /*
    Grass
    */

    if (
        type === "grass"
    ) {

        if (
            side === "py"
        ) {

            color =
                new THREE.Color(
                    0x59b83f
                );

        }

        else if (
            side === "ny"
        ) {

            color =
                new THREE.Color(
                    0x70451f
                );

        }

        else {

            color =
                new THREE.Color(
                    0x65a94c
                );

        }

    }


    /*
    Остальные блоки
    */

    else {

        color =
            new THREE.Color(

                BLOCKS[type]
                    ? BLOCKS[type].color
                    : 0xffffff

            );

    }


    /*
    Простое освещение сторон.

    Верх светлее.
    Низ темнее.
    */

    if (
        side === "py"
    ) {

        color.multiplyScalar(
            1.08
        );

    }


    if (
        side === "ny"
    ) {

        color.multiplyScalar(
            0.65
        );

    }


    if (
        side === "px" ||
        side === "nx"
    ) {

        color.multiplyScalar(
            0.9
        );

    }


    return color;

}


/* =====================================================
   UNLOAD CHUNK
===================================================== */

function unloadChunk(
    chunk
) {

    disposeChunkMesh(
        chunk
    );


    /*
    Удаляем блоки
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

        chunkKey(

            chunk.cx,

            chunk.cz

        )

    );

}


/* =====================================================
   SPAWN
===================================================== */

function spawnPlayer() {

    /*
    Загружаем стартовый чанк
    */

    const cx =
        worldToChunk(
            0
        );


    const cz =
        worldToChunk(
            0
        );


    /*
    Сначала создаём стартовый
    набор чанков.
    */

    for (
        let x = -1;
        x <= 1;
        x++
    ) {

        for (
            let z = -1;
            z <= 1;
            z++
        ) {

            createChunk(

                cx + x,

                cz + z

            );

        }

    }


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
   INPUT
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


    const playButton =
        document.getElementById(
            "playButton"
        );


    if (
        playButton
    ) {

        playButton.addEventListener(

            "click",

            startGame

        );

    }


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
   START GAME
===================================================== */

function startGame() {

    const screen =
        document.getElementById(
            "start-screen"
        );


    if (
        screen
    ) {

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
   SELECT SLOT
===================================================== */

function selectSlot(
    number
) {

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


    if (
        label
    ) {

        label.textContent =
            BLOCKS[
                selectedBlock
            ].name;

    }

}


/* =====================================================
   PLAYER UPDATE
===================================================== */

function updatePlayer(
    delta
) {

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


        const dx =

            (

                right * cos +

                forward * sin

            ) * speed;


        const dz =

            (

                forward * cos -

                right * sin

            ) * speed;


        movePlayer(
            dx,
            dz
        );

    }


    /*
    -----------------------------------------------------
    GRAVITY
    -----------------------------------------------------
    */

    player.velocityY -=

        GRAVITY *
        delta;


    const vertical =

        player.velocityY *
        delta;


    if (
        vertical > 0
    ) {

        if (
            !collides(

                player.x,

                player.y +
                    vertical,

                player.z

            )
        ) {

            player.y +=
                vertical;

        }

        else {

            player.velocityY =
                0;

        }

    }

    else {

        if (
            !collides(

                player.x,

                player.y +
                    vertical,

                player.z

            )
        ) {

            player.y +=
                vertical;

            player.grounded =
                false;

        }

        else {

            player.velocityY =
                0;

            player.grounded =
                true;

        }

    }


    /*
    -----------------------------------------------------
    CHUNK UPDATE
    -----------------------------------------------------
    */

    chunkUpdateTimer +=
        delta;


    if (
        chunkUpdateTimer >
        0.5
    ) {

        updateChunks();

        chunkUpdateTimer =
            0;

    }


    updateCamera();

}


/* =====================================================
   MOVE PLAYER
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
   COLLISION
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
   CAMERA
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
   RAYCAST
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


    /*
    Теперь raycast идёт
    по чанковым mesh.
    */

    for (
        const chunk
        of chunks.values()
    ) {

        if (
            chunk.mesh
        ) {

            meshes.push(
                chunk.mesh
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


    /*
    Нам нужно вычислить,
    какой блок был выбран.

    Точка попадания
    немного смещена внутрь/наружу
    относительно поверхности.
    */

    const point =
        hit.point;


    const normal =
        hit.face.normal;


    const px =
        point.x -
        normal.x *
        0.001;


    const py =
        point.y -
        normal.y *
        0.001;


    const pz =
        point.z -
        normal.z *
        0.001;


    const x =
        Math.floor(
            px
        );


    const y =
        Math.floor(
            py
        );


    const z =
        Math.floor(
            pz
        );


    if (
        !hasBlock(
            x,
            y,
            z
        )
    ) {

        return null;

    }


    return {

        hit,

        x,

        y,

        z,

        normal

    };

}


/* =====================================================
   BREAK
===================================================== */

function breakBlock() {

    const target =
        getTargetBlock();


    if (
        !target
    ) {

        return;

    }


    if (
        target.y <= 0
    ) {

        return;

    }


    setBlock(

        target.x,

        target.y,

        target.z,

        null

    );

}


/* =====================================================
   PLACE
===================================================== */

function placeBlock() {

    const target =
        getTargetBlock();


    if (
        !target
    ) {

        return;

    }


    const x =
        target.x +
        target.normal.x;


    const y =
        target.y +
        target.normal.y;


    const z =
        target.z +
        target.normal.z;


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
    Не ставим блок внутрь игрока.
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


    const chunk =
        getChunkForBlock(
            x,
            z
        );


    if (
        !chunk
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
   GET CHUNK
===================================================== */

function getChunkForBlock(
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


    return chunks.get(

        chunkKey(
            cx,
            cz
        )

    );

}


/* =====================================================
   SET BLOCK
===================================================== */

function setBlock(
    x,
    y,
    z,
    type
) {

    const chunk =
        getChunkForBlock(
            x,
            z
        );


    if (
        !chunk
    ) {

        return;

    }


    const lx =
        localCoordinate(
            x
        );


    const lz =
        localCoordinate(
            z
        );


    const localKey =
        `${lx},${y},${lz}`;


    /*
    -----------------------------------------------------
    REMOVE
    -----------------------------------------------------
    */

    if (
        type === null
    ) {

        chunk.blocks.delete(
            localKey
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
    ADD
    -----------------------------------------------------
    */

    else {

        const data = {

            x,

            y,

            z,

            type

        };


        chunk.blocks.set(

            localKey,

            data

        );


        worldBlocks.set(

            blockKey(
                x,
                y,
                z
            ),

            data

        );

    }


    /*
    -----------------------------------------------------
    REBUILD
    -----------------------------------------------------
    */

    rebuildChunk(
        chunk
    );


    /*
    Если изменён блок
    на границе чанка,
    сосед тоже должен
    перестроиться.
    */

    rebuildNeighborChunks(
        x,
        z
    );

}


/* =====================================================
   NEIGHBOR CHUNKS
===================================================== */

function rebuildNeighborChunks(
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

        rebuildChunkAt(
            x - 1,
            z
        );

    }


    if (
        lx ===
        CHUNK_SIZE - 1
    ) {

        rebuildChunkAt(
            x + 1,
            z
        );

    }


    if (
        lz === 0
    ) {

        rebuildChunkAt(
            x,
            z - 1
        );

    }


    if (
        lz ===
        CHUNK_SIZE - 1
    ) {

        rebuildChunkAt(
            x,
            z + 1
        );

    }

}


/* =====================================================
   REBUILD CHUNK AT
===================================================== */

function rebuildChunkAt(
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
   HUD
===================================================== */

function updateHUD() {

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


    if (
        x
    ) {

        x.textContent =
            Math.floor(
                player.x
            );

    }


    if (
        y
    ) {

        y.textContent =
            Math.floor(
                player.y
            );

    }


    if (
        z
    ) {

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


    updatePlayer(
        delta
    );


    updateHUD();


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
