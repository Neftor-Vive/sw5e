import { htmlQueryAll } from "./utils.mjs";

/**
 * Display a monster's CR in the sidebar
 * @param {HTMLElement|jQuery} html       The sidebar to be modified
 * @param {object|undefined} compendium   The compendium pack's data
 */
export default async function DisplayCR(html, compendium) {
  if (compendium && compendium?.collection?.title !== "Monsters") return;

  const actorElements = htmlQueryAll(html, ".directory-item.document.actor");
  for (const actorElement of actorElements) {
    actorElement.querySelector(".sw5e-cr-label")?.remove();
    const id = actorElement.getAttribute("data-document-id");
    if (!id) continue;

    const actor = await (compendium?.collection?.getDocument(id) ?? game.actors.get(id));
    const cr = actor?.system?.details?.cr;
    if (!cr) continue;

    const el = document.createElement("h4");
    el.classList.add("document-name", "sw5e-cr-label");
    el.style.textAlign = "right";
    el.style.marginRight = "10px";
    el.textContent = `${game.i18n.localize("SW5E.ChallengeRatingAbbr")}: ${cr}`;
    if (compendium) el.style.maxWidth = "85px";
    actorElement.appendChild(el);
  }
}
