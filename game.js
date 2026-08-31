const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const GROUND_Y = 270;

// ====================
// AUDIO (no external files, generated with Web Audio API)
// ====================
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
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
    } catch (e) {
        // Audio not available (autoplay restrictions before first interaction) - ignore
    }
}
function playJumpSound() { beep(500, 0.12, "square", 0.06); }
function playHitSound() { beep(120, 0.25, "sawtooth", 0.1); }
function playScoreSound() { beep(880, 0.15, "sine", 0.05); }
function playGameOverSound() { beep(200, 0.5, "sawtooth", 0.1); }

// ====================
// LAMA (player)
// ====================
const lama = {
    x: 50,
    y: 220,
    width: 40,
    height: 50,
    standHeight: 50,
    duckHeight: 28,
    velocityY: 0,
    jumping: false,
    ducking: false,
    invulnerable: 0,      // frames of invulnerability remaining after a hit
    legFrame: 0,          // for run animation
    legTimer: 0
};

// ====================
// OBSTACLES (array instead of a single reused cactus)
// ====================
let obstacles = [];
let distanceToNextObstacle = 0;
let gameSpeed = 2.5;
const BASE_SPEED = 2.5;
const gravity = 0.8;

function spawnObstacle() {
    const type = Math.random() < 0.7 ? "cactus" : "bird";

    if (type === "cactus") {
        const height = 30 + Math.random() * 30; // 30 - 60
        obstacles.push({
            type: "cactus",
            x: canvas.width + 20,
            y: GROUND_Y - height,
            width: 18 + Math.random() * 14,
            height: height
        });
    } else {
        // Bird flies at a height the player must duck under
        obstacles.push({
            type: "bird",
            x: canvas.width + 20,
            y: GROUND_Y - 65 - Math.random() * 20,
            width: 34,
            height: 24,
            wingFrame: 0,
            wingTimer: 0
        });
    }

    // Next spawn distance shrinks slightly as game speeds up, but stays randomized
    distanceToNextObstacle = 260 + Math.random() * 220;
}

// ====================
// GAME STATE
// ====================
let lives = 3;
let score = 0;
let highScore = parseInt(localStorage.getItem("lamaGameHighScore") || "0", 10);
let state = "start"; // "start" | "playing" | "paused" | "gameover"
let frame = 0;
let groundOffset = 0;

// ====================
// INPUT HANDLING
// ====================
function tryJump() {
    if (state === "playing" && !lama.jumping && !lama.ducking) {
        lama.velocityY = -15;
        lama.jumping = true;
        playJumpSound();
    }
}

function startGame() {
    lives = 3;
    score = 0;
    obstacles = [];
    distanceToNextObstacle = 200;
    gameSpeed = BASE_SPEED;
    lama.x = 50;
    lama.y = 220;
    lama.velocityY = 0;
    lama.jumping = false;
    lama.ducking = false;
    lama.invulnerable = 0;
    state = "playing";
}

document.addEventListener("keydown", function (event) {
    if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        if (state === "start") {
            startGame();
        } else if (state === "gameover") {
            startGame();
        } else if (state === "playing") {
            tryJump();
        } else if (state === "paused") {
            state = "playing";
        }
    }

    if (event.code === "ArrowDown") {
        if (state === "playing" && !lama.jumping) {
            lama.ducking = true;
        }
    }

    if (event.code === "KeyP") {
        if (state === "playing") state = "paused";
        else if (state === "paused") state = "playing";
    }
});

document.addEventListener("keyup", function (event) {
    if (event.code === "ArrowDown") {
        lama.ducking = false;
    }
});

// Touch / mobile support: tap anywhere on canvas to jump / start / restart
canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();
    if (state === "start" || state === "gameover") {
        startGame();
    } else if (state === "playing") {
        tryJump();
    } else if (state === "paused") {
        state = "playing";
    }
});
canvas.addEventListener("mousedown", function () {
    if (state === "start" || state === "gameover") {
        startGame();
    } else if (state === "playing") {
        tryJump();
    }
});

