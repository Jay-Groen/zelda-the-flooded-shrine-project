import { LEVEL_NAMES } from './constants'
import { useGame } from './store'

const formatTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Hud() {
  const level = useGame((s) => s.level)
  const nearChest = useGame((s) => s.nearChest)
  const chestOpen = useGame((s) => s.chestOpen)
  const finished = useGame((s) => s.finished)
  const beat = useGame((s) => s.beat)
  const startedAt = useGame((s) => s.startedAt)
  const finishedAt = useGame((s) => s.finishedAt)
  const reset = useGame((s) => s.reset)

  return (
    <div className={`hud ${chestOpen ? 'hud-finale' : ''}`}>
      <div className="hud-top">
        <h1>The Flooded Shrine</h1>
        <p>
          <kbd>WASD</kbd> move · <kbd>Space</kbd> jump/climb · <kbd>E</kbd> open · click ▲▼ on the
          pedestal · <kbd>R</kbd> reset
        </p>
        <p className="level">Water: {LEVEL_NAMES[level]}</p>
      </div>

      {nearChest && !chestOpen && <div className="hud-prompt">Press E to open</div>}

      {beat === 1 && (
        <div className="hud-banner" key="pearl">
          <small>You found</small>
          The Tide Pearl
        </div>
      )}
      {beat === 2 && !finished && (
        <div className="hud-banner hud-banner-fade" key="exit">
          <small>Sunlight floods the shrine</small>
          The way out is open
        </div>
      )}

      {finished && (
        <div className="hud-end">
          <h2>Shrine cleared</h2>
          <p>Time: {formatTime(finishedAt - startedAt)}</p>
          <button onClick={reset}>Play again</button>
        </div>
      )}
    </div>
  )
}
