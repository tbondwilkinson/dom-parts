# DOM Parts Polyfill

This github repository contains a polyfill of the DOM parts proposal under `/src`.

The polyfill does not add any `MutationObserver` that listens for node additions or removals to update the list of parts in `PartRoot` objects. Instead, every call to `getParts()`, `partRoot`, and `valid` does DOM traversal.

There is however cached equivalents of most methods, such as `getCachedParts()`, that returns the result of the last DOM walk, if the user knows that the DOM has not been mutated since the last DOM walk. There is also a `setCachedParts` method, which you should use at your own danger since there is no validation that the parts are actually valid. Using these methods may leave the `Part` object in an incorrect state, but any call to the actual API methods will return the correct result for what is actually in the DOM.
