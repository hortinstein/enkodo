import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.166.0/testing/asserts.ts";
import { createRequire } from "https://deno.land/std@0.166.0/node/module.ts";

import {
  enc,
  dec,
  wrap,
  unwrap,
  wrapKey,
  unwrapKey,
  generateKeyPair
} from "./main.ts";

const hello_world = new TextEncoder().encode("Hello World");
const [priv, pub] = generateKeyPair();
const [priv2, pub2] = generateKeyPair();

const base64ToUint8 = (str: string): Uint8Array =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

// uses the release config for the tests
const TEST_STRING = new TextEncoder().encode("hello this is a test string");
const TEST_WRAPPED = await Deno.readFile("./TESTFILE_TYPESCRIPT_ENC_BIN")
const TEST_KEY = await Deno.readFile("./TESTFILE_TYPESCRIPT_PRIVKEY")

// this function tests whether the encryption and decryption functions work
export function encrypt_decrypt() {
  const enc_test = enc(priv, pub2, hello_world);
  // console.log(enc_test);
  const plain = dec(priv2, enc_test);
  assertEquals(hello_world, plain);
} //exported for use in benchmarks
Deno.test(encrypt_decrypt)

// this function tests serialization and deserialization of the encryption object
export function wrap_unwrap() {
  const enc_test = enc(priv, pub2, hello_world);
  const wrapped = wrap(enc_test);
  const unwrapped = unwrap(wrapped);
  const plain = dec(priv2, unwrapped);
  assertEquals(enc_test, unwrapped);
};
Deno.test(wrap_unwrap)

Deno.test(function unwrapanddecrypt() {
  const unwrapped = unwrap(TEST_WRAPPED);
  const unwrappedKey = unwrapKey(TEST_KEY)
  const plain = dec(unwrappedKey, unwrapped);
  assertEquals(plain, TEST_STRING)
});
