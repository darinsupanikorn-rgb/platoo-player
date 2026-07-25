import {
  metronomeEnabled, setMetronomeEnabled,
  metronomeVolume, setMetronomeVolume,
  pitchPreserve, setPitchPreserve,
  loopStart, setLoopStart,
  loopEnd, setLoopEnd
} from './state.js';

let deps = {};

export function initPlanModeListeners(d) {
  deps = d;

  document.getElementById('planBpmInput').addEventListener('input', function () {
    var v = parseInt(this.value) || 120;
    deps.updateBPM(v);
  });

  document.getElementById('planBpmSlider').addEventListener('input', function () {
    deps.updateBPM(parseInt(this.value));
  });

  document.getElementById('planTapBtn').addEventListener('click', deps.tapTempo);

  document.getElementById('planMetronomeToggle').addEventListener('change', function () {
    setMetronomeEnabled(this.checked);
    var status = document.getElementById('planMetronomeStatus');
    if (status) status.textContent = metronomeEnabled ? 'เปิด' : 'ปิด';
    if (metronomeEnabled) {
      deps.startMetronome();
    } else {
      deps.stopMetronome();
    }
  });

  document.getElementById('planMetronomeVol').addEventListener('input', function () {
    setMetronomeVolume(parseInt(this.value) / 100);
    var valEl = document.getElementById('planMetronomeVolVal');
    if (valEl) valEl.textContent = this.value + '%';
  });

  document.getElementById('planLoopToggle').addEventListener('change', function () {
    deps.toggleLoop();
  });

  document.getElementById('planLoopSetStart').addEventListener('click', deps.setLoopStart);
  document.getElementById('planLoopSetEnd').addEventListener('click', deps.setLoopEnd);

  document.getElementById('planSpeedSlider').addEventListener('input', function () {
    var v = parseInt(this.value);
    deps.updateSpeed(v / 100);
  });

  document.getElementById('planPitchToggle').addEventListener('change', function () {
    setPitchPreserve(this.checked);
  });

  document.getElementById('planStartBtn').addEventListener('click', deps.startPractice);

  deps.updateLoopDisplay();
}
