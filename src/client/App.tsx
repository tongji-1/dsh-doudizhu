import React from 'react'
import { FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import { cardText, isJoker, isRed, rankText, sortForDisplay, type Card } from './cards.ts'
import { comboText } from './combos.ts'
import { canPass, isCounterRob, isLandlordChoice, legalMoves, type GameState, type Seat } from './game.ts'
import { format } from './i18n.ts'
import type { StandardProps, TableFace } from './services.ts'
import { analyzeSelection } from './selection.ts'
import { clampBox, QUICK_TALKS, type TableSnapshot, type WindowBox } from './store.ts'
import { deriveWorkNotice, type WorkNotice, type WorkSessionSummary } from './work-status.ts'

type T = (key: string) => string

interface NavigationEntryProps extends StandardProps, TableFace {
  readonly t: T
}

interface WindowProps extends StandardProps, TableFace {
  readonly t: T
}

interface MaidCharacterSources {
  readonly left?: string | undefined
  readonly right?: string | undefined
}

function currentRunning(props: StandardProps): boolean {
  return props.useSessions(state => state.current === undefined ? false : state.byId[state.current]?.running === true)
}

/** True when the hand is waiting on the human — the badge the header action shows. */
function awaitingUser(game: GameState): boolean {
  return game.phase !== 'over' && game.turn === game.userSeat
}

function WorkReminder({ notice, t, onReturn }: { notice: WorkNotice; t: T; onReturn: () => void }): React.ReactElement {
  const message = notice.kind === 'approval'
    ? t('workApproval')
    : notice.kind === 'plan-review'
      ? t('workPlanReview')
      : notice.kind === 'question'
        ? t('workQuestion')
        : notice.kind === 'completed'
          ? t('workCompleted')
          : format(t('workRunning'), notice.title === '' ? t('currentTask') : notice.title)
  return (
    <div className="ddz-work-reminder" data-kind={notice.kind} role="status" aria-live="polite">
      <span className="ddz-work-indicator" aria-hidden />
      <strong>{t('workReminder')}</strong>
      <span className="ddz-work-message">{message}</span>
      <button type="button" onClick={onReturn}>
        {notice.kind === 'completed' ? t('viewResult') : notice.kind === 'running' ? t('returnToWork') : t('handleNow')}
      </button>
    </div>
  )
}

/** Reuse the two character images owned by the active maid skin. */
function readMaidCharacterSources(): MaidCharacterSources {
  if (typeof document === 'undefined') return {}
  const source = (side: 'left' | 'right'): string | undefined => {
    const image = document.querySelector<HTMLImageElement>(`img[data-maid-character="${side}"]`)
    const value = image?.currentSrc || image?.src
    return value === '' ? undefined : value
  }
  return { left: source('left'), right: source('right') }
}

function useMaidCharacterSources(): MaidCharacterSources {
  const [sources, setSources] = React.useState<MaidCharacterSources>(readMaidCharacterSources)
  React.useEffect(() => {
    const sync = (): void => {
      const next = readMaidCharacterSources()
      setSources(current => current.left === next.left && current.right === next.right ? current : next)
    }
    sync()
    if (typeof MutationObserver === 'undefined') return undefined
    const touchesCharacter = (node: Node): boolean => node instanceof Element
      && (node.matches('img[data-maid-character]') || node.querySelector('img[data-maid-character]') !== null)
    const observer = new MutationObserver(records => {
      const changed = records.some(record => record.type === 'attributes'
        ? record.target instanceof Element && record.target.matches('img[data-maid-character]')
        : [...record.addedNodes, ...record.removedNodes].some(touchesCharacter))
      if (changed) sync()
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['src'],
      childList: true,
      subtree: true,
    })
    return () => { observer.disconnect() }
  }, [])
  return sources
}

export function NavigationEntry(props: NavigationEntryProps): React.ReactElement {
  const running = currentRunning(props)
  const waiting = props.useTable(state => awaitingUser(state.game) && !(state.open && !state.minimized))
  return (
    <button
      type="button"
      data-ddz-nav-entry
      aria-label={props.t('entry')}
      title={`${props.t('entry')} — ${running ? props.t('agentRunning') : props.t('tagline')}`}
      onClick={props.openTable}
    >
      <span className="ddz-entry-icon" aria-hidden>
        <span className="ddz-entry-card" /><span className="ddz-entry-card" /><span className="ddz-entry-pip">地</span>
      </span>
      <span className="ddz-entry-copy">{props.t('entry')}</span>
      {waiting ? <span className="ddz-entry-dot" aria-hidden /> : null}
    </button>
  )
}

function CardFace({ card, selected, dim, onToggle, onDragStart }: {
  card: Card
  selected?: boolean | undefined
  dim?: boolean | undefined
  onToggle?: ((id: number) => void) | undefined
  onDragStart?: ((event: React.PointerEvent, id: number) => void) | undefined
}): React.ReactElement {
  const joker = isJoker(card.rank)
  const body = (
    <>
      <span className="ddz-card-rank">{joker ? (card.rank === 17 ? '大' : '小') : rankText(card.rank)}</span>
      <span className="ddz-card-suit">{joker ? '王' : cardText(card).slice(-1)}</span>
    </>
  )
  if (onToggle === undefined) {
    return <span className="ddz-card" data-red={String(isRed(card))} data-dim={dim === true ? 'true' : undefined}>{body}</span>
  }
  return (
    <button
      type="button"
      className="ddz-card"
      data-red={String(isRed(card))}
      data-selected={String(selected === true)}
      data-card-id={card.id}
      aria-pressed={selected === true}
      aria-label={cardText(card)}
      onClick={() => { onToggle(card.id) }}
      onPointerDown={onDragStart === undefined ? undefined : (event) => { onDragStart(event, card.id) }}
    >
      {body}
    </button>
  )
}

function CardRow({ cards, empty }: { cards: readonly Card[]; empty?: string }): React.ReactElement {
  if (cards.length === 0) return <span className="ddz-play-empty">{empty ?? ''}</span>
  return (
    <span className="ddz-play-row">
      {sortForDisplay(cards).map(card => <CardFace key={card.id} card={card} />)}
    </span>
  )
}

function BotSeat({ seat, index, game, thinking, talk, characterSrc, t }: {
  seat: Seat
  index: number
  game: GameState
  thinking: boolean
  talk?: string | undefined
  characterSrc?: string | undefined
  t: T
}): React.ReactElement {
  const provisional = game.phase === 'robbing' && game.candidateLandlordSeat === index
  const priority = game.phase === 'robbing' && game.candidateLandlordSeat === null && game.initialLandlordSeat === index
  const role = game.phase === 'robbing'
    ? provisional ? t('provisionalLandlord') : priority ? t('priorityLandlordChoice') : t('robbingRole')
    : game.landlordSeat === null ? undefined : seat.landlord ? t('landlord') : t('farmer')
  return (
    <div
      className="ddz-bot"
      data-acting={String(game.turn === index)}
      data-character={String(characterSrc !== undefined)}
      data-side={index === 1 ? 'left' : 'right'}
    >
      {characterSrc === undefined ? null : (
        <img className="ddz-bot-character" src={characterSrc} alt="" aria-hidden draggable={false} />
      )}
      <div className="ddz-bot-head">
        <span className="ddz-avatar" data-landlord={String(seat.landlord || provisional)}>{seat.landlord ? '地' : provisional ? '候' : priority ? '先' : '抢'}</span>
        <span className="ddz-bot-meta">
          <strong>{seat.name}</strong>
          <span>{role === undefined ? '' : `${role} · `}{seat.hand.length} {t('cards')}</span>
        </span>
        <span className="ddz-bot-tokens">◈ {seat.tokens}</span>
      </div>
      <div className="ddz-bot-play">
        {game.phase === 'robbing' && game.passedRobSeats.includes(index)
          ? <span className="ddz-pass-chip">{t('didNotRob')}</span>
          : game.phase === 'robbing' && game.robbedSeats.includes(index)
            ? <span className="ddz-pass-chip" data-robbed="true">{t('robbed')}</span>
            : seat.passed && seat.lastPlay.length === 0
          ? <span className="ddz-pass-chip">{t('passed')}</span>
          : <CardRow cards={seat.lastPlay} />}
      </div>
      {thinking ? <div className="ddz-thinking"><i /><i /><i /><span>{seat.name} {t('thinking')}</span></div> : null}
      {talk !== undefined ? <div className="ddz-talk" role="status" aria-live="polite">{talk}</div> : null}
    </div>
  )
}

function RobBar({ game, t, onRob }: { game: GameState; t: T; onRob: (take: boolean) => void }): React.ReactElement {
  const counter = isCounterRob(game)
  const choice = isLandlordChoice(game)
  return (
    <div className="ddz-robbar">
      <strong>{choice ? t('landlordChoiceTitle') : counter ? t('counterRobTitle') : t('robTitle')}</strong>
      <div className="ddz-rob-options">
        <button type="button" className="ddz-action" onClick={() => { onRob(false) }}>
          {choice ? t('declineLandlord') : counter ? t('giveUpCounterRob') : t('doNotRob')}
        </button>
        <button type="button" className="ddz-action" data-primary="true" onClick={() => { onRob(true) }}>
          {choice ? t('beLandlord') : counter ? t('counterRob') : t('robLandlord')}
        </button>
      </div>
    </div>
  )
}

/** Live viewport size, so the window can be re-clamped without storing the clamp. */
function useViewport(): { width: number; height: number } {
  const read = (): { width: number; height: number } =>
    ({ width: window.innerWidth, height: window.innerHeight })
  const [viewport, setViewport] = React.useState(read)
  React.useEffect(() => {
    const onResize = (): void => { setViewport(read()) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [])
  return viewport
}

function useDragBox(box: WindowBox, commit: (box: WindowBox) => void): {
  box: WindowBox
  startMove: (event: React.PointerEvent) => void
  startResize: (event: React.PointerEvent) => void
} {
  const [live, setLive] = React.useState<WindowBox | undefined>()
  const current = live ?? box

  const begin = (event: React.PointerEvent, mode: 'move' | 'resize'): void => {
    event.preventDefault()
    const origin = { x: event.clientX, y: event.clientY }
    const start = current
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    let latest = start
    const onMove = (move: PointerEvent): void => {
      const dx = move.clientX - origin.x
      const dy = move.clientY - origin.y
      const next = mode === 'move'
        ? { ...start, x: start.x + dx, y: start.y + dy }
        : { ...start, width: start.width + dx, height: start.height + dy }
      latest = clampBox(next, window.innerWidth, window.innerHeight)
      setLive(latest)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setLive(undefined)
      commit(latest)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return {
    box: current,
    startMove: (event) => { begin(event, 'move') },
    startResize: (event) => { begin(event, 'resize') },
  }
}

function statusLine(snapshot: TableSnapshot, t: T): string {
  const { game } = snapshot
  if (game.phase === 'over') return game.result ?? t('handOver')
  if (game.phase === 'robbing') {
    if (game.turn !== game.userSeat) return format(t('waitingRob'), game.seats[game.turn ?? 0]?.name ?? '')
    return isLandlordChoice(game) ? t('landlordChoiceTitle') : isCounterRob(game) ? t('counterRobTitle') : t('robTitle')
  }
  if (game.turn !== game.userSeat) return t('waiting')
  if (game.required === null) return t('yourLead')
  return `${t('mustBeat')} ${comboText(game.required)}`
}

export function TableWindow(props: WindowProps): React.ReactElement | null {
  const snapshot = props.useTable(state => state)
  const workSession = props.useSessions(state => state.current === undefined
    ? undefined
    : state.byId[state.current] as WorkSessionSummary | undefined)
  const running = workSession?.running === true
  const { game } = snapshot
  const viewport = useViewport()
  const drag = useDragBox(snapshot.box, props.setBox)
  const { startMove, startResize } = drag
  const box = clampBox(drag.box, viewport.width, viewport.height)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [quickTalkOpen, setQuickTalkOpen] = React.useState(false)
  const [workCompleted, setWorkCompleted] = React.useState(false)
  const previousWork = React.useRef<{ summary?: WorkSessionSummary; running: boolean }>({ running: false })
  const dragGesture = React.useRef<{
    pointerId: number
    cardId: number
    x: number
    y: number
    selecting: boolean
    dragging: boolean
    seen: Set<number>
  } | undefined>()
  const suppressClick = React.useRef(false)
  const maidCharacters = useMaidCharacterSources()

  React.useEffect(() => {
    if (!snapshot.open || snapshot.minimized) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (settingsOpen) setSettingsOpen(false)
      else props.setMinimized(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true) }
  }, [snapshot.open, snapshot.minimized, settingsOpen, props.setMinimized])

  React.useEffect(() => {
    const previous = previousWork.current
    if (workSession?.running === true) setWorkCompleted(false)
    else if (previous.running && workSession !== undefined && workSession.pendingInteraction === undefined) setWorkCompleted(true)
    previousWork.current = { ...(workSession === undefined ? {} : { summary: workSession }), running: workSession?.running === true }
  }, [workSession])

  if (!snapshot.open) return null

  const hero = game.seats[game.userSeat] as Seat
  const heroTurn = awaitingUser(game)
  const selection = new Set(snapshot.selection)
  const selectionState = analyzeSelection(game, game.userSeat, snapshot.selection)
  const combo = selectionState.kind === 'valid' || selectionState.kind === 'too-low' ? selectionState.combo : undefined
  const playable = heroTurn && game.phase === 'playing' && selectionState.kind === 'valid'
  const legal = heroTurn && game.phase === 'playing' ? legalMoves(game, game.userSeat) : []
  const hintIndex = legal.findIndex(move =>
    move.cards.length === selection.size && move.cards.every(card => selection.has(card.id)))
  const selectionMessage = selectionState.kind === 'invalid'
    ? props.t('selectionInvalid')
    : selectionState.kind === 'too-low'
      ? `${props.t('selectionTooLow')} ${comboText(selectionState.required)}`
      : selectionState.kind === 'valid'
        ? `${comboText(selectionState.combo)} · ${props.t('selectionPlayable')}`
        : ''
  const heroTalk = snapshot.talks.find(talk => talk.seat === game.userSeat)?.text
  const rankings = game.phase === 'over'
    ? game.seats.map((seat, index) => ({ seat, index })).sort((left, right) => right.seat.tokens - left.seat.tokens)
    : []
  const workNotice = deriveWorkNotice(workSession, workCompleted)
  const returnToWork = (): void => {
    setWorkCompleted(false)
    props.setMinimized(true)
  }

  const startCardDrag = (event: React.PointerEvent, cardId: number): void => {
    if (!heroTurn || game.phase !== 'playing') return
    const selecting = !selection.has(cardId)
    const gesture = {
      pointerId: event.pointerId,
      cardId,
      x: event.clientX,
      y: event.clientY,
      selecting,
      dragging: false,
      seen: new Set<number>(),
    }
    dragGesture.current = gesture
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)
    const selectAtPoint = (x: number, y: number): void => {
      const card = document.elementsFromPoint(x, y)
        .find(element => element instanceof HTMLElement && element.dataset.cardId !== undefined) as HTMLElement | undefined
      const id = Number(card?.dataset.cardId)
      if (!Number.isInteger(id) || gesture.seen.has(id)) return
      gesture.seen.add(id)
      props.setCardSelected(id, gesture.selecting)
    }
    const onMove = (move: PointerEvent): void => {
      if (move.pointerId !== gesture.pointerId) return
      const distance = Math.hypot(move.clientX - gesture.x, move.clientY - gesture.y)
      if (!gesture.dragging && distance >= 5) {
        gesture.dragging = true
        gesture.seen.add(gesture.cardId)
        props.setCardSelected(gesture.cardId, gesture.selecting)
      }
      if (gesture.dragging) {
        move.preventDefault()
        selectAtPoint(move.clientX, move.clientY)
      }
    }
    const onUp = (up: PointerEvent): void => {
      if (up.pointerId !== gesture.pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragGesture.current = undefined
      if (gesture.dragging) {
        suppressClick.current = true
        setTimeout(() => { suppressClick.current = false }, 0)
      }
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const toggleCard = (id: number): void => {
    if (suppressClick.current) return
    props.toggleCard(id)
  }

  if (snapshot.minimized) {
    return (
      <div className="ddz-pill" data-waiting={String(heroTurn)}>
        <button type="button" className="ddz-pill-main" onClick={() => { props.setMinimized(false) }}>
          <FishLogo size={14} />
          <span>{props.t('entry')}</span>
          <em>{heroTurn ? props.t('yourTurn') : statusLine(snapshot, props.t)}</em>
        </button>
        <button type="button" className="ddz-pill-close" aria-label={props.t('close')} onClick={props.closeTable}>×</button>
      </div>
    )
  }

  return (
    <section
      className="ddz-window"
      role="dialog"
      aria-label={props.t('entry')}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <header className="ddz-titlebar" onPointerDown={startMove} title={props.t('dragHint')}>
        <div className="ddz-title">
          <FishLogo size={15} />
          <strong>{props.t('entry')}</strong>
          <span>{format(props.t('handNumber'), game.handNumber)}</span>
        </div>
        <div className="ddz-title-actions" onPointerDown={(event) => { event.stopPropagation() }}>
          <span className="ddz-agent" data-running={String(running)}>
            <i />{running ? props.t('agentRunning') : props.t('agentIdle')}
          </span>
          <button
            type="button"
            className="ddz-ghost"
            data-active={String(settingsOpen)}
            aria-label={props.t('settings')}
            aria-expanded={settingsOpen}
            onClick={() => { setSettingsOpen(open => !open) }}
          >⚙</button>
          <button type="button" className="ddz-ghost" aria-label={props.t('minimize')} onClick={() => { props.setMinimized(true) }}>–</button>
          <button type="button" className="ddz-ghost" aria-label={props.t('close')} onClick={props.closeTable}>×</button>
        </div>
      </header>

      {settingsOpen ? (
        <div className="ddz-settings" role="group" aria-label={props.t('settings')}>
          <label className="ddz-switch">
            <input
              type="checkbox"
              checked={snapshot.useModel}
              onChange={(event) => { props.setUseModel(event.currentTarget.checked) }}
            />
            <span><strong>{props.t('opponentModel')}</strong><em>{props.t('opponentModelHint')}</em></span>
          </label>
          <button type="button" className="ddz-action" onClick={props.resetTable}>{props.t('reset')}</button>
        </div>
      ) : null}

      {workNotice === undefined ? null : <WorkReminder notice={workNotice} t={props.t} onReturn={returnToWork} />}

      <div className="ddz-bots">
        {[1, 2].map(index => (
          <BotSeat
            key={index}
            seat={game.seats[index] as Seat}
            index={index}
            game={game}
            thinking={snapshot.thinkingSeat === index}
            talk={snapshot.talks.find(talk => talk.seat === index)?.text}
            characterSrc={index === 1 ? maidCharacters.left : maidCharacters.right}
            t={props.t}
          />
        ))}
      </div>

      <div className="ddz-center" data-result={String(game.phase === 'over')}>
        {game.phase === 'over' ? (
          <div className="ddz-settlement" data-match-over={String(game.matchOver)} role="status" aria-live="polite">
            <strong>{game.matchOver ? props.t('matchOver') : props.t('handOver')}</strong>
            <span className="ddz-settlement-result">{game.result}</span>
            {game.settlement === undefined ? null : (
              <span className="ddz-settlement-payment">
                <span>{format(props.t('settlementExpected'), game.settlement.stake * 2)}</span>
                <i aria-hidden>→</i>
                <span>{format(props.t('settlementPaid'), game.settlement.paid)}</span>
              </span>
            )}
            {game.matchOver ? <span className="ddz-settlement-bankrupt">{format(props.t('bankrupt'), game.bankruptSeats.map(index => game.seats[index]?.name ?? '').join('、'))}</span> : null}
            <ol>
              {rankings.map(({ seat, index }, rank) => (
                <li key={seat.id} data-bankrupt={String(game.bankruptSeats.includes(index))}>
                  <b>{rank + 1}</b><span>{seat.name}</span><em>◈ {seat.tokens}</em>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="ddz-bottom-cards">
              <span className="ddz-label">{props.t('bottom')}</span>
              {game.bottomRevealed
                ? sortForDisplay(game.bottom).map(card => <CardFace key={card.id} card={card} />)
                : game.bottom.map(card => <span key={card.id} className="ddz-card ddz-card-back"><FishLogo size={16} /></span>)}
            </div>
            <div className="ddz-meta">
              <span>{props.t('baseScore')} <strong>{game.baseScore}</strong></span>
              <span>{props.t('multiplier')} <strong>×{game.multiplier}</strong></span>
              {game.phase === 'robbing' ? <span>{props.t('robCount')} <strong>{game.robCount}</strong></span> : null}
              <span>{props.t('tokens')} <strong>◈ {hero.tokens}</strong></span>
              {snapshot.status !== undefined ? (
                <span className="ddz-source" data-source={snapshot.status.source} title={snapshot.status.error ?? snapshot.status.model ?? ''}>
                  {snapshot.status.source === 'model' ? props.t('modelSource') : props.t('localSource')}
                </span>
              ) : null}
            </div>
            <p className="ddz-log">{game.logs.at(-1) ?? ''}</p>
          </>
        )}
      </div>

      {game.phase === 'over' ? null : <div className="ddz-hero">
        <div className="ddz-hero-head">
          <span
            className="ddz-avatar"
            data-landlord={String(hero.landlord || (game.phase === 'robbing' && game.candidateLandlordSeat === game.userSeat))}
          >{hero.landlord
            ? '地'
            : game.phase === 'robbing' && game.candidateLandlordSeat === game.userSeat
              ? '候'
              : game.phase === 'robbing' && game.candidateLandlordSeat === null && game.initialLandlordSeat === game.userSeat
                ? '先'
                : game.phase === 'robbing' ? '抢' : '农'}</span>
          <span className="ddz-hero-copy">
            <strong>{hero.name}</strong>
            <span>{statusLine(snapshot, props.t)}</span>
          </span>
          <span className="ddz-hero-tokens">◈ {hero.tokens}</span>
          {combo !== undefined ? <span className="ddz-combo">{comboText(combo)}</span> : null}
          <button
            type="button"
            className="ddz-talk-trigger"
            aria-expanded={quickTalkOpen}
            aria-label={props.t('quickTalk')}
            onClick={() => { setQuickTalkOpen(open => !open) }}
          >…</button>
          {heroTalk === undefined ? null : <span className="ddz-hero-talk" role="status">{heroTalk}</span>}
          {quickTalkOpen ? (
            <div className="ddz-talk-menu">
              {QUICK_TALKS.map(text => (
                <button key={text} type="button" onClick={() => { props.sendQuickTalk(text); setQuickTalkOpen(false) }}>{text}</button>
              ))}
            </div>
          ) : null}
        </div>
        {selectionMessage === '' ? null : <div className="ddz-selection-status" data-valid={String(selectionState.kind === 'valid')}>{selectionMessage}</div>}
        <div className="ddz-hand" data-count={hero.hand.length}>
          {sortForDisplay(hero.hand).map(card => (
            <CardFace
              key={card.id}
              card={card}
              selected={selection.has(card.id)}
              onToggle={heroTurn && game.phase === 'playing' ? toggleCard : undefined}
              onDragStart={heroTurn && game.phase === 'playing' ? startCardDrag : undefined}
            />
          ))}
        </div>
      </div>}

      <footer className="ddz-controls">
        {game.phase === 'over' ? (
          <button type="button" className="ddz-action" data-primary="true" onClick={props.nextHand}>
            {game.matchOver ? props.t('restartMatch') : props.t('nextHand')}
          </button>
        ) : game.phase === 'robbing' ? (
          heroTurn ? <RobBar game={game} t={props.t} onRob={props.decideRob} /> : <span className="ddz-waiting">{format(props.t('waitingRob'), game.seats[game.turn ?? 0]?.name ?? '')}</span>
        ) : heroTurn ? (
          <>
            <button type="button" className="ddz-action" disabled={!canPass(game)} onClick={props.passTurn}>{props.t('pass')}</button>
            <button type="button" className="ddz-action" onClick={props.clearSelection}>{props.t('clear')}</button>
            <div className="ddz-hints">
              <button type="button" className="ddz-action ddz-hint-arrow" aria-label={props.t('previousHint')} onClick={() => { props.hint(-1) }}>‹</button>
              <button type="button" className="ddz-action" onClick={() => { props.hint(0) }}>
                {hintIndex < 0 ? props.t('hint') : `${props.t('hint')} ${hintIndex + 1}/${legal.length}`}
              </button>
              <button type="button" className="ddz-action ddz-hint-arrow" aria-label={props.t('nextHint')} onClick={() => { props.hint(1) }}>›</button>
            </div>
            <button type="button" className="ddz-action" data-primary="true" disabled={!playable} onClick={props.playSelection}>{props.t('play')}</button>
          </>
        ) : (
          <span className="ddz-waiting">{props.t('waiting')}</span>
        )}
      </footer>

      <span className="ddz-resize" onPointerDown={startResize} aria-hidden />
    </section>
  )
}
