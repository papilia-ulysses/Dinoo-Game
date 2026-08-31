const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // keep the pixel art crisp when scaled

const GROUND_Y = 250;

// ====================
// PALETTE (for UI bits still drawn with code, e.g. text)
// ====================
const PALETTE = {
    ink: "#3C152E",
    burgundy: "#792142",
    mauve: "#A73354",
    roseDark: "#C83D60",
    magenta: "#DC2E78",
    rose: "#EF4A71",
    pink: "#ED9AA7",
    pinkLite: "#F1B0B9",
    white: "#FFFFFF"
};

// ====================
// ASSET LOADING
// ====================
const ASSET_PATH = "assets/";
const ASSET_FILES = {
    dinoIdle: "dino_idle_1.png",
    dinoRun1: "dino_run_1.png",
    dinoRun2: "dino_run_2.png",
    dinoJump: "dino_jump.png",
    dinoDuck: "dino_duck_1.png",
    dinoHurt: "dino_hurt.png",
    cactus1: "cactus_1.png",
    cactus2: "cactus_2.png",
    ptero1: "ptero_1.png",
    ptero2: "ptero_2.png",
    heart: "heart.png",
    cloud: "cloud.png",
    rock: "rock.png"
};

const images = {};
let assetsLoaded = 0;
const assetKeys = Object.keys(ASSET_FILES);

function loadAssets(onDone) {
    assetKeys.forEach((key) => {
        const img = new Image();
        img.onload = () => {
            assetsLoaded++;
            if (assetsLoaded === assetKeys.length) onDone();
        };
        img.onerror = () => {
            console.error("Failed to load asset:", ASSET_FILES[key]);
            assetsLoaded++;
            if (assetsLoaded === assetKeys.length) onDone();
        };
        img.src = ASSET_PATH + ASSET_FILES[key];
        images[key] = img;
    });
}

// Draws an image at a target height, preserving its native aspect ratio.
// anchorBottom keeps the sprite's feet aligned to a fixed ground y.
function drawSpriteImg(img, x, targetHeight, anchorBottomY) {
    if (!img || !img.naturalWidth) return { width: 0, height: 0 };
    const ratio = img.naturalWidth / img.naturalHeight;
    const w = targetHeight * ratio;
    const y = anchorBottomY - targetHeight;
    ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(targetHeight));
    return { width: w, height: targetHeight, y: y };
}

// ====================
// DINO (player)
// ====================
const DINO_X = 70;
const DINO_STAND_H = 78;
const DINO_DUCK_H = 46;

const dino = {
    x: DINO_X,
    velocityY: 0,
    jumping: false,
    ducking: false,
    invulnerable: 0,
    runTimer: 0,
    runFrame: 0,
    height: DINO_STAND_H,
    width: DINO_STAND_H, // updated once the first frame is measured
    yOffset: 0 // current vertical offset above the ground while jumping
};

function currentDinoImage() {
    if (dino.invulnerable > 0 && Math.floor(dino.invulnerable / 4) % 2 === 0) {
        return null; // flicker
    }
    if (dino.jumping) return images.dinoJump;
    if (dino.ducking) return images.dinoDuck;
    return dino.runFrame === 0 ? images.dinoRun1 : images.dinoRun2;
}

// ====================
// OBSTACLES
// ====================
let obstacles = [];
let distanceToNextObstacle = 0;
let gameSpeed = 3.0;
const BASE_SPEED = 3.0;
const gravity = 0.9;
const JUMP_VELOCITY = -16.5;

function spawnObstacle() {
    const roll = Math.random();

    if (roll < 0.65) {
        const img = Math.random() < 0.5 ? images.cactus1 : images.cactus2;
        const h = 45 + Math.random() * 30;
        obstacles.push({ type: "ground", img, x: canvas.width + 20, height: h });
    } else {
        const h = 40;
        // fly low (must duck) or high (must NOT jump into it) - keep it fair: always duckable
        const groundClearance = DINO_DUCK_H + 25 + Math.random() * 25;
        obstacles.push({
            type: "flying", x: canvas.width + 20, height: h,
            groundClearance, wingFrame: 0, wingTimer: 0
        });
    }

    distanceToNextObstacle = 260 + Math.random() * 220;
}

// ====================
// GAME STATE
// ====================
let lives = 3;
let score = 0;
let highScore = parseInt(localStorage.getItem("dinoGameHighScore") || "0", 10);
let state = "loading"; // "loading" | "start" | "playing" | "paused" | "gameover"
let groundScroll = 0;
let cloudScroll = 0;

// ====================
// INPUT
// ====================
function tryJump() {
    if (state === "playing" && !dino.jumping && !dino.ducking) {
        dino.velocityY = JUMP_VELOCITY;
        dino.jumping = true;
        playJumpSound();
    }
}

