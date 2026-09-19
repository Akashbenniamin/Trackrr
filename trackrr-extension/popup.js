document.getElementById('testBtn').addEventListener('click', async () => {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  const btn = document.getElementById('testBtn');
  btn.disabled = true;
  btn.innerText = 'Extracting...';

  chrome.runtime.sendMessage({
    action: 'FETCH_IG_METADATA',
    url: url
  }, (res) => {
    btn.disabled = false;
    btn.innerText = 'Test Extraction';
    const resultBox = document.getElementById('result');
    if (!res || res.error) {
      alert('Error: ' + (res?.error || 'Could not extract metadata'));
      return;
    }
    resultBox.style.display = 'block';
    document.getElementById('resThumb').src = res.thumbnailUrl || '';
    document.getElementById('resCaption').innerText = res.caption ? (res.caption.slice(0, 40) + '...') : (res.author || 'Reel');
    document.getElementById('resViews').innerText = res.viewsCount ? ('👁️ ' + res.viewsCount) : '👁️ -';
    document.getElementById('resLikes').innerText = res.likesCount ? ('❤️ ' + res.likesCount) : '❤️ -';
    document.getElementById('resDate').innerText = 'Posted: ' + (res.postedDate || 'Unknown');
  });
});
