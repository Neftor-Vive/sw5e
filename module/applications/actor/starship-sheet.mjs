import ActorSheet5e from "./base-sheet.mjs";
import AdvancementConfirmationDialog from "../advancement/advancement-confirmation-dialog.mjs";
import AdvancementManager from "../advancement/advancement-manager.mjs";

import { fromUuidSynchronous, htmlQueryAll, resolveHtml } from "../../utils.mjs";

/**
 * An Actor sheet for starships in the SW5E system.
 */
export default class ActorSheet5eStarship extends ActorSheet5e {
  /** @override */
  get template() {
    if (!game.user.isGM && this.actor.limited) return "systems/sw5e/templates/actors/newActor/limited-sheet.hbs";
    return "systems/sw5e/templates/actors/newActor/starship-sheet.hbs";
  }

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sw5e", "sheet", "actor", "starship"],
      width: 800,
      height: 775,
      tabs: [
        {
          navSelector: ".root-tabs",
          contentSelector: ".sheet-body",
          initial: "attributes"
        }
      ]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  static unsupportedItemTypes = new Set([
    "archetype",
    "background",
    "class",
    "deployment",
    "maneuver",
    "power",
    "species"
  ]);

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options = {}) {
    const context = await super.getData(options);

    // Add Size info
    context.isTiny = context.system.traits.size === "tiny";
    context.isSmall = context.system.traits.size === "sm";
    context.isMedium = context.system.traits.size === "med";
    context.isLarge = context.system.traits.size === "lg";
    context.isHuge = context.system.traits.size === "huge";
    context.isGargantuan = context.system.traits.size === "grg";

    // Decide if deployment is visible
    const ssDeploy = context.system.attributes.deployment;
    const anyDeployed = Object.keys(CONFIG.SW5E.ssCrewStationTypes).some(
      k => ssDeploy[k]?.items?.size || ssDeploy[k]?.value
    );
    const anyActive = !!ssDeploy.active.value;
    for (const key of Object.keys(CONFIG.SW5E.ssCrewStationTypes)) {
      const ssDeployment = ssDeploy[key];
      ssDeployment.actorsVisible = !!(!anyDeployed || ssDeployment.items?.size);
      if (this._filters.ssactions.has("activeDeploy")) ssDeployment.actionsVisible = !anyActive || ssDeployment.active;
      else ssDeployment.actionsVisible = !!(ssDeployment.actorsVisible || ssDeployment.value);
    }

    const routing = this.actor.system.attributes.power.routing;
    const symbols = ["↓", "=", "↑"];
    const effects = ["negative", "neutral", "positive"];
    context.routing = Object.keys(CONFIG.SW5E.powerRoutingOpts).reduce((obj, key) => {
      const effect = routing === key ? 2 : routing === "none" ? 1 : 0;
      obj[key] = {
        value: effect,
        symbol: symbols[effect],
        effect: effects[effect]
      };
      return obj;
    }, {});

    // Check for Starship Shield
    context.shieldInstalled = !!(this.actor._getEquipment("ssshield", { equipped: true })?.length);
    context.isShieldDepleted = context.system.attributes.shld.depleted;

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getLabels() {
    const labels = super._getLabels();

    labels.hullDice = game.i18n.format("SW5E.HullDiceFull", {
      cur: this.actor.system.attributes.hull.dice,
      max: this.actor.system.attributes.hull.dicemax,
      die: this.actor.system.attributes.hull.die
    });

    labels.shieldDice = game.i18n.format("SW5E.ShieldDiceFull", {
      cur: this.actor.system.attributes.shld.dice,
      max: this.actor.system.attributes.shld.dicemax,
      die: this.actor.system.attributes.shld.die
    });

    return labels;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getMovementSpeed(systemData, largestPrimary = false) {
    const movement = systemData.attributes.movement ?? {};

    // Prepare an array of available movement speeds
    let speeds = [
      [movement.turn, `${game.i18n.localize("SW5E.MovementTurn")} ${movement.turn}`]
    ];
    if (largestPrimary) {
      speeds.push([movement.space, `${game.i18n.localize("SW5E.MovementSpace")} ${movement.space}`]);
    }

    // Filter and sort speeds on their values
    speeds = speeds.filter(s => s[0]).sort((a, b) => b[0] - a[0]);

    // Case 1: Largest as primary
    if (largestPrimary) {
      let primary = speeds.shift();
      return {
        primary: `${primary ? primary[1] : "0"} ${movement.units || Object.keys(CONFIG.SW5E.movementUnits)[0]}`,
        special: speeds.map(s => s[1]).join(", ")
      };
    }

    // Case 2: Space as primary
    else {
      return {
        primary: `${movement.space || 0} ${movement.units || Object.keys(CONFIG.SW5E.movementUnits)[0]}`,
        special: speeds.length ? speeds.map(s => s[1]).join(", ") : ""
      };
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareItems(context) {
    const categories = this._prepareItemCategories({ splitEquipped: true });

    categories.equipped = {
      weapon: categories.equipped.weapon,
      equipment: categories.equipped.equipment,
      starshipmod: categories.equipped.starshipmod
    };

    this._prepareItemsCategorized(context, categories);

    // Split features
    categories.ssactions = Object.fromEntries(Object.entries(categories.features)
      .filter(([k, v]) => ["starshipAction", "deployment"].includes(v.dataset.featType))
      .map(([k, v]) => [k.replace(/.*\./g, ""), { ...v, derived: v.dataset.featType === "deployment" }]));

    categories.features.feat.required = false;
    categories.features["feat.starship"].required = true;
    categories.features = Object.values(categories.features)
      .filter(f => !["starshipAction", "deployment"].includes(f.dataset.featType));

    categories.inventory = Object.values(categories.inventory);
    categories.equipped = Object.values(categories.equipped);

    // Organize Starship Actions
    for (const actions of Object.values(categories.ssactions)) for (const action of actions.items) {
      const deployment = this.actor.system.attributes.deployment[action.system.deployment];
      const ctx = context.itemContext[action.id] ??= {};
      ctx.active = deployment?.active;
      ctx.name = action.name;
    }

    // Add derived actions from crew members
    const ssDeploy = this.actor.system.attributes.deployment;
    for (const uuid of ssDeploy.crew.items) {
      const actor = fromUuidSynchronous(uuid);
      if (!actor) continue;
      const features = actor.itemTypes.feat.filter(item => item.system.type.value === "deployment");
      for (const feature of features) {
        const ctx = context.itemContext[feature.id] ??= {};
        this._prepareItemContext(feature, ctx);

        ctx.active = ssDeploy.active.value === uuid;
        ctx.derived = uuid;
        ctx.name = feature.name;
        if (!this._filters.ssactions.has("activeDeploy")) ctx.name += ` (${actor.name})`;

        if (feature.system.type.subtype === "venture") categories.ssactions.venture.items.push(feature);
        else categories.ssactions.deployment.items.push(feature);
      }
    }

    // Apply item filters
    for (const actions of Object.values(categories.ssactions)) {
      actions.items = this._filterItems(actions.items, this._filters.ssactions);
    }
    for (const features of categories.features) {
      features.items = this._filterItems(features.items, this._filters.features);
    }
    for (const itemType of categories.inventory) {
      itemType.items = this._filterItems(itemType.items, this._filters.inventory);
    }
    for (const itemType of categories.equipped) {
      itemType.items = this._filterItems(itemType.items, this._filters.ssequipment);
    }

    // Organize Starship Size
    const maxTierDelta = CONFIG.SW5E.maxTier - this.actor.system.details.tier;
    for (const ss of categories.class.starshipsize.items) {
      const ctx = context.itemContext[ss.id] ??= {};
      ctx.availableLevels = Array.fromRange(CONFIG.SW5E.maxTier + 1).map(tier => {
        const delta = tier - ss.system.tier;
        return { tier, delta, disabled: delta > maxTierDelta };
      });
    }
    categories.features.unshift(categories.class.starshipsize);

    // Add unsorted items to the Inventory, to make them acessible
    categories.inventory.unsorted = categories.unsorted;

    // Assign and return
    context.inventoryFilters = true;
    context.ssactions = categories.ssactions;
    context.features = categories.features;
    context.inventory = categories.inventory;
    context.equipment = categories.equipped;
  }

  /* -------------------------------------------- */

  /**
   * A helper method to establish the displayed preparation state for an item.
   * @param {Item5e} item  Item being prepared for display.
   * @param {object} context  Context data for display.
   * @protected
   */
  _prepareItemToggleState(item, context) {
    if (item.isStarshipItem) {
      const isActive = !!item.system.equipped;
      context.toggleClass = isActive ? "active" : "";
      context.toggleTitle = game.i18n.localize(isActive ? "SW5E.Installed" : "SW5E.NotInstalled");
      context.canToggle = "equipped" in item.system;
    }
  }


  /** @inheritDoc */
  _filterItems(items, filters) {
    return super._filterItems(items, filters).filter(item => {
      if (filters.has("activeDeploy") && item.system.deployment) {
        const deployment = this.actor.system.attributes.deployment[item.system.deployment];
        if (deployment && !deployment.active) return false;
      }
      return true;
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    const root = resolveHtml(html);
    htmlQueryAll(root, ".health .rollable").forEach(item => item.addEventListener("click", this._onRollHPFormula.bind(this)));
    htmlQueryAll(root, ".refuel").forEach(item => item.addEventListener("click", this._onIncrementFuelLevel.bind(this)));
    htmlQueryAll(root, ".burnfuel").forEach(item => item.addEventListener("click", this._onDecrementFuelLevel.bind(this)));
    htmlQueryAll(root, ".powerslider").forEach(item => item.addEventListener("change", this._powerRoutingSliderUpdate.bind(this)));
    htmlQueryAll(root, ".tier-selector").forEach(item => item.addEventListener("change", this._onTierChange.bind(this)));
    htmlQueryAll(root, ".recharge-repair").forEach(item => item.addEventListener("click", this._onRechargeRepair.bind(this)));
    htmlQueryAll(root, ".refitting-repair").forEach(item => item.addEventListener("click", this._onRefittingRepair.bind(this)));
    htmlQueryAll(root, ".regen-repair").forEach(item => item.addEventListener("click", this._onRegenRepair.bind(this)));
    htmlQueryAll(root, ".rollable[data-action]").forEach(item => item.addEventListener("click", this._onSheetAction.bind(this)));
    htmlQueryAll(root, ".deploy-control").forEach(item => item.addEventListener("click", this._onDeployControl.bind(this)));
    htmlQueryAll(root, ".item-toggle").forEach(item => item.addEventListener("click", this._onToggleItem.bind(this)));
    htmlQueryAll(root, ".item.group-grid-inventory").forEach(item => {
      item.addEventListener("mouseover", this._onMouseOverItem.bind(this));
      item.addEventListener("mouseout", this._onMouseOutItem.bind(this));
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse click events for starship sheet actions.
   * @param {MouseEvent} event  The originating click event.
   * @returns {Promise}         Dialog or roll result.
   * @private
   */
  _onSheetAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "rollDestructionSave":
        return this.actor.rollDestructionSave({ event });
      case "rollInitiative":
        return this.actor.rollInitiativeDialog({ event });
      case "rollPowerDie":
        return this.actor.rollPowerDie(event.target.dataset.location);
    }
  }

  /* -------------------------------------------- */

  /**
   * Respond to a new tier being selected from the tier selector.
   * @param {Event} event                           The originating change.
   * @returns {Promise<AdvancementManager|Item5e>}  Manager if advancements needed, otherwise updated item.
   * @private
   */
  async _onTierChange(event) {
    event.preventDefault();

    const delta = Number(event.target.value);
    const itemId = event.target.closest(".item")?.dataset.itemId;
    if (!delta || !itemId) return;
    const item = this.actor.items.get(itemId);

    let attr = null;
    if (item.type === "starshipsize") attr = "tier";
    if (!attr) return ui.error(`Unexpected item.type '${item.type}'`);

    if (!game.settings.get("sw5e", "disableAdvancements")) {
      const manager = AdvancementManager.forLevelChange(this.actor, itemId, delta);
      if (manager.steps.length) {
        if (delta > 0) return manager.render(true);
        try {
          const shouldRemoveAdvancements = await AdvancementConfirmationDialog.forLevelDown(item);
          if (shouldRemoveAdvancements) return manager.render(true);
        } catch(err) {
          return;
        }
      }
    }
    return item.update({ [`system.${attr}`]: item.system[attr] + delta });
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the state of an Owned Item within the Actor.
   * @param {Event} event             The triggering click event.
   * @returns {Promise<Item5e>|void}  Item with the updates applied.
   * @private
   */
  _onToggleItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const val = foundry.utils.getProperty(item, "system.equipped");
    const updates = [];

    const { minCrew, installCost, installTime } = this.actor.getInstallationData(itemId);

    const callback = html => {
      if (val !== foundry.utils.getProperty(item, "system.equipped")) return;
      if (!val && item.type === "equipment") {
        for (const i of this.actor.items) {
          if (i.type === "equipment" && i.system.armor.type === item.system.armor.type && i.system.equipped) {
            updates.push({ _id: i.id, "system.equipped": false });
          }
        }
      }
      updates.push({ _id: item.id, "system.equipped": !val });

      this.actor.updateEmbeddedDocuments("Item", updates);
    };

    // Shift click skips the confirmation dialog
    if (event.shiftKey) callback();
    else Dialog.confirm({
      title: game.i18n.localize(val ? "SW5E.StarshipEquipUninstallTitle" : "SW5E.StarshipEquipInstallTitle"),
      content: game.i18n.format(val ? "SW5E.StarshipEquipUninstallContent" : "SW5E.StarshipEquipInstallContent", {
        minCrew,
        installCost,
        installTime
      }),
      yes: callback
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle mousing over an Owned Item within the Actor.
   * @param {Event} event             The triggering mouseover event.
   * @returns {void}
   * @private
   */
  _onMouseOverItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item?.system?.firingArc && item.system.range?.value && !item.firingArcTemplate) {
      try {
        item.firingArcTemplate = sw5e.canvas.FiringArcTemplate.fromItem(item);
        item.firingArcTemplate?.drawPreview();
      } catch(err) {
        Hooks.onError("ActorSheet5eStarship._onMouseOverItem", err, {
          msg: game.i18n.localize("SW5E.PlaceTemplateError"),
          log: "error",
          notify: "error"
        });
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle mousing out of an Owned Item within the Actor.
   * @param {Event} event             The triggering mouseover event.
   * @returns {void}
   * @private
   */
  _onMouseOutItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (item?.firingArcTemplate) {
      item.firingArcTemplate._onCancelPlacement(event);
      item.firingArcTemplate = undefined;
    }
  }

  /* -------------------------------------------- */

  /**
   * Take a Recharge repair, calling the relevant function on the Actor instance.
   * @param {Event} event              The triggering click event.
   * @returns {Promise<RepairResult>}  Result of the repair action.
   * @private
   */
  async _onRechargeRepair(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.rechargeRepair();
  }

  /* -------------------------------------------- */

  /**
   * Take a refitting repair, calling the relevant function on the Actor instance.
   * @param {Event} event              The triggering click event.
   * @returns {Promise<RepairResult>}  Result of the repair action.
   * @private
   */
  async _onRefittingRepair(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.refittingRepair();
  }

  /* -------------------------------------------- */

  /**
   * Take a regen repair, calling the relevant function on the Actor instance.
   * @param {Event} event              The triggering click event.
   * @returns {Promise<RepairResult>}  Result of the repair action.
   * @private
   */
  async _onRegenRepair(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.regenRepair();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropSingleItem(itemData) {
    // Increment the number of tier of a starship instead of creating a new item
    if (itemData.type === "starshipsize") {
      const currentType = this.actor.itemTypes.starshipsize.find(t => t.name === itemData.name);
      if (currentType) {
        const currentTier = currentType.system.tier;
        itemData.system.tier = Math.min(itemData.system.tier || 1, CONFIG.SW5E.maxTier - currentTier);
        if (itemData.system.tier <= 0) {
          const err = game.i18n.format("SW5E.MaxTierLevelExceededWarn", { max: CONFIG.SW5E.maxTier });
          ui.notifications.error(err);
          return false;
        }
        if (!game.settings.get("sw5e", "disableAdvancements")) {
          const manager = AdvancementManager.forLevelChange(this.actor, currentType.id, itemData.system.tier);
          if (manager.steps.length) {
            manager.render(true);
            return false;
          }
        }
        currentType.update({ "system.tier": currentTier + itemData.system.tier });
        return false;
      } else {
        // Only allow 1 starship type per starship
        const toDelete = this.actor.itemTypes.starshipsize.map(item => item.id);
        await this.actor.deleteEmbeddedDocuments("Item", toDelete);
        await this.actor.update({ "system.attributes.hp.value": 0, "system.attributes.hp.temp": 0 });
      }
    }

    // Default drop handling if Tiers were not added
    return super._onDropSingleItem(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling NPC health values using the provided formula
   * @param {Event} event     The original click event
   * @private
   */
  _onRollHPFormula(event) {
    event.preventDefault();
    const formula = this.actor.system.attributes.hp.formula;
    if (!formula) return;
    const hp = new Roll(formula).roll({ async: false }).total;
    AudioHelper.play({ src: CONFIG.sounds.dice });
    this.actor.update({ "system.attributes.hp.value": hp, "system.attributes.hp.max": hp });
  }

  /* -------------------------------------------- */

  /**
   * Handle refueling a starship
   * @param {Event} event     The original click event
   * @private
   */
  _onIncrementFuelLevel(event) {
    // Event.preventDefault();
    this.actor.update({ "system.attributes.fuel.value": this.actor.system.attributes.fuel.fuelCap });
  }

  /* -------------------------------------------- */

  /**
   * Handle a starship burning fuel
   * @param {Event} event     The original click event
   * @private
   */
  _onDecrementFuelLevel(event) {
    // Event.preventDefault();
    this.actor.update({ "system.attributes.fuel.value": this.actor.system.attributes.fuel.value - 1 });
  }

  /* -------------------------------------------- */

  _powerRoutingSliderUpdate(input) {
    const selected = input.target.value === "2" ? input.target.dataset.id : "none";

    this.actor.update({ "system.attributes.power.routing": selected });
  }

  /* -------------------------------------------- */

  /**
   * Handle control events from a deployed actor
   * @param {Event} event     The original click event
   * @private
   */
  _onDeployControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    if (a.dataset.action === "clear") {
      const key = a.dataset.key;
      const deploy = this.actor.system.attributes.deployment[key];
      if (deploy) for (const uuid of deploy.items ?? [ deploy.value ]) {
        const actor = fromUuidSynchronous(uuid);
        this.actor.ssUndeployCrew(actor);
      }
    } else {
      const li = a.closest("li");

      const uuid = li.dataset.uuid;
      const actor = fromUuidSynchronous(uuid);
      const deployments = this.actor.system.attributes.deployment;

      switch (a.dataset.action) {
        case "pilot-toggle":
          if (deployments.pilot.value === uuid) this.actor.ssUndeployCrew(actor, ["pilot"]);
          else this.actor.ssDeployCrew(actor, "pilot");
          break;
        case "delete":
          this.actor.ssUndeployCrew(actor);
          break;
        case "toggle":
          this.actor.ssToggleActiveCrew(uuid);
          break;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle editing an existing Owned Item for the Actor.
   * @param {Event} event         The originating click event.
   * @returns {ItemSheet5e|void}  The rendered item sheet.
   * @private
   */
  _onItemEdit(event) {
    const li = event.currentTarget.closest(".item");
    if (li.dataset.derived) {
      event.preventDefault();
      const uuid = li.dataset.derived;
      if (uuid) {
        const actor = fromUuidSynchronous(uuid);
        const item = actor?.items?.get(li.dataset.itemId);
        return item?.sheet?.render(true);
      }
    } else {
      return super._onItemEdit(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle using an item from the Actor sheet, obtaining the Item instance, and dispatching to its use method.
   * @param {Event} event    The triggering click event.
   * @returns {Roll|void}    Results of the roll.
   * @private
   */
  _onItemUse(event) {
    const li = event.currentTarget.closest(".item");
    if (li.dataset.derived) {
      event.preventDefault();
      const uuid = li.dataset.derived;
      if (uuid) {
        const actor = fromUuidSynchronous(uuid);
        const item = actor?.items?.get(li.dataset.itemId);
        return item?.roll();
      }
    } else return super._onItemUse(event);
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling and items expanded description.
   * @param {Event} event   Triggering event.
   * @private
   */
  _onItemSummary(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    if (!li?.dataset.derived) return super._onItemSummary(event);

    const uuid = li.dataset.derived;
    if (!uuid) return;
    const actor = fromUuidSynchronous(uuid);
    const item = actor?.items?.get(li.dataset.itemId);
    if (!item) return;

    const chatData = item.getChatData({ secrets: this.actor.isOwner });
    const summarySelector = ":scope > .item-summary";
    if (li.classList.contains("expanded")) {
      li.querySelector(summarySelector)?.remove();
      li.classList.remove("expanded");
      return;
    }

    const summary = document.createElement("div");
    summary.className = "item-summary";
    summary.innerHTML = chatData.description.value ?? "";
    const props = document.createElement("div");
    props.className = "item-properties";
    for (const property of chatData.properties ?? []) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = property;
      props.append(tag);
    }
    summary.append(props);
    li.append(summary);
    li.classList.add("expanded");
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropActor(event, data) {
    // Get the target actor
    const cls = getDocumentClass("Actor");
    const sourceActor = await cls.fromDropData(data);
    if (!sourceActor) return;

    if (!CONFIG.SW5E.ssDeployableTypes.includes(sourceActor.type)) {
      ui.notifications.warn( game.i18n.format("SW5E.DeploymentInvalidActorType", {
        actorType: game.i18n.localize(CONFIG.Actor.typeLabels[sourceActor.type])
      }));
      return null;
    }

    // Pre-select the deployment slot with the highest rank
    let preselected = Object.entries(sourceActor.system.details.ranks ?? {}).reduce(
      (prev, cur) => (cur[0] === "total" ? prev : cur[1] > prev[1] ? cur : prev),
      ["passenger", 0]
    )[0];
    if (!(preselected in CONFIG.SW5E.ssCrewStationTypes)) preselected = "crew";

    // Create and render the Dialog
    // Define a function to record starship deployment selection
    const rememberOptions = html => {
      let value = null;
      htmlQueryAll(resolveHtml(html), "input").forEach(el => {
        if (el.checked) value = el.value;
      });
      return value;
    };
    return new Dialog(
      {
        title: game.i18n.format("SW5E.DeploymentPromptTitle", {
          crew: sourceActor.name,
          starship: this.actor.name
        }),
        content: {
          i18n: CONFIG.SW5E.ssCrewStationTypes,
          isToken: this.actor.isToken,
          preselected
        },
        default: "accept",
        buttons: {
          deploy: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize("SW5E.DeploymentAcceptSettings"),
            callback: html => {
              const choice = rememberOptions(html);
              if (!["passenger", "crew"].includes(choice)) this.actor.ssDeployCrew(sourceActor, "crew");
              this.actor.ssDeployCrew(sourceActor, choice);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("Cancel")
          }
        }
      },
      {
        classes: ["dialog", "sw5e"],
        width: 400,
        template: "systems/sw5e/templates/apps/deployment-prompt.hbs"
      }
    ).render(true);
  }
}
