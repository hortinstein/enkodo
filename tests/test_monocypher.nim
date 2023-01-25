import unittest
import monocypher
import sysrandom

echo("key size: ", sizeof(Key))
echo("nonce size: ", sizeof(Nonce))
let a_secretKey = getRandomBytes(sizeof(Key))
let a_publicKey = crypto_key_exchange_public_key(a_secretKey)

let b_secretKey = getRandomBytes(sizeof(Key))
let b_publicKey = crypto_key_exchange_public_key(b_secretKey)

test "key exchange works":
  let a_sharedKey = crypto_key_exchange(a_secretKey, b_publicKey)
  let b_sharedKey = crypto_key_exchange(b_secretKey, a_publicKey)
  doAssert(a_sharedKey == b_sharedKey)

test "encryption works":  
  let sharedKey = crypto_key_exchange(a_secretKey, b_publicKey)

  let nonce = getRandomBytes(sizeof(Nonce))
  let plaintext = cast[seq[byte]]("hello")
  let (mac, ciphertext) = crypto_lock(sharedKey, nonce, plaintext)
  let decrypted = crypto_unlock(sharedKey, nonce, mac, ciphertext)


test "decryption works":
  let sharedKey = crypto_key_exchange(a_secretKey, b_publicKey)
  let nonce = getRandomBytes(sizeof(Nonce))
  let plaintext = cast[seq[byte]]("hello")
  let (mac, ciphertext) = crypto_lock(sharedKey, nonce, plaintext)
  let decrypted = crypto_unlock(sharedKey, nonce, mac, ciphertext)
  doAssert(plaintext == decrypted)
