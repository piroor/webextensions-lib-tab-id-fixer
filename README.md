# webextensions-lib-tab-id-fixer

Helps to operate tabs across multiple windows, against the [bug 1398272](https://bugzilla.mozilla.org/show_bug.cgi?id=1398272).
The bug has been fixed at Firefox 61, so this library is bosolete for Firefox 61 and later.

## Required permissions

 * `tabs`

## Usage

Load the file `TabIdFixer.js` from both background page and other pages, like:

```json
<script type="application/javascript" src="./TabIdFixer.js"></script>
```

This library provides two public methods: `TabIdFixer.fixTab()` and `TabIdFixer.fixTabId()`.

### `TabIdFixer.fixTab()`

This method updates the `id` attribute of the given `tabs.Tab` object itself, like:

```javascript
browser.tabs.onTabUpdate.addListener((aTabId, aChangeInfo, aTab) => {
  TabIdFixer.fixTab(aTab);
  aTabId = aTab.id;
  ...
});
```

This method returns the updated `tabs.Tab` object itself, thus you can use it as a filter function:

```javascript
var tabs = await browser.tabs.query(condition);
var secureTabs = tabs.map(TabIdFixer.fixTab) // collect their id
                     .filter(aTab => /^https:/.test(aTab.url));
...
```

Nothing will happen when the given `tabs.Tab` object has correct `id`.

### `TabIdFixer.fixTabId()`

This method is a primitive method for cases only tab id is available but the `tabs.Tab` object is not given. For example:

```javascript
browser.runtime.onMessage.addListener((aMessage, aSender) => {
  var id = TabIdFixer.fixTabId(aMessage.tabId);
  ...
});
```

The given id itself will be returned if it is correct id.


