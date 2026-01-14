/**
 * Base64 encoding that works reliably in React Native.
 * btoa is not available in all React Native environments.
 */
export function base64Encode(str: string): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";

  // Convert string to UTF-8 bytes
  const bytes: number[] = [];
  for (let j = 0; j < str.length; j++) {
    const charCode = str.charCodeAt(j);
    if (charCode < 128) {
      bytes.push(charCode);
    } else if (charCode < 2048) {
      bytes.push((charCode >> 6) | 192);
      bytes.push((charCode & 63) | 128);
    } else {
      bytes.push((charCode >> 12) | 224);
      bytes.push(((charCode >> 6) & 63) | 128);
      bytes.push((charCode & 63) | 128);
    }
  }

  // Process 3 bytes at a time
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];

    // First character is always valid
    result += chars.charAt((a >> 2) & 63);
    // Second character
    result +=
      chars.charAt(((a & 3) << 4) | ((b !== undefined ? b >> 4 : 0) & 15));
    // Third character (or padding)
    if (b !== undefined) {
      result +=
        chars.charAt(((b & 15) << 2) | ((c !== undefined ? c >> 6 : 0) & 3));
    } else {
      result += "=";
    }
    // Fourth character (or padding)
    if (c !== undefined) {
      result += chars.charAt(c & 63);
    } else {
      result += "=";
    }
  }

  return result;
}
