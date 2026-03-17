import ActorSheet5e from "./base-sheet.mjs";
import ActorTypeConfig from "./type-config.mjs";
import AdvancementConfirmationDialog from "../advancement/advancement-confirmation-dialog.mjs";
import AdvancementManager from "../advancement/advancement-manager.mjs";
import { enrichHtml, htmlQueryAll, resolveHtml } from "../../utils.mjs";

/**
 * An Actor sheet for player character type actors in the SW5E system.
 */
export default class ActorSheet5eCharacter extends ActorSheet5e {
  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["swalt", "sw5e", "sheet", "actor", "character"],
      blockFavTab: true,
      subTabs: null,
      width: 800,
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
  static unsupportedItemTypes = new Set(["starshipsize", "starshipmod"]);

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async getData(options = {}) {
    const context = await super.getData(options);

    // Resources
    context.resources = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
      const res = foundry.utils.mergeObject(context.actor.system.resources[r] || {}, {
        name: r,
        placeholder: game.i18n.localize(`SW5E.Resource${r.titleCase()}`)
      }, {inplace: false});
      if ( res.value === 0 ) delete res.value;
      if ( res.max === 0 ) delete res.max;
      return arr.concat([res]);
    }, []);

    // HTML enrichment
    for (const field of [
      "trait",
      "ideal",
      "bond",
      "flaw",
      "description",
      "notes"
    ]) {
      const value = context.system.details[field]?.value ?? context.system.details[field];
      context[`${field}HTML`] = await enrichHtml(value, {
        secrets: this.actor.isOwner,
        rollData: context.rollData,
        async: true,
        relativeTo: this.actor
      });
    }

    // Make the correct powerbook active when you open the tab
    context.activePowerbook = this.actor.caster[0] ?? "force";

    const classes = this.actor.itemTypes.class;
    foundry.utils.mergeObject(context, {
      disableExperience: game.settings.get("sw5e", "disableExperienceTracking"),
      classLabels: classes.map(c => c.name).join(", "),
      multiclassLabels: classes.map(c => [c.archetype?.name ?? "", c.name, c.system.levels].filterJoin(" ")).join(", "),
      labels: {
        type: context.system.details.type.label
      },
      weightUnit: game.i18n.localize(
        `SW5E.Abbreviation${game.settings.get("sw5e", "metricWeightUnits") ? "Kg" : "Lbs"}`
      ),
      encumbrance: context.system.attributes.encumbrance
    });
    this._prepareFavorites(context);
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareItems(context) {
    const categories = this._prepareItemCategories({
      splitActive: true,
      featureTypes: Object.fromEntries(
        Object.entries(CONFIG.SW5E.featureTypes).map(([k, v]) => {
          if (k === "class") delete v.subtypes;
          return [k, v];
        })
      )
    });

    this._prepareItemsCategorized(context, categories);

    // Apply active item filters
    for (const itemType of Object.values(categories.inventory)) {
      itemType.items = this._filterItems(itemType.items, this._filters.inventory);
    }
    for (const featType of Object.values(categories.features)) {
      featType.items = this._filterItems(featType.items, this._filters.features);
    }
    categories.powers.for.items = this._filterItems(categories.powers.for.items, this._filters.forcePowerbook);
    categories.powers.tec.items = this._filterItems(categories.powers.tec.items, this._filters.techPowerbook);
    categories.maneuvers.items = this._filterItems(categories.maneuvers.items, this._filters.superiorityPowerbook);

    // Organize Powerbook and count the number of prepared powers (excluding always, at will, etc...)
    categories.powers.for.items = this._preparePowerbook(context, categories.powers.for.items, "uni");
    categories.powers.tec.items = this._preparePowerbook(context, categories.powers.tec.items, "tec");
    categories.maneuvers.items = this._prepareManeuvers(categories.maneuvers.items);

    // Sort classes and interleave matching archetypes, put unmatched archetypes into features so they don't disappear
    categories.class.class.items.sort((a, b) => b.system.levels - a.system.levels);
    const maxLevelDelta = CONFIG.SW5E.maxLevel - this.actor.system.details.level;
    categories.class.class.items = categories.class.class.items.reduce((arr, cls) => {
      const ctx = (context.itemContext[cls.id] ??= {});
      ctx.availableLevels = Array.fromRange(CONFIG.SW5E.maxLevel + 1)
        .slice(1)
        .map(level => {
          const delta = level - cls.system.levels;
          return { level, delta, disabled: delta > maxLevelDelta };
        });
      arr.push(cls);
      const identifier = cls.system.identifier || cls.name.slugify({ strict: true });
      const archetype = categories.class.archetype.items.findSplice(s => s.system.classIdentifier === identifier);
      if (archetype) arr.push(archetype);
      return arr;
    }, []);
    for (const archetype of categories.class.archetype.items) {
      categories.unsorted.items.push(archetype);
      const message = game.i18n.format("SW5E.ArchetypeMismatchWarn", {
        name: archetype.name,
        class: archetype.system.classIdentifier
      });
      context.warnings.push({ message, type: "warning" });
    }

    // Organize Starship Features
    categories.class.deployment.items.sort((a, b) => b.system.rank - a.system.rank);
    const maxRankDelta = CONFIG.SW5E.maxRank - this.actor.system.details.ranks;
    categories.class.deployment.items = categories.class.deployment.items.reduce((arr, dep) => {
      const ctx = (context.itemContext[dep.id] ??= {});
      ctx.availableRanks = Array.fromRange(CONFIG.SW5E.maxIndividualRank + 1)
        .slice(1)
        .map(rank => {
          const delta = rank - dep.system.rank;
          return { rank, delta, disabled: delta > maxRankDelta };
        });
      arr.push(dep);
      return arr;
    }, []);

    categories.ssfeatures = [
      categories.class.deployment,
      categories.features["feat.deployment"],
      categories.features["feat.deployment.venture"]
    ];

    // Organize Features
    categories.features = Object.values(categories.features).filter(f => f.dataset.featType !== "deployment");
    categories.features.unshift(categories.class.species);
    const classFeatures = categories.features.splice(
      categories.features.findIndex(f => f.dataset.featType === "class"),
      1
    );
    categories.features.unshift(...classFeatures);
    categories.features.unshift(categories.class.class);
    categories.features.unshift(categories.class.background);

    // Add unsorted items to the Inventory, to make them acessible
    categories.inventory.unsorted = categories.unsorted;

    // Assign and return
    context.inventoryFilters = true;
    context.inventory = Object.values(categories.inventory);
    context.forcePowerbook = categories.powers.for.items;
    context.techPowerbook = categories.powers.tec.items;
    context.superiorityPowerbook = categories.maneuvers.items;
    context.features = categories.features;
    context.ssfeatures = categories.ssfeatures;
  }

  /* -------------------------------------------- */

  /**
   * A helper method to establish the displayed preparation state for an item.
   * @param {Item5e} item     Item being prepared for display.
   * @param {object} context  Context data for display.
   * @protected
   */
  _prepareItemToggleState(item, context) {
    if (item.type === "power") {
      const prep = item.system.preparation || {};
      const isAlways = prep.mode === "always";
      const isPrepared = !!prep.prepared;
      context.toggleClass = isPrepared ? "active" : "";
      if (isAlways) context.toggleClass = "fixed";
      if (isAlways) context.toggleTitle = CONFIG.SW5E.powerPreparationModes.always;
      else if (isPrepared) context.toggleTitle = CONFIG.SW5E.powerPreparationModes.prepared;
      else context.toggleTitle = game.i18n.localize("SW5E.PowerUnprepared");
    } else {
      const isActive = !!item.system.equipped;
      context.toggleClass = isActive ? "active" : "";
      context.toggleTitle = game.i18n.localize(isActive ? "SW5E.Equipped" : "SW5E.Unequipped");
      context.canToggle = "equipped" in item.system;
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  activateListeners(html) {
    const root = resolveHtml(html);
    super.activateListeners(html);
    this._initializeSubTabs(root);
    if (!this.isEditable) return;
    htmlQueryAll(root, ".level-selector").forEach(item => item.addEventListener("change", this._onLevelChange.bind(this)));
    htmlQueryAll(root, ".item-toggle").forEach(item => item.addEventListener("click", this._onToggleItem.bind(this)));
    htmlQueryAll(root, ".item-fav").forEach(item => item.addEventListener("click", this._onToggleFavorite.bind(this)));
    htmlQueryAll(root, ".short-rest").forEach(item => item.addEventListener("click", this._onShortRest.bind(this)));
    htmlQueryAll(root, ".long-rest").forEach(item => item.addEventListener("click", this._onLongRest.bind(this)));
    htmlQueryAll(root, ".rollable[data-action]").forEach(item => item.addEventListener("click", this._onSheetAction.bind(this)));

    // Send Languages to Chat onClick
    htmlQueryAll(root, '[data-options="share-languages"]').forEach(item => item.addEventListener("click", event => {
      event.preventDefault();
      let langs = Array.from(this.actor.system.traits.languages.value)
        .map(l => CONFIG.SW5E.languages[l] || l)
        .join(", ");
      let custom = this.actor.system.traits.languages.custom;
      if (custom) langs += `, ${custom.replace(/;/g, ",")}`;
      let content = `
        <div class="sw5e chat-card item-card" data-actor-id="${this.actor.id}">
          <header class="card-header flexrow">
            <img src="${this.actor.img}" data-tooltip="${this.actor.name}" width="36" height="36"/>
            <h3 class="item-name">Known Languages</h3>
          </header>
          <div>${langs}</div>
        </div>
      `;

      // Send to Chat
      let rollBlind = false;
      let rollMode = game.settings.get("core", "rollMode");
      if (rollMode === "blindroll") rollBlind = true;
      let data = {
        user: game.user.id,
        content,
        blind: rollBlind,
        speaker: {
          actor: this.actor.id,
          token: this.actor.token,
          alias: this.actor.name
        },
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      };

      if (["gmroll", "blindroll"].includes(rollMode)) data.whisper = ChatMessage.getWhisperRecipients("GM");
      else if (rollMode === "selfroll") data.whisper = [game.users.get(game.user.id)];

      ChatMessage.create(data);
    }));
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onConfigMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if ( (event.currentTarget.dataset.action === "type") && (this.actor.system.details.species?.id) ) {
      new ActorTypeConfig(this.actor.system.details.species, { keyPath: "system.type" }).render(true);
    } else if ( event.currentTarget.dataset.action !== "type" ) {
      return super._onConfigMenu(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse click events for character sheet actions.
   * @param {MouseEvent} event  The originating click event.
   * @returns {Promise}         Dialog or roll result.
   * @private
   */
  _onSheetAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "rollDeathSave":
        return this.actor.rollDeathSave({ event });
      case "rollInitiative":
        return this.actor.rollInitiativeDialog({ event });
    }
  }

  /* -------------------------------------------- */

  /**
   * Respond to a new level being selected from the level selector.
   * @param {Event} event                           The originating change.
   * @returns {Promise<AdvancementManager|Item5e>}  Manager if advancements needed, otherwise updated item.
   * @private
   */
  async _onLevelChange(event) {
    event.preventDefault();

    const delta = Number(event.target.value);
    const itemId = event.target.closest(".item")?.dataset.itemId;
    if (!delta || !itemId) return;
    const item = this.actor.items.get(itemId);

    let attr = null;
    if (item.type === "class") attr = "levels";
    else if (item.type === "deployment") attr = "rank";
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
   * @param {Event} event        The triggering click event.
   * @returns {Promise<Item5e>}  Item with the updates applied.
   * @private
   */
  _onToggleItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const attr = item.type === "power" ? "system.preparation.prepared" : "system.equipped";
    return item.update({ [attr]: !foundry.utils.getProperty(item, attr) });
  }

  /* -------------------------------------------- */

  /**
   * Take a short rest, calling the relevant function on the Actor instance.
   * @param {Event} event             The triggering click event.
   * @returns {Promise<RestResult>}  Result of the rest action.
   * @private
   */
  async _onShortRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.shortRest();
  }

  /* -------------------------------------------- */

  /**
   * Take a long rest, calling the relevant function on the Actor instance.
   * @param {Event} event             The triggering click event.
   * @returns {Promise<RestResult>}  Result of the rest action.
   * @private
   */
  async _onLongRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.longRest();
  }

  /* -------------------------------------------- */

  /**
   * Toggle an item's favourite state.
   * @param {Event} event  The triggering click event.
   * @returns {Promise<Item5e>|undefined}
   * @private
   */
  _onToggleFavorite(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const isFavourite = foundry.utils.getProperty(item, "flags.favtab.isFavourite") === true;
    return item.update({ "flags.favtab.isFavourite": !isFavourite });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onItemDelete(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;

    return new Dialog({
      title: `Deleting ${item.name}`,
      content: `<p>Are you sure you want to delete ${item.name}?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fa fa-check"></i>',
          label: "Yes",
          callback: () => item.delete()
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "No"
        }
      },
      default: "cancel"
    }).render(true);
  }

  /* -------------------------------------------- */

  /**
   * Prepare favourite tab data for display.
   * @param {object} context  Prepared rendering context.
   * @protected
   */
  _prepareFavorites(context) {
    const favItems = [];
    const favFeats = [];
    const favPowers = {
      0: { isCantrip: true, powers: false },
      1: { powers: false, value: context.actor.system.powers.power1.value, max: context.actor.system.powers.power1.max },
      2: { powers: false, value: context.actor.system.powers.power2.value, max: context.actor.system.powers.power2.max },
      3: { powers: false, value: context.actor.system.powers.power3.value, max: context.actor.system.powers.power3.max },
      4: { powers: false, value: context.actor.system.powers.power4.value, max: context.actor.system.powers.power4.max },
      5: { powers: false, value: context.actor.system.powers.power5.value, max: context.actor.system.powers.power5.max },
      6: { powers: false, value: context.actor.system.powers.power6.value, max: context.actor.system.powers.power6.max },
      7: { powers: false, value: context.actor.system.powers.power7.value, max: context.actor.system.powers.power7.max },
      8: { powers: false, value: context.actor.system.powers.power8.value, max: context.actor.system.powers.power8.max },
      9: { powers: false, value: context.actor.system.powers.power9.value, max: context.actor.system.powers.power9.max }
    };

    let itemSort = 1;
    let featSort = 1;
    let powerCount = 0;

    for (const item of context.actor.items) {
      if (["class", "archetype", "species", "deployment", "background"].includes(item.type)) continue;
      if (foundry.utils.getProperty(item, "flags.favtab.isFavourite") !== true) continue;

      const favourite = {
        ...item.toObject(),
        editable: this.options.editable,
        id: item.id,
        img: item.img,
        labels: item.labels,
        name: item.name,
        type: item.type
      };

      if (item.system.components) {
        const comps = item.system.components;
        favourite.powerComps = `${comps.vocal ? "V" : ""}${comps.somatic ? "S" : ""}${comps.material ? "M" : ""}`;
        favourite.powerCon = !!comps.concentration;
        favourite.powerRit = !!comps.ritual;
      }

      const sort = Number(foundry.utils.getProperty(item, "flags.favtab.sort"));

      switch (item.type) {
        case "feat":
        case "maneuver":
          favourite.favoriteSort = Number.isFinite(sort) ? sort : featSort++ * 100000;
          favFeats.push(favourite);
          break;
        case "power": {
          if (item.system.preparation.mode) {
            favourite.powerPrepMode = ` (${CONFIG.SW5E.powerPreparationModes[item.system.preparation.mode]})`;
          }
          const level = item.system.level || 0;
          favPowers[level].powers ||= [];
          favPowers[level].powers.push(favourite);
          powerCount++;
          break;
        }
        default:
          favourite.favoriteSort = Number.isFinite(sort) ? sort : itemSort++ * 100000;
          favItems.push(favourite);
          break;
      }
    }

    context.favItems = favItems.length ? favItems.sort((a, b) => a.favoriteSort - b.favoriteSort) : false;
    context.favFeats = favFeats.length ? favFeats.sort((a, b) => a.favoriteSort - b.favoriteSort) : false;
    context.favPowers = powerCount > 0 ? favPowers : false;
    context.editable = this.options.editable;
  }

  /* -------------------------------------------- */

  /**
   * Track and restore local subgroup tab state.
   * @param {HTMLElement|Document|DocumentFragment|null} root  The rendered sheet root.
   * @protected
   */
  _initializeSubTabs(root) {
    if (!root) return;
    const controls = htmlQueryAll(root, "[data-subgroup-selection] [data-subgroup][data-target]");
    if (!controls.length) return;

    if (this.options.subTabs == null) {
      this.options.subTabs = {};
      for (const control of controls) {
        const subgroup = control.dataset.subgroup;
        const target = control.dataset.target;
        const targetState = { target, active: control.classList.contains("active") };
        this.options.subTabs[subgroup] ??= [];
        this.options.subTabs[subgroup].push(targetState);
      }
    }

    for (const [group, tabs] of Object.entries(this.options.subTabs)) {
      const activeTargets = tabs.filter(tab => tab.active).map(tab => tab.target);
      const fallbackTarget = activeTargets[0] ?? tabs[0]?.target;
      htmlQueryAll(root, `[data-subgroup="${group}"]`).forEach(element => element.classList.remove("active"));
      if (!fallbackTarget) continue;
      htmlQueryAll(root, `[data-subgroup="${group}"][data-target="${fallbackTarget}"]`).forEach(element => {
        element.classList.add("active");
      });
    }

    for (const control of controls) {
      control.addEventListener("click", event => {
        const target = event.currentTarget;
        const subgroup = target.dataset.subgroup;
        const nextTarget = target.dataset.target;
        htmlQueryAll(root, `[data-subgroup="${subgroup}"]`).forEach(element => element.classList.remove("active"));
        htmlQueryAll(root, `[data-subgroup="${subgroup}"][data-target="${nextTarget}"]`).forEach(element => {
          element.classList.add("active");
        });

        const tabs = this.options.subTabs[subgroup] ?? [];
        tabs.forEach(tab => {
          tab.active = tab.target === nextTarget;
        });
      });
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropSingleItem(itemData) {
    // Increment the number of class levels a character instead of creating a new item
    if (itemData.type === "class") {
      const charLevel = this.actor.system.details.level;
      itemData.system.levels = Math.min(itemData.system.levels, CONFIG.SW5E.maxLevel - charLevel);
      if (itemData.system.levels <= 0) {
        const err = game.i18n.format("SW5E.MaxCharacterLevelExceededWarn", { max: CONFIG.SW5E.maxLevel });
        ui.notifications.error(err);
        return false;
      }

      const cls = this.actor.itemTypes.class.find(c => c.identifier === itemData.system.identifier);
      if (cls) {
        const priorLevel = cls.system.levels;
        if (!game.settings.get("sw5e", "disableAdvancements")) {
          const manager = AdvancementManager.forLevelChange(this.actor, cls.id, itemData.system.levels);
          if (manager.steps.length) {
            manager.render(true);
            return false;
          }
        }
        cls.update({ "system.levels": priorLevel + itemData.system.levels });
        return false;
      }
    }

    // If a archetype is dropped, ensure it doesn't match another archetype with the same identifier
    else if (itemData.type === "archetype") {
      const other = this.actor.itemTypes.archetype.find(i => i.identifier === itemData.system.identifier);
      if (other) {
        const err = game.i18n.format("SW5E.ArchetypeDuplicateError", { identifier: other.identifier });
        ui.notifications.error(err);
        return false;
      }
      const cls = this.actor.itemTypes.class.find(i => i.identifier === itemData.system.classIdentifier);
      if (cls && cls.archetype) {
        const err = game.i18n.format("SW5E.ArchetypeAssignmentError", {
          class: cls.name,
          archetype: cls.archetype.name
        });
        ui.notifications.error(err);
        return false;
      }
    }
    return super._onDropSingleItem(itemData);
  }
}
