# 🚀 Trump Elon Rocket Game 🚀

A retro arcade-style game inspired by the Chrome dinosaur game, but with Trump and Elon on a rocket jumping over obstacles in space!

## Features

- **Arcade-style pixel graphics** - Nostalgic retro vibes with modern gameplay
- **Dynamic duo** - Character switches between Trump and Elon during gameplay
- **Progressive difficulty** - Speed increases and spawn rate changes as you progress
- **Multiple obstacle types** - Meteors, aliens, and space debris
- **Particle effects** - Jump trails and score popups for that arcade feel
- **Persistent high scores** - Your best score is saved in localStorage
- **Responsive controls** - SPACEBAR or UP ARROW to jump, ARROW KEYS to move

## How to Play

1. Open `index.html` in your browser
2. Click "START GAME" on the title screen
3. Press SPACEBAR or UP ARROW to jump over obstacles
4. Use LEFT/RIGHT ARROW KEYS to move side to side
5. Survive as long as possible to increase your score
6. The game gets harder as your score increases (levels go up to 10)

## Game Mechanics

- **Scoring**: +10 points for each obstacle survived
- **Levels**: Difficulty increases every 500 points
- **Speed**: Base speed is 5 pixels/frame, increases with level
- **Spawn Rate**: More obstacles appear as difficulty increases
- **Physics**: Gravity-based jumping with increasing jump power at higher levels

## File Structure

```
├── index.html       # Main game HTML
├── style.css        # Arcade-style CSS with retro neon theme
├── game.js          # Game logic, physics, and rendering
└── README.md        # This file
```

## Controls

- **SPACEBAR** or **UP ARROW** - Jump
- **LEFT ARROW** - Move left
- **RIGHT ARROW** - Move right

## Browser Compatibility

Works in all modern browsers with HTML5 Canvas support:
- Chrome/Chromium
- Firefox
- Safari
- Edge

## Tips to Get High Score

- Time your jumps carefully
- Use left/right movement to avoid obstacles in their path
- Watch for the pattern of obstacle spawning
- Stay near the center for more reaction time
- The game gets significantly harder after level 5

Enjoy the game!