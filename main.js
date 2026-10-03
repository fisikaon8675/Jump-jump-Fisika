// Konfigurasi Matter.js
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Events = Matter.Events;

const WORLD_HEIGHT = 28800; // Total ketinggian dunia
const WORLD_WIDTH = 12000; // Lebar total dunia (kanan-kiri)
const START_X = 500; // Mulai dari kiri
const START_Y = WORLD_HEIGHT - 200; // Titik mulai (bawah)
const FINISH_X = WORLD_WIDTH - 1000; // Target di sebelah kanan atas
const FINISH_Y = 200; // Garis Finish (puncak)
let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;

// Preload Player Assets
const playerFrames = [];
for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.src = `assets/player/player1_gerak${i}.png`;
    playerFrames.push(img);
}
const playerJumpFrame = new Image();
playerJumpFrame.src = 'assets/player/player1_jump.png';

const bataImg = new Image();
bataImg.src = 'assets/platform/bata.png';
const bataMerahImg = new Image();
bataMerahImg.src = 'assets/platform/bata-merah.png';
const betonImg = new Image();
betonImg.src = 'assets/platform/beton.png';
const kayuImg = new Image();
kayuImg.src = 'assets/platform/kayu.png';

const cloudImgs = [];
['cloud1.png', 'cloud2.png', 'cloud3.png', 'cloud4.png', 'cloud8.png'].forEach(name => {
    const img = new Image();
    img.src = 'assets/env/' + name;
    cloudImgs.push(img);
});

const bgMusic = new Audio('assets/sound/sound.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;
let isMusicPlaying = false;

const fallSound = new Audio('assets/sound/fall.mp3');
let isFallingSoundPlayed = false;
let fallStartY = 0;
let isSoundMuted = false;

const gemTypes = ['gemBlue.png', 'gemGreen.png', 'gemRed.png'];

// Inisialisasi Engine & Gravitasi
const engine = Engine.create();
engine.world.gravity.y = 1.2; // Gravitasi normal sedikit berat agar platforming pas

// Render Kanvas
const render = Render.create({
    element: document.getElementById('canvas-container'),
    engine: engine,
    options: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio,
        hasBounds: true // Penting untuk pergerakan kamera
    }
});

// -----------------------------
// PEMBUATAN OBJEK (BODIES)
// -----------------------------

// Karakter Utama (Menggunakan Custom Sprite)
const player = Bodies.rectangle(START_X, START_Y, 40, 40, {
    chamfer: { radius: 10 }, 
    restitution: 0.1, 
    friction: 0.05,
    frictionAir: 0.01, // Dikurangi agar lebih cepat
    density: 0.005,
    inertia: Infinity, // Mencegah rotasi tubuh
    render: {
        visible: false // Sembunyikan default body, kita gambar manual
    },
    label: 'player'
});

// Tanah Dasar
const ground = Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT, WORLD_WIDTH * 2, 100, {
    isStatic: true,
    render: { fillStyle: '#9e9e9e', strokeStyle: '#000', lineWidth: 4 },
    label: 'ground'
});

// Garis Finish (Di Kanan Atas)
const finishLine = Bodies.rectangle(FINISH_X, FINISH_Y, 1500, 50, {
    isStatic: true,
    isSensor: true, // Tidak ada tabrakan fisik
    render: { fillStyle: '#4caf50', strokeStyle: '#000', lineWidth: 4 },
    label: 'finish'
});

// Dinding Pembatas Kiri dan Kanan (Sesuai WORLD_WIDTH)
const wallLeft = Bodies.rectangle(-25, WORLD_HEIGHT/2, 50, WORLD_HEIGHT*1.5, { isStatic: true });
const wallRight = Bodies.rectangle(WORLD_WIDTH+25, WORLD_HEIGHT/2, 50, WORLD_HEIGHT*1.5, { isStatic: true });

Composite.add(engine.world, [player, ground, finishLine, wallLeft, wallRight]);

// Generator Prosedural Platform & Baterai Soal
const platforms = [];
const platformGap = 130; // Jarak Y diturunkan agar lompatan tidak terlalu tinggi

