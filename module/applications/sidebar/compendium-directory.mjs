import { CompendiumBrowser } from "../compendium/_module.mjs";

const { CompendiumDirectory } = foundry.applications.sidebar.tabs;

/**
 * An extension of the base CompendiumDirectory class to provide some 5e-specific functionality.
 * @extends {CompendiumDirectory}
 */
export default class CompendiumDirectory5e extends CompendiumDirectory {
  activateListeners(html) {
    super.activateListeners(html);

    const root = html instanceof HTMLElement ? html : html?.[0];
    const footer = root?.querySelector("footer.directory-footer");
    if (!footer) return;

    footer.querySelector("[data-action='sw5e-compendium-browser']")?.remove();
    footer.append(CompendiumBrowser.browseButton());
  }
}
