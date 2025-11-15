# Distributed File Transfer System

A high-reliability file transfer system designed for unstable, real-world networks. Built around dynamic chunking, compression, hashing, adaptive protocols, encryption, and optional peer-to-peer transfer using WebRTC.

This system is engineered for environments where standard upload mechanisms fail — mobile networks, fluctuating bandwidth, emergency vehicles, remote areas, and large-file transfers.

---

## 🚀 Features (Current Implementation)

### 1. File Preparation (Client Side)

- Reads the input file.
- Compresses it to optimize bandwidth usage.
- Generates a SHA-256 hash of the compressed file for end-to-end integrity.

### 2. Dynamic Chunking Engine

Chunk size is calculated on the fly based on real-time network speed.

- High speed → Larger chunks
- Low/unstable speed → Smaller chunks

Each chunk includes:

- Chunk index
- Total chunks
- SHA-256 hash
- File metadata

### 3. Secure Chunk Transmission

- Each chunk is verified on the server using its SHA-256 hash.
- Corrupted/mismatched chunks are re-requested.
- No need to retransmit the whole file.

### 4. Server-Side Reassembly

Once all chunks are received:

1. Sort by index
2. Reassemble
3. Decompress
4. Hash the final file
5. Compare with the original client hash

If the hashes match → upload complete. If not → problematic chunks are fetched again.

---

## 🛠 Future Enhancements

### 1. Adaptive Protocol Switching

Depending on current network quality:

- HTTP/2 / gRPC for stable networks
- QUIC / HTTP/3 for mobile or fluctuating networks
- TLS 1.3 secured mode for sensitive transfers

Protocol switching will happen automatically during transfer.

### 2. End-to-End Encryption

Planned upgrades include:

- AES-256 per chunk encryption
- Diffie–Hellman / TLS key exchange
- Per-chunk nonce to prevent replay attacks

This ensures full confidentiality even if packets are intercepted.

### 3. Network-Aware Chunk Rebalancing

The transfer engine continuously monitors:

- Latency
- Bandwidth
- Jitter
- Packet loss

When the network changes (example: moving in an ambulance):

- The system instantly recalculates chunk sizes
- Transfer continues without restarting

### 4. Intelligent Resume Logic

If the connection drops:

- Upload resumes from the last acknowledged chunk
- No duplication
- No corrupt alignment due to hashing

Future upgrades:

- Forward Error Correction (FEC)
- Multi-path chunk routing

---

## 🔗 WebRTC Client-to-Client Transfer

### 1. Direct P2P Data Channel

The system will integrate WebRTC for:

- Client → Client direct file transfers
- Zero server bandwidth usage
- Lower latency
- Higher speed

Server is used only for signaling (connection setup).

### 2. Security on WebRTC

- Built-in DTLS
- Additional AES-256 encryption
- Per-chunk SHA-256 validation

### 3. Dynamic Chunking Still Applies

Adaptive chunking works even over WebRTC:

- WiFi → large chunks
- Weak network → smaller chunks

This guarantees smooth P2P transfers.

---

## 🎯 Why This System Stands Out

Unlike traditional upload systems, this architecture is built for real-world failure conditions:

- Fluctuating mobile networks
- Emergency environments
- Large and sensitive files
- P2P scenarios
- Low bandwidth regions

Backed by:

- Dynamic chunking
- Compression
- Hashing at both levels
- Protocol adaptivity
- Strong encryption
- Resume logic
- Optional WebRTC transfer

_This system isn't just an uploader — it's a resilient file transfer engine._
