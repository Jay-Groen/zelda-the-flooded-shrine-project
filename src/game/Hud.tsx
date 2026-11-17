import { LEVEL_NAMES } from './constants'
import { useGame } from './store'
import { LEVELS, useLevels } from './levels'
import { useMirrorHall } from './mirror/store'

const formatTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Hud() {
  const active = useLevels((s) => s.active)
  return (
    <div className="hud">
      {active === 0 ? <ShrineHud /> : <MirrorHallHud />}
      <LevelNav />
    </div>
  )
}

/** "‹  Level 01 · The Flooded Shrine  ›" — slides the camera to the neighbouring diorama. */
function LevelNav() {
  const active = useLevels((s) => s.active)
  const cleared = useLevels((s) => s.cleared)
  const go = useLevels((s) => s.go)
  const level = LEVELS[active]
  return (
    <nav className="level-nav" aria-label="Levels">
      <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous level">
        ‹
      </button>
      <div className="level-nav-label">
        <span>
          Level {level.number}
          {cleared[active] && <i className="level-nav-check" aria-label="cleared"> ✓</i>}
        </span>
        <small>{level.name}</small>
      </div>
      <button onClick={() => go(active + 1)} disabled={active === LEVELS.length - 1} aria-label="Next level">
        ›
      </button>
    </nav>
  )
}

function ShrineHud() {
  const level = useGame((s) => s.level)
  const nearChest = useGame((s) => s.nearChest)
  const chestOpen = useGame((s) => s.chestOpen)
  const finished = useGame((s) => s.finished)
  const beat = useGame((s) => s.beat)
  const startedAt = useGame((s) => s.startedAt)
  const finishedAt = useGame((s) => s.finishedAt)
  const reset = useGame((s) => s.reset)
  const go = useLevels((s) => s.go)

  return (
    <div className={chestOpen ? 'hud-finale' : ''}>
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
          <div className="hud-end-actions">
            <button onClick={reset}>Play again</button>
            <button onClick={() => go(1)}>Next: The Mirror Hall ›</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MirrorHallHud() {
  const reachable = useMirrorHall((s) => s.reachable)
  const solved = useMirrorHall((s) => s.solved)
  return (
    <div className={solved ? 'hud-finale' : ''}>
      <div className="hud-top">
        <h1>The Mirror Hall</h1>
        <p>
          <kbd>WASD</kbd> move · stand next to a mirror and click it or press <kbd>E</kbd> to turn it ·{' '}
          <kbd>R</kbd> reset
        </p>
        <p className="level">Guide the sunlight to the crystal</p>
      </div>

      {reachable >= 0 && !solved && <div className="hud-prompt">Click the mirror or press E to turn it</div>}

      {solved && (
        <div className="hud-banner hud-banner-fade" key="hall">
          <small>The crystal awakens</small>
          The light finds its way
        </div>
      )}
    </div>
  )
}