for (let y = WORLD_HEIGHT - 250; y > FINISH_Y + 100; y -= platformGap) {
    const width = Math.random() * 150 + 100;
    
    // Perhitungan X agar mengarah serong ke kanan
    const progress = (WORLD_HEIGHT - y) / (WORLD_HEIGHT - FINISH_Y); 
    const base_x = START_X + progress * (FINISH_X - START_X);
    const x = base_x + (Math.random() * 400 - 200); // Randomisasi sedikit
    
    // Platform (Semua memakai Custom Texture)
    const p = Bodies.rectangle(x, y, width, 30, {
        isStatic: true,
        friction: 0.5,
        render: { visible: false }, // Selalu disembunyikan agar digambar manual
        label: 'platform'
    });
    
    p.customWidth = width;
    p.customHeight = 30;
    
    if (progress < 0.3) {
        p.customTexture = Math.random() > 0.5 ? 'bata' : 'bata-merah';
    } else if (progress < 0.6) {
        p.customTexture = 'kayu';
    } else {
        p.customTexture = 'beton';
    }
    
    platforms.push(p);

    // 25% kemungkinan muncul Gem Soal di atas platform
    if (Math.random() < 0.25) {
        const randomGem = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        const bat = Bodies.rectangle(x, y - 40, 30, 30, {
            isStatic: true,
            isSensor: true,
            render: {
                sprite: {
                    texture: 'assets/gems/' + randomGem,
                    xScale: 0.8,
                    yScale: 0.8
                }
            },
            label: 'gem'
        });
        Composite.add(engine.world, bat);
    }
}
Composite.add(engine.world, platforms);

// Generator Awan (di atas ketinggian 1000m)
const clouds = [];
// 1000m = y < WORLD_HEIGHT - 1000
for (let y = WORLD_HEIGHT - 1000; y > FINISH_Y - 500; y -= 250) {
    // Generate lebih banyak awan per baris ketinggian karena dunia sangat lebar (12000px)
    const numClouds = 6 + Math.random() * 4; // 6-10 awan per layer
    for (let i = 0; i < numClouds; i++) {
        clouds.push({
            x: Math.random() * WORLD_WIDTH,
            y: y + (Math.random() * 100 - 50),
            imgIndex: Math.floor(Math.random() * cloudImgs.length),
            scale: 0.5 + Math.random() * 1.5,
            drift: (Math.random() - 0.5) * 1.5 // Kecepatan angin horizontal
        });
    }
}

// Render Tambahan: Menggambar Sprite Animasi Karakter & Platform Awal
Events.on(render, 'afterRender', function() {
    const ctx = render.context;
    
    // Aplikasikan transformasi kamera Matter.js (viewport)
    Render.startViewTransform(render);
    
    // Gambar awan sebagai background di atas ketinggian 1000m
    clouds.forEach(c => {
        const img = cloudImgs[c.imgIndex];
        if (img.complete && img.naturalWidth > 0) {
            const w = img.naturalWidth * c.scale;
            const h = img.naturalHeight * c.scale;
            ctx.globalAlpha = 0.8; // Sedikit transparan
            ctx.drawImage(img, c.x - w/2, c.y - h/2, w, h);
            ctx.globalAlpha = 1.0;
        }
    });
    
    // Gambar custom platform untuk seluruh ketinggian
    platforms.forEach(p => {
        if (p.customTexture) {
            let img = bataImg;
            if (p.customTexture === 'bata-merah') img = bataMerahImg;
            if (p.customTexture === 'kayu') img = kayuImg;
            if (p.customTexture === 'beton') img = betonImg;
            
            if (img.complete && img.naturalWidth > 0) {
                ctx.translate(p.position.x, p.position.y);
                ctx.rotate(p.angle);
                
                // Gambar membentang (stretch) ke ukuran hitbox agar pas fisika
                ctx.drawImage(img, -p.customWidth / 2, -p.customHeight / 2, p.customWidth, p.customHeight);
                
                ctx.rotate(-p.angle);
                ctx.translate(-p.position.x, -p.position.y);
            }
        }
    });

    const px = player.position.x;
    const py = player.position.y;
    
    let imgToDraw = playerFrames[0]; // Idle
    if (isJumping) {
        imgToDraw = playerJumpFrame;
    } else if (isMoving) {
        imgToDraw = playerFrames[currentFrame];
    }
    
    if (imgToDraw.complete && imgToDraw.naturalWidth > 0) {
        const targetSize = 65; // Skala pas frame body 40x40 (sedikit lebih besar)
        const scale = Math.min(targetSize / imgToDraw.naturalWidth, targetSize / imgToDraw.naturalHeight);
        const drawW = imgToDraw.naturalWidth * scale;
        const drawH = imgToDraw.naturalHeight * scale;
        
        ctx.translate(px, py);
        ctx.scale(facingRight ? 1 : -1, 1);
        
        // Geser ke atas sedikit agar kaki pas dengan bounds bawah body
        ctx.drawImage(imgToDraw, -drawW / 2, -drawH / 2 - 5, drawW, drawH);
        
        ctx.scale(facingRight ? 1 : -1, 1);
        ctx.translate(-px, -py);
    }
    
    // Kembalikan transformasi kamera
    Render.endViewTransform(render);
});

