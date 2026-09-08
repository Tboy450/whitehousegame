// Game Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game States
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

// Game Variables
let gameState = GAME_STATE.MENU;
let score = 0;
let highScore = localStorage.getItem('trumpElonHighScore') || 0;
let level = 1;
let gameSpeed = 2;
let spawnRate = 0.008;
let jumpPower = 12;

// Player (Trump or Elon) - stays on LEFT side
const player = {
    x: 50,
    y: canvas.height - 80,
    width: 35,
    height: 55,
    velocityY: 0,
    jumping: false,
    gravity: 0.5,
    groundY: canvas.height - 80,
    character: 'trump'
};

// Obstacles Array
let obstacles = [];

// Particle effects for arcade feel
let particles = [];

// Input Handling
let keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'ArrowUp') && gameState === GAME_STATE.PLAYING) {
        e.preventDefault();
        jump();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    gameState = GAME_STATE.PLAYING;
    score = 0;
    level = 1;
    gameSpeed = 5;
    spawnRate = 0.015;
    obstacles = [];
    particles = [];
    player.x = canvas.width / 2 - 15;
    player.y = player.groundY;
    player.velocityY = 0;
    player.jumping = false;
    animate();
}

function jump() {
    if (!player.jumping) {
        player.velocityY = -jumpPower;
        player.jumping = true;
        createParticles(player.x + player.width / 2, player.y + player.height, 'jump');
    }
}

function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    if (player.character === 'trump') {
        drawTrump(x, y, w, h);
    } else {
        drawElon(x, y, w, h);
    }
}

function drawTrump(x, y, w, h) {
    // Head (face)
    ctx.fillStyle = '#ffc966';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 10, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Iconic Trump hair
    ctx.fillStyle = '#d4a756';
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 3);
    ctx.quadraticCurveTo(x + w / 2, y - 8, x + w - 5, y + 3);
    ctx.lineTo(x + w - 5, y + 10);
    ctx.quadraticCurveTo(x + w / 2, y, x + 5, y + 10);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#0066cc';
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, y + 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 10, y + 8, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, y + 8, 1, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 16, 4, 0, Math.PI);
    ctx.stroke();
    
    // Body (suit)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 2, y + 24, w - 4, h - 24);
    
    // Tie
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + w / 2 - 2, y + 24, 4, 12);
    
    // Arms
    ctx.fillStyle = '#ffc966';
    ctx.fillRect(x - 5, y + 30, 5, 20);
    ctx.fillRect(x + w, y + 30, 5, 20);
}

function drawElon(x, y, w, h) {
    // Head (face)
    ctx.fillStyle = '#d9b8a3';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + 10, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair (dark, slicked back)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 1);
    ctx.quadraticCurveTo(x + w / 2, y - 5, x + w - 8, y + 1);
    ctx.lineTo(x + w - 8, y + 12);
    ctx.quadraticCurveTo(x + w / 2, y + 5, x + 8, y + 12);
    ctx.closePath();
    ctx.fill();
    
    // Eyes (intense gaze)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x + 10, y + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 30, y + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 11, y + 8, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 31, y + 8, 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Smirk
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 16, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
    
    // Body (shirt)
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(x + 2, y + 23, w - 4, h - 23);
    
    // Arms
    ctx.fillStyle = '#d9b8a3';
    ctx.fillRect(x - 5, y + 30, 5, 20);
    ctx.fillRect(x + w, y + 30, 5, 20);
}

