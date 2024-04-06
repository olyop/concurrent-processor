/* eslint-disable no-param-reassign, unicorn/prevent-abbreviations, unicorn/no-for-loop */

const DEFAULT_MAX_WORKERS = navigator.hardwareConcurrency - 1;

export async function concurrentProcessor<T, V, R = T>(options: ConcurrentProcessorOptions<T, V, R>) {
	const pool: WorkerPoolItem[] = [];

	const maxWorkers = options.concurrency ?? DEFAULT_MAX_WORKERS;

	try {
		// promisify the recursive function
		await new Promise<void>((resolve, reject) => {
			// initialize worker pool
			for (let i = 0; i < maxWorkers; i += 1) {
				const worker: WorkerPoolItem = {
					isProcessing: false,
					value: new Worker(options.workerURL, options.workerOptions),
				};

				worker.value.addEventListener("message", onWorkerMessage(worker, pool, options, reject, resolve));

				pool.push(worker);
			}

			// Start processing first batch of work
			void batchProcessor<T, V, R>(pool, options, reject, resolve);
		});
	} finally {
		// terminate workers
		for (const worker of pool) {
			worker.value.terminate();
		}
	}
}

function onWorkerMessage<T, V, R>(
	worker: WorkerPoolItem,
	pool: WorkerPoolItem[],
	options: ConcurrentProcessorOptions<T, V, R>,
	onError: (error: Error) => void,
	onComplete: () => void,
) {
	return (event: MessageEvent) => {
		options.onProcess(event.data as V);

		if (options.signal?.aborted) {
			onComplete();

			return;
		}

		worker.isProcessing = false;

		// Since a worker has just completed processing
		// a value, we can start processing another batch
		void batchProcessor<T, V, R>(pool, options, onError, onComplete);
	};
}

async function batchProcessor<T, V, R = T>(
	pool: WorkerPoolItem[],
	options: ConcurrentProcessorOptions<T, V, R>,
	onError: (error: Error) => void,
	onComplete: () => void,
) {
	const batch: [T, WorkerPoolItem][] = [];

	// find available workers
	const availableWorkers = pool.filter(worker => !worker.isProcessing);

	if (availableWorkers.length === 0) {
		onError(new Error("No available workers"));

		return;
	}

	// assign work to available workers
	for (const worker of availableWorkers) {
		const value = options.values.pop();

		// if value is undefined this means there is no more work to do
		if (value === undefined) break;

		batch.push([value, worker]);
	}

	// no work left?
	if (batch.length === 0) {
		// are any workers still processing?
		if (pool.every(worker => !worker.isProcessing)) {
			// now we are done
			onComplete();
		}

		// always return as there is no more work to do
		return;
	}

	// mark workers as processing
	// we should do this here as below we may have to wait for promises to resolve
	// and we don't want another batch to be processed in the meantime
	for (const item of batch) {
		const worker = item[1];

		worker.isProcessing = true;
	}

	let values: [R, WorkerPoolItem][] = [];

	if (options.onRead) {
		const promises: [Promise<R>, WorkerPoolItem][] = [];

		for (const item of batch) {
			const [value, worker] = item;

			const result = options.onRead(value);

			if (result instanceof Promise) {
				promises.push([result, worker]);
			} else {
				values.push([result, worker]);
			}
		}

		if (promises.length > 0) {
			const promiseValues = await Promise.all(promises.map(([promise]) => promise));

			for (let i = 0; i < promiseValues.length; i += 1) {
				// @ts-expect-error
				values.push([promiseValues[i], promises[i][1]]);
			}
		}
	} else {
		// if there is no onRead function, it just passes the values through
		values = batch as unknown as [R, WorkerPoolItem][];
	}

	// send work to workers
	for (const item of values) {
		const [value, worker] = item;

		if (options.transfer) {
			if (!isTransferable(value)) {
				onError(new Error("Value is not transferable"));

				return;
			}

			worker.value.postMessage(value, [value]);
		} else {
			worker.value.postMessage(value);
		}
	}
}

function isTransferable(value: unknown): value is Transferable {
	return (
		value instanceof ArrayBuffer ||
		value instanceof OffscreenCanvas ||
		value instanceof ImageBitmap ||
		value instanceof MessagePort ||
		value instanceof ReadableStream ||
		value instanceof WritableStream ||
		value instanceof TransformStream ||
		value instanceof VideoFrame
	);
}

interface WorkerPoolItem {
	value: Worker;
	isProcessing: boolean;
}

export interface ConcurrentProcessorOptions<T, V, R = T> {
	workerURL: string;
	workerOptions?: WorkerOptions;
	concurrency?: number;
	transfer?: boolean;
	signal?: AbortSignal;
	values: T[];
	onRead?: (value: T) => Promise<R> | R;
	onProcess: (value: V) => void;
}
