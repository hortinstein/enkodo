import monocypher
import sysrandom

import enkodo/serialize
export serialize

proc toString*(bytes: seq[byte]): string =
  result = newString(bytes.len)
  copyMem(result[0].addr, bytes[0].unsafeAddr, bytes.len)

proc toKey(s: seq[byte]): monocypher.Key =
  copyMem(addr result[0], unsafeAddr s[0], sizeof(monocypher.Key))

proc toNonce(s: seq[byte]): monocypher.Nonce =
  copyMem(addr result[0], unsafeAddr s[0], sizeof(monocypher.Nonce))

proc randomKey*(): monocypher.Key =
  toKey(getRandomBytes(sizeof(monocypher.Key)))

proc enc*( privateKey: monocypher.Key, publicKey: monocypher.Key, plaintext: seq[byte]): EncObj =
  let sharedKey = crypto_x25519(privateKey, publicKey)
  let nonce = toNonce(getRandomBytes(sizeof(monocypher.Nonce)))
  let (mac, ciphertext) = crypto_aead_lock(sharedKey, nonce, plaintext)
  let myPubKey = crypto_x25519_public_key(privateKey)
  result = EncObj(publicKey: myPubKey,
                  nonce: nonce,
                  mac: mac,
                  cipherLen: cipherText.len,
                  cipherText: cipherText)

proc dec*( privateKey: monocypher.Key, encObj: EncObj): seq[byte] =
  let sharedKey = crypto_x25519(privateKey, encObj.publicKey)
  result = crypto_aead_unlock(encObj.mac,
                              sharedKey,
                              encObj.nonce,
                              encObj.ciphertext)

proc generateKeyPair*(): (monocypher.Key, monocypher.Key) =
  let privateKey = toKey(getRandomBytes(sizeof(monocypher.Key)))
  let publicKey = crypto_x25519_public_key(privateKey)
  return (privateKey, publicKey)
