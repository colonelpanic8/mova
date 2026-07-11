import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";
import React, { useEffect } from "react";
import { Text } from "react-native";

import { useApi } from "../../context/ApiContext";
import { useAuth } from "../../context/AuthContext";
import {
  TemplatesProvider,
  useTemplates,
} from "../../context/TemplatesContext";
import { MetadataResponse } from "../../services/api";

jest.mock("../../context/ApiContext");
jest.mock("../../context/AuthContext");

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function buildMetadata(templateName: string): MetadataResponse {
  return {
    templates: {
      default: {
        name: templateName,
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
}

function Probe({ onValue }: { onValue: jest.Mock }) {
  const context = useTemplates();

  useEffect(() => {
    onValue(context);
  }, [context, onValue]);

  return <Text>{context.templates?.default?.name ?? "loading"}</Text>;
}

describe("TemplatesProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it("starts a fresh metadata request when the server identity changes mid-load", async () => {
    const firstMetadata = createDeferred<MetadataResponse>();
    const firstApi = {
      getMetadata: jest.fn(() => firstMetadata.promise),
    };
    const secondApi = {
      getMetadata: jest.fn().mockResolvedValue(buildMetadata("Second Server")),
    };
    let authState = {
      isAuthenticated: true,
      apiUrl: "https://first.example.com",
      username: "ivan",
    };
    let api = firstApi;
    const onValue = jest.fn();

    (useAuth as jest.Mock).mockImplementation(() => authState);
    (useApi as jest.Mock).mockImplementation(() => api);

    const { getByText, rerender } = render(
      <TemplatesProvider>
        <Probe onValue={onValue} />
      </TemplatesProvider>,
    );

    await waitFor(() => {
      expect(firstApi.getMetadata).toHaveBeenCalledTimes(1);
    });

    authState = {
      isAuthenticated: true,
      apiUrl: "https://second.example.com",
      username: "ivan",
    };
    api = secondApi;

    rerender(
      <TemplatesProvider>
        <Probe onValue={onValue} />
      </TemplatesProvider>,
    );

    await waitFor(() => {
      expect(secondApi.getMetadata).toHaveBeenCalledTimes(1);
      expect(getByText("Second Server")).toBeTruthy();
    });

    firstMetadata.resolve(buildMetadata("First Server"));

    await waitFor(() => {
      expect(getByText("Second Server")).toBeTruthy();
    });
  });
});
