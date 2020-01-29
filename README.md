# rust-node-noise-handshake

Let's see if Rust and NodeJS can do a NOISE handshake. A step towards [hypercore-protocol in Rust](https://github.com/Frando/hypercore-protocol-rust-experiments).

In NodeJS uses [noise-protocol](https://github.com/emilbayes/noise-protocol/tree/standard-dh) on the `standard-dh` tree that changes the DH algorithm to the NOISE spec.

In Rust uses [snow](https://github.com/mcginty/snow/pull/73) with a PR that adds the XChaChaPoly cipher.

## Usage

First run `npm install` and `cargo build`.

Then launch the run.js script to start both a server and a client and let them connect to each other:

* `node run.js node node`
* `node run.js rust rust`
* `node run.js node rust`
* `node run.js rust node`

Or start the sessions individually:

* `node handshake.js server 8000`
* `node handshake.js client 8000`
* `cargo run -- server 8000`
* `cargo run -- client 8000`

Current state: rust/rust and node/node works. With rust/node and node/rust the client finishes correctly, the server not.
