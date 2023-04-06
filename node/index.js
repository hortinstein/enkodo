const crypto = require("crypto");
const { createRequire } = require("module");
const serialize = require("./serialize.js");
const monocypher = require("monocypher-wasm");

async function initMonocypher() {
  await monocypher.ready;
}

initMonocypher();

function splitMAC(encBuffer) {
  return [encBuffer.slice(0, MAC_LEN), encBuffer.slice(MAC_LEN)];
}

function randomBytes(n) {
  const buf = new Uint8Array(n);
  return crypto.randomFillSync(buf);
}

const HASH_LEN = 64;
const KEY_LEN = 32;
const NONCE_LEN = 24;
const MAC_LEN = 16;
const SIG_LEN = 64;

function enc(privateKey, publicKey, data) {
  const sharedKey = monocypher.crypto_key_exchange(privateKey, publicKey);
  const nonce = randomBytes(NONCE_LEN);
  const maccipher = monocypher.crypto_lock(sharedKey, nonce, data);
  const [mac, cipher] = splitMAC(maccipher);
  const myPubKey = monocypher.crypto_key_exchange_public_key(privateKey);
  return serialize.returnEncObj(myPubKey, nonce, mac, cipher.length, cipher);
}

function dec(privateKey, encObj) {
  const sharedKey = monocypher.crypto_key_exchange(
    privateKey,
    encObj.publicKey
  );
  const mac = new Uint8Array(encObj.mac);
  const cipher = new Uint8Array(encObj.cipherText);
  const maccipher = new Uint8Array([...mac, ...cipher]);
  const plain = monocypher.crypto_unlock(sharedKey, encObj.nonce, maccipher);
  return plain;
}

function generateKeyPair() {
  const privateKey = randomBytes(KEY_LEN);
  const publicKey = monocypher.crypto_key_exchange_public_key(privateKey);
  return [privateKey, publicKey];
}

function wrap(obj) {
  return serialize.wrap(obj);
}

function unwrap(wrappedObj) {
  return serialize.unwrap(wrappedObj);
}

function wrapKey(obj) {
  return serialize.wrapKey(obj);
}

function unwrapKey(wrappedObj) {
  return serialize.unwrapKey(wrappedObj);
}

module.exports = {
  enc,
  dec,
  generateKeyPair,
  wrap,
  unwrap,
  wrapKey,
  unwrapKey,
  HASH_LEN,
  KEY_LEN,
  NONCE_LEN,
  MAC_LEN,
  SIG_LEN,
};
