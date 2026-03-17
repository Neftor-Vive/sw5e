/**
 * Quick and dirty API around the Loading bar.
 * Does not handle conflicts; multiple instances of this class will fight for the same loading bar, but once all but
 * once are completed, the bar should return to normal
 */
export class Progress {
    /**
     * @type {number}
     * @private
     */
    steps;

    /**
     * @type {number}
     * @private
     */
    counter;

    /**
     * @type {string}
     * @private
     */
    label;

    /**
     * @type {number|null}
     * @private
     */
    fadeTimeout = null;

    constructor({ steps = 1 } = {}) {
      this.steps = steps;
      this.counter = -1;
      this.label = "";
    }

    advance(label) {
      this.counter += 1;
      this.label = label;
      this.updateUI();
    }

    close(label) {
      if (label) this.label = game.i18n.localize(label);
      this.counter = this.steps;
      this.updateUI();
    }

    updateUI() {
      const loader = document.getElementById("loading");
      if (!loader) return;
      const context = loader.querySelector("#context");
      const loadingBar = loader.querySelector("#loading-bar");
      const progress = loader.querySelector("#progress");
      const pct = Math.clamp((100 * this.counter) / this.steps, 0, 100);
      if (context) context.textContent = this.label;
      if (loadingBar) {
        loadingBar.style.width = `${pct}%`;
        loadingBar.style.whiteSpace = "nowrap";
      }
      if (progress) progress.textContent = `${this.counter} / ${this.steps}`;
      loader.style.display = "block";

      if (this.fadeTimeout) {
        window.clearTimeout(this.fadeTimeout);
        this.fadeTimeout = null;
      }
      if (this.counter === this.steps) {
        this.fadeTimeout = window.setTimeout(() => {
          loader.style.display = "none";
          this.fadeTimeout = null;
        }, 2000);
      }
    }
}
