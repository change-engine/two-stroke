import { Miniflare, createFetchMock } from "miniflare";
import toml from "toml";
import fs from "fs";
import { Env } from "./types";
import consumers from "stream/consumers";
import { URLSearchParams } from "url";
import createClient from "openapi-fetch";

// eslint-disable-next-line @typescript-eslint/ban-types
export const setupTests = async <Paths extends {}>(bindings: Env) => {
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();

  const config = toml.parse(fs.readFileSync("wrangler.toml", "utf8"));

  const miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
    bindings: {
      TOKEN_HASH:
        "djAxlhzT1IU9QIP3UKdipECQPAGGoPQK86/GnTBcbHLtPC3ni6JkTQ/iIeF0KG0y1CZ+J+9W",
      ...bindings,
    },
    queueConsumers: (config.queues?.consumers ?? []).map(
      ({ queue }: { queue: string }) => queue,
    ),
    queueProducers: Object.fromEntries(
      (config.queues?.producers ?? []).map(
        ({ binding, queue }: { queue: string; binding: string }) => [
          binding,
          queue,
        ],
      ),
    ),
    r2Buckets: (config.r2_buckets ?? []).map(
      ({ binding }: { binding: string }) => binding,
    ),
    kvNamespaces: (config.kv_namespaces ?? []).map(
      ({ binding }: { binding: string }) => binding,
    ),
    d1Databases: (config.d1_databases ?? []).map(
      ({ binding }: { binding: string }) => binding,
    ),
    fetchMock,
  });

  const url = await miniflare.ready;

  const client = createClient<Paths>({ baseUrl: url.toString() });

  return {
    url,
    miniflare,
    fetchMock,
    client,
    async waitForQueue(trigger: () => Promise<void>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log: any = [];
      const orig = console.log;
      console.log = function (message) {
        orig(message);
        log.push(message);
      };
      await trigger();
      await waitUntil(() => expect(log).contains("Queue batch finished"));
      console.log = orig;
    },
  };
};

async function waitUntil(condition: () => void, time = 100) {
  try {
    condition();
    return;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, time));
    await waitUntil(condition, time);
  }
}

export function recordRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    consumers.json(body).then(cb);
    return { statusCode, data };
  };
}

export function recordFormRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    consumers
      .text(body)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) =>
        cb(Object.fromEntries(new URLSearchParams(data).entries())),
      );
    return { statusCode, data };
  };
}

export function recordFirehoseRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (data: any) => void,
  statusCode: number,
  data: string | object | Buffer | undefined,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ body }: any) => {
    consumers
      .json(body)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => cb(JSON.parse(atob(data["Record"]["Data"]))));
    return { statusCode, data };
  };
}
