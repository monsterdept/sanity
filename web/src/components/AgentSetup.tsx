import { useEffect, useState } from 'react'
import { Overlay } from './Overlay'
import {
  mcpClients,
  mcpCommand,
  mcpConnect,
  mcpDisconnect,
  type McpClient,
  type McpCommand,
} from '../lib/api'

/** Everything about pointing an agent at this install, in one place.
 *
 *  Detection and configuration are ONE list. Splitting them — a table telling you what
 *  was connected, and a separate button that connected one particular client — makes you
 *  read a status in one place and act on it in another, and leaves every other client
 *  with a status and no action. A row that can say "not connected" should be the row
 *  that connects it. */
export function AgentSetup({ onClose }: { onClose: () => void }) {
  const [cmd, setCmd] = useState<McpCommand | null>(null)
  const [clients, setClients] = useState<McpClient[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const refresh = () => void mcpClients().then(setClients)
  useEffect(() => {
    void mcpCommand().then(setCmd)
    refresh()
  }, [])

  async function toggle(c: McpClient) {
    setBusy(c.id)
    setError('')
    try {
      if (c.registered && c.current) await mcpDisconnect(c.id)
      else await mcpConnect(c.id)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function copy() {
    if (!cmd) return
    try {
      await navigator.clipboard.writeText(cmd.json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the block is selectable, so it can be copied by hand */
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <span className="text-[15px] font-semibold">Connect an agent</span>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[var(--muted-foreground)] hover:opacity-80"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Sanity speaks <strong className="text-[var(--foreground)]">MCP</strong>, and that
            is the main way to use it. An agent launches sanity as a small stdio server,
            points it at whatever repo the session is in, and reads the code — Sanity just
            displays what comes back. Everything stays on this machine.
          </p>

          <div className="mt-5 flex flex-col">
            {clients.length === 0 && (
              <span className="text-[11px] text-[var(--muted-foreground)]">Checking…</span>
            )}
            {clients.map((c) => (
              <ClientRow key={c.id} client={c} busy={busy === c.id} onToggle={() => toggle(c)} />
            ))}
          </div>

          {error && <p className="mt-2 text-[11px] text-[var(--destructive)]">{error}</p>}

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Clients read their config at startup, so restart or reconnect one after
            changing it — Claude Desktop needs a full ⌘Q. Only each client's own user-level
            config is checked: a per-project entry, like a repo's <code>.mcp.json</code>,
            connects for real but can't be seen from here.
          </p>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Then, in that agent
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Say <span className="mono text-[var(--foreground)]">study this project in sanity</span>.
              It will open here on its own. Sanity hands back a protocol asking the agent to
              read in fresh subagents — a session that already knows your code recalls it
              rather than predicting it, and recall marks everything unsurprising.
            </p>
          </div>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Anything else
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              For a client not listed above — or one that keeps its config in a format
              sanity won't rewrite — this is the server to add by hand. It's the same
              command the buttons write.
            </p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="mono min-w-0 flex-1 select-text overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                {cmd ? cmd.json : 'Loading…'}
              </pre>
              <button
                onClick={copy}
                disabled={!cmd}
                title="Copy"
                className="shrink-0 rounded-md border border-[var(--border)] px-2 py-2 text-[11px] text-[var(--muted-foreground)] hover:opacity-80 disabled:opacity-40"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  )
}

/** One client: what it is, where it stands, and the single action that changes that. */
function ClientRow({
  client,
  busy,
  onToggle,
}: {
  client: McpClient
  busy: boolean
  onToggle: () => void
}) {
  const connected = client.registered && client.current
  const stale = client.registered && !client.current

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 last:border-b-0">
      <div className="min-w-0">
        <div
          className="text-sm"
          style={{ color: client.present ? 'var(--foreground)' : 'var(--muted-foreground)' }}
        >
          {client.name}
        </div>
        {stale && (
          <div className="text-[11px] text-[var(--warning)]">
            points at a different sanity — looks configured, won’t connect
          </div>
        )}
      </div>

      {!client.present ? (
        <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]" title={client.path}>
          not installed
        </span>
      ) : !client.writable ? (
        // Read-only formats get an honest label rather than a button that can't work.
        <span className="shrink-0 text-[11px] text-[var(--muted-foreground)]" title={client.path}>
          {connected ? 'connected' : 'add by hand'}
        </span>
      ) : (
        <button
          onClick={onToggle}
          disabled={busy}
          title={client.path}
          className="shrink-0 rounded-md border px-2.5 py-1 text-[11px] hover:opacity-80 disabled:opacity-50"
          style={{
            borderColor: connected ? 'var(--border)' : 'var(--accent)',
            background: connected ? 'transparent' : 'var(--accent)',
            color: connected ? 'var(--muted-foreground)' : 'var(--accent-foreground)',
          }}
        >
          {busy ? '…' : connected ? 'Disconnect' : stale ? 'Repoint' : 'Connect'}
        </button>
      )}
    </div>
  )
}
