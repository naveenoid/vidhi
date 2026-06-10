// Vidhi - Story screens
// A modern Tamil horror frame around the classic shooter: intro narration,
// Doom-style interludes between levels, and the ending. DOM overlay with a
// typewriter effect; click/key/touch to skip ahead, then to continue.

export const STORY = {
  intro: {
    title: 'VIDHI',
    lines: [
      'Karaikudi. Ungal paatanaar oorukku thirumbi vandheerkal.',
      'You have returned to your grandfather\'s village — the last of your line.',
      '',
      'Avar kadaisi kaditham: "Kovilai thirakkaadhe. Vidhi thoongugiradhu."',
      'His final letter warned: "Do not open the temple. Fate sleeps within."',
      '',
      'Aanal kathavu thirandhirukkiradhu. Ulle, iruttil... edho asaigiradhu.',
      'But the sealed door stands open. Inside, in the dark... something stirs.',
      '',
      'Trishulam kaiyil. Vidhiyai ethirkol.',
      'The trident is in your hand. Confront your fate.',
    ],
  },
  interludes: [
    {
      title: 'IRULIL NADAI',
      lines: [
        'Vaasal kadandhuvitteergal. Aanal idhu aarambam mattume.',
        'The gateway lies behind you. But this was only the beginning.',
        '',
        'Suvargalil pazhaya raththam. Asurargal nooru aandugalaaga kaaththirundhana.',
        'Old blood stains these walls. The asuras have waited a hundred years.',
        '',
        'Keezhe, irulil, oru sannadhi. Angirundhu oru kural ungalai azhaikkiradhu.',
        'Below, in darkness, an inner shrine. From it, a voice calls your name.',
      ],
    },
    {
      title: 'SIVAN KOVIL',
      lines: [
        'Irul ungalai vizhungavillai. Innum illai.',
        'The dark did not swallow you. Not yet.',
        '',
        'Kadaisi garbhagriham. Mahishasuran ange kaaththirukkiraan.',
        'The final sanctum waits. And Mahishasura waits within it.',
        '',
        'Ungal paatanaar seyya mudiyaadhadhai neengal seyya vendum.',
        'You must finish what your grandfather could not.',
      ],
    },
  ],
  ending: {
    title: 'VIDHI MUDINDHADHU',
    lines: [
      'Mahishasuran veezhndhaan. Kovil amaidhiyaanadhu.',
      'Mahishasura has fallen. The temple is silent at last.',
      '',
      'Vidiyalil, neengal veliyeri varugireergal. Ooru innum thoongugiradhu.',
      'At dawn you step into the light. The village still sleeps.',
      '',
      'Paatanaarin kaditham ippodhu puriyiradhu: vidhi enbadhu vidhikkappattadhu alla.',
      'Now you understand his letter: fate is not what is written.',
      '',
      'Adhu neengal edhirkolvadhu.',
      'It is what you confront.',
    ],
  },
};

export class StoryScreen {
  constructor() {
    this.el = document.getElementById('story-screen');
    this.titleEl = document.getElementById('story-title');
    this.textEl = document.getElementById('story-text');
    this.hintEl = document.getElementById('story-hint');
    this.active = false;
    this.onDone = null;
    this._typeTimer = null;

    const advance = (e) => {
      if (!this.active) return;
      e.preventDefault();
      if (this._typing) {
        // First press: reveal everything
        this._finishTyping();
      } else {
        this.hide();
      }
    };
    this.el.addEventListener('pointerdown', advance);
    document.addEventListener('keydown', (e) => {
      if (this.active && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        advance(e);
      }
    });
  }

  show(part, onDone) {
    this.active = true;
    this.onDone = onDone || null;
    this.titleEl.textContent = part.title;
    this.textEl.textContent = '';
    this.hintEl.style.opacity = '0';
    this.el.style.display = 'flex';

    this._fullText = part.lines.join('\n');
    this._pos = 0;
    this._typing = true;
    const tick = () => {
      if (!this._typing) return;
      // Type a few characters per tick; newlines pause slightly longer
      let step = 2;
      this._pos = Math.min(this._fullText.length, this._pos + step);
      this.textEl.textContent = this._fullText.slice(0, this._pos);
      if (this._pos >= this._fullText.length) {
        this._finishTyping();
      } else {
        const ch = this._fullText[this._pos - 1];
        this._typeTimer = setTimeout(tick, ch === '\n' ? 140 : 18);
      }
    };
    tick();
  }

  _finishTyping() {
    this._typing = false;
    if (this._typeTimer) clearTimeout(this._typeTimer);
    this.textEl.textContent = this._fullText;
    this.hintEl.style.opacity = '1';
  }

  hide() {
    this.active = false;
    this.el.style.display = 'none';
    if (this.onDone) {
      const cb = this.onDone;
      this.onDone = null;
      cb();
    }
  }
}
