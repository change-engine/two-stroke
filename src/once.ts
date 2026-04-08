import type { z, ZodSafeParseResult, ZodType } from "zod/v4";

export const once = async <T extends { retry_count: number }>(
    key: string,
    bucket: R2Bucket,
    queue: Queue<T>,
    backoffExponent: number,
    numRetries: number,
    ack: (cb: () => Promise<void>) => Promise<void>,
    cb: (retry: (m: T) => Promise<void>) => Promise<void>,
) => {
    const retry = async (m: T) => {
        const retry_count = m.retry_count + 1;
        if (retry_count > numRetries) throw new Error("Too many retries");
        await queue.send(
            { ...m, retry_count },
            { delaySeconds: Math.min(Math.pow(retry_count, backoffExponent), 900) },
        );
    };
    if (!(await isDuplicateMessage(key, bucket)))
        await ack(async () => {
            await cb(retry);
        });
};


export const retryHandler =
    <T, M extends ZodType>(
        maxRetries: number,
        handler: (
            body: z.output<M>,
            env: T,
            isFinalAttempt: boolean,
            ack: (cb: () => Promise<void>) => Promise<void>,
        ) => Promise<void>,
    ) =>
        async ({
            body,
            waitUntil,
            env,
        }: {
            body: z.infer<M> & { retry: number };
            waitUntil: (p: Promise<void>) => void;
            env: T;
        }) => {
            const isFinalAttempt = body.retry >= maxRetries;
            await handler(
                body,
                env,
                isFinalAttempt,
                // eslint-disable-next-line @typescript-eslint/require-await
                async (cb) => {
                    waitUntil(cb());
                },
            );

            return { body: { ok: true } };
        };

export const retryQueue =
    <T, M extends ZodType>(
        maxRetries: number,
        handler: (
            body: z.output<M>,
            env: T,
            isFinalAttempt: boolean,
            ack: (cb: () => Promise<void>) => Promise<void>,
        ) => Promise<void>,
    ) =>
        async ({
            batch,
            parsedBatch,
            env,
        }: {
            batch: MessageBatch<z.input<M>>;
            parsedBatch: ZodSafeParseResult<z.output<M>>[];
            env: T;
        }) => {
            const message = batch.messages[0];
            if (!message || batch.messages.length !== 1) {
                console.warn({ batch });
                throw new Error(
                    `Queue must only process one message at a time, got ${batch.messages.length}`,
                );
            }
            if (!parsedBatch[0] || !parsedBatch[0].success) {
                console.error({ batch });
                throw new Error(`Queue message invalid`);
            }

            const isFinalAttempt = message.attempts >= maxRetries;

            try {
                await handler(parsedBatch[0].data, env, isFinalAttempt, async (cb) => {
                    message.ack();
                    await cb();
                });
            } catch (err) {
                if (!isFinalAttempt) message.retry();
                throw err;
            }
        };


const isDuplicateMessage = async (key: string, bucket: R2Bucket) => {
    // Work around for CloudFlare R2 error:
    // put: We encountered an internal error. Please try again. (10001)
    for (let i = 0; i < 5; i++) {
        try {
            // Will throw if that error occurs
            const putResult = await bucket.put(`lock-${key}`, "", {
                onlyIf: new Headers({
                    "If-Unmodified-Since": "Wed, 21 Oct 2015 07:28:00 GMT",
                }),
            });
            // if the returned result is null then the object already existed
            const isDupe = putResult === null;
            if (isDupe) console.log("Duplicate message", { key });
            return isDupe;
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            console.warn(`Error putting ${key} to R2: ${err}`);
            console.warn(`Retrying in ${i} seconds`);
            await new Promise((resolve) => setTimeout(resolve, i * 1000));
        }
    }
    throw new Error(`Failed to put ${key} to R2`);
};