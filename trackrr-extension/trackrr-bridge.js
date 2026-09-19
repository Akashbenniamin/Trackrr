// Trackrr Extension Bridge - Injected into Trackrr web application tabs
(function() {
  try {
    document.documentElement.setAttribute('data-trackrr-extension', '1.0.0');
    window.__TRACKRR_EXTENSION_ACTIVE__ = true;
  } catch (e) {}

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    const { type, requestId, url } = event.data;

    if (type === 'TRACKRR_EXT_PING') {
      window.postMessage({
        type: 'TRACKRR_EXT_PONG',
        version: '1.0.0',
        timestamp: Date.now()
      }, '*');
      return;
    }

    if (type === 'TRACKRR_EXT_FETCH') {
      try {
        chrome.runtime.sendMessage({
          action: 'FETCH_IG_METADATA',
          url: url
        }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: 'TRACKRR_EXT_RESULT',
              requestId,
              error: chrome.runtime.lastError.message || 'Extension communication error'
            }, '*');
            return;
          }
          window.postMessage({
            type: 'TRACKRR_EXT_RESULT',
            requestId,
            ...(response || { error: 'Empty response from extension' })
          }, '*');
        });
      } catch (err) {
        window.postMessage({
          type: 'TRACKRR_EXT_RESULT',
          requestId,
          error: err.message
        }, '*');
      }
    }
  });
})();
