let ctx: AudioContext | null = null

/**
 * Original four-note "treasure" motif: E5 – G5 – D6 – C6.
 * Sine body + a soft triangle overtone, fed through a short echo so it rings in the shrine.
 */
export function playChime() {
  ctx ??= new AudioContext()
  const ac = ctx
  if (ac.state === 'suspended') void ac.resume()
  const t0 = ac.currentTime + 0.05

  const master = ac.createGain()
  master.gain.value = 0.22
  const delay = ac.createDelay()
  delay.delayTime.value = 0.27
  const feedback = ac.createGain()
  feedback.gain.value = 0.35
  const wet = ac.createGain()
  wet.gain.value = 0.45

  master.connect(ac.destination)
  master.connect(delay)
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  wet.connect(ac.destination)

  const notes: [freq: number, at: number][] = [
    [659.25, 0],
    [783.99, 0.17],
    [1174.66, 0.34],
    [1046.5, 0.56],
  ]

  notes.forEach(([freq, at], i) => {
    const last = i === notes.length - 1
    const dur = last ? 2.2 : 0.7
    const start = t0 + at
    for (const [type, mult, vol] of [
      ['sine', 1, 1],
      ['triangle', 2, 0.18],
    ] as const) {
      const osc = ac.createOscillator()
      osc.type = type
      osc.frequency.value = freq * mult
      const env = ac.createGain()
      env.gain.setValueAtTime(0.0001, start)
      env.gain.exponentialRampToValueAtTime(vol, start + 0.012)
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(env).connect(master)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    }
  })
}