// ====================
// UPDATE
// ====================
function update() {
    if (state !== "playing") return;

    frame++;

    // Gravity / jump
    lama.velocityY += gravity;
    lama.y += lama.velocityY;
    if (lama.y >= 220) {
        lama.y = 220;
        lama.velocityY = 0;
        lama.jumping = false;
    }

    // Duck hitbox adjustment (keep feet on the ground while ducking)
    if (lama.ducking && !lama.jumping) {
        lama.height = lama.duckHeight;
        lama.y = 220 + (lama.standHeight - lama.duckHeight);
    } else {
        lama.height = lama.standHeight;
        if (!lama.jumping) lama.y = 220;
    }

    // Run animation timer
    lama.legTimer++;
    if (lama.legTimer > 6) {
        lama.legTimer = 0;
        lama.legFrame = 1 - lama.legFrame;
    }

    // Ground scroll (visual)
    groundOffset -= gameSpeed;
    if (groundOffset <= -40) groundOffset = 0;

    // Invulnerability countdown
    if (lama.invulnerable > 0) lama.invulnerable--;

    // Spawn obstacles
    distanceToNextObstacle -= gameSpeed;
    if (distanceToNextObstacle <= 0) {
        spawnObstacle();
    }

    // Move + clean up obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= gameSpeed;

        if (o.type === "bird") {
            o.wingTimer++;
            if (o.wingTimer > 10) {
                o.wingTimer = 0;
                o.wingFrame = 1 - o.wingFrame;
            }
        }

        if (o.x + o.width < -20) {
            obstacles.splice(i, 1);
            continue;
        }

        // Collision detection (only if not currently invulnerable)
        if (lama.invulnerable === 0) {
            const hit =
                lama.x < o.x + o.width &&
                lama.x + lama.width > o.x &&
                lama.y < o.y + o.height &&
                lama.y + lama.height > o.y;

            if (hit) {
                lives--;
                lama.invulnerable = 60; // ~1 second of flashing invulnerability
                playHitSound();

                if (lives <= 0) {
                    state = "gameover";
                    playGameOverSound();
                    if (score > highScore) {
                        highScore = Math.floor(score / 10);
                        localStorage.setItem("lamaGameHighScore", highScore);
                    }
                }
            }
        }
    }

    // Score
    score++;
    if (score % 100 === 0) playScoreSound();

    // Smooth-ish difficulty scaling instead of hard steps
    const s = Math.floor(score / 10);
    gameSpeed = BASE_SPEED + Math.min(s / 40, 3.5); // caps around 6.0
}

// ====================
// DRAW
// ====================
function drawBackground() {
    // Sky
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sun
    ctx.fillStyle = "#ddd";
    ctx.beginPath();
    ctx.arc(720, 50, 25, 0, Math.PI * 2);
    ctx.fill();

    // Ground line
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();

    // Scrolling ground dashes (parallax feel)
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    for (let x = groundOffset; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 6);
        ctx.lineTo(x + 20, GROUND_Y + 6);
        ctx.stroke();
    }
}

function drawLama() {
    // Flicker while invulnerable
    if (lama.invulnerable > 0 && Math.floor(lama.invulnerable / 4) % 2 === 0) {
        return;
    }

    ctx.fillStyle = "black";
    ctx.fillRect(lama.x, lama.y, lama.width, lama.height);

    // Simple running legs (only when on ground and not ducking)
    if (!lama.jumping) {
        ctx.fillStyle = "black";
        if (lama.legFrame === 0) {
            ctx.fillRect(lama.x + 5, lama.y + lama.height, 8, 8);
            ctx.fillRect(lama.x + lama.width - 13, lama.y + lama.height, 8, 4);
        } else {
            ctx.fillRect(lama.x + 5, lama.y + lama.height, 8, 4);
            ctx.fillRect(lama.x + lama.width - 13, lama.y + lama.height, 8, 8);
        }
    }
}

function drawObstacles() {
    ctx.fillStyle = "black";
    for (const o of obstacles) {
        if (o.type === "cactus") {
            ctx.fillRect(o.x, o.y, o.width, o.height);
        } else {
            // Bird: body + flapping wings
            ctx.fillRect(o.x + 8, o.y + 8, o.width - 16, o.height - 12);
            if (o.wingFrame === 0) {
                ctx.fillRect(o.x, o.y, 12, 6);
                ctx.fillRect(o.x + o.width - 12, o.y, 12, 6);
            } else {
                ctx.fillRect(o.x, o.y + 10, 12, 6);
                ctx.fillRect(o.x + o.width - 12, o.y + 10, 12, 6);
            }
        }
    }
}

function drawHUD() {
    ctx.fillStyle = "black";
    ctx.font = "20px Arial";

    ctx.textAlign = "left";
    ctx.fillText("Lives: " + lives, 20, 30);

    ctx.textAlign = "right";
    ctx.fillText("Score: " + Math.floor(score / 10), canvas.width - 20, 30);
    ctx.font = "14px Arial";
    ctx.fillText("Best: " + highScore, canvas.width - 20, 50);
}

function drawOverlay() {
    ctx.textAlign = "center";

    if (state === "start") {
        ctx.font = "32px Arial";
        ctx.fillText("LAMA GAME", canvas.width / 2, 110);
        ctx.font = "18px Arial";
        ctx.fillText("Press SPACE / tap to start", canvas.width / 2, 150);
        ctx.font = "14px Arial";
        ctx.fillText("↑ / Space: jump   ↓: duck under birds   P: pause", canvas.width / 2, 180);
    }

    if (state === "paused") {
        ctx.font = "32px Arial";
        ctx.fillText("PAUSED", canvas.width / 2, 150);
        ctx.font = "16px Arial";
        ctx.fillText("Press P to resume", canvas.width / 2, 180);
    }

    if (state === "gameover") {
        ctx.font = "40px Arial";
        ctx.fillText("GAME OVER", canvas.width / 2, 110);
        ctx.font = "20px Arial";
        ctx.fillText("Score: " + Math.floor(score / 10) + "   Best: " + highScore, canvas.width / 2, 150);
        ctx.font = "16px Arial";
        ctx.fillText("Press SPACE / tap to restart", canvas.width / 2, 180);
    }
}

function draw() {
    drawBackground();
    drawLama();
    drawObstacles();
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

gameLoop();