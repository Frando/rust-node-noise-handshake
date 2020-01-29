use async_std::net::{TcpListener, TcpStream};
use async_std::stream::StreamExt;
use async_std::task;
use std::env;
use std::io::{ErrorKind, Result};

mod noise;

fn main() {
    let count = env::args().count();
    if count < 3 {
        usage();
    }
    let mode = env::args().nth(1).unwrap();
    let port = env::args().nth(2).unwrap();

    let address = format!("127.0.0.1:{}", port);

    task::block_on(async move {
        let result = match mode.as_ref() {
            "server" => tcp_server(address).await,
            "client" => tcp_client(address).await,
            _ => panic!(usage()),
        };
        if let Err(e) = result {
            eprintln!("error: {}", e);
        }
    });
}

fn usage() {
    println!("usage: cargo run [client|server] [port]");
    std::process::exit(1);
}

async fn tcp_server(address: String) -> Result<()> {
    let listener = TcpListener::bind(&address).await?;
    println!("Listening on {}", listener.local_addr()?);

    let mut incoming = listener.incoming();
    while let Some(stream) = incoming.next().await {
        let stream = stream?;
        let peer_addr = stream.peer_addr().unwrap();
        eprintln!("new connection from {}", peer_addr);
        task::spawn(async move {
            match onconnection(stream, false).await {
                Err(ref e) if e.kind() != ErrorKind::UnexpectedEof => {
                    eprintln!("connection closed from {} with error: {}", peer_addr, e);
                }
                Err(_) | Ok(()) => {
                    eprintln!("connection closed from {}", peer_addr);
                }
            }
        });
    }
    Ok(())
}

async fn tcp_client(address: String) -> Result<()> {
    let stream = TcpStream::connect(&address).await?;
    onconnection(stream, true).await?;
    Ok(())
}

async fn onconnection(stream: TcpStream, is_initiator: bool) -> Result<()> {
    match noise::handshake(stream, is_initiator).await {
        Ok(_) => eprintln!("done without errors"),
        Err(e) => eprintln!("error {:?}", e),
    };
    Ok(())
}