// -----------------------------
// SISTEM ENERGI & MEKANIK
// -----------------------------

let energy = 100;
const MAX_ENERGY = 100;
let isQuizOpen = false;
let gameState = 'start_menu'; // start_menu, playing, paused, win
let currentBattery = null; // Menyimpan baterai/gem yang disentuh
let jumpCount = 0; // Deteksi lompatan (cegah double jump berlebihan)
let collectedGems = 0; // Penghitung gems

// Animation State
let currentFrame = 0;
let frameTimer = 0;
let isMoving = false;
let isJumping = false;
let facingRight = true;

const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => {
    // Putar musik saat user berinteraksi pertama kali
    if (!isMusicPlaying) {
        bgMusic.play().catch(err => console.log("Audio play failed:", err));
        isMusicPlaying = true;
    }

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    
    // Trigger Kuis via "Q"
    if (key === 'q' && !isQuizOpen && gameState === 'playing') {
        triggerQuiz();
    } else if (key === 'p') {
        togglePause();
    } else if (key === 'm') {
        toggleSound();
    } else if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// Deteksi Tabrakan (Ground, Platform, Baterai, Finish)
Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        
        // Reset Jump jika menyentuh platform/ground
        if (bodyA.label === 'player' && (bodyB.label === 'platform' || bodyB.label === 'ground')) {
            jumpCount = 0;
        } else if (bodyB.label === 'player' && (bodyA.label === 'platform' || bodyA.label === 'ground')) {
            jumpCount = 0;
        }

        // Tabrakan dengan Gem
        if (!isQuizOpen && gameState === 'playing') {
            if (bodyA.label === 'player' && bodyB.label === 'gem') {
                currentBattery = bodyB;
                triggerQuiz();
            } else if (bodyB.label === 'player' && bodyA.label === 'gem') {
                currentBattery = bodyA;
                triggerQuiz();
            }
        }

        // Tabrakan Finish (Menang)
        if ((bodyA.label === 'player' && bodyB.label === 'finish') || (bodyB.label === 'player' && bodyA.label === 'finish')) {
            gameState = 'win';
            document.getElementById('overlay-msg').style.display = 'flex';
        }
    });
});

// Loop Utama Fisika (Pergerakan & UI)
const energyBarFill = document.getElementById('energy-bar-fill');
const altVal = document.getElementById('alt-val');

