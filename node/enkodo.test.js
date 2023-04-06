const {
  enc,
  dec,
  wrap,
  unwrap,
  wrapKey,
  unwrapKey,
  generateKeyPair,
} = require("./index.js");

const fs = require("fs");
const path = require("path");

const hello_world = new TextEncoder().encode("Hello World");
const [priv, pub] = generateKeyPair();
const [priv2, pub2] = generateKeyPair();

const base64ToUint8 = (str) => Uint8Array.from(Buffer.from(str, "base64"));

const TEST_STRING = new TextEncoder().encode("hello this is a test string");
const TEST_WRAPPED = fs.readFileSync(
  path.join(__dirname, "../TESTFILE_TYPESCRIPT_ENC_BIN")
);
const TEST_KEY = fs.readFileSync(
  path.join(__dirname, "../TESTFILE_TYPESCRIPT_PRIVKEY")
);

describe("enkodo", () => {
  test("encrypt and decrypt should work correctly", () => {
    const enc_test = enc(priv, pub2, hello_world);
    const plain = dec(priv2, enc_test);

    expect(plain).toEqual(hello_world);
  });

  test("wrap and unwrap should work correctly", () => {
    const enc_test = enc(priv, pub2, hello_world);
    const wrapped = wrap(enc_test);
    const unwrapped = unwrap(wrapped);
    const plain = dec(priv2, unwrapped);

    expect(enc_test).toEqual(unwrapped);
  });

  test("unwrap and decrypt should work correctly", () => {
    const unwrapped = unwrap(TEST_WRAPPED);
    const unwrappedKey = unwrapKey(TEST_KEY);
    const plain = dec(unwrappedKey, unwrapped);

    expect(plain).toEqual(TEST_STRING);
  });
});