// Obstacle Class
class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.type = type; // 'bird', 'box', 'cactus'
    }
    
    draw() {
        if (this.type === 'bird') {
            this.drawBird();
        } else if (this.type === 'box') {
            this.drawBox();
        } else {
            this.drawCactus();
        }
    }
    
    drawBird() {
        // Flying obstacle (like pterodactyl)
        ctx.fillStyle = '#333333';
        // Body
        ctx.fillRect(this.x + 5, this.y + 10, 20, 10);
        // Head
        ctx.beginPath();
        ctx.arc(this.x + 22, this.y + 12, 4, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillRect(this.x - 5, this.y + 12, 10, 3);
        ctx.fillRect(this.x + 20, this.y + 12, 10, 3);
    }
    
    drawBox() {
        // Crate/box obstacle
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Crate lines
        ctx.strokeStyle = '#5a4a0a';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width, this.y + this.height / 2);
        ctx.stroke();
    }
    
    drawCactus() {
        // Cactus obstacle
        ctx.fillStyle = '#00aa00';
        // Main stem
        ctx.fillRect(this.x + 10, this.y, 10, 30);
        // Side spikes
        ctx.fillRect(this.x + 5, this.y + 8, 5, 4);
        ctx.fillRect(this.x + 25, this.y + 12, 5, 4);
        ctx.fillRect(this.x + 5, this.y + 20, 5, 4);
        // Top
        ctx.fillRect(this.x + 8, this.y - 5, 14, 5);
    }
}

// Collision Detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Particle Effects
function createParticles(x, y, type) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 2 + 1,
            life: 30,
            maxLife: 30,
            color: type === 'jump' ? '#00d4ff' : '#ff6b6b'
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life--;
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
    });
}

// Spawn Obstacles
function spawnObstacle() {
    if (Math.random() < spawnRate) {
        const types = ['bird', 'box', 'cactus'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const y = player.groundY + 10;
        obstacles.push(new Obstacle(canvas.width, y, randomType));
    }
}

// Update Game Logic
function update() {
    if (gameState !== GAME_STATE.PLAYING) return;
    
    // Player movement
    player.velocityY += player.gravity;
    player.y += player.velocityY;
    
    // Ground collision
    if (player.y >= player.groundY) {
        player.y = player.groundY;
        player.jumping = false;
        player.velocityY = 0;
    }
    
    // Update obstacles - move LEFT toward player
    obstacles.forEach(obs => {
        obs.x -= gameSpeed;
        
        // Collision detection
        if (checkCollision(player, {
            x: obs.x - 5,
            y: obs.y - 5,
            width: obs.width + 10,
            height: obs.height + 10
        })) {
            endGame();
        }
    });
    
    // Remove off-screen obstacles and increment score
    obstacles = obstacles.filter(obs => {
        if (obs.x < -50) {
            score += 1;
            return false;
        }
        return true;
    });
    
    spawnObstacle();
    updateParticles();
    
    // Difficulty scaling - much slower
    if (score > 0 && score % 200 === 0 && level < 10) {
        level++;
        gameSpeed += 0.3;
        spawnRate += 0.001;
        jumpPower += 0.2;
    }
    
    // Update HUD
    document.getElementById('score').textContent = `SCORE: ${score}`;
    document.getElementById('level').textContent = `LEVEL: ${level}`;
}

function endGame() {
    gameState = GAME_STATE.GAME_OVER;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('trumpElonHighScore', highScore);
    }
    document.getElementById('gameOver').classList.remove('hidden');
    document.getElementById('finalScore').textContent = score;
    document.getElementById('levelReached').textContent = level;
}

// Draw HUD
function drawHUD() {
    // Optional: Draw additional HUD elements on canvas
}

// Main Animation Loop
function animate() {
    // Clear canvas
    ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid (arcade style)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    
    if (gameState === GAME_STATE.PLAYING) {
        update();
        
        // Draw game elements
        obstacles.forEach(obs => obs.draw());
        drawPlayer();
        drawParticles();
        drawHUD();
    }
    
    // Change character occasionally
    if (Math.random() < 0.0005 && gameState === GAME_STATE.PLAYING) {
        player.character = player.character === 'trump' ? 'elon' : 'trump';
    }
    
    requestAnimationFrame(animate);
}

// Update high score display on load
document.getElementById('highScore').textContent = `HIGH: ${highScore}`;

// Start the game loop
animate();
