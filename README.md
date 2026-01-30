# Flappy Bird Clone

A high-quality, realistic Flappy Bird clone built with HTML, CSS, and JavaScript (no external game engines). Features smooth physics, parallax background, responsive design, and optional sound.

## How to Run

1. Open `index.html` in a modern browser, or
2. Serve the folder locally (e.g. `npx serve .` or `python -m http.server`) and open the URL.

## Controls

- **Desktop:** Spacebar or mouse click
- **Mobile:** Tap the screen
- **Restart:** After game over, tap "Play Again" (no page reload)

---

## Physics

- **Gravity:** Constant downward acceleration (`GRAVITY = 0.45`). Each frame, the bird’s vertical velocity `vy` increases by this amount (scaled by frame time for consistent behavior at different frame rates).
- **Velocity:** Vertical velocity is clamped to a maximum downward value (`MAX_FALL_SPEED = 10`) so the bird doesn’t accelerate infinitely.
- **Flap:** A tap/click/space applies an upward impulse (`FLAP_IMPULSE = -8.2`), i.e. sets `vy` to that value. The next frame gravity immediately starts pulling the bird down again, giving smooth arcs instead of jerky jumps.
- **Position:** Each frame, `bird.y += bird.vy * (dt/16)` so movement is frame-rate independent (normalized to ~60fps).
- **Rotation:** The bird tilts up when `vy < 0` (flapping) and tilts down when falling; the target angle is derived from `vy` and smoothed with lerp for a natural look.

---

## Scoring

- **When you score:** The score increases by 1 only when the bird’s center passes the **right edge** of a pipe (`bird.x > pipe.x + pipe.width`). Each pipe pair is counted at most once (tracked with a `passed` flag).
- **Current score:** Shown at the top during play.
- **High score:** The best score is stored in `localStorage` under the key `flappyHighScore` and shown in the HUD and on the Game Over screen. It persists across sessions and page reloads.
- **Optional:** A short sound plays when you pass a pipe (and when you hit the ground/pipe); sound can be toggled with the speaker button.

---

## Code Structure

- **Game loop:** `gameLoop(timestamp)` runs via `requestAnimationFrame`. Each frame it: updates physics, updates pipes, checks collisions, clears the canvas, then draws pipes and bird.
- **Physics:** `updatePhysics(dt)` applies gravity, clamps velocity, updates position, and updates rotation. `flap()` sets upward velocity.
- **Rendering:** `drawBird()` and `drawPipes()` render the bird (with rotation) and pipe rectangles. Background and ground are CSS (parallax layers).
- **Collision:** `checkCollisions()` uses circle-vs-rectangle for the bird (radius) vs each pipe rectangle, and a simple comparison for the ground. Game over is triggered on any of these collisions.
- **Screens:** Start screen (Play button) and Game Over screen (score, best, Play Again) are HTML overlays; visibility is toggled by the game state (`start` / `playing` / `gameover`).

---

## Bonus Features

- **Increasing difficulty:** Pipe speed scales with score: `speed = basePipeSpeed * (1 + score * 0.02)`. Spawn interval shortens as score increases.
- **Sound toggle:** Button in the HUD to enable/disable flap, score, and hit sounds (Web Audio API).
- **Start + Game Over screens:** As described above.
- **Hitboxes:** Bird uses a circle (radius 14px); pipes use axis-aligned rectangles. Collision is circle-vs-rect (closest-point test) for pixel-accurate feel.

Enjoy playing.
