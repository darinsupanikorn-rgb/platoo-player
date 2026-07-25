// ─── platoo-player: UI Module ───
import { } from './state.js';

var handleFile;
var pushUndoState;
var autoSave;
var undo;
var redo;

var uploadZone, fileInput, selectFileBtn;
var backingTracklist;
var menuToggle, sidebar, sidebarOverlay;
var shortcutsModal, shortcutsCloseBtn;

function $(id) { return document.getElementById(id); }

export function initUploadEvents(deps) {
  handleFile = deps.handleFile;

  selectFileBtn = $('selectFileBtn');
  fileInput = $('fileInput');
  uploadZone = $('uploadZone');

  // ─── Events ───

  selectFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  uploadZone.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (this.files && this.files[0]) {
      handleFile(this.files[0]);
    }
    this.value = '';
  });

  uploadZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', function () {
    this.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

export function initMobileMenu() {
  menuToggle = $('menuToggle');
  sidebar = $('sidebar');
  sidebarOverlay = $('sidebarOverlay');

  // ─── Mobile Menu ───

  menuToggle.addEventListener('click', function () {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

  $('instList').addEventListener('click', function (e) {
    var btn = e.target.closest('.inst-btn');
    if (btn && window.innerWidth <= 768) closeSidebar();
  });
  document.querySelectorAll('.nav-item, #instBackBtn').forEach(function (el) {
    el.addEventListener('click', function () {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

export function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
}

export function initTabNavigation() {
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelectorAll('.nav-item').forEach(function (nav) {
        nav.classList.remove('active');
      });
      this.classList.add('active');

      const tab = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(function (tc) {
        tc.classList.remove('active');
      });
      document.getElementById('tab-' + tab).classList.add('active');
    });
  });
}

export function initTrackDragDrop(deps) {
  pushUndoState = deps.pushUndoState;
  autoSave = deps.autoSave;

  backingTracklist = $('backingTracklist');

  var dragState = null;

  backingTracklist.addEventListener('mousedown', onPointerDown);
  backingTracklist.addEventListener('touchstart', onPointerDown, { passive: true });

  function onPointerDown(e) {
    var header = e.target.closest('.backing-track-header');
    if (!header) return;
    var track = header.closest('.backing-track');
    if (!track) return;
    if (e.target.closest('button')) return;

    pushUndoState();

    var clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

    dragState = {
      track: track,
      startY: clientY
    };

    track.classList.add('dragging');

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  function onPointerMove(e) {
    if (!dragState) return;
    e.preventDefault();

    var clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    var tracks = backingTracklist.querySelectorAll('.backing-track:not(.dragging)');

    backingTracklist.querySelectorAll('.backing-track.drag-target').forEach(function (t) {
      t.classList.remove('drag-target');
    });

    var target = null;
    tracks.forEach(function (t) {
      var rect = t.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2 && !target) {
        target = t;
      }
    });

    if (target) {
      target.classList.add('drag-target');
    }
    dragState.target = target;
  }

  function onPointerUp() {
    if (!dragState) return;

    dragState.track.classList.remove('dragging');

    backingTracklist.querySelectorAll('.backing-track.drag-target').forEach(function (t) {
      t.classList.remove('drag-target');
    });

    if (dragState.target) {
      backingTracklist.insertBefore(dragState.track, dragState.target);
    }

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);

    dragState = null;
    autoSave();
  }
}

export function initShortcutsOverlay(deps) {
  undo = deps.undo;
  redo = deps.redo;

  shortcutsModal = $('shortcutsModal');
  shortcutsCloseBtn = $('shortcutsCloseBtn');

  // ─── Keyboard Shortcuts Overlay ───

  shortcutsCloseBtn.addEventListener('click', closeShortcutsOverlay);

  shortcutsModal.addEventListener('click', function (e) {
    if (e.target === shortcutsModal) closeShortcutsOverlay();
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !e.repeat) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !e.repeat) {
        e.preventDefault();
        redo();
        return;
      }
    }
    if (e.key === '?' && !e.repeat) {
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      openShortcutsOverlay();
      return;
    }
    if (e.key === 'Escape' && shortcutsModal.classList.contains('open')) {
      closeShortcutsOverlay();
    }
  });

  // Add help button to sidebar footer
  var sidebarFooter = document.querySelector('.sidebar-footer');
  if (sidebarFooter) {
    var helpBtn = document.createElement('button');
    helpBtn.className = 'help-btn';
    helpBtn.innerHTML = '&#63;';
    helpBtn.title = 'คีย์ลัด';
    helpBtn.addEventListener('click', openShortcutsOverlay);
    sidebarFooter.appendChild(helpBtn);
  }
}

export function toggleShortcutsOverlay() {
  shortcutsModal.classList.toggle('open');
}

export function openShortcutsOverlay() {
  shortcutsModal.classList.add('open');
}

export function closeShortcutsOverlay() {
  shortcutsModal.classList.remove('open');
}

export function initErrorBoundary() {
  window.onerror = function (msg, url, line, col, err) {
    console.error('[PlatooPlayer Error]', msg, url, 'line ' + line + ':' + col, err);
    return false;
  };
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[PlatooPlayer Unhandled Promise]', e.reason);
  });
}
