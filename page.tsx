'use client';

import React, { useMemo, useState } from 'react';
import { Download, Music4, Sparkles } from 'lucide-react';

const SCALES: Record<string, number[]> = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

const ROOT_NOTES: Record<string, number> = {
  A: 57,
  'A#': 58,
  B: 59,
  C: 60,
  'C#': 61,
  D: 62,
  'D#': 63,
  E: 64,
  F: 65,
  'F#': 66,
  G: 67,
  'G#': 68,
};

const PRESETS = {
  anthem: {
    bpm: 172,
    root: 'A',
    scale: 'harmonic_minor',
    energy: 'Alta',
    darkness: 'Media',
    density: 'Alta',
    barsIntro: 8,
    barsBreak: 8,
    barsMain: 16,
    barsOutro: 8,
  },
  oscuro: {
    bpm: 175,
    root: 'F#',
    scale: 'phrygian',
    energy: 'Alta',
    darkness: 'Alta',
    density: 'Media',
    barsIntro: 8,
    barsBreak: 8,
    barsMain: 16,
    barsOutro: 8,
  },
  melodico: {
    bpm: 168,
    root: 'C#',
    scale: 'minor',
    energy: 'Media',
    darkness: 'Baja',
    density: 'Alta',
    barsIntro: 8,
    barsBreak: 8,
    barsMain: 16,
    barsOutro: 8,
  },
};

type NoteEvent = {
  channel: number;
  pitch: number;
  startBeat: number;
  durationBeat: number;
  velocity: number;
};