Events.on(engine, 'beforeUpdate', () => {
    // Kamera dan UI harus selalu ter-update
    
    // Pergerakan awan (drift)
    if (gameState === 'playing' && !isQuizOpen) {
        clouds.forEach(c => {
            c.x += c.drift;
            if (c.x > WORLD_WIDTH + 500) c.x = -500;
            else if (c.x < -500) c.x = WORLD_WIDTH + 500;
        });
    }

    isMoving = false;
    isJumping = Math.abs(player.velocity.y) > 1; // Deteksi lompat/jatuh

    // Catat posisi Y terakhir saat pemain berada di tanah/platform
    if (!isJumping) {
        fallStartY = player.position.y;
        isFallingSoundPlayed = false;
    }

    // Efek suara ketika terjatuh lebih dari 300m dari titik awal lompat/jatuh
    if (player.velocity.y > 0) {
        if (player.position.y - fallStartY > 300) {
            if (!isFallingSoundPlayed && gameState === 'playing') {
                fallSound.currentTime = 0;
                fallSound.play().catch(e => console.log(e));
                isFallingSoundPlayed = true;
            }
        }
    }

    // Pergerakan Horizontal & Lompatan (Hanya saat playing)
    if (energy > 0 && gameState === 'playing' && !isQuizOpen) {
        const moveForce = 0.008; // Diperbesar agar gerak lebih cepat
        if (keys.a || keys.ArrowLeft) {
            Body.applyForce(player, player.position, { x: -moveForce, y: 0 });
            energy -= 0.01; // Pengurangan jalan sangat lambat (disesuaikan)
            isMoving = true;
            facingRight = false;
        }
        if (keys.d || keys.ArrowRight) {
            Body.applyForce(player, player.position, { x: moveForce, y: 0 });
            energy -= 0.01;
            isMoving = true;
            facingRight = true;
        }
        
        // Lompat
        if ((keys.w || keys.ArrowUp) && jumpCount < 1) {
            // Lompatan instan via Kecepatan (dikurangi agar tidak terlalu tinggi)
            Body.setVelocity(player, { x: player.velocity.x, y: -19 });
            energy -= 2; // Cost energi disesuaikan agar seimbang dengan reward kuis
            jumpCount++;
            keys.w = false; // Mencegah ditahan
            keys.ArrowUp = false;
        }
    }
    
    // Update Animation Frame
    if (isMoving && !isJumping) {
        frameTimer += engine.timing.lastDelta;
        if (frameTimer > 150) { // Ganti frame tiap 150ms
            frameTimer = 0;
            currentFrame = (currentFrame + 1) % playerFrames.length;
        }
    } else {
        currentFrame = 0;
    }
    
    // Batasan Energi
    if (energy < 0) energy = 0;
    if (energy > MAX_ENERGY) energy = MAX_ENERGY;

    // Update Bar Energi UI
    energyBarFill.style.width = (energy / MAX_ENERGY * 100) + '%';
    if (energy < 20) energyBarFill.style.backgroundColor = '#ea4335'; // Merah
    else if (energy < 50) energyBarFill.style.backgroundColor = '#fbbc05'; // Kuning
    else energyBarFill.style.backgroundColor = '#4caf50'; // Hijau

    // Update Ketinggian UI
    const altitude = Math.max(0, WORLD_HEIGHT - player.position.y);
    altVal.textContent = Math.floor(altitude);

    // Kamera mengikuti sumbu X dan Y Karakter
    let cameraX = player.position.x;
    let cameraY = player.position.y;
    
    const limitBottomY = WORLD_HEIGHT - SCREEN_HEIGHT / 2;
    const limitTopY = SCREEN_HEIGHT / 2;
    if (cameraY > limitBottomY) cameraY = limitBottomY;
    if (cameraY < limitTopY) cameraY = limitTopY;
    
    const limitLeftX = SCREEN_WIDTH / 2;
    const limitRightX = WORLD_WIDTH - SCREEN_WIDTH / 2;
    if (cameraX < limitLeftX) cameraX = limitLeftX;
    if (cameraX > limitRightX) cameraX = limitRightX;
    
    render.bounds.min.x = cameraX - SCREEN_WIDTH / 2;
    render.bounds.max.x = cameraX + SCREEN_WIDTH / 2;
    render.bounds.min.y = cameraY - SCREEN_HEIGHT / 2;
    render.bounds.max.y = cameraY + SCREEN_HEIGHT / 2;
});

// -----------------------------
// SISTEM KUIS FISIKA
// -----------------------------

