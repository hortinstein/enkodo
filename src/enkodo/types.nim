
type
  Hash = array[64, byte]
  Key = array[32, byte]
  Nonce = array[24, byte]
  Mac = array[16, byte]
  Signature = array[64, byte]

type
  EncObj* = object
    publicKey*: Key
    nonce*:     Nonce
    mac*:       Mac
    cipherLen*:  int
    cipherText*: seq[byte]