const noise = require('noise-protocol')
const test = require('tape')
const process = require('process')
const { spawn } = require('child_process')
const { Writable } = require('stream')

const isInitiator = process.argv[2] === 'init'

let proc = 'cargo'
let args = ['run', '--']
if (!isInitiator) args.push('init')

const rustProcess = spawn(proc, args, {
  stdio: 'pipe'
})
rustProcess.stderr.pipe(process.stderr)

const read = reader(rustProcess.stdout)
const write = writer(rustProcess.stdin)

run(isInitiator, read, write)

async function run (isInitiator, read, write) {
  try {
    console.error('[node] start. initiator', isInitiator)

    const state = noise.initialize('XX', isInitiator, Buffer.alloc(0), noise.keygen())
    const txBuf = Buffer.alloc(512)
    // const rxBuf = Buffer.alloc(512)

    if (isInitiator) {
      noise.writeMessage(state, Buffer.alloc(0), txBuf)
      write(txBuf.subarray(0, noise.writeMessage.bytes))
      console.error('[node] write', noise.writeMessage.bytes)
    }

    let msg, split
    console.error('[node] now read')
    msg = await read()
    console.error('[node] read', msg.length)
    split = noise.readMessage(state, Buffer.alloc(0), msg)
    console.error('[node] split1', split)

    noise.writeMessage(state, Buffer.alloc(0), txBuf)
    write(txBuf.subarray(0, noise.writeMessage.bytes))
    console.error('[node] write', noise.writeMessage.bytes)

    msg = await read()
    split = noise.readMessage(state, Buffer.alloc(0), msg)
    console.error('[node] split2', split)
  } catch (e) {
    console.error('[node] exception:', e)
  }
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
  return function write (msg) {
    let header = Buffer.alloc(2)
    header.writeUInt16BE(msg.length)
    target.write(header)
    target.write(msg)
  }
}

//   var client = noise.initialize('XX', true, Buffer.alloc(0), noise.keygen())
//   var server = noise.initialize('XX', false, Buffer.alloc(0), noise.keygen())

//   var clientTx = Buffer.alloc(512)
//   var serverRx = Buffer.alloc(512)

//   var serverTx = Buffer.alloc(512)
//   var clientRx = Buffer.alloc(512)

//   // ->
//   assert.false(noise.writeMessage(client, Buffer.alloc(0), clientTx))
//   assert.ok(noise.writeMessage.bytes > 0)
//   assert.false(noise.readMessage(server, clientTx.subarray(0, noise.writeMessage.bytes), serverRx))
//   assert.equal(noise.readMessage.bytes, 0)

//   // <-
//   assert.false(noise.writeMessage(server, Buffer.alloc(0), serverTx))
//   assert.ok(noise.writeMessage.bytes > 0)
//   assert.false(noise.readMessage(client, serverTx.subarray(0, noise.writeMessage.bytes), clientRx))
//   assert.equal(noise.readMessage.bytes, 0)

//   // ->
//   var splitClient = noise.writeMessage(client, Buffer.alloc(0), clientTx)
//   assert.ok(noise.writeMessage.bytes > 0)
//   var splitServer = noise.readMessage(server, clientTx.subarray(0, noise.writeMessage.bytes), serverRx)
//   assert.equal(noise.readMessage.bytes, 0)

//   assert.same(splitClient.tx, splitServer.rx)
//   assert.same(splitClient.rx, splitServer.tx)

//   assert.end()


// async function read () {
// }

// test('XX pattern', function (assert) {
//   var client = noise.initialize('XX', true, Buffer.alloc(0), noise.keygen())
//   var server = noise.initialize('XX', false, Buffer.alloc(0), noise.keygen())

//   var clientTx = Buffer.alloc(512)
//   var serverRx = Buffer.alloc(512)

//   var serverTx = Buffer.alloc(512)
//   var clientRx = Buffer.alloc(512)

//   // ->
//   assert.false(noise.writeMessage(client, Buffer.alloc(0), clientTx))
//   assert.ok(noise.writeMessage.bytes > 0)
//   assert.false(noise.readMessage(server, clientTx.subarray(0, noise.writeMessage.bytes), serverRx))
//   assert.equal(noise.readMessage.bytes, 0)

//   // <-
//   assert.false(noise.writeMessage(server, Buffer.alloc(0), serverTx))
//   assert.ok(noise.writeMessage.bytes > 0)
//   assert.false(noise.readMessage(client, serverTx.subarray(0, noise.writeMessage.bytes), clientRx))
//   assert.equal(noise.readMessage.bytes, 0)

//   // ->
//   var splitClient = noise.writeMessage(client, Buffer.alloc(0), clientTx)
//   assert.ok(noise.writeMessage.bytes > 0)
//   var splitServer = noise.readMessage(server, clientTx.subarray(0, noise.writeMessage.bytes), serverRx)
//   assert.equal(noise.readMessage.bytes, 0)

//   assert.same(splitClient.tx, splitServer.rx)
//   assert.same(splitClient.rx, splitServer.tx)

//   assert.end()
// })