type Track = {
  name: string;
  channel: number;
  program?: number;
  notes: NoteEvent[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noteInScale(rootNote: number, scaleName: string, degree: number, octaveShift = 0) {
  const scale = SCALES[scaleName];
  const scaleLen = scale.length;
  const octave = Math.floor(degree / scaleLen);
  const idx = ((degree % scaleLen) + scaleLen) % scaleLen;
  return rootNote + scale[idx] + 12 * (octave + octaveShift);
}

function triad(rootNote: number, scaleName: string, degree: number, octaveShift = 0) {
  return [
    noteInScale(rootNote, scaleName, degree, octaveShift),
    noteInScale(rootNote, scaleName, degree + 2, octaveShift),
    noteInScale(rootNote, scaleName, degree + 4, octaveShift),
  ];
}

function pushNote(trackEvents: NoteEvent[], channel: number, pitch: number, startBeat: number, durationBeat: number, velocity: number) {
  trackEvents.push({ channel, pitch, startBeat, durationBeat, velocity });
}

function buildProgression(totalBars: number, darkness: string, rng: () => number) {
  let core = [0, 5, 2, 6];
  if (darkness === 'Alta') core = [0, 6, 5, 4];
  if (darkness === 'Baja') core = [0, 5, 3, 6];

  const result: number[] = [];
  while (result.length < totalBars) {
    const block = [...core];
    if (rng() < 0.35) block[block.length - 1] = pick(rng, [4, 6]);
    result.push(...block);
  }
  return result.slice(0, totalBars);
}

function melodyDurations(density: string) {
  if (density === 'Baja') return [0.5, 1];
  if (density === 'Media') return [0.25, 0.5, 0.5, 0.75];
  return [0.25, 0.25, 0.5, 0.5, 0.75];
}

function melodyPool(rootNote: number, scaleName: string, degree: number, darkness: string) {
  const chord = [
    noteInScale(rootNote, scaleName, degree, 1),
    noteInScale(rootNote, scaleName, degree + 2, 1),
    noteInScale(rootNote, scaleName, degree + 4, 1),
    noteInScale(rootNote, scaleName, degree + 7, 1),
  ];

  const passing = darkness === 'Alta'
    ? [
        noteInScale(rootNote, scaleName, degree + 1, 1),
        noteInScale(rootNote, scaleName, degree + 5, 1),
      ]
    : [
        noteInScale(rootNote, scaleName, degree + 1, 1),
        noteInScale(rootNote, scaleName, degree + 3, 1),
        noteInScale(rootNote, scaleName, degree + 5, 1),
      ];

  return { chord, passing };
}

function shapePhrase(notes: Omit<NoteEvent, 'channel'>[], rng: () => number) {
  if (!notes.length) return notes;
  const shaped = [];
  let prev = notes[0].pitch;

  for (let i = 0; i < notes.length; i++) {
    const current = { ...notes[i] };
    if (i > 0 && Math.abs(current.pitch - prev) > 9) {
      current.pitch = prev + pick(rng, [-7, -5, -3, 3, 5, 7]);
    }
    prev = current.pitch;
    shaped.push(current);
  }

  shaped[shaped.length - 1].pitch = shaped[0].pitch;
  shaped[shaped.length - 1].velocity = clamp(shaped[shaped.length - 1].velocity + 8, 1, 127);
  return shaped;
}

function generateMelodyBar({ rootNote, scaleName, degree, darkness, density, intensity, rng }: any) {
  const { chord, passing } = melodyPool(rootNote, scaleName, degree, darkness);
  const durations = melodyDurations(density);
  const notes = [];
  let beat = 0;

  while (beat < 4) {
    let dur = pick(rng, durations);
    if (beat + dur > 4) dur = 4 - beat;

    const pool = intensity === 'Baja' ? chord : [...chord, ...chord, ...chord, ...passing];
    const pitch = pick(rng, pool);
    const velocity = intensity === 'Baja' ? Math.floor(68 + rng() * 14) : Math.floor(88 + rng() * 24);

    notes.push({ pitch, startBeat: beat, durationBeat: dur, velocity });
    beat += dur;
  }

  return shapePhrase(notes, rng);
}

function intToVarLen(value: number) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function strBytes(str: string) {
  return Array.from(str).map((c) => c.charCodeAt(0));
}

function u32(n: number) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function createTrackChunk(events: any[]) {
  let bytes: number[] = [];
  let lastTick = 0;

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  for (const event of events) {
    const delta = event.tick - lastTick;
    bytes.push(...intToVarLen(delta));
    bytes.push(...event.data);
    lastTick = event.tick;
  }

  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return [...strBytes('MTrk'), ...u32(bytes.length), ...bytes];
}

function buildMidiFile({ title, bpm, tracks }: { title: string; bpm: number; tracks: Track[] }) {
  const ticksPerQuarter = 480;
  const header = [
    ...strBytes('MThd'),
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x01,
    0x00, tracks.length + 1,
    (ticksPerQuarter >> 8) & 0xff,
    ticksPerQuarter & 0xff,
  ];

  const tempoTrackEvents = [];
  const microsecondsPerQuarter = Math.round(60000000 / bpm);
  tempoTrackEvents.push({ tick: 0, order: 0, data: [0xff, 0x03, title.length, ...strBytes(title)] });
  tempoTrackEvents.push({ tick: 0, order: 1, data: [0xff, 0x51, 0x03, (microsecondsPerQuarter >> 16) & 255, (microsecondsPerQuarter >> 8) & 255, microsecondsPerQuarter & 255] });

  const chunks = [createTrackChunk(tempoTrackEvents)];

  tracks.forEach((track) => {
    const events = [];
    events.push({ tick: 0, order: 0, data: [0xff, 0x03, track.name.length, ...strBytes(track.name)] });
    if (typeof track.program === 'number') {
      events.push({ tick: 0, order: 1, data: [0xc0 | track.channel, track.program] });
    }
    track.notes.forEach((note, idx) => {
      const start = Math.round(note.startBeat * ticksPerQuarter);
      const end = Math.round((note.startBeat + note.durationBeat) * ticksPerQuarter);
      const velocity = clamp(note.velocity, 1, 127);
      const pitch = clamp(note.pitch, 0, 127);
      events.push({ tick: start, order: 10 + idx * 2, data: [0x90 | track.channel, pitch, velocity] });
      events.push({ tick: end, order: 11 + idx * 2, data: [0x80 | track.channel, pitch, 0] });
    });
    chunks.push(createTrackChunk(events));
  });

  const bytes = new Uint8Array([...header, ...chunks.flat()]);
  return new Blob([bytes], { type: 'audio/midi' });
}

function buildTrackData(config: any): Track[] {
  const rng = seededRandom(Number(config.seed) || 17);
  const totalBars = config.barsIntro + config.barsBreak + config.barsMain + config.barsOutro;
  const progression = buildProgression(totalBars, config.darkness, rng);
  const rootNote = ROOT_NOTES[config.root];

  const kick: Track = { name: 'Kick', channel: 9, notes: [] };
  const bass: Track = { name: 'Bass', channel: 1, program: 38, notes: [] };
  const lead: Track = { name: 'Lead', channel: 2, program: 81, notes: [] };
  const pad: Track = { name: 'Pad', channel: 3, program: 89, notes: [] };
  const fx: Track = { name: 'FX', channel: 4, program: 99, notes: [] };

  function addKickBar(bar: number, mode: string) {
    const base = bar * 4;
    const hits = mode === 'break' ? [0, 2] : mode === 'dense' ? [0, 1, 2, 3, 3.5] : [0, 1, 2, 3];
    hits.forEach((h) => pushNote(kick.notes, 9, 36, base + h, 0.22, 120));
  }

  function addBassBar(bar: number, degree: number, energy: string) {
    const base = bar * 4;
    const root = noteInScale(rootNote, config.scale, degree, -1);
    const fifth = noteInScale(rootNote, config.scale, degree + 4, -1);
    const octave = root + 12;
    let pattern: number[][] = [];
    let duration = 0.35;
    let velocity = 95;

    if (energy === 'Baja') {
      pattern = [[0, root], [1, root], [2, fifth], [3, root]];
      duration = 0.75;
      velocity = 80;
    } else if (energy === 'Media') {
      pattern = [[0, root], [0.5, octave], [1, root], [1.5, octave], [2, fifth], [3, root]];
      duration = 0.38;
      velocity = 90;
    } else {
      pattern = [[0, root], [0.5, octave], [1, root], [1.5, octave], [2, fifth], [2.5, octave], [3, root], [3.5, octave]];
      duration = 0.33;
      velocity = 98;
    }
    pattern.forEach(([offset, pitch]) => pushNote(bass.notes, 1, pitch, base + offset, duration, velocity));
  }

  function addMelodyBar(bar: number, degree: number, intensity: string) {
    const base = bar * 4;
    const notes = generateMelodyBar({ rootNote, scaleName: config.scale, degree, darkness: config.darkness, density: config.density, intensity, rng });
    notes.forEach((n: any) => pushNote(lead.notes, 2, n.pitch, base + n.startBeat, n.durationBeat, n.velocity));
  }

  function addPadBar(bar: number, degree: number) {
    const base = bar * 4;
    const chord = triad(rootNote, config.scale, degree, 0);
    chord.forEach((p) => pushNote(pad.notes, 3, p, base, 4, 60));
  }

  function addFxRiser(bar: number) {
    const base = bar * 4;
    const startPitch = config.darkness === 'Alta' ? 69 : 72;
    for (let i = 0; i < 8; i++) pushNote(fx.notes, 4, startPitch + i, base + i * 0.5, 0.28, 72 + i * 4);
  }

  let bar = 0;
  for (let i = 0; i < config.barsIntro; i++) {
    const degree = progression[bar];
    addKickBar(bar, config.energy === 'Alta' ? 'dense' : 'drive');
    addBassBar(bar, degree, config.energy === 'Baja' ? 'Baja' : 'Media');
    if (bar % 2 === 0) addPadBar(bar, degree);
    if (i >= config.barsIntro - 2) addFxRiser(bar);
    bar++;
  }
  for (let i = 0; i < config.barsBreak; i++) {
    const degree = progression[bar];
    addKickBar(bar, i < config.barsBreak - 2 ? 'break' : 'drive');
    addPadBar(bar, degree);
    addMelodyBar(bar, degree, 'Baja');
    if (i >= config.barsBreak - 2) addFxRiser(bar);
    bar++;
  }
  for (let i = 0; i < config.barsMain; i++) {
    const degree = progression[bar];
    addKickBar(bar, config.energy === 'Alta' ? 'dense' : 'drive');
    addBassBar(bar, degree, config.energy);
    addMelodyBar(bar, degree, 'Alta');
    if (i % 4 === 0) addPadBar(bar, degree);
    if (i === 7 || i === 15) addFxRiser(bar);
    bar++;
  }
  for (let i = 0; i < config.barsOutro; i++) {
    const degree = progression[bar];
    addKickBar(bar, i < 4 ? 'drive' : 'break');
    addBassBar(bar, degree, 'Baja');
    if (i < 4) addMelodyBar(bar, degree, 'Baja');
    if (i % 2 === 0) addPadBar(bar, degree);
    bar++;
  }

  return [kick, bass, lead, pad, fx];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cardClass() {
  return 'rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] border border-slate-100';
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function RangeField({ label, value, min, max, step, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}: {value}</label>
      <input className="w-full" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function Page() {
  const [title, setTitle] = useState('RuboyStyle_Inspired_01');
  const [bpm, setBpm] = useState(172);
  const [root, setRoot] = useState('A');
  const [scale, setScale] = useState('harmonic_minor');
  const [energy, setEnergy] = useState('Alta');
  const [darkness, setDarkness] = useState('Media');
  const [density, setDensity] = useState('Alta');
  const [seed, setSeed] = useState('17');
  const [barsIntro, setBarsIntro] = useState(8);
  const [barsBreak, setBarsBreak] = useState(8);
  const [barsMain, setBarsMain] = useState(16);
  const [barsOutro, setBarsOutro] = useState(8);
  const [lastFilename, setLastFilename] = useState('');

  const summary = useMemo(() => {
    const totalBars = barsIntro + barsBreak + barsMain + barsOutro;
    const durationSeconds = Math.round((totalBars * 4 * 60) / bpm);
    return { totalBars, durationSeconds };
  }, [barsIntro, barsBreak, barsMain, barsOutro, bpm]);

  function applyPreset(name: keyof typeof PRESETS) {
    const p = PRESETS[name];
    setBpm(p.bpm);
    setRoot(p.root);
    setScale(p.scale);
    setEnergy(p.energy);
    setDarkness(p.darkness);
    setDensity(p.density);
    setBarsIntro(p.barsIntro);
    setBarsBreak(p.barsBreak);
    setBarsMain(p.barsMain);
    setBarsOutro(p.barsOutro);
  }

  function handleGenerate() {
    const config = { title, bpm, root, scale, energy, darkness, density, seed: Number(seed) || 17, barsIntro, barsBreak, barsMain, barsOutro };
    const tracks = buildTrackData(config);
    const blob = buildMidiFile({ title, bpm, tracks });
    const filename = `${title.replace(/[^a-z0-9_-]/gi, '_') || 'track'}_${bpm}bpm.mid`;
    downloadBlob(blob, filename);
    setLastFilename(filename);
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className={cardClass()}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-slate-900 p-3 text-white"><Music4 className="h-6 w-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">Generador musical makina / remember</h1>
                <p className="mt-1 text-sm text-slate-600">Web app lista para móvil y ordenador. Genera un MIDI original con kick, bajo, lead, pads y FX.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button className="rounded-2xl border px-4 py-3 text-sm font-medium" onClick={() => applyPreset('anthem')}><Sparkles className="mr-2 inline h-4 w-4"/>Anthem</button>
              <button className="rounded-2xl border px-4 py-3 text-sm font-medium" onClick={() => applyPreset('oscuro')}><Sparkles className="mr-2 inline h-4 w-4"/>Oscuro</button>
              <button className="rounded-2xl border px-4 py-3 text-sm font-medium" onClick={() => applyPreset('melodico')}><Sparkles className="mr-2 inline h-4 w-4"/>Melódico</button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-700">Nombre del tema</label>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-3" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <RangeField label="BPM" value={bpm} min={155} max={190} step={1} onChange={setBpm} />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Seed</label>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-3" value={seed} onChange={(e) => setSeed(e.target.value)} />
              </div>
              <SelectField label="Tonalidad" value={root} onChange={setRoot} options={Object.keys(ROOT_NOTES)} />
              <SelectField label="Escala" value={scale} onChange={setScale} options={Object.keys(SCALES)} />
              <SelectField label="Energía" value={energy} onChange={setEnergy} options={['Baja', 'Media', 'Alta']} />
              <SelectField label="Oscuridad" value={darkness} onChange={setDarkness} options={['Baja', 'Media', 'Alta']} />
              <SelectField label="Densidad melódica" value={density} onChange={setDensity} options={['Baja', 'Media', 'Alta']} />
            </div>
          </div>

          <div className={cardClass()}>
            <h2 className="text-xl font-bold">Estructura del tema</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <RangeField label="Intro" value={barsIntro} min={4} max={16} step={4} onChange={setBarsIntro} />
              <RangeField label="Break" value={barsBreak} min={4} max={16} step={4} onChange={setBarsBreak} />
              <RangeField label="Parte principal" value={barsMain} min={8} max={32} step={4} onChange={setBarsMain} />
              <RangeField label="Outro" value={barsOutro} min={4} max={16} step={4} onChange={setBarsOutro} />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className={cardClass()}>
            <h2 className="text-xl font-bold">Generar y descargar</h2>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
              <div className="flex items-center justify-between"><span>Duración aprox.</span><strong>{summary.durationSeconds}s</strong></div>
              <div className="flex items-center justify-between"><span>Compases totales</span><strong>{summary.totalBars}</strong></div>
              <div className="flex items-center justify-between"><span>Salida</span><strong>MIDI multipista</strong></div>
            </div>
            <button className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-4 text-white font-semibold" onClick={handleGenerate}><Download className="mr-2 inline h-5 w-5"/>Generar MIDI</button>
            {lastFilename ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Archivo generado: <strong>{lastFilename}</strong></div> : null}
            <div className="mt-4 rounded-2xl border p-4 text-sm text-slate-600">Después ábrelo en FL Studio, Ableton, Cubase o Logic y asigna tus sonidos favoritos.</div>
          </div>

          <div className={cardClass()}>
            <h2 className="text-xl font-bold">Publicación</h2>
            <p className="mt-3 text-sm text-slate-600">Sube esta carpeta a Vercel. Al publicar tendrás un enlace real y lo abrirás desde iPhone o Android sin depender del ordenador.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
