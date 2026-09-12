(() => {
  "use strict";

  const presets = Object.freeze([
    { id: "minor-third", name: "Minor third", intervals: [0, 3] },
    { id: "major-third", name: "Major third", intervals: [0, 4] },
    { id: "perfect-fourth", name: "Perfect fourth", intervals: [0, 5] },
    { id: "perfect-fifth", name: "Perfect fifth", intervals: [0, 7] },
    { id: "minor-sixth", name: "Minor sixth", intervals: [0, 8] },
    { id: "major-sixth", name: "Major sixth", intervals: [0, 9] },
    { id: "octave", name: "Octave", intervals: [0, 12] },
    { id: "major-triad", name: "Major triad", intervals: [0, 4, 7] },
    { id: "minor-triad", name: "Minor triad", intervals: [0, 3, 7] },
    { id: "dominant-seventh", name: "Dominant seventh", intervals: [0, 4, 7, 10] },
    { id: "major-seventh", name: "Major seventh", intervals: [0, 4, 7, 11] },
    { id: "minor-seventh", name: "Minor seventh", intervals: [0, 3, 7, 10] }
  ].map(preset => Object.freeze({
    id: preset.id,
    name: preset.name,
    intervals: Object.freeze(preset.intervals)
  })));

  function notesFor(note, presetId) {
    const preset = presets.find(item => item.id === presetId) ||
      presets.find(item => item.id === "major-third");
    return preset.intervals.map((interval, index) => ({
      // Preserve the exact register, even when it exceeds the visible instruments.
      midi: note.midi + interval,
      preferredString: index === 0 && note.preferredString != null ? note.preferredString : null
    }));
  }

  function mapPositions(notes, tuning, maxFret) {
    const candidates = notes.map((note, noteIndex) => {
      const positions = [];
      for (let stringNumber = 1; stringNumber <= tuning.length; stringNumber += 1) {
        const fret = note.midi - tuning[tuning.length - stringNumber];
        if (Number.isInteger(fret) && fret >= 0 && fret <= maxFret) {
          positions.push({ stringNumber, fret });
        }
      }
      if (noteIndex === 0) {
        const preferred = positions.find(position => position.stringNumber === note.preferredString);
        if (preferred) return [preferred];
      }
      return positions;
    });

    let best = null;
    let bestCount = -1;
    let bestFretSum = Infinity;
    let bestHighestFret = Infinity;
    const current = [];
    const usedStrings = new Set();

    function visit(index, count, fretSum, highestFret) {
      if (count + notes.length - index < bestCount) return;
      if (index === notes.length) {
        // At equal total cost, keep the hand lower on the neck. Candidates use
        // string-number order to make ties in both fret measures deterministic.
        if (count > bestCount || (count === bestCount &&
            (fretSum < bestFretSum || (fretSum === bestFretSum && highestFret < bestHighestFret)))) {
          best = current.slice();
          bestCount = count;
          bestFretSum = fretSum;
          bestHighestFret = highestFret;
        }
        return;
      }

      for (const position of candidates[index]) {
        if (usedStrings.has(position.stringNumber)) continue;
        current[index] = position;
        usedStrings.add(position.stringNumber);
        visit(index + 1, count + 1, fretSum + position.fret, Math.max(highestFret, position.fret));
        usedStrings.delete(position.stringNumber);
      }

      // Keep a playable source note even if dropping it would fit more harmonies.
      if (index !== 0 || candidates[index].length === 0) {
        current[index] = null;
        visit(index + 1, count, fretSum, highestFret);
      }
    }

    visit(0, 0, 0, 0);
    return best;
  }

  const api = Object.freeze({ presets, notesFor, mapPositions });
  if (typeof window !== "undefined") window.Harmony = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
