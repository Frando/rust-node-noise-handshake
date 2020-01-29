use snow::{Builder, Error as SnowError, HandshakeState};
use std::convert::TryInto;
use std::env;
use std::io;
use std::io::{BufReader, BufWriter, Read, StdinLock, StdoutLock, Write};

fn main() {
    let mode = env::args().nth(1);
    let is_initiator = mode.is_some();

    eprintln!("rust start. initiator {}", is_initiator);
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut writer = BufWriter::new(stdout.lock());

    let mut buf_tx = vec![0u8; 65535];
    let mut buf_rx = vec![0u8; 65535];

    let mut noise = build_handshake_state(is_initiator).unwrap();

    if is_initiator {
        let tx_len = noise.write_message(&[], &mut buf_tx).unwrap();
        write(&mut writer, &buf_tx[..tx_len]);
        eprintln!("[rust] written {}", tx_len);
    }

    let msg = read(&mut reader);
    let rx_len = noise.read_message(&msg, &mut buf_rx).unwrap();
    eprintln!("[rust] read {}", rx_len);

    eprintln!("[rust] complete {}", noise.is_handshake_finished());

    let tx_len = noise.write_message(&[], &mut buf_tx).unwrap();
    write(&mut writer, &buf_tx[..tx_len]);
    eprintln!("[rust] written {}", tx_len);

    eprintln!("[rust] complete {}", noise.is_handshake_finished());

    let msg = read(&mut reader);
    let rx_len = noise.read_message(&msg, &mut buf_rx).unwrap();
    eprintln!("[rust] read {}", rx_len);

    eprintln!("[rust] complete {}", noise.is_handshake_finished())
}

pub fn build_handshake_state(is_initiator: bool) -> std::result::Result<HandshakeState, SnowError> {
    static PATTERN: &'static str = "Noise_XX_25519_XChaChaPoly_BLAKE2b";
    let builder: Builder<'_> = Builder::new(PATTERN.parse()?);
    let key_pair = builder.generate_keypair().unwrap();
    // let key_pair = Keypair {
    //     public: PUBKEY.to_vec(),
    //     private: PRIVKEY.to_vec(),
    // };
    // eprintln!(
    //     "keypair public {:?} private {:?} ",
    //     key_pair.public, key_pair.private
    // );
    eprintln!("local pubkey: {:x?}", &key_pair.public);
    let noise = if is_initiator {
        builder
            .local_private_key(&key_pair.private)
            .build_initiator()
    } else {
        builder
            .local_private_key(&key_pair.private)
            .build_responder()
    };
    noise
}

fn read(reader: &mut BufReader<StdinLock>) -> Vec<u8> {
    let mut len_buf = vec![0u8; 2];
    reader.read_exact(&mut len_buf).unwrap();
    let len = u16::from_be_bytes(len_buf.as_slice().try_into().unwrap());
    let mut buf = vec![0u8; len as usize];
    reader.read_exact(&mut buf).unwrap();
    eprintln!("[rust] read {}", len);
    buf
}

fn write(writer: &mut BufWriter<StdoutLock>, buf: &[u8]) {
    let len = buf.len() as u16;
    writer.write_all(&len.to_be_bytes()).unwrap();
    writer.write_all(&buf).unwrap();
    writer.flush().unwrap();
    eprintln!("[rust] write {}", len);
}
