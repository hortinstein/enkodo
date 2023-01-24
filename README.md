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
import enkodo

let (a_secretKey, a_publicKey) = generateKeyPair()
let (b_secretKey, b_publicKey) = generateKeyPair()

let plaintext = cast[seq[byte]]("hello this is a test string")

let encObj = enc(a_secretKey,b_publicKey,plaintext)
let wrapped = wrap(encObj)
let unwrapped = unwrap(wrapped)
let ptext = dec(b_secretKey,unwrapped)
doAssert(plaintext == ptext)
```

#### Typescript

Below is a simple nim example of encypting, serializing and base64ing

``` typescript
import {
  enc,
  dec,
  generateKeyPair,
  unwrap,
  wrap
} from "https://deno.land/x/enkodo@v0.1.0/typescript/mod.ts";

const hello_world = new TextEncoder().encode("Hello World");
const [priv, pub] = generateKeyPair();
const [priv2, pub2] = generateKeyPair();

const enc_test = enc(priv, pub2, hello_world);
const plain = dec(priv2, enc_test);
assertEquals(hello_world, plain);
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
- Rust: https://stackoverflow.com/questions/59879692/how-to-call-a-nim-function-from-rust-through-c-ffi
- Go
- Zig
- C
- Python
