import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildConfigIdentityKey,
  CachedMetadataEntry,
  clearObservedConfigHash,
  CONFIG_METADATA_TTL_MS,
  getCachedMetadata,
  getObservedConfigHash,
  isCachedMetadataFresh,
  observeConfigHash,
  saveCachedMetadata,
  subscribeToConfigHash,
} from "../../services/configMetadata";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const SAMPLE_METADATA: CachedMetadataEntry["metadata"] = {
  templates: {
    default: {
      name: "Default",
      prompts: [],
    },
  },
  filterOptions: null,
  todoStates: null,
  customViews: null,
  categoryTypes: null,
  habitConfig: {
    status: "ok",
    enabled: true,
  },
  exposedFunctions: null,
  errors: [],
};

describe("configMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearObservedConfigHash();
  });

  it("stores cached metadata per server identity", async () => {
    await saveCachedMetadata("http://example.com/", "ivan", {
      metadata: SAMPLE_METADATA,
      configHash: "hash-1",
      cachedAt: "2026-04-03T00:00:00.000Z",
    });
    const storedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(storedValue);

    const cached = await getCachedMetadata("http://example.com", "ivan");

    expect(cached).toEqual({
      metadata: SAMPLE_METADATA,
      configHash: "hash-1",
      cachedAt: "2026-04-03T00:00:00.000Z",
    });
  });

  it("calculates freshness against the ttl window", () => {
    const freshTimestamp = new Date(
      Date.now() - CONFIG_METADATA_TTL_MS + 1_000,
    ).toISOString();
    const staleTimestamp = new Date(
      Date.now() - CONFIG_METADATA_TTL_MS - 1_000,
    ).toISOString();

    expect(isCachedMetadataFresh(freshTimestamp)).toBe(true);
    expect(isCachedMetadataFresh(staleTimestamp)).toBe(false);
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
});
