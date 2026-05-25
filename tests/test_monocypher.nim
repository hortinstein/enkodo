import unittest
import monocypher
import sysrandom

proc toKey(s: seq[byte]): Key =
  copyMem(addr result[0], unsafeAddr s[0], sizeof(Key))

proc toNonce(s: seq[byte]): Nonce =
  copyMem(addr result[0], unsafeAddr s[0], sizeof(Nonce))

echo("key size: ", sizeof(Key))
echo("nonce size: ", sizeof(Nonce))
let a_secretKey = toKey(getRandomBytes(sizeof(Key)))
let a_publicKey = crypto_x25519_public_key(a_secretKey)

let b_secretKey = toKey(getRandomBytes(sizeof(Key)))
let b_publicKey = crypto_x25519_public_key(b_secretKey)

test "key exchange works":
  let a_sharedKey = crypto_x25519(a_secretKey, b_publicKey)
  let b_sharedKey = crypto_x25519(b_secretKey, a_publicKey)
  doAssert(a_sharedKey == b_sharedKey)

test "encryption works":
  let sharedKey = crypto_x25519(a_secretKey, b_publicKey)
  let nonce = toNonce(getRandomBytes(sizeof(Nonce)))
  let plaintext = cast[seq[byte]]("hello")
  let (mac, ciphertext) = crypto_aead_lock(sharedKey, nonce, plaintext)
  let decrypted = crypto_aead_unlock(mac, sharedKey, nonce, ciphertext)

test "decryption works":
  let sharedKey = crypto_x25519(a_secretKey, b_publicKey)
  let nonce = toNonce(getRandomBytes(sizeof(Nonce)))
  let plaintext = cast[seq[byte]]("hello")
  let (mac, ciphertext) = crypto_aead_lock(sharedKey, nonce, plaintext)
  let decrypted = crypto_aead_unlock(mac, sharedKey, nonce, ciphertext)
  doAssert(plaintext == decrypted)
