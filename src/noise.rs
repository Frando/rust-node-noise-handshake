use async_std::io::{BufReader, BufWriter, Read, ReadExt, Result, Write};
use async_std::net::TcpStream;
use async_std::prelude::*;
use async_std::task::{Context, Poll};
use snow::{Builder, Error as SnowError, HandshakeState, Keypair};
use std::clone::Clone;
use std::convert::TryInto;
use std::pin::Pin;
use std::sync::Arc;

pub async fn handshake(stream: TcpStream, is_initiator: bool) -> Result<()> {
    let stream = CloneableStream(Arc::new(stream));
    let mut reader = BufReader::new(stream.clone());
    let mut writer = BufWriter::new(stream.clone());

    let mut tx_buf = vec![0u8; 65535];
    let mut rx_buf = vec![0u8; 65535];
    let mut rx_len;
    let mut tx_len;

    let payload = format!("rusty payload {} init", is_initiator)
        .as_bytes()
        .to_vec();

    let (mut noise, local_keypair) = build_handshake_state(is_initiator).unwrap();

    eprintln!("start handshake (rust)");
    eprintln!("initiator {}", is_initiator);
    eprintln!("loc pk {:x?}", &local_keypair.public);

    if is_initiator {
        tx_len = noise.write_message(&payload, &mut tx_buf).unwrap();
        write(&mut writer, &tx_buf[..tx_len]).await?;
    }

    let msg = read(&mut reader).await?;
    rx_len = noise.read_message(&msg, &mut rx_buf).unwrap();

    tx_len = noise.write_message(&payload, &mut tx_buf).unwrap();
    write(&mut writer, &tx_buf[..tx_len]).await?;

    if !is_initiator {
        let msg = read(&mut reader).await?;
        rx_len = noise.read_message(&msg, &mut rx_buf).unwrap();
    }

    eprintln!("handshake complete!");
    eprintln!("loc pk {:x?}", &local_keypair.public);
    eprintln!("rem pk {:x?}", noise.get_remote_static().unwrap());
    eprintln!("handshakehash len: {}", noise.get_handshake_hash().len());
    eprintln!("handshakehash: {:x?}", noise.get_handshake_hash());
    eprintln!(
        "remote payload: {}",
        String::from_utf8_lossy(&rx_buf[..rx_len])
    );

    Ok(())
}

pub fn build_handshake_state(
    is_initiator: bool,
) -> std::result::Result<(HandshakeState, Keypair), SnowError> {
    static PATTERN: &'static str = "Noise_XX_25519_XChaChaPoly_BLAKE2b";
    let builder: Builder<'_> = Builder::new(PATTERN.parse()?);
    let key_pair = builder.generate_keypair().unwrap();
    let noise = if is_initiator {
        builder
            .local_private_key(&key_pair.private)
            .build_initiator()
    } else {
        builder
            .local_private_key(&key_pair.private)
            .build_responder()
    };
    let noise = noise?;
    Ok((noise, key_pair))
}

async fn read<R>(reader: &mut BufReader<R>) -> Result<Vec<u8>>
where
    R: Read + Unpin,
{
    let mut len_buf = vec![0u8; 2];
    reader.read_exact(&mut len_buf).await?;
    let len = u16::from_be_bytes(len_buf.as_slice().try_into().unwrap());
    let mut buf = vec![0u8; len as usize];
    reader.read_exact(&mut buf).await?;
    eprintln!("read {}", len);
    Ok(buf)
}

async fn write<W>(writer: &mut BufWriter<W>, buf: &[u8]) -> Result<()>
where
    W: Write + Unpin,
{
    let len = buf.len() as u16;
    writer.write_all(&len.to_be_bytes()).await?;
    writer.write_all(&buf).await?;
    writer.flush().await?;
    eprintln!("write {}", len);
    Ok(())
}

#[derive(Clone)]
pub(crate) struct CloneableStream(Arc<TcpStream>);
impl Read for CloneableStream {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context, buf: &mut [u8]) -> Poll<Result<usize>> {
        Pin::new(&mut &*self.0).poll_read(cx, buf)
    }
}
impl Write for CloneableStream {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context, buf: &[u8]) -> Poll<Result<usize>> {
        Pin::new(&mut &*self.0).poll_write(cx, buf)
    }
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Result<()>> {
        Pin::new(&mut &*self.0).poll_flush(cx)
    }
    fn poll_close(self: Pin<&mut Self>, cx: &mut Context) -> Poll<Result<()>> {
        Pin::new(&mut &*self.0).poll_close(cx)
    }
}
