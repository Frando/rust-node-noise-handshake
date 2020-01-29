const { spawn } = require('child_process')
const chalk = require('chalk')
const split = require('split2')

const PORT = 8000
const backends = {
  rust: { bin: 'cargo', args: ['run', '--'] },
  node: { bin: 'node', args: ['handshake.js'] }
}

const [server, client] = process.argv.slice(2)
if (!backends[server] || !backends[client]) usage()

const procs = []
procs.push(start({
  bin: backends[server].bin,
  args: [...backends[server].args, 'server', PORT],
  name: server,
  color: 'red'
}))
setTimeout(() => {
  procs.push(start({
    bin: backends[client].bin,
    args: [...backends[client].args, 'client', PORT],
    name: client,
    color: 'blue'
  }))
}, 100)

process.on('SIGINT', onclose)

function onclose () {
  setTimeout(() => {
    procs.forEach(proc => proc.kill())
    process.exit()
  }, 100)
}

function start ({ bin, args, name, color }) {
  const proc = spawn(bin, args)
  proc.on('exit', onclose)
  proc.stderr.pipe(split()).on('data', line => {
    console.log(chalk.bold[color]('[' + name + ']') + ' ' + line)
  })
  return proc
}

function usage () {
  console.error('USAGE: node run.js [rust|node] [rust|node]')
  process.exit(1)
}
