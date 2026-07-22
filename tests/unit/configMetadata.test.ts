import {
  buildConfigIdentityKey,
  clearObservedConfigHash,
  getObservedConfigHash,
  observeConfigHash,
  subscribeToConfigHash,
} from "../../services/configMetadata";

describe("configMetadata", () => {
  beforeEach(() => {
    clearObservedConfigHash();
  });

  it("builds identity keys from normalized url and username", () => {
    const key = buildConfigIdentityKey("http://example.com/", "ivan");
    // Trailing slash is normalized away, so both spellings share an identity.
    expect(buildConfigIdentityKey("http://example.com", "ivan")).toBe(key);
    expect(buildConfigIdentityKey("http://example.com", "other")).not.toBe(key);
    expect(buildConfigIdentityKey("http://other.com", "ivan")).not.toBe(key);
  });

  it("publishes config hash changes once per distinct value", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToConfigHash(listener);
    const identityKey = buildConfigIdentityKey("http://example.com", "ivan");

    observeConfigHash(identityKey, "hash-1");
    observeConfigHash(identityKey, "hash-1");
    observeConfigHash(identityKey, "hash-2");
    unsubscribe();

    expect(getObservedConfigHash(identityKey)).toBe("hash-2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      identityKey,
      configHash: "hash-1",
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      identityKey,
      configHash: "hash-2",
    });
  });

  it("ignores empty hashes and scopes hashes per identity", () => {
    const identityA = buildConfigIdentityKey("http://a.com", "ivan");
    const identityB = buildConfigIdentityKey("http://b.com", "ivan");

    observeConfigHash(identityA, "hash-a");
    observeConfigHash(identityB, "  ");
    observeConfigHash(identityB, null);

    expect(getObservedConfigHash(identityA)).toBe("hash-a");
    expect(getObservedConfigHash(identityB)).toBeNull();

    clearObservedConfigHash(identityA);
    expect(getObservedConfigHash(identityA)).toBeNull();
  });
});
