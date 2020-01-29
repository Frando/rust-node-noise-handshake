const noise = require('noise-protocol')
const process = require('process')
const { Writable } = require('stream')
const net = require('net')

const [mode, port] = process.argv.slice(2)
if (['client', 'server'].indexOf(mode) === -1 || !port) usage()

const isInitiator = mode === 'client'

createConnection(isInitiator, port, function (isInitiator, socket) {
  const read = reader(socket)
  const write = writer(socket)
  handshakeXX(isInitiator, read, write)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})

async function handshakeXX (isInitiator, read, write) {
  console.error('start handshake (nodejs)')
  console.error('initiator ', isInitiator)
  const state = noise.initialize('XX', isInitiator, Buffer.alloc(0), noise.keygen())
  const txBuf = Buffer.alloc(512)
  const rxBuf = Buffer.alloc(512)
  const payload = Buffer.alloc(0)
  console.error('loc pk', fmt(state.spk))

  try {
    let split
    if (isInitiator) {
      await send()
      await recv()
      split = await send()
    } else {
      await recv()
      await send()
      split = await recv()
    }
    console.error('handshake complete!')
    console.error('loc pk', fmt(state.spk))
    console.error('rem pk', fmt(state.rs))
    console.error('split len', split.rx.length + split.tx.length)
    console.error('split rx', fmt(split.rx))
    console.error('split tx', fmt(split.tx))
  } catch (e) {
    console.error('error', e)
  }

  async function send () {
    const split = noise.writeMessage(state, payload, txBuf)
    await write(txBuf.subarray(0, noise.writeMessage.bytes))
    console.error('write', noise.writeMessage.bytes)
    return split
  }

  async function recv () {
    const msg = await read()
    console.error('read', msg.length)
    const split = noise.readMessage(state, msg, rxBuf)
    return split
  }
}

function createConnection (isInitiator, port, onconnection) {
  if (isInitiator) {
    console.error(`connecting to ${port}`)
    const socket = net.connect(port, 'localhost')
    onconnection(isInitiator, socket)
  } else {
    const server = net.createServer(function (socket) {
      onconnection(isInitiator, socket)
    })
    server.listen(port, 'localhost', () => {
      console.error(`listening on port ${port}`)
    })
  }
}

function usage () {
  console.error('USAGE: node xx.js [client|server] PORT')
  process.exit(1)
}

function fmt (buf) {
  // return '[' + buf.toString('hex') + ']'
  return '[' +
    buf.toString('hex')
      .split('')
      .reduce((res, v, i) => res + ((!i || i % 2) ? '' : ', ') + v, '') +
  ']'
}

function reader (stream) {
  let buf = Buffer.alloc(0)
  let missing = -1
  let msgs = []
  let emit = msg => msgs.push(msg)

  stream.pipe(new Writable({
    write (chunk, enc, next) {
      buf = Buffer.concat([buf, chunk])
      process.nextTick(onread)
      next()
    }
  }))

  return function next () {
    return new Promise((resolve, reject) => {
      if (msgs.length) return resolve(msgs.shift())
      emit = function (msg) {
        resolve(msg)
        emit = msg => msgs.push(msg)
      }
    })
  }

  function onread () {
    if (missing === -1 && buf.length < 2) return
    if (missing === -1) {
      missing = buf.slice(0, 2).readUInt16BE()
      buf = buf.slice(2)
    }
    if (missing <= buf.length) {
      let msg = buf.slice(0, missing)
      buf = buf.slice(missing)
      missing = -1
      emit(msg)
      if (buf.length) process.nextTick(onread)
    }
  }
}

function writer (target) {
  return async function write (msg) {
    let header = Buffer.alloc(2)
    header.writeUInt16BE(msg.length)
    target.write(header)
    target.write(msg)
  }
}
