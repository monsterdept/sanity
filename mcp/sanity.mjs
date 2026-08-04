#!/usr/bin/env node
// A tiny MCP stdio server that lets Claude assess a repo for sanity.
//
// The premise: every other scoring backend answers "could a model have predicted this
// code?" because that is what a model can emit. The question a user actually has is
// "will Claude Code get lost in my repo?" — and an agent can answer that by trying.
//
// THE PROTOCOL MATTERS. sanity_next hands out a function's name, signature and
// neighbours and DELIBERATELY WITHHOLDS THE BODY. Commit to what you expect, then open
// the file yourself and report the gap. Asking an agent whether it understood something
// gets "yes" every time; asking it to predict first and checking is falsifiable.
//
// Dependency-free: newline-delimited JSON-RPC 2.0 over stdin/stdout, Node's built-in
// fetch. Same shape as tally's server — it finds the app by reading the endpoint the app
// publishes, not by assuming a port, because anything else holding that port would answer
// in the app's place.
//
// Wired via .mcp.json. Claude Code loads MCP servers at startup, so reconnect (/mcp or
// restart) after adding it.

import os from 'node:os'
import npath from 'node:path'
import fs from 'node:fs'

function dataFilePath(name) {
  const home = os.homedir()
  if (process.platform === 'darwin')
    return npath.join(home, 'Library', 'Application Support', 'Sanity', name)
  if (process.platform === 'win32')
    return npath.join(process.env.APPDATA ?? npath.join(home, 'AppData', 'Roaming'), 'Sanity', name)
  return npath.join(process.env.XDG_DATA_HOME ?? npath.join(home, '.local', 'share'), 'Sanity', name)
}

// Signal 0 tests existence without delivering: ESRCH when the process is gone, EPERM
// when it exists but belongs to someone else (still alive, still fine).
function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

// Resolved per call, not once at startup, so the app can be restarted onto a different
// port without restarting this server. A stale file from a crashed app fails the pid check.
function baseUrl() {
  if (process.env.SANITY_BACKEND) return process.env.SANITY_BACKEND
  try {
    const { port, pid } = JSON.parse(fs.readFileSync(dataFilePath('agent-endpoint.json'), 'utf8'))
    if (port && pid && pidAlive(pid)) return `http://127.0.0.1:${port}`
  } catch {
    /* no file, unreadable, or malformed */
  }
  return null
}

async function call(path, init) {
  const base = baseUrl()
  if (!base) throw new Error('Sanity is not running. Start the app, then call sanity_open with your repo path.')
  const r = await fetch(base + path, init)
  if (!r.ok) throw new Error(`sanity ${path} returned ${r.status}`)
  return r.json()
}

const TOOLS = [
  {
    name: 'sanity_open',
    description:
      'Point Sanity at a repo and make it what the window shows. Call this FIRST, with the absolute path of the project you are working in — Sanity creates the project if it has not seen it before, and reopens it (keeping past assessments) if it has. ' +
      'Sanity does the structural work itself: walking the repo, parsing functions, reading git history. You do not need to do any of that. Every function starts uncoloured, because nothing has read it yet. ' +
      'READ THE `protocol` FIELD IN THE RESPONSE AND FOLLOW IT — the assessment must run in fresh subagents, not in the session that called this.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path to the repo.' } },
      required: ['path'],
    },
  },
  {
    name: 'sanity_status',
    description:
      'What repo Sanity currently has open, how many functions it found, and how many have been assessed. Call this first.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'sanity_next',
    description:
      'Get the next functions to assess, most promising first. ONLY call this from a fresh subagent that has not been reading this repo — a reader who already knows a file recalls it rather than predicting it, and recall marks everything unsurprising.  Returns each function\'s NAME, SIGNATURE LOCATION and SIBLING NAMES — deliberately NOT its body. ' +
      'For each one: (1) write down what you expect the body to do, based only on the name, its neighbours and what you know of the codebase; ' +
      '(2) THEN open abs_path at the given line and read it; (3) report the gap with sanity_report. ' +
      'Predicting before looking is the point — it is what makes the result mean something.',
    inputSchema: {
      type: 'object',
      properties: { n: { type: 'number', description: 'How many to fetch (default 5).' } },
    },
  },
  {
    name: 'sanity_report',
    description:
      'Report one function after predicting and then reading it. Be honest about surprise: mark surprised=true only when the body did something the name and signature would not lead a competent reader to expect — an unusual failure mode, a hidden side effect, a workaround, an inverted condition. Ordinary implementation detail is not surprise.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The id from sanity_next.' },
        expected: { type: 'string', description: 'What you predicted BEFORE reading it.' },
        found: { type: 'string', description: 'What it actually does.' },
        surprised: { type: 'boolean', description: 'Did it diverge in a way that matters?' },
        cold: {
          type: 'boolean',
          description:
            'True if you had NOT read this file before making your prediction. Answer honestly — a warm reading is worth less and Sanity shows it differently rather than discarding it.',
        },
        note: {
          type: 'string',
          description:
            'One sentence a human can read, only if surprised. Say what would trip someone up.',
        },
      },
      required: ['id', 'expected', 'found', 'surprised'],
    },
  },
]

async function handle(name, args) {
  if (name === 'sanity_open')
    return call('/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: args.path }),
    })
  if (name === 'sanity_status') return call('/status')
  if (name === 'sanity_next') return call(`/queue?n=${Math.max(1, Math.min(25, args?.n ?? 5))}`)
  if (name === 'sanity_report') {
    return call('/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: args.id,
        expected: args.expected ?? '',
        found: args.found ?? '',
        surprised: !!args.surprised,
        note: args.note ?? '',
        cold: !!args.cold,
      }),
    })
  }
  throw new Error(`unknown tool ${name}`)
}

// ── JSON-RPC 2.0 over stdio ────────────────────────────────────────────────────
let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (chunk) => {
  buf += chunk
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    // Notifications have no id and must not be answered.
    if (msg.id === undefined) continue
    respond(msg)
  }
})

async function respond(msg) {
  const send = (result, error) =>
    process.stdout.write(
      JSON.stringify(error ? { jsonrpc: '2.0', id: msg.id, error } : { jsonrpc: '2.0', id: msg.id, result }) + '\n',
    )
  try {
    if (msg.method === 'initialize')
      return send({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'sanity', version: '0.1.0' },
      })
    if (msg.method === 'tools/list') return send({ tools: TOOLS })
    if (msg.method === 'tools/call') {
      const out = await handle(msg.params?.name, msg.params?.arguments ?? {})
      return send({ content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
    }
    send(null, { code: -32601, message: `method not found: ${msg.method}` })
  } catch (e) {
    // Errors come back as tool content, not transport errors, so the model can read and
    // act on them ("open the app first") instead of seeing an opaque failure.
    send({ content: [{ type: 'text', text: `error: ${e.message}` }], isError: true })
  }
}