const quizBank = [
    // Besaran dan Satuan (13 Soal)
    { q: "Besaran pokok untuk mengukur panjang adalah...", hint: "Standar internasional", opts: ["Kilogram", "Meter", "Sekon", "Kelvin"], ans: 1 },
    { q: "Satuan energi dalam Sistem Internasional (SI) adalah...", hint: "Juga untuk usaha", opts: ["Newton", "Watt", "Pascal", "Joule"], ans: 3 },
    { q: "Besaran yang memiliki nilai dan arah disebut...", hint: "Berbeda dengan skalar", opts: ["Besaran Skalar", "Besaran Pokok", "Besaran Vektor", "Besaran Turunan"], ans: 2 },
    { q: "Satuan gaya dalam Sistem Internasional (SI) adalah...", hint: "Sama dengan nama ilmuwan gravitasi", opts: ["Joule", "Newton", "Watt", "Pascal"], ans: 1 },
    { q: "Di antara kelompok besaran berikut, yang semuanya merupakan besaran pokok adalah...", hint: "Suhu, massa, panjang...", opts: ["Panjang, Massa, Waktu", "Gaya, Kecepatan, Usaha", "Energi, Jarak, Waktu", "Massa, Berat, Gaya"], ans: 0 },
    { q: "Satuan dari besaran massa dalam Standar Internasional adalah...", hint: "Bukan gram", opts: ["Kilogram", "Ton", "Pound", "Newton"], ans: 0 },
    { q: "Kelvin adalah satuan internasional (SI) untuk besaran pokok...", hint: "Berhubungan dengan panas/dingin", opts: ["Waktu", "Panjang", "Suhu", "Kuat Arus"], ans: 2 },
    { q: "Besaran turunan yang merupakan hasil bagi antara perpindahan dan waktu adalah...", hint: "Satuannya m/s (vektor)", opts: ["Kelajuan", "Percepatan", "Gaya", "Kecepatan"], ans: 3 },
    { q: "Dimensi dari besaran massa disimbolkan dengan huruf...", hint: "Berbeda dengan berat", opts: ["L", "M", "T", "W"], ans: 1 },
    { q: "Awalan satuan 'kilo' memiliki nilai pengali sebesar...", hint: "Seperti kilometer ke meter", opts: ["10", "100", "1000", "1.000.000"], ans: 2 },
    { q: "Besaran yang diturunkan dari besaran pokok panjang dan waktu adalah...", hint: "Panjang dibagi waktu", opts: ["Kecepatan", "Luas", "Volume", "Massa jenis"], ans: 0 },
    { q: "Besaran yang hanya memiliki nilai (besar) saja tanpa arah disebut...", hint: "Lawan dari Vektor", opts: ["Besaran Skalar", "Besaran Fisika", "Besaran Turunan", "Besaran Relatif"], ans: 0 },
    { q: "Alat ukur yang tepat untuk mengukur besaran waktu adalah...", hint: "Sering dipakai saat olahraga", opts: ["Jangka sorong", "Dinamometer", "Termometer", "Stopwatch"], ans: 3 },

    // Gaya (13 Soal)
    { q: "Massa suatu benda 5 kg, jika gravitasi=10 m/s², berapakah gaya beratnya?", hint: "W = m * g", opts: ["50 N", "5 N", "15 N", "0.5 N"], ans: 0 },
    { q: "Hukum I Newton sering disebut juga sebagai Hukum...", hint: "Kecenderungan mempertahankan keadaan diam/gerak", opts: ["Aksi-Reaksi", "Kelembaman/Inersia", "Gravitasi", "Kekekalan Energi"], ans: 1 },
    { q: "Gaya yang muncul ketika dua permukaan saling bersentuhan dan menghambat gerak disebut...", hint: "Arahnya berlawanan dengan gerak", opts: ["Gaya Normal", "Gaya Gesek", "Gaya Pegas", "Gaya Sentripetal"], ans: 1 },
    { q: "Jika kamu mendorong tembok, tembok juga 'mendorong' kamu dengan gaya yang sama. Ini sesuai dengan Hukum...", hint: "Aksi = Reaksi", opts: ["Newton I", "Newton II", "Newton III", "Gravitasi Newton"], ans: 2 },
    { q: "Gaya yang selalu menarik benda-benda ke pusat bumi adalah...", hint: "Benda jatuh", opts: ["Gaya Magnet", "Gaya Gesek", "Gaya Gravitasi", "Gaya Pegas"], ans: 2 },
    { q: "Percepatan benda berbanding lurus dengan gaya total dan berbanding terbalik dengan massanya. Ini adalah Hukum...", hint: "F = m * a", opts: ["Kepler", "Hukum I Newton", "Hukum II Newton", "Hukum III Newton"], ans: 2 },
    { q: "Gaya gesek statis akan bekerja pada benda yang...", hint: "Lawan dari gaya gesek kinetik", opts: ["Bergerak cepat", "Bergerak lambat", "Sedang melayang", "Masih diam"], ans: 3 },
    { q: "Resultan dari dua gaya yang sama besar dan berlawanan arah adalah...", hint: "Tarik tambang yang seimbang", opts: ["Maksimal", "Nol", "Setengahnya", "Menjadi ganda"], ans: 1 },
    { q: "Sebuah balok ditarik dengan gaya 10 N ke kanan dan 4 N ke kiri. Resultan gayanya adalah...", hint: "Kurangkan karena berlawanan", opts: ["14 N ke kanan", "6 N ke kiri", "6 N ke kanan", "14 N ke kiri"], ans: 2 },
    { q: "Gaya yang dikerjakan oleh tali pada benda yang digantung padanya disebut gaya...", hint: "Tension", opts: ["Gaya Tegangan Tali", "Gaya Normal", "Gaya Gesek", "Gaya Berat"], ans: 0 },
    { q: "Sifat kelembaman (inersia) suatu benda sangat dipengaruhi oleh...", hint: "Semakin berat semakin susah didorong", opts: ["Volume", "Suhu", "Massa benda", "Warna benda"], ans: 2 },
    { q: "Untuk memperkecil gaya gesekan pada mesin, kita biasanya menggunakan...", hint: "Benda licin", opts: ["Pasir", "Pelumas / Oli", "Kertas Amplas", "Air Garam"], ans: 1 },
    { q: "Alat yang biasa digunakan untuk mengukur besar gaya (misal berat beban) di laboratorium adalah...", hint: "Menggunakan pegas", opts: ["Neraca Ohaus", "Neraca Pegas (Dinamometer)", "Barometer", "Mikrometer"], ans: 1 },

    // Energi (12 Soal)
    { q: "Rumus energi potensial gravitasi adalah...", hint: "Terkait massa, gravitasi, ketinggian", opts: ["m * g", "1/2 * m * v²", "m * g * h", "F * s"], ans: 2 },
    { q: "Energi kinetik benda bermassa 2 kg yang bergerak dengan kelajuan 3 m/s adalah...", hint: "Ek = 1/2 m v²", opts: ["3 J", "6 J", "9 J", "18 J"], ans: 2 },
    { q: "Kemampuan untuk melakukan usaha disebut...", hint: "Dibutuhkan untuk bergerak", opts: ["Gaya", "Energi", "Daya", "Momentum"], ans: 1 },
    { q: "Jika gaya 20 N memindahkan benda sejauh 2 m searah gaya, energi (usaha) yang dilakukan...", hint: "W = F * s", opts: ["10 J", "22 J", "40 J", "0 J"], ans: 2 },
    { q: "Energi yang dimiliki suatu benda karena geraknya disebut...", hint: "Kinetik", opts: ["Energi Mekanik", "Energi Potensial", "Energi Kinetik", "Energi Panas"], ans: 2 },
    { q: "Usaha bernilai nol jika gaya yang diberikan ternyata...", hint: "Tembok didorong tapi...", opts: ["Besar sekali", "Sangat kecil", "Mendorong ke atas", "Tidak memindahkan benda"], ans: 3 },
    { q: "Energi potensial elastis timbul ketika sebuah pegas atau karet...", hint: "Bentuk diubah sementara", opts: ["Dipanaskan", "Ditarik atau ditekan", "Diputar", "Didinginkan"], ans: 1 },
    { q: "Besarnya energi kinetik suatu benda berbanding lurus dengan...", hint: "Ek = 1/2 m v²", opts: ["Tinggi dan gravitasi", "Gaya dan perpindahan", "Massa dan kuadrat kecepatan", "Waktu tempuh"], ans: 2 },
    { q: "Daya (Power) adalah besarnya usaha yang dilakukan setiap satuan...", hint: "P = W / t", opts: ["Jarak", "Waktu", "Massa", "Kecepatan"], ans: 1 },
    { q: "Satuan daya dalam Sistem Internasional (SI) adalah...", hint: "Sama dengan satuan pada lampu bohlam", opts: ["Watt", "Joule", "Newton", "Volt"], ans: 0 },
    { q: "Truk dengan kelajuan 20 m/s memiliki energi kinetik lebih besar dari motor di kelajuan yang sama, karena...", hint: "Rumus Ek = 1/2 m v²", opts: ["Truk lebih panjang", "Massa truk lebih besar", "Mesin truk lebih panas", "Motor lebih ringan"], ans: 1 },
    { q: "Energi yang tersimpan pada benda yang diletakkan pada suatu ketinggian tertentu disebut...", hint: "Karena pengaruh gravitasi", opts: ["Energi Kinetik", "Energi Listrik", "Energi Potensial Gravitasi", "Energi Mekanik"], ans: 2 },

    // Kekekalan Energi (12 Soal)
    { q: "Hukum kekekalan energi menyatakan bahwa energi tidak dapat...", hint: "Hanya dapat diubah bentuknya", opts: ["Ditransfer", "Dimusnahkan dan Diciptakan", "Diukur", "Disimpan"], ans: 1 },
    { q: "Saat bola jatuh dari ketinggian, energi potensialnya sebagian besar berubah menjadi...", hint: "Semakin cepat saat jatuh", opts: ["Energi Kalor", "Energi Listrik", "Energi Kinetik", "Energi Pegas"], ans: 2 },
    { q: "Jumlah total Energi Kinetik dan Energi Potensial pada suatu benda disebut...", hint: "Em = Ep + Ek", opts: ["Energi Listrik", "Energi Termal", "Energi Mekanik", "Energi Kimia"], ans: 2 },
    { q: "Ketika kelapa jatuh dan membentur tanah keras, sebagian besar energi mekaniknya akan berubah menjadi...", hint: "Terdengar dan terasa", opts: ["Energi Kinetik", "Energi Kalor dan Bunyi", "Energi Cahaya", "Energi Magnet"], ans: 1 },
    { q: "Alat yang berfungsi mengubah energi gerak (kinetik) menjadi energi listrik adalah...", hint: "Di Pembangkit Listrik", opts: ["Baterai", "Lampu", "Motor Listrik", "Generator"], ans: 3 },
    { q: "Pada setrika listrik, perubahan energi yang terjadi adalah dari energi listrik menjadi energi...", hint: "Bikin baju rapi", opts: ["Bunyi", "Cahaya", "Panas (Kalor)", "Kinetik"], ans: 2 },
    { q: "Pada proses fotosintesis, tumbuhan mengubah energi cahaya matahari menjadi energi...", hint: "Tersimpan dalam bentuk karbohidrat", opts: ["Kinetik", "Potensial", "Listrik", "Kimia"], ans: 3 },
    { q: "Lampu LED di rumah kita mengubah energi listrik menjadi energi...", hint: "Tujuan utama lampu", opts: ["Cahaya", "Bunyi", "Gerak", "Kimia"], ans: 0 },
    { q: "Saat anak panah dilesatkan dari busurnya, energi potensial pegas dari busur berubah menjadi...", hint: "Panah melesat", opts: ["Energi Listrik", "Energi Kinetik anak panah", "Energi Kimia", "Energi Kalor"], ans: 1 },
    { q: "Pada sebuah ayunan (bandul), energi kinetiknya mencapai nilai maksimum saat berada di...", hint: "Kecepatan tertinggi", opts: ["Titik tertinggi", "Sisi kanan", "Sisi kiri", "Titik terendah (setimbang)"], ans: 3 },
    { q: "Pada Pembangkit Listrik Tenaga Air (PLTA), air yang berada di bendungan tinggi memiliki energi...", hint: "Airnya di ketinggian", opts: ["Energi Kimia", "Energi Listrik", "Energi Potensial Gravitasi", "Energi Nuklir"], ans: 2 },
    { q: "Energi mekanik sebuah kelapa yang jatuh bebas tanpa adanya gesekan udara adalah...", hint: "Em = Konstan", opts: ["Selalu Bertambah", "Tetap/Konstan di setiap titik", "Berkurang perlahan", "Menjadi Nol"], ans: 1 }
];

