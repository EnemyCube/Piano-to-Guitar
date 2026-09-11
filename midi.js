(() => {
  "use strict";

  // Standard MIDI File events are ordered in ticks, regardless of tempo changes.
  // https://midi.org/standard-midi-files-specification
  const maxFileBytes = 5 * 1024 * 1024;
  const maxNotes = 10000;
  const maxTracks = 256;
  const maxEvents = 500000;

  function parse(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("Choose a MIDI file to import.");
    }
    if (arrayBuffer.byteLength > maxFileBytes) {
      throw new Error("This MIDI file is too large. Choose a file under 5 MB.");
    }

    const bytes = new Uint8Array(arrayBuffer);
    const data = new DataView(arrayBuffer);
    let offset = 0;
    let boundary = bytes.length;
    let trackIndex = -1;
    let noteCount = 0;
    let eventCount = 0;
    let percussionCount = 0;

    function fail(message) {
      const location = trackIndex < 0 ? "" : ` in track ${trackIndex + 1}`;
      throw new Error(`Invalid MIDI file${location}: ${message}`);
    }

    function requireBytes(length) {
      if (length > boundary - offset) {
        fail("the file is incomplete or an event length is incorrect.");
      }
    }

    function readByte() {
      requireBytes(1);
      return bytes[offset++];
    }

    function readDataByte() {
      const value = readByte();
      if (value > 0x7f) fail("a note or event contains an invalid data byte.");
      return value;
    }

    function readUint16() {
      requireBytes(2);
      const value = data.getUint16(offset);
      offset += 2;
      return value;
    }

    function readUint32() {
      requireBytes(4);
      const value = data.getUint32(offset);
      offset += 4;
      return value;
    }

    function readTag() {
      requireBytes(4);
      const value = String.fromCharCode(...bytes.subarray(offset, offset + 4));
      offset += 4;
      return value;
    }

    function readVariableLength() {
      let value = 0;
      for (let index = 0; index < 4; index += 1) {
        const next = readByte();
        value = value * 128 + (next & 0x7f);
        if ((next & 0x80) === 0) return value;
      }
      fail("an event time or length exceeds four bytes.");
    }

    if (bytes.length < 14 || readTag() !== "MThd") {
      throw new Error("This is not a standard MIDI file. Choose a .mid or .midi file.");
    }
    const headerLength = readUint32();
    if (headerLength < 6) fail("the MIDI header is too short.");
    requireBytes(headerLength);
    const headerEnd = offset + headerLength;
    const format = readUint16();
    const trackCount = readUint16();
    const division = readUint16();
    if (format === 2) {
      throw new Error("MIDI format 2 contains independent sequences. Export it as MIDI format 0 or 1 to import it.");
    }
    if (format !== 0 && format !== 1) {
      throw new Error("This MIDI format is not supported. Choose a standard MIDI format 0 or 1 file.");
    }
    if (trackCount === 0 || (format === 0 && trackCount !== 1)) {
      fail("the header declares an incorrect number of tracks.");
    }
    if (trackCount > maxTracks) {
      throw new Error(`This MIDI file has too many tracks. Export at most ${maxTracks} tracks.`);
    }
    if (division & 0x8000) {
      const framesPerSecond = (division >> 8) - 256;
      if (![-24, -25, -29, -30].includes(framesPerSecond) || (division & 0xff) === 0) {
        fail("the SMPTE timing resolution is incorrect.");
      }
    } else if (division === 0) {
      fail("the timing resolution must be greater than zero.");
    }
    offset = headerEnd;

    const tracks = [];
    while (offset < bytes.length) {
      trackIndex = -1;
      boundary = bytes.length;
      const tag = readTag();
      const chunkLength = readUint32();
      requireBytes(chunkLength);
      const chunkEnd = offset + chunkLength;
      if (tag === "MThd") fail("the file contains a second header.");
      // The standard allows unfamiliar chunks; their declared lengths still matter.
      if (tag !== "MTrk") {
        offset = chunkEnd;
        continue;
      }
      if (tracks.length >= trackCount) fail("the file contains more tracks than its header declares.");

      trackIndex = tracks.length;
      boundary = chunkEnd;
      const track = { index: trackIndex, name: "", notes: [] };
      let tick = 0;
      let runningStatus = 0;
      let ended = false;

      while (offset < boundary) {
        eventCount += 1;
        if (eventCount > maxEvents) {
          throw new Error("This MIDI file has too many events. Export a shorter section to import it.");
        }
        tick += readVariableLength();
        if (!Number.isSafeInteger(tick)) fail("the track is too long.");
        requireBytes(1);
        let status = bytes[offset];
        if (status < 0x80) {
          if (runningStatus === 0) fail("an event is missing its MIDI status byte.");
          status = runningStatus;
        } else {
          offset += 1;
          runningStatus = status < 0xf0 ? status : 0;
        }

        if (status === 0xff) {
          const type = readDataByte();
          const length = readVariableLength();
          requireBytes(length);
          if (type === 0x2f) {
            if (length !== 0) fail("the end-of-track event has an incorrect length.");
            if (offset !== boundary) fail("data follows the end-of-track event.");
            ended = true;
            break;
          }
          if (type === 0x03 && !track.name) {
            const nameBytes = bytes.subarray(offset, offset + Math.min(length, 1024));
            track.name = new TextDecoder().decode(nameBytes)
              .replace(/[\u0000-\u001f\u007f]/g, " ")
              .replace(/\s+/g, " ").trim().slice(0, 120);
          }
          offset += length;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          const length = readVariableLength();
          requireBytes(length);
          offset += length;
          continue;
        }
        if (status >= 0xf0) fail("an unsupported system event appears outside a SysEx event.");

        const type = status >> 4;
        const channel = status & 0x0f;
        const first = readDataByte();
        const second = type === 0xc || type === 0xd ? 0 : readDataByte();
        // A zero-velocity note-on is a note-off, not another tab entry.
        if (type === 0x9 && second !== 0) {
          if (channel === 9) {
            percussionCount += 1;
          } else {
            noteCount += 1;
            if (noteCount > maxNotes) {
              throw new Error("This MIDI file contains more than 10,000 pitched notes. Export a shorter section to import it.");
            }
            track.notes.push({ midi: first, tick, channel, order: eventCount });
          }
        }
      }
      if (!ended) fail("the track is missing its end-of-track event.");
      tracks.push(track);
      offset = chunkEnd;
    }
    trackIndex = -1;
    if (tracks.length !== trackCount) fail("one or more declared tracks are missing.");
    return { format, tracks, percussionCount };
  }

  window.MidiImport = Object.freeze({ parse, maxFileBytes, maxNotes });
})();