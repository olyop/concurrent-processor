# Concurrent Processor

A simple utility that concurrently processes an array of arbitrary values by offloading the execution to a web worker.

## Installation

```bash
npm install concurrent-processor
```

## Usage

```javascript
import { concurrentProcessor } from "concurrent-processor";

await concurrentProcessor({
	workerURL,     // URL to the worker script
	values,        // Array of values to process
	onRead,        // Callback function when a value is read to be passed to the worker
	onProcess,     // Callback function when a value has been processed
	signal,        // Abort signal
	workerOptions, // Options to pass to new Worker(url, options)
});
```
