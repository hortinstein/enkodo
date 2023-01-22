import { enc, dec, generateKeyPair } from "./main.ts";
import { encrypt_decrypt } from "./main_test.ts";

Deno.bench(encrypt_decrypt);