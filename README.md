# rust-node-noise-handshake

Let's see if Rust and NodeJS can do a [Noise](http://noiseprotocol.org/noise.html) handshake for authenticated, encrypted communication.

A step towards [hypercore-protocol in Rust](https://github.com/Frando/hypercore-protocol-rust-experiments), a practical exploration of how Noise works, and a little demo of async networking in Rust with [async-std](https://async.rs/).

The NodeJS part uses [noise-protocol](https://github.com/emilbayes/noise-protocol) on [the `standard-dh` branch](https://github.com/emilbayes/noise-protocol/tree/standard-dh) that changes the Diffie-Hellman algorithm to follow NOISE spec].

The Rust part uses [snow](https://github.com/mcginty/snow/pull/73) on a [PR branch that adds the XChaChaPoly cipher](https://github.com/mcginty/snow/pull/73).

## Usage

First clone this repository and run `npm install` and `cargo build`.

Then launch the run.js script to spawn both a TCP server (responder) and a TCP client (initiator), in a combination of your choise (first is responder, second is initiator):

* `node run.js node node`
* `node run.js rust rust`
* `node run.js node rust`
* `node run.js rust node`

Or start the sessions individually:

* `node handshake.js server 8000`
* `node handshake.js client 8000`
* `cargo run -- server 8000`
* `cargo run -- client 8000`

Current state: **It works!** After long debugging I found the cause why rust/node or node/rust was not working - the nonces were padded differently.