function startGame() {
    lives = 3;
    score = 0;
    obstacles = [];
    distanceToNextObstacle = 200;
    gameSpeed = BASE_SPEED;
    dino.velocityY = 0;
    dino.jumping = false;
    dino.ducking = false;
    dino.invulnerable = 0;
    state = "playing";
}

document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        if (state === "start" || state === "gameover") startGame();
        else if (state === "playing") tryJump();
        else if (state === "paused") state = "playing";
    }
    if (event.code === "ArrowDown") {
        if (state === "playing" && !dino.jumping) dino.ducking = true;
    }
    if (event.code === "KeyP") {
        if (state === "playing") state = "paused";
        else if (state === "paused") state = "playing";
    }
});
document.addEventListener("keyup", (event) => {
    if (event.code === "ArrowDown") dino.ducking = false;
});

canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    if (state === "start" || state === "gameover") startGame();
    else if (state === "playing") tryJump();
    else if (state === "paused") state = "playing";
});
canvas.addEventListener("mousedown", () => {
    if (state === "start" || state === "gameover") startGame();
    else if (state === "playing") tryJump();
});

// ---- on-screen mobile buttons ----
const btnJump = document.getElementById("btnJump");
const btnDuck = document.getElementById("btnDuck");
const btnFullscreen = document.getElementById("btnFullscreen");

function handleJumpPress(event) {
    event.preventDefault();
    if (state === "start" || state === "gameover") startGame();
    else if (state === "playing") tryJump();
    else if (state === "paused") state = "playing";
}

if (btnJump) {
    btnJump.addEventListener("touchstart", handleJumpPress);
    btnJump.addEventListener("mousedown", handleJumpPress);
}

if (btnDuck) {
    const startDuck = (event) => {
        event.preventDefault();
        if (state === "playing" && !dino.jumping) dino.ducking = true;
    };
    const endDuck = (event) => {
        event.preventDefault();
        dino.ducking = false;
    };
    btnDuck.addEventListener("touchstart", startDuck);
    btnDuck.addEventListener("touchend", endDuck);
    btnDuck.addEventListener("touchcancel", endDuck);
    btnDuck.addEventListener("mousedown", startDuck);
    btnDuck.addEventListener("mouseup", endDuck);
    btnDuck.addEventListener("mouseleave", endDuck);
}

if (btnFullscreen) {
    const toggleFullscreen = (event) => {
        event.preventDefault();
        const container = document.documentElement;
        if (!document.fullscreenElement) {
            (container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen)
                .call(container);
        } else {
            (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)
                .call(document);
        }
    };
    btnFullscreen.addEventListener("touchstart", toggleFullscreen);
    btnFullscreen.addEventListener("click", toggleFullscreen);
}

// ====================
// AUDIO (generated, no external files)
// ====================
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}
function beep(freq, duration, type = "square", volume = 0.08) {
    try {
        const ac = getAudioCtx();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        osc.stop(ac.currentTime + duration);
    } catch (e) { /* audio blocked before first interaction - ignore */ }
}
function playJumpSound() { beep(500, 0.12, "square", 0.06); }
function playHitSound() { beep(120, 0.25, "sawtooth", 0.1); }
function playScoreSound() { beep(880, 0.15, "sine", 0.05); }
function playGameOverSound() { beep(200, 0.5, "sawtooth", 0.1); }

// ====================
// UPDATE
// ====================
function update() {
    cloudScroll -= 0.3;
    if (cloudScroll <= -canvas.width) cloudScroll = 0;

    if (state !== "playing") return;

    // Gravity
    dino.velocityY += gravity;
    dino.yOffset += dino.velocityY;
    if (dino.yOffset >= 0) {
        dino.yOffset = 0;
        dino.velocityY = 0;
        dino.jumping = false;
    }

    dino.height = dino.ducking && !dino.jumping ? DINO_DUCK_H : DINO_STAND_H;

    // Run animation
    dino.runTimer++;
    if (dino.runTimer > 6) {
        dino.runTimer = 0;
        dino.runFrame = 1 - dino.runFrame;
    }

    groundScroll -= gameSpeed;
    if (groundScroll <= -40) groundScroll = 0;

    if (dino.invulnerable > 0) dino.invulnerable--;

    distanceToNextObstacle -= gameSpeed;
    if (distanceToNextObstacle <= 0) spawnObstacle();

    const dinoBottom = GROUND_Y + dino.yOffset;
    const dinoTop = dinoBottom - dino.height;
    const dinoLeft = dino.x;
    const dinoRight = dino.x + dino.width;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= gameSpeed;

        if (o.type === "flying") {
            o.wingTimer++;
            if (o.wingTimer > 6) { o.wingTimer = 0; o.wingFrame = 1 - o.wingFrame; }
        }

        // estimate obstacle width from a reference aspect once its image is known
        const img = o.type === "ground" ? o.img : (o.wingFrame === 0 ? images.ptero1 : images.ptero2);
        const ratio = img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1;
        o.width = o.height * ratio;

        if (o.x + o.width < -20) { obstacles.splice(i, 1); continue; }

        const oBottom = o.type === "ground" ? GROUND_Y : GROUND_Y - o.groundClearance + o.height;
        const oTop = oBottom - o.height;

        if (dino.invulnerable === 0) {
            const hit =
                dinoLeft < o.x + o.width * 0.8 &&
                dinoRight > o.x + o.width * 0.2 &&
                dinoTop < oBottom - o.height * 0.15 &&
                dinoBottom > oTop + o.height * 0.15;

            if (hit) {
                lives--;
                dino.invulnerable = 60;
                playHitSound();
                if (lives <= 0) {
                    state = "gameover";
                    playGameOverSound();
                    const finalScore = Math.floor(score / 10);
                    if (finalScore > highScore) {
                        highScore = finalScore;
                        localStorage.setItem("dinoGameHighScore", highScore);
                    }
                }
            }
        }
    }

    score++;
    if (score % 100 === 0) playScoreSound();

    const s = Math.floor(score / 10);
    gameSpeed = BASE_SPEED + Math.min(s / 50, 4);
}

