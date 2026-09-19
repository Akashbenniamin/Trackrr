// Trackrr Instagram Injector - Injected into Instagram web tabs
// Adds convenient "⚡ Send to Trackrr" button on Instagram Reels
(function() {
  function injectButtons() {
    // Find all reel articles or containers
    const reels = document.querySelectorAll('article, div[role="dialog"], [data-pressable-container="true"]');
    reels.forEach(container => {
      if (container.dataset.trackrrInjected) return;
      container.dataset.trackrrInjected = 'true';

      // Look for share button or action row
      const actionRow = container.querySelector('section, [role="button"]')?.parentElement;
      if (!actionRow) return;

      const btn = document.createElement('button');
      btn.innerText = '⚡ Trackrr';
      btn.title = 'Copy Reel link and details for Trackrr';
      btn.style.cssText = `
        background: linear-gradient(135deg, #06B6D4, #3B82F6);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        margin-left: 8px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        z-index: 99;
      `;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const reelUrl = window.location.href;
        navigator.clipboard.writeText(reelUrl);
        btn.innerText = '✓ Copied!';
        btn.style.background = '#10B981';
        setTimeout(() => {
          btn.innerText = '⚡ Trackrr';
          btn.style.background = 'linear-gradient(135deg, #06B6D4, #3B82F6)';
        }, 2000);
      });

      try {
        actionRow.appendChild(btn);
      } catch {}
    });
  }

  // Observe dynamically loaded Instagram content
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  injectButtons();
})();
