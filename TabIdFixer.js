/*
 Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
 (required only on Firefox 60 or older versions)

 license: The MIT License, Copyright (c) 2017-2018 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/webextensions-lib-tab-id-fixer
*/
'use strict';

var TabIdFixer = {
  required: true,

  // public methods
  fixTabId(aTabId) {
    if (!this.required)
      return aTabId;
    return this.wrongToCorrect[aTabId] || aTabId;
  },

  fixTab(aTab) {
    if (!this.required)
      return aTab;
    var correctId = this.fixTabId(aTab.id);
    if (correctId)
      aTab.id = correctId;
    return aTab;
  },

  // internal
  FETCH_ID_TABLES: 'tab-id-fixer:fetch-id-tables',
  PUSH_ID_TABLES: 'tab-id-fixer:push-id-tables',

  isBackground:   undefined,
  windowId:       undefined,
  wrongToCorrect: {},
  correctToWrong: {},

  init() {
    this.fixTabId = this.fixTabId.bind(this);
    this.fixTab   = this.fixTab.bind(this);

    this.initialized = new Promise((aResolve, aReject) => {
      this.onInitialized = aResolve;
    });

    this.onTabRemoved = this.onTabRemoved.bind(this);
    browser.tabs.onRemoved.addListener(this.onTabRemoved);

    this.onTabAttached = this.onTabAttached.bind(this);
    browser.tabs.onAttached.addListener(this.onTabAttached);

    this.onMessage = this.onMessage.bind(this);
    browser.runtime.onMessage.addListener(this.onMessage);

    Promise.all([
      browser.runtime.getBrowserInfo(),
      browser.runtime.getBackgroundPage()
    ]).then(async results => {
      const [browserInfo, backgroundPage] = results;
      this.isBackground = (backgroundPage == window);
      if (parseInf(browserInfo.split('.')[0]) >= 61) {
        this.required = false;
        this.endListen();
        this.wrongToCorrect = {};
        this.correctToWrong = {};
        this.onInitialized();
      }
      if (!this.isBackground) {
        await Promise.all([
          (async () => {
            let tables = await browser.runtime.sendMessage({ type: this.FETCH_ID_TABLES }).catch(aError => String(aError));
            if (tables && typeof tables == 'object') {
              this.wrongToCorrect = tables.wrongToCorrect;
              this.correctToWrong = tables.correctToWrong;
            }
          })(),
          (async () => {
            this.windowId = (await browser.windows.getCurrent()).id;
          })()
        ]);
      }
      window.addEventListener('unload', () => {
        this.endListen();
      }, { once: true });
      this.onInitialized();
    });
  },

  endListen() {
    browser.tabs.onRemoved.removeListener(this.onTabRemoved);
    browser.tabs.onAttached.removeListener(this.onTabAttached);
    if (this.isBackground)
      browser.runtime.onMessage.removeListener(this.onMessage);
  },

  onTabRemoved(aTabId, aRemoveInfo) {
    // clear cached data for a while, because it can be used by other listeners of onTabRemoved.
    setTimeout(() => {
      var wrongId = this.correctToWrong[aTabId];
      if (wrongId)
        delete this.wrongToCorrect[wrongId];
      delete this.correctToWrong[aTabId];
    }, 500);
  },

  onTabAttached: async function(aTabId, aAttachInfo) {
    var tab = await browser.tabs.get(aTabId).catch(aError => {});
    if (!tab || tab.id == aTabId)
      return;

    var oldWrongId = this.correctToWrong[aTabId];
    if (oldWrongId)
      delete this.wrongToCorrect[oldWrongId];
    this.wrongToCorrect[tab.id] = aTabId;
    this.correctToWrong[aTabId] = tab.id;

    // "onTabAttached" events for "move tab to new window" action never be listened
    // in the new window itself, and the window fetches ID tabes before "onTabAttached"
    // is fired. As the result, the new window cannot know correct tables for the tabs
    // moved from old window, so we need to push correctly updated ID tables to the window.
    browser.runtime.sendMessage({
      type:           this.PUSH_ID_TABLES,
      windowId:       aAttachInfo.windowId,
      wrongToCorrect: this.wrongToCorrect,
      correctToWrong: this.correctToWrong
    });
  },

  onMessage(aMessage, aSender) {
    switch (aMessage && aMessage.type) {
      case this.FETCH_ID_TABLES:
        if (this.isBackground) {
          return Promise.resolve({
            wrongToCorrect: this.wrongToCorrect,
            correctToWrong: this.correctToWrong
          });
        }
        break;

      case this.PUSH_ID_TABLES:
        if (!this.isBackground &&
            this.windowId == aMessage.windowId) {
          this.wrongToCorrect = aMessage.wrongToCorrect;
          this.correctToWrong = aMessage.correctToWrong;
        }
        break;
    }
  }
};
TabIdFixer.init();
