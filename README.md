[![Gitpod Ready-to-Code](https://img.shields.io/badge/Gitpod-Ready--to--Code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/hortinstein/enkodo/) 
# enkōdo

Enkodo is a cross platform encyption and serialization wrapper for ```monocypher``` written in nim, with compatibility targets in ```typescript``` and more planned in the future.   

- [enkōdo](#enkōdo)
    - [Building all targets](#building-all-targets)
    - [Usage](#usage)
      - [Nim](#nim)
      - [Typescript](#typescript)
    - [Nimble Test](#nimble-test)
    - [Deno Test](#deno-test)
    - [Planned compatibility](#planned-compatibility)


### Building all targets
These are the nim instructions and what they do:
```
nimble buildall #creates all the libraries and helpers for all languages 
```

### Usage

#### Nim

Below is a simple nim example of encypting, serializing and base64ing

``` nim

let (a_secretKey, a_publicKey) = generateKeyPair()
let (b_secretKey, b_publicKey) = generateKeyPair()

let plaintext = cast[seq[byte]]("hello this is a test string")

let encObj = enc(a_secretKey,b_publicKey,plaintext)
let serEncObj = serEncObj(encObj)
let base64SerEncObj = b64Str(serEncObj)
let unbase64SerEncObj = unb64Str(base64SerEncObj)
let deSerEncObj = desEncObj(unbase64SerEncObj)
let ptext = dec(b_secretKey,deSerEncObj)
```

#### Typescript

Below is a simple nim example of encypting, serializing and base64ing

``` typescript
import { enc, dec, generateKeyPair } from "./main.ts";

export function encrypt_decrypt() {
  const hello_world = new TextEncoder().encode("Hello World");
  const [priv, pub] = generateKeyPair();
  const [priv2, pub2] = generateKeyPair();

  const [pub3, nonce, mac, cipher] = enc(priv, pub2, hello_world);

  const plain = dec(priv2, pub, nonce, mac, cipher);

  assertEquals(hello_world, plain);
}
```

### Nimble Test
Tests the encryption and serialization functions
```
nimble test 
```

### Deno Test
Tests the encryption functions
```
deno test 
deno bench #runs the benchmark
```

### Planned compatibility
- Rust
- Go
- Zig
- C
- Python