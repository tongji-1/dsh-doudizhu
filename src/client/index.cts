import { NavigationEntry, TableWindow } from './App.tsx'
import { dictionaries } from './i18n.ts'
import { createFace, type ClientCtx } from './services.ts'
import { createTableStore } from './store.ts'
import { STYLES } from './styles.ts'

const NS = 'dsh-doudizhu'

function apply(ctx: ClientCtx): void {
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-doudizhu: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = NS
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-doudizhu: styles')

  // The store starts its own turn loop, so a hand keeps playing while the
  // window is minimized or closed entirely.
  const store = createTableStore()
  const face = (): ReturnType<typeof createFace> => createFace(store)

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-doudizhu',
    order: 30,
    locale: NS,
    label: () => t('entry'),
    inject: face,
  }, NavigationEntry))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'dsh-doudizhu-table',
    order: 100,
    locale: NS,
    inject: face,
  }, TableWindow))
}

module.exports = {
  name: NS,
  inject: ['slots', 'locale'],
  apply,
}