const modal = document.getElementById('quiz-modal');
const qTitle = document.getElementById('q-title');
const qHint = document.getElementById('q-hint');
const qOpts = document.getElementById('q-opts');

function triggerQuiz() {
    isQuizOpen = true;
    engine.timing.timeScale = 0; // Pause game fisika
    
    // Acak kuis
    const quiz = quizBank[Math.floor(Math.random() * quizBank.length)];
    qTitle.textContent = quiz.q;
    qHint.textContent = `💡 Petunjuk: ${quiz.hint}`;
    
    qOpts.innerHTML = '';
    quiz.opts.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.onclick = () => answerQuiz(btn, i === quiz.ans);
        qOpts.appendChild(btn);
    });
    
    modal.style.display = 'flex';
}

function answerQuiz(btn, isCorrect) {
    // Matikan klik tombol lain
    const btns = qOpts.querySelectorAll('.opt-btn');
    btns.forEach(b => b.style.pointerEvents = 'none');
    
    if (isCorrect) {
        btn.classList.add('correct');
        energy = Math.min(MAX_ENERGY, energy + (MAX_ENERGY / 10)); // Butuh 10 jawaban benar untuk penuh
        collectedGems++;
        document.getElementById('gem-val').textContent = collectedGems;
        // Hapus baterai dari world jika dipicu lewat tabrakan
        if (currentBattery) {
            Composite.remove(engine.world, currentBattery);
        }
    } else {
        btn.classList.add('wrong');
        // Tidak dapat energi, baterai juga dihancurkan
        if (currentBattery) {
            Composite.remove(engine.world, currentBattery);
        }
    }

    setTimeout(() => {
        modal.style.display = 'none';
        isQuizOpen = false;
        engine.timing.timeScale = 1; // Resume Fisika
        currentBattery = null; 
    }, 1200);
}

