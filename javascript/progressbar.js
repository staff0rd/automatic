/* global opts */
let lastState = {};

function rememberGallerySelection(id_gallery) {}

function getGallerySelectedIndex(id_gallery) {}

function request(url, data, handler, errorHandler) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const js = JSON.parse(xhr.responseText);
          handler(js);
        } catch (error) {
          console.error(error);
          errorHandler();
        }
      } else {
        errorHandler();
      }
    }
  };
  const js = JSON.stringify(data);
  xhr.send(js);
}

function pad2(x) {
  return x < 10 ? `0${x}` : x;
}

function formatTime(secs) {
  if (secs > 3600) return `${pad2(Math.floor(secs / 60 / 60))}:${pad2(Math.floor(secs / 60) % 60)}:${pad2(Math.floor(secs) % 60)}`;
  if (secs > 60) return `${pad2(Math.floor(secs / 60))}:${pad2(Math.floor(secs) % 60)}`;
  return `${Math.floor(secs)}s`;
}

function checkPaused(state) {
  lastState.paused = state ? !state : !lastState.paused;
  document.getElementById('txt2img_pause').innerText = lastState.paused ? 'Resume' : 'Pause'
  document.getElementById('img2img_pause').innerText = lastState.paused ? 'Resume' : 'Pause'
}

function setProgress(res) {
  elements = ['txt2img_generate', 'img2img_generate', 'extras_generate']
  perc = res ? `${Math.round((res?.progress || 0) * 100.0)}%` : ''
  eta = res?.paused ? ' Paused' : ` ETA: ${Math.round(res?.eta || 0)}s`;
  document.title = 'SD.Next ' + perc;
  for (elId of elements) {
    el = document.getElementById(elId);
    el.innerText = res
      ? perc + eta
      : 'Generate';
    el.style.background = res 
      ? `linear-gradient(to right, var(--primary-500) 0%, var(--primary-800) ${perc}, var(--neutral-700) ${perc})`
      : 'var(--button-primary-background-fill)'
  }
}

function randomId() {
  return `task(${Math.random().toString(36).slice(2, 7)}${Math.random().toString(36).slice(2, 7)}${Math.random().toString(36).slice(2, 7)})`;
}

// starts sending progress requests to "/internal/progress" uri, creating progressbar above progressbarContainer element and preview inside gallery element
// Cleans up all created stuff when the task is over and calls atEnd. calls onProgress every time there is a progress update
function requestProgress(id_task, gallery, atEnd = null, onProgress = null, once = false) {
  localStorage.setItem('task', id_task);
  let hasStarted = false;
  const dateStart = new Date();
  const prevProgress = null;
  const parentGallery = gallery ? gallery.parentNode : null;
  let livePreview;
  const img = new Image();
  if (parentGallery) {
    livePreview = document.createElement('div');
    livePreview.className = 'livePreview';
    parentGallery.insertBefore(livePreview, gallery);
    const rect = gallery.getBoundingClientRect();
    if (rect.width) {
      livePreview.style.width = `${rect.width}px`;
      livePreview.style.height = `${rect.height}px`;
    }
    img.onload = function () {
      livePreview.appendChild(img);
      if (livePreview.childElementCount > 2) livePreview.removeChild(livePreview.firstElementChild);
    };
  }

  const done = function () {
    console.debug('task end:   ', id_task);
    localStorage.removeItem('task');
    setProgress();
    if (parentGallery && livePreview) parentGallery.removeChild(livePreview);
    checkPaused(true);
    if (atEnd) atEnd();
  };

  const start = function (id_task, id_live_preview) {
    request('./internal/progress', { id_task, id_live_preview }, (res) => {
      lastState = res;
      const elapsedFromStart = (new Date() - dateStart) / 1000;
      hasStarted |= res.active;
      if (res.completed || (!res.active && (hasStarted || once)) || (elapsedFromStart > 30 && !res.queued && res.progress == prevProgress)) {
        done();
        return;
      }
      setProgress(res);
      if (res.live_preview && gallery) img.src = res.live_preview;
      if (onProgress) onProgress(res);
      setTimeout(() => start(id_task, res.id_live_preview), opts.live_preview_refresh_period || 250);
    }, done);
  };
  start(id_task, 0);
}
