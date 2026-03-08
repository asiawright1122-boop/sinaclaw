import { describe, it, expect } from "vitest";
import { encryptString, decryptString } from "./security";

describe("security — AES-GCM encryption", () => {
    it("encrypts and decrypts a string correctly", async () => {
        const plaintext = "sk-test-1234567890abcdef";
        const password = "my-secure-passphrase";

        const encrypted = await encryptString(plaintext, password);
        expect(encrypted).not.toBe(plaintext);
        expect(encrypted.length).toBeGreaterThan(0);

        const decrypted = await decryptString(encrypted, password);
        expect(decrypted).toBe(plaintext);
    });

    it("fails decryption with wrong password", async () => {
        const plaintext = "sensitive-api-key";
        const encrypted = await encryptString(plaintext, "correct-password");

        await expect(
            decryptString(encrypted, "wrong-password")
        ).rejects.toThrow();
    });

    it("produces different ciphertexts for same input (random salt/iv)", async () => {
        const plaintext = "same-input";
        const password = "same-password";
        const enc1 = await encryptString(plaintext, password);
        const enc2 = await encryptString(plaintext, password);
        expect(enc1).not.toBe(enc2);
    });

    it("handles empty string", async () => {
        const encrypted = await encryptString("", "password");
        const decrypted = await decryptString(encrypted, "password");
        expect(decrypted).toBe("");
    });

    it("handles unicode content", async () => {
        const plaintext = "你好世界 API キー";
        const password = "パスワード123";
        const encrypted = await encryptString(plaintext, password);
        const decrypted = await decryptString(encrypted, password);
        expect(decrypted).toBe(plaintext);
    });
});
