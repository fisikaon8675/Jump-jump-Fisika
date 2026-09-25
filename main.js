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
    { q: "Besaran pokok untuk mengukur panjang adalah...", hint: "Standar internasional", opts: ["Kilogram", "Meter", "Sekon", "Kelvin"], ans: 1 },
    { q: "Massa suatu benda 5 kg, jika g=10 m/s², berapakah beratnya?", hint: "W = m * g", opts: ["50 N", "5 N", "15 N", "0.5 N"], ans: 0 },
    { q: "Hukum I Newton sering disebut juga sebagai Hukum...", hint: "Kecenderungan mempertahankan keadaan", opts: ["Aksi-Reaksi", "Kelembaman/Inersia", "Gravitasi", "Kekekalan Energi"], ans: 1 },
    { q: "Gaya yang muncul ketika dua permukaan saling bersentuhan dan bergesekan disebut...", hint: "Arahnya berlawanan dengan gerak", opts: ["Gaya Normal", "Gaya Gesek", "Gaya Pegas", "Gaya Sentripetal"], ans: 1 },
    { q: "Perpindahan dibagi dengan waktu tempuh disebut...", hint: "Vektor, memiliki arah", opts: ["Kelajuan", "Percepatan", "Kecepatan", "Jarak"], ans: 2 },
    { q: "Rumus energi potensial gravitasi adalah...", hint: "Terkait massa, gravitasi, ketinggian", opts: ["m * g", "1/2 * m * v²", "m * g * h", "F * s"], ans: 2 },
    { q: "Alat untuk mengukur kuat arus listrik adalah...", hint: "Memiliki satuan Ampere", opts: ["Voltmeter", "Amperemeter", "Ohmmeter", "Termometer"], ans: 1 },
    { q: "Satuan energi dalam Sistem Internasional (SI) adalah...", hint: "Juga untuk usaha", opts: ["Newton", "Watt", "Pascal", "Joule"], ans: 3 },
    { q: "Peristiwa pembelokan cahaya saat melewati dua medium yang berbeda kerapatannya disebut...", hint: "Refraksi", opts: ["Pemantulan", "Pembiasan", "Difraksi", "Interferensi"], ans: 1 },
    { q: "Jika gaya 20 N memindahkan benda sejauh 2 m searah gaya, usaha yang dilakukan...", hint: "W = F * s", opts: ["10 J", "22 J", "40 J", "0 J"], ans: 2 },
    { q: "Energi kinetik benda bermassa 2 kg yang bergerak dengan kelajuan 3 m/s adalah...", hint: "Ek = 1/2 m v²", opts: ["3 J", "6 J", "9 J", "18 J"], ans: 2 },
    { q: "Hukum Bernoulli berkaitan dengan konsep fluida yang...", hint: "Udara pada sayap pesawat", opts: ["Diam (Statis)", "Bergerak (Dinamis)", "Bertekanan Tinggi", "Membeku"], ans: 1 },
    { q: "Perubahan wujud zat dari padat langsung menjadi gas disebut...", hint: "Contoh: kapur barus", opts: ["Mencair", "Menyublim", "Mengkristal", "Menguap"], ans: 1 },
    { q: "Gaya tolak-menolak terjadi jika dua muatan listrik...", hint: "Interaksi muatan", opts: ["Berbeda jenis", "Sejenis", "Netral", "Tidak bermuatan"], ans: 1 },
    { q: "Hambatan listrik disimbolkan dengan huruf...", hint: "Resistance", opts: ["I", "V", "R", "P"], ans: 2 },
    { q: "Frekuensi getaran didefinisikan sebagai...", hint: "Satuan Hertz (Hz)", opts: ["Waktu untuk satu getaran", "Banyaknya getaran tiap detik", "Simpangan terjauh", "Jarak getaran"], ans: 1 },
    { q: "Lensa yang bentuknya bagian tengah lebih tebal daripada bagian tepinya adalah...", hint: "Kaca pembesar (lup)", opts: ["Lensa Cembung", "Lensa Cekung", "Lensa Datar", "Lensa Silindris"], ans: 0 },
    { q: "Satuan untuk tegangan listrik adalah...", hint: "Alessandro...", opts: ["Ampere", "Ohm", "Volt", "Watt"], ans: 2 },
    { q: "Hukum Ohm dinyatakan dengan persamaan...", hint: "Hubungan tegangan, arus, hambatan", opts: ["V = I/R", "I = V * R", "V = I * R", "R = V * I"], ans: 2 },
    { q: "Titik didih air pada tekanan 1 atmosfer dalam skala Celcius adalah...", hint: "Suhu saat air mendidih", opts: ["0°C", "50°C", "100°C", "212°C"], ans: 2 },
    { q: "Gelombang suara termasuk jenis gelombang...", hint: "Membutuhkan medium", opts: ["Elektromagnetik", "Transversal", "Longitudinal", "Stasioner"], ans: 2 },
    { q: "Benda langit yang memancarkan cahaya sendiri disebut...", hint: "Matahari adalah contohnya", opts: ["Planet", "Bintang", "Satelit", "Komet"], ans: 1 },
    { q: "Kecepatan cahaya di ruang hampa adalah sekitar...", hint: "c", opts: ["300.000 km/s", "30.000 km/s", "3.000 km/s", "300 km/s"], ans: 0 },
    { q: "Gaya yang bekerja pada suatu luasan tertentu disebut...", hint: "P = F/A", opts: ["Usaha", "Tekanan", "Daya", "Momentum"], ans: 1 },
    { q: "Bunyi pantul yang terdengar setelah bunyi asli selesai diucapkan disebut...", hint: "Sering terjadi di tebing", opts: ["Gaung", "Gema", "Kerdam", "Desah"], ans: 1 },
    { q: "Alat yang berfungsi untuk mengubah energi kinetik/mekanik menjadi energi listrik adalah...", hint: "Di PLTA", opts: ["Motor Listrik", "Transformator", "Generator", "Baterai"], ans: 2 },
    { q: "Planet terbesar di Tata Surya kita adalah...", hint: "Raksasa gas", opts: ["Bumi", "Mars", "Jupiter", "Saturnus"], ans: 2 },
    { q: "Besaran yang merupakan perkalian antara massa dan kecepatan benda adalah...", hint: "p = m * v", opts: ["Impuls", "Gaya", "Energi", "Momentum"], ans: 3 },
    { q: "Perpindahan kalor tanpa melalui zat perantara disebut...", hint: "Panas matahari ke bumi", opts: ["Konduksi", "Konveksi", "Radiasi", "Isolasi"], ans: 2 },
    { q: "Gaya sentripetal selalu mengarah ke...", hint: "Gerak melingkar", opts: ["Luar lintasan", "Pusat lingkaran", "Arah gerak", "Atas"], ans: 1 },
    { q: "Benda yang tidak dapat ditembus cahaya disebut benda...", hint: "Lawan dari transparan", opts: ["Bening", "Gelap/Opaque", "Translusens", "Tembus pandang"], ans: 1 },
    { q: "Alat optik yang digunakan kapal selam untuk melihat permukaan laut adalah...", hint: "Memakai cermin", opts: ["Teleskop", "Mikroskop", "Periskop", "Kamera"], ans: 2 },
    { q: "Inti atom terdiri dari...", hint: "Partikel subatomik", opts: ["Elektron dan Proton", "Proton dan Neutron", "Elektron dan Neutron", "Hanya Proton"], ans: 1 },
    { q: "Daya listrik 100 Watt yang dinyalakan selama 10 jam menggunakan energi sebesar...", hint: "E = P * t (dalam kWh)", opts: ["1 kWh", "10 kWh", "100 kWh", "1000 kWh"], ans: 0 },
    { q: "Bahan yang sangat mudah menghantarkan arus listrik disebut...", hint: "Tembaga, Emas", opts: ["Isolator", "Semikonduktor", "Konduktor", "Superkonduktor"], ans: 2 },
    { q: "Tekanan hidrostatis dipengaruhi oleh...", hint: "P = ρ * g * h", opts: ["Massa jenis, gravitasi, kedalaman", "Volume dan luas", "Kecepatan aliran", "Suhu air"], ans: 0 },
    { q: "Bunyi tidak dapat merambat di ruang...", hint: "Astronot di luar angkasa", opts: ["Udara", "Air", "Padat", "Hampa/Vakum"], ans: 3 },
    { q: "Kemampuan lensa untuk memusatkan atau menyebarkan cahaya disebut...", hint: "P = 1/f", opts: ["Fokus", "Kekuatan Lensa", "Perbesaran", "Jarak benda"], ans: 1 },
    { q: "Cahaya putih matahari yang melewati prisma akan terurai menjadi pelangi. Peristiwa ini disebut...", hint: "Dispersi", opts: ["Difraksi", "Interferensi", "Polarisasi", "Dispersi"], ans: 3 },
    { q: "Hukum kekekalan energi menyatakan bahwa energi tidak dapat...", hint: "Hanya dapat diubah bentuknya", opts: ["Ditransfer", "Dimusnahkan/Diciptakan", "Diukur", "Disimpan"], ans: 1 },
    { q: "Besaran vektor memiliki...", hint: "Berbeda dengan skalar", opts: ["Hanya Nilai", "Hanya Arah", "Nilai dan Arah", "Tidak keduanya"], ans: 2 },
    { q: "Gaya angkat pesawat terbang dapat dijelaskan menggunakan prinsip...", hint: "Perbedaan tekanan udara", opts: ["Archimedes", "Pascal", "Bernoulli", "Newton"], ans: 2 },
    { q: "Alat ukur suhu yang memiliki titik didih air 373 adalah skala...", hint: "Skala mutlak", opts: ["Celcius", "Reamur", "Fahrenheit", "Kelvin"], ans: 3 },
    { q: "Massa jenis (densitas) dirumuskan sebagai...", hint: "ρ = ...", opts: ["Volume / Massa", "Massa * Volume", "Massa / Volume", "Berat / Volume"], ans: 2 },
    { q: "Warna yang menyerap kalor paling baik/cepat adalah...", hint: "Pakaian saat panas", opts: ["Putih", "Hitam", "Kuning", "Hijau"], ans: 1 },
    { q: "Gelombang yang memiliki arah rambat tegak lurus dengan arah getarannya adalah...", hint: "Seperti gelombang tali", opts: ["Longitudinal", "Elektromagnetik", "Mekanik", "Transversal"], ans: 3 },
    { q: "Syarat terjadinya resonansi bunyi adalah kesamaan...", hint: "Ikut bergetar", opts: ["Amplitudo", "Frekuensi", "Kecepatan", "Fase"], ans: 1 },
    { q: "Alat yang berfungsi untuk mengubah atau menaik/turunkan tegangan listrik bolak-balik adalah...", hint: "Trafo", opts: ["Kapasitor", "Induktor", "Transformator", "Dioda"], ans: 2 },
    { q: "Batu yang dijatuhkan dari tebing tanpa kecepatan awal melakukan gerak...", hint: "GJB", opts: ["GLB", "GJB (Jatuh Bebas)", "GLBB Diperlambat", "Gerak Parabola"], ans: 1 },
    { q: "Hukum Archimedes berkaitan dengan gaya...", hint: "Benda mengapung", opts: ["Apung/Ke atas", "Gesek", "Berat", "Normal"], ans: 0 }
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
    render.canvas.width = SCREEN_WIDTH;
    render.canvas.height = SCREEN_HEIGHT;
    render.options.width = SCREEN_WIDTH;
    render.options.height = SCREEN_HEIGHT;
});

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
