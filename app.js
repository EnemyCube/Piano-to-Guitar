(function () {
  "use strict";

  var PIANO_MIN = 21;
  var PIANO_MAX = 108;
  var MIDDLE_C = 60;
  var MAX_FRET = 24;
  var DEFAULT_WHITE_KEY_WIDTH = 26;
  var DEFAULT_BLACK_KEY_WIDTH = 16;
  var NOTE_NAMES = [
    { sharp: "C", flat: "C", natural: true },
    { sharp: "C#", flat: "Db" },
    { sharp: "D", flat: "D", natural: true },
    { sharp: "D#", flat: "Eb" },
    { sharp: "E", flat: "E", natural: true },
    { sharp: "F", flat: "F", natural: true },
    { sharp: "F#", flat: "Gb" },
    { sharp: "G", flat: "G", natural: true },
    { sharp: "G#", flat: "Ab" },
    { sharp: "A", flat: "A", natural: true },
    { sharp: "A#", flat: "Bb" },
    { sharp: "B", flat: "B", natural: true }
  ];
  var WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11];
  var FRET_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
  var DOUBLE_MARKERS = [12, 24];

  var CHORDS = {
    "Major": [0, 4, 7],
    "Minor": [0, 3, 7],
    "Diminished": [0, 3, 6],
    "Augmented": [0, 4, 8],
    "Sus2": [0, 2, 7],
    "Sus4": [0, 5, 7],
    "Dominant 7": [0, 4, 7, 10],
    "Major 7": [0, 4, 7, 11],
    "Minor 7": [0, 3, 7, 10]
  };

  var SCALES = {
    "Major": [0, 2, 4, 5, 7, 9, 11],
    "Natural minor": [0, 2, 3, 5, 7, 8, 10],
    "Harmonic minor": [0, 2, 3, 5, 7, 8, 11],
    "Minor pentatonic": [0, 3, 5, 7, 10],
    "Major pentatonic": [0, 2, 4, 7, 9],
    "Blues": [0, 3, 5, 6, 7, 10],
    "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  var TUNINGS = [
    { id: "standard-6", name: "6-string standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "drop-d", name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "d-standard", name: "D standard", notes: ["D2", "G2", "C3", "F3", "A3", "D4"] },
    { id: "standard-7", name: "7-string standard", notes: ["B1", "E2", "A2", "D3", "G3", "B3", "E4"] },
    { id: "standard-8", name: "8-string standard", notes: ["F#1", "B1", "E2", "A2", "D3", "G3", "B3", "E4"] }
  ];

  var state = {
    selectedMidis: [],
    selectedPitchClasses: [],
    tuning: TUNINGS[0].notes.map(noteToMidi),
    activeTuningId: TUNINGS[0].id,
    fitFrame: 0
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    populateRootSelect();
    populateTuningPresetSelect();
    bindControls();
    applyTuning(TUNINGS[0]);
    setPresetMode("manual");
    window.addEventListener("resize", scheduleFit);
    renderAll();
  });

  function cacheElements() {
    els.app = document.querySelector(".app");
    els.rootNote = document.getElementById("root-note");
    els.presetType = document.getElementById("preset-type");
    els.presetName = document.getElementById("preset-name");
    els.clearSelection = document.getElementById("clear-selection");
    els.resetApp = document.getElementById("reset-app");
    els.selectedNotes = document.getElementById("selected-notes");
    els.pianoTitle = document.getElementById("piano-title");
    els.octaveBand = document.getElementById("octave-band");
    els.piano = document.getElementById("piano");
    els.tuningPreset = document.getElementById("tuning-preset");
    els.stringCount = document.getElementById("string-count");
    els.customTuning = document.getElementById("custom-tuning");
    els.fretboard = document.getElementById("fretboard");
  }

  function populateRootSelect() {
    NOTE_NAMES.forEach(function (note, pitchClass) {
      var option = document.createElement("option");
      option.value = String(pitchClass);
      option.textContent = pitchClassLabel(pitchClass);
      els.rootNote.appendChild(option);
    });
  }

  function populateTuningPresetSelect() {
    TUNINGS.forEach(function (tuning) {
      var option = document.createElement("option");
      option.value = tuning.id;
      option.textContent = tuning.name + " (" + tuning.notes.join(" ") + ")";
      els.tuningPreset.appendChild(option);
    });
    var custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom";
    els.tuningPreset.appendChild(custom);
  }

  function bindControls() {
    els.presetType.addEventListener("change", function () {
      setPresetMode(els.presetType.value);
      applyPresetSelection();
    });

    els.presetName.addEventListener("change", applyPresetSelection);
    els.rootNote.addEventListener("change", applyPresetSelection);

    els.clearSelection.addEventListener("click", function () {
      state.selectedMidis = [];
      state.selectedPitchClasses = [];
      setPresetMode("manual");
      renderAll();
    });

    els.resetApp.addEventListener("click", function () {
      state.selectedMidis = [];
      state.selectedPitchClasses = [];
      els.rootNote.value = "0";
      setPresetMode("manual");
      applyTuning(TUNINGS[0]);
      renderAll();
    });

    els.tuningPreset.addEventListener("change", function () {
      if (els.tuningPreset.value === "custom") {
        markCustomTuning();
        renderCustomTuning();
        return;
      }
      applyTuning(getTuningById(els.tuningPreset.value));
      renderAll();
    });

    els.stringCount.addEventListener("change", function () {
      setStringCount(parseInt(els.stringCount.value, 10));
      renderAll();
    });
  }

  function setPresetMode(mode) {
    els.presetType.value = mode;
    els.presetName.innerHTML = "";

    if (mode === "manual") {
      els.presetName.disabled = true;
      var manualOption = document.createElement("option");
      manualOption.value = "";
      manualOption.textContent = "Click notes manually";
      els.presetName.appendChild(manualOption);
      return;
    }

    els.presetName.disabled = false;
    var source = mode === "chord" ? CHORDS : SCALES;
    Object.keys(source).forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      els.presetName.appendChild(option);
    });
  }

  function applyPresetSelection() {
    var mode = els.presetType.value;
    if (mode === "manual") {
      renderAll();
      return;
    }

    var source = mode === "chord" ? CHORDS : SCALES;
    var intervals = source[els.presetName.value] || [];
    var root = parseInt(els.rootNote.value, 10);
    state.selectedMidis = [];
    state.selectedPitchClasses = intervals.map(function (interval) {
      return normalizePitchClass(root + interval);
    });
    renderAll();
  }

  function buildPiano() {
    els.piano.innerHTML = "";
    els.octaveBand.innerHTML = "";

    var range = getPlayablePianoRange();
    var whiteCount = 0;
    var octaveRuns = [];
    var currentRun = null;

    els.pianoTitle.textContent = "Piano Layout (" + fullNoteLabel(range.start) + "-" + fullNoteLabel(range.end) + ")";

    for (var midi = range.start; midi <= range.end; midi += 1) {
      var pc = pitchClassFromMidi(midi);
      var octave = octaveFromMidi(midi);
      var isWhite = WHITE_PITCH_CLASSES.indexOf(pc) !== -1;
      var key = document.createElement("button");
      key.type = "button";
      key.className = "key " + (isWhite ? "white" : "black") + " oct-" + octave;
      key.dataset.midi = String(midi);
      key.dataset.pc = String(pc);
      key.setAttribute("aria-label", fullNoteLabel(midi));
      if (midi === MIDDLE_C) {
        key.classList.add("middle-c");
      }
      key.innerHTML = '<span class="key-label">' + pitchClassHtml(pc) + '<span class="key-octave">' + octave + "</span></span>";
      key.addEventListener("click", function () {
        toggleMidi(parseInt(this.dataset.midi, 10));
      });
      els.piano.appendChild(key);

      if (isWhite) {
        whiteCount += 1;
        if (!currentRun || currentRun.octave !== octave) {
          currentRun = { octave: octave, count: 0 };
          octaveRuns.push(currentRun);
        }
        currentRun.count += 1;
      }
    }

    var chartWidth = getGuitarChartWidth();
    var whiteKeyWidth = chartWidth / whiteCount;
    var blackKeyWidth = Math.max(10, whiteKeyWidth * (DEFAULT_BLACK_KEY_WIDTH / DEFAULT_WHITE_KEY_WIDTH));
    var blackKeyHalf = blackKeyWidth / 2;

    els.piano.style.setProperty("--white-key-w", whiteKeyWidth + "px");
    els.piano.style.setProperty("--black-key-w", blackKeyWidth + "px");
    els.piano.style.setProperty("--black-key-half", blackKeyHalf + "px");
    els.piano.style.width = chartWidth + "px";
    els.octaveBand.style.gridTemplateColumns = octaveRuns.map(function (run) {
      return run.count * whiteKeyWidth + "px";
    }).join(" ");
    els.octaveBand.style.width = chartWidth + "px";

    octaveRuns.forEach(function (run) {
      var segment = document.createElement("div");
      segment.className = "octave-segment oct-" + run.octave;
      segment.textContent = "Octave " + run.octave;
      els.octaveBand.appendChild(segment);
    });
  }

  function renderFretboard() {
    els.fretboard.innerHTML = "";

    var header = document.createElement("div");
    header.className = "fret-header";
    header.appendChild(makeHeaderCell("String"));
    header.appendChild(makeHeaderCell("Open"));
    for (var fret = 1; fret <= MAX_FRET; fret += 1) {
      header.appendChild(makeHeaderCell(String(fret), fret));
    }
    els.fretboard.appendChild(header);

    var displayTuning = state.tuning.slice().reverse();
    displayTuning.forEach(function (openMidi, displayIndex) {
      var stringNumber = displayIndex + 1;
      var row = document.createElement("div");
      row.className = "fret-row";
      row.appendChild(makeStringLabel(stringNumber, openMidi));

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var midi = openMidi + fret;
        row.appendChild(makeFretCell(midi, fret, stringNumber));
      }
      els.fretboard.appendChild(row);
    });
  }

  function makeHeaderCell(text, fret) {
    var cell = document.createElement("div");
    cell.className = "fret-head-cell";
    if (FRET_MARKERS.indexOf(fret) !== -1) {
      cell.classList.add("has-marker");
    }
    if (DOUBLE_MARKERS.indexOf(fret) !== -1) {
      cell.classList.add("has-marker", "has-double-marker");
    }
    cell.innerHTML = '<span class="fret-number">' + text + '</span>';
    return cell;
  }

  function makeStringLabel(stringNumber, midi) {
    var label = document.createElement("div");
    label.className = "string-label";
    label.innerHTML = '<span>String ' + stringNumber + "<small>" + fullNoteLabel(midi) + "</small></span>";
    return label;
  }

  function makeFretCell(midi, fret, stringNumber) {
    var pc = pitchClassFromMidi(midi);
    var octave = octaveFromMidi(midi);
    var cell = document.createElement("button");
    cell.type = "button";
    cell.className = "fret-cell oct-" + octave + (fret === 0 ? " open" : "");
    cell.dataset.pc = String(pc);
    cell.dataset.midi = String(midi);
    cell.setAttribute("aria-label", fullNoteLabel(midi) + ", fret " + fret + ", string " + stringNumber);
    cell.innerHTML = '<span><span class="note-name">' + pitchClassHtml(pc) + '</span><span class="note-octave">' + octave + "</span></span>";
    cell.addEventListener("click", function () {
      toggleMidi(parseInt(this.dataset.midi, 10));
    });
    return cell;
  }

  function renderCustomTuning() {
    els.customTuning.innerHTML = "";
    els.stringCount.value = String(state.tuning.length);

    state.tuning.slice().reverse().forEach(function (midi, displayIndex) {
      var internalIndex = state.tuning.length - displayIndex - 1;
      var editor = document.createElement("div");
      editor.className = "string-editor";

      var label = document.createElement("span");
      label.textContent = "S" + (displayIndex + 1);

      var noteSelect = document.createElement("select");
      noteSelect.setAttribute("aria-label", "String " + (displayIndex + 1) + " note");
      NOTE_NAMES.forEach(function (note, pitchClass) {
        var option = document.createElement("option");
        option.value = String(pitchClass);
        option.textContent = pitchClassLabel(pitchClass);
        noteSelect.appendChild(option);
      });
      noteSelect.value = String(pitchClassFromMidi(midi));

      var octaveSelect = document.createElement("select");
      octaveSelect.setAttribute("aria-label", "String " + (displayIndex + 1) + " octave");
      for (var octave = 0; octave <= 5; octave += 1) {
        var option = document.createElement("option");
        option.value = String(octave);
        option.textContent = String(octave);
        octaveSelect.appendChild(option);
      }
      octaveSelect.value = String(octaveFromMidi(midi));

      function updateString() {
        var pitchClass = parseInt(noteSelect.value, 10);
        var octaveValue = parseInt(octaveSelect.value, 10);
        state.tuning[internalIndex] = midiFromPitchClassAndOctave(pitchClass, octaveValue);
        markCustomTuning();
        renderAll();
      }

      noteSelect.addEventListener("change", updateString);
      octaveSelect.addEventListener("change", updateString);

      editor.appendChild(label);
      editor.appendChild(noteSelect);
      editor.appendChild(octaveSelect);
      els.customTuning.appendChild(editor);
    });
  }

  function renderSelection() {
    var selectedMidis = state.selectedMidis.slice().sort(function (a, b) {
      return a - b;
    });
    var selectedPitchClasses = state.selectedPitchClasses.slice().sort(function (a, b) {
      return a - b;
    });
    var readout = selectedMidis.length
      ? selectedMidis.map(fullNoteLabel)
      : selectedPitchClasses.map(pitchClassLabel);
    els.selectedNotes.textContent = readout.length ? readout.join(", ") : "None";

    document.querySelectorAll("[data-pc]").forEach(function (node) {
      var pc = parseInt(node.dataset.pc, 10);
      var midi = parseInt(node.dataset.midi, 10);
      var exactMatch = selectedMidis.indexOf(midi) !== -1;
      var pitchMatch = selectedPitchClasses.indexOf(pc) !== -1;
      var presetMatch = !selectedMidis.length && pitchMatch;
      var selected = exactMatch || presetMatch;
      var related = !selected && selectedMidis.length > 0 && pitchMatch;

      node.classList.toggle("selected", selected);
      node.classList.toggle("related", related);
      if (node.classList.contains("key") || node.classList.contains("fret-cell")) {
        node.setAttribute("aria-pressed", selected || related ? "true" : "false");
      }
    });
  }

  function renderAll() {
    renderCustomTuning();
    buildPiano();
    renderFretboard();
    renderSelection();
    scheduleFit();
  }

  function getPlayablePianoRange() {
    var lowest = Math.min.apply(null, state.tuning);
    var highest = Math.max.apply(null, state.tuning) + MAX_FRET;
    var start = Math.max(lowest, PIANO_MIN);
    var end = Math.min(highest, PIANO_MAX);

    if (start > end) {
      return { start: PIANO_MIN, end: PIANO_MAX };
    }
    return { start: start, end: end };
  }

  function getGuitarChartWidth() {
    var styles = getComputedStyle(document.documentElement);
    var stringLabelWidth = parseFloat(styles.getPropertyValue("--string-label-w")) || 82;
    var openCellWidth = parseFloat(styles.getPropertyValue("--open-cell-w")) || 48;
    var fretCellWidth = parseFloat(styles.getPropertyValue("--cell-w")) || 56;
    return stringLabelWidth + openCellWidth + MAX_FRET * fretCellWidth;
  }

  function scheduleFit() {
    if (state.fitFrame) {
      cancelAnimationFrame(state.fitFrame);
    }
    state.fitFrame = requestAnimationFrame(fitAppToViewport);
  }

  function fitAppToViewport() {
    state.fitFrame = 0;
    if (!els.app) {
      return;
    }

    els.app.style.setProperty("--app-scale", "1");
    els.app.style.setProperty("--app-left", "0px");
    els.app.style.setProperty("--app-top", "0px");

    var viewportPadding = 8;
    var naturalWidth = els.app.scrollWidth;
    var naturalHeight = els.app.scrollHeight;
    var availableWidth = Math.max(window.innerWidth - viewportPadding, 1);
    var availableHeight = Math.max(window.innerHeight - viewportPadding, 1);
    var scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
    var left = Math.max((window.innerWidth - naturalWidth * scale) / 2, 0);
    var top = Math.max((window.innerHeight - naturalHeight * scale) / 2, 0);

    els.app.style.setProperty("--app-scale", String(scale));
    els.app.style.setProperty("--app-left", left + "px");
    els.app.style.setProperty("--app-top", top + "px");
  }

  function toggleMidi(midi) {
    if (els.presetType.value !== "manual") {
      setPresetMode("manual");
      state.selectedMidis = [];
      state.selectedPitchClasses = [];
    }

    var index = state.selectedMidis.indexOf(midi);
    if (index === -1) {
      state.selectedMidis.push(midi);
    } else {
      state.selectedMidis.splice(index, 1);
    }
    syncPitchClassesFromSelectedMidis();
    renderAll();
  }

  function syncPitchClassesFromSelectedMidis() {
    state.selectedPitchClasses = state.selectedMidis.reduce(function (pitchClasses, midi) {
      var pitchClass = pitchClassFromMidi(midi);
      if (pitchClasses.indexOf(pitchClass) === -1) {
        pitchClasses.push(pitchClass);
      }
      return pitchClasses;
    }, []);
  }

  function applyTuning(tuning) {
    state.activeTuningId = tuning.id;
    state.tuning = tuning.notes.map(noteToMidi);
    els.tuningPreset.value = tuning.id;
    els.stringCount.value = String(state.tuning.length);
    renderCustomTuning();
  }

  function markCustomTuning() {
    state.activeTuningId = "custom";
    els.tuningPreset.value = "custom";
  }

  function setStringCount(count) {
    if (count === state.tuning.length) {
      return;
    }

    var presetForCount = TUNINGS.filter(function (tuning) {
      return tuning.notes.length === count && tuning.id.indexOf("standard") !== -1;
    })[0];

    if (state.activeTuningId !== "custom" && presetForCount) {
      state.tuning = presetForCount.notes.map(noteToMidi);
      state.activeTuningId = presetForCount.id;
      els.tuningPreset.value = presetForCount.id;
      return;
    }

    while (state.tuning.length < count) {
      state.tuning.unshift(state.tuning[0] - 5);
    }
    while (state.tuning.length > count) {
      state.tuning.shift();
    }
  }

  function getTuningById(id) {
    return TUNINGS.filter(function (tuning) {
      return tuning.id === id;
    })[0] || TUNINGS[0];
  }

  function noteToMidi(note) {
    var match = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
    if (!match) {
      throw new Error("Invalid note: " + note);
    }
    var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
    var accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    var octave = parseInt(match[3], 10);
    return midiFromPitchClassAndOctave(base + accidental, octave);
  }

  function midiFromPitchClassAndOctave(pitchClass, octave) {
    return (octave + 1) * 12 + normalizePitchClass(pitchClass);
  }

  function pitchClassFromMidi(midi) {
    return normalizePitchClass(midi);
  }

  function normalizePitchClass(value) {
    return ((value % 12) + 12) % 12;
  }

  function octaveFromMidi(midi) {
    return Math.floor(midi / 12) - 1;
  }

  function pitchClassLabel(pitchClass) {
    var note = NOTE_NAMES[normalizePitchClass(pitchClass)];
    return note.natural ? note.sharp : note.sharp + "/" + note.flat;
  }

  function pitchClassHtml(pitchClass) {
    var label = pitchClassLabel(pitchClass);
    return label.replace("/", "<br>");
  }

  function fullNoteLabel(midi) {
    return pitchClassLabel(pitchClassFromMidi(midi)) + octaveFromMidi(midi);
  }
})();