// ====================
// DRAW
// ====================
function drawBackground() {
    ctx.fillStyle = PALETTE.pinkLite;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sun
    ctx.fillStyle = PALETTE.rose;
    ctx.beginPath();
    ctx.arc(canvas.width - 70, 55, 30, 0, Math.PI * 2);
    ctx.fill();

    // Clouds (parallax)
    for (const dx of [80, 340, 600, 860]) {
        const x = ((dx + cloudScroll) % (canvas.width + 300)) - 150;
        ctx.drawImage(images.cloud, x, 30 + (dx % 3) * 15, 90, 38);
    }

    // Ground strip
    ctx.fillStyle = PALETTE.burgundy;
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, GROUND_Y, canvas.width, 2);

    // Scrolling ground texture
    ctx.fillStyle = PALETTE.mauve;
    for (let x = groundScroll; x < canvas.width; x += 40) {
        ctx.fillRect(x, GROUND_Y + 10, 20, 3);
        ctx.fillRect(x + 10, GROUND_Y + 24, 16, 3);
    }
}

function drawDino() {
    const img = currentDinoImage();
    if (!img) return; // hit-flicker frame
    const bottomY = GROUND_Y + dino.yOffset;
    const info = drawSpriteImg(img, dino.x, dino.height, bottomY);
    dino.width = info.width;
}

function drawObstacles() {
    for (const o of obstacles) {
        if (o.type === "ground") {
            drawSpriteImg(o.img, o.x, o.height, GROUND_Y);
        } else {
            const img = o.wingFrame === 0 ? images.ptero1 : images.ptero2;
            drawSpriteImg(img, o.x, o.height, GROUND_Y - o.groundClearance + o.height);
        }
    }
}

function drawHUD() {
    for (let i = 0; i < lives; i++) {
        ctx.drawImage(images.heart, 16 + i * 34, 14, 28, 24);
    }

    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "right";
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillText(String(Math.floor(score / 10)).padStart(5, "0"), canvas.width - 20, 32);
    ctx.font = "12px 'Courier New', monospace";
    ctx.fillText("HI " + String(highScore).padStart(5, "0"), canvas.width - 20, 50);
}

function drawOverlay() {
    ctx.textAlign = "center";
    ctx.fillStyle = PALETTE.ink;

    if (state === "loading") {
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.fillText("Loading...", canvas.width / 2, canvas.height / 2);
    }

    if (state === "start") {
        ctx.font = "bold 34px 'Courier New', monospace";
        ctx.fillText("DINO GAME", canvas.width / 2, 110);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("Press SPACE / tap to start", canvas.width / 2, 145);
        ctx.font = "13px 'Courier New', monospace";
        ctx.fillText("\u2191 jump   \u2193 duck   P pause", canvas.width / 2, 170);
    }

    if (state === "paused") {
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.fillText("PAUSED", canvas.width / 2, 140);
        ctx.font = "14px 'Courier New', monospace";
        ctx.fillText("Press P to resume", canvas.width / 2, 168);
    }

    if (state === "gameover") {
        ctx.font = "bold 32px 'Courier New', monospace";
        ctx.fillText("GAME OVER", canvas.width / 2, 105);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillText("Score " + Math.floor(score / 10) + "   Best " + highScore, canvas.width / 2, 138);
        ctx.font = "13px 'Courier New', monospace";
        ctx.fillText("Press SPACE / tap to retry", canvas.width / 2, 165);
    }
}

function draw() {
    drawBackground();
    drawObstacles();
    drawDino();
    drawHUD();
    drawOverlay();
}

// ====================
// GAME LOOP
// ====================
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

loadAssets(() => {
    state = "start";
});

gameLoop();
