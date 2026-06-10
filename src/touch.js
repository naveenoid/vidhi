// Vidhi - Touch controls
// Left half of the screen: virtual analog joystick (movement).
// Right half: drag to look around. Dedicated FIRE / weapon / interact /
// map buttons. Multi-touch tracked by touch identifier so you can move,
// look and fire at the same time.

const JOY_RADIUS = 60; // px, max stick deflection
const LOOK_SENS_X = 0.006;
const LOOK_SENS_Y = 0.004;

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('touch-controls');
    this.joyBase = document.getElementById('joy-base');
    this.joyNub = document.getElementById('joy-nub');

    this.moveTouch = null; // { id, originX, originY }
    this.lookTouch = null; // { id, lastX, lastY }

    this._bindZones();
    this._bindButtons();
  }

  _bindZones() {
    const zone = document.getElementById('touch-zone');

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2 && !this.moveTouch) {
          this.moveTouch = { id: t.identifier, originX: t.clientX, originY: t.clientY };
          this.joyBase.style.display = 'block';
          this.joyBase.style.left = `${t.clientX - 70}px`;
          this.joyBase.style.top = `${t.clientY - 70}px`;
          this._setNub(0, 0);
        } else if (t.clientX >= window.innerWidth / 2 && !this.lookTouch) {
          this.lookTouch = { id: t.identifier, lastX: t.clientX, lastY: t.clientY };
        }
      }
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.moveTouch && t.identifier === this.moveTouch.id) {
          let dx = t.clientX - this.moveTouch.originX;
          let dy = t.clientY - this.moveTouch.originY;
          const len = Math.hypot(dx, dy);
          if (len > JOY_RADIUS) {
            dx = (dx / len) * JOY_RADIUS;
            dy = (dy / len) * JOY_RADIUS;
          }
          this._setNub(dx, dy);
          // Screen up = forward, screen right = strafe right
          this.game.moveInput.y = -dy / JOY_RADIUS;
          this.game.moveInput.x = dx / JOY_RADIUS;
        } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
          const dx = t.clientX - this.lookTouch.lastX;
          const dy = t.clientY - this.lookTouch.lastY;
          this.lookTouch.lastX = t.clientX;
          this.lookTouch.lastY = t.clientY;
          this.game.lookInput.yaw += dx * LOOK_SENS_X;
          this.game.lookInput.pitch -= dy * LOOK_SENS_Y;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.moveTouch && t.identifier === this.moveTouch.id) {
          this.moveTouch = null;
          this.game.moveInput.x = 0;
          this.game.moveInput.y = 0;
          this.joyBase.style.display = 'none';
        } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
          this.lookTouch = null;
        }
      }
    };
    zone.addEventListener('touchend', endTouch, { passive: false });
    zone.addEventListener('touchcancel', endTouch, { passive: false });
  }

  _setNub(dx, dy) {
    this.joyNub.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  _bindButtons() {
    const bind = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDown();
      }, { passive: false });
      const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onUp) onUp();
      };
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
    };

    bind('btn-fire', () => { this.game.shooting = true; }, () => { this.game.shooting = false; });
    bind('btn-weapon', () => this.game.cycleWeapon());
    bind('btn-interact', () => this.game.interact());
    bind('btn-map', () => {
      this.game.gameState.mapExpanded = !this.game.gameState.mapExpanded;
    });
    bind('btn-pause', () => {
      const gs = this.game.gameState;
      if (gs.gameOver || gs.victory) this.game.restart();
      else gs.paused = !gs.paused;
    });
  }
}