// Mulai Game
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Handle window resize
window.addEventListener('resize', () => {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
    
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Perbaikan ukuran canvas saat fullscreen (menjaga pixel ratio dan set CSS style secara eksplisit)
    render.canvas.width = SCREEN_WIDTH * pixelRatio;
    render.canvas.height = SCREEN_HEIGHT * pixelRatio;
    render.canvas.style.width = SCREEN_WIDTH + 'px';
    render.canvas.style.height = SCREEN_HEIGHT + 'px';
    
    render.options.width = SCREEN_WIDTH;
    render.options.height = SCREEN_HEIGHT;
});

// Kontrol Touch Mobile
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');

if (btnLeft && btnRight && btnJump) {
    const handleTouch = (btn, keyName, isDown) => {
        return (e) => {
            if(e.cancelable) e.preventDefault(); // Mencegah perilaku default seperti scroll
            keys[keyName] = isDown;
            if (isDown) btn.classList.add('active');
            else btn.classList.remove('active');
            
            // Auto play music on first touch if not playing
            if (isDown && !isMusicPlaying) {
                bgMusic.play().catch(err => console.log(err));
                isMusicPlaying = true;
            }
        };
    };

    // Events (Touch & Mouse)
    ['touchstart', 'mousedown'].forEach(evt => {
        btnLeft.addEventListener(evt, handleTouch(btnLeft, 'a', true), {passive: false});
        btnRight.addEventListener(evt, handleTouch(btnRight, 'd', true), {passive: false});
        btnJump.addEventListener(evt, handleTouch(btnJump, 'w', true), {passive: false});
    });

    ['touchend', 'mouseup', 'mouseleave'].forEach(evt => {
        btnLeft.addEventListener(evt, handleTouch(btnLeft, 'a', false), {passive: false});
        btnRight.addEventListener(evt, handleTouch(btnRight, 'd', false), {passive: false});
        btnJump.addEventListener(evt, handleTouch(btnJump, 'w', false), {passive: false});
    });
}

// Kontrol State Game
window.startGame = function() {
    document.getElementById('start-overlay').style.display = 'none';
    gameState = 'playing';
};

window.togglePause = function() {
    if (gameState === 'playing') {
        gameState = 'paused';
        engine.timing.timeScale = 0;
        document.getElementById('pause-overlay').style.display = 'flex';
    } else if (gameState === 'paused') {
        gameState = 'playing';
        engine.timing.timeScale = 1;
        document.getElementById('pause-overlay').style.display = 'none';
    }
};

window.toggleSound = function() {
    isSoundMuted = !isSoundMuted;
    bgMusic.muted = isSoundMuted;
    fallSound.muted = isSoundMuted;
    
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
        if (isSoundMuted) {
            soundBtn.textContent = 'SOUND: OFF 🔇 (M)';
            soundBtn.style.background = '#9e9e9e';
        } else {
            soundBtn.textContent = 'SOUND: ON 🔊 (M)';
            soundBtn.style.background = '#2196F3';
        }
    }
};
