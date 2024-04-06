import { createElement, useRef, useState } from "react";

import { concurrentProcessor } from "./concurrent-processor";
import isPrimeWorkerURL from "./is-prime-worker?worker&url";
import { PrimeNumberTestResult } from "./types";

export function Application() {
	const primeNumberAbortControllerRef = useRef(new AbortController());

	const [result, setResult] = useState<unknown[]>([]);
	const [isRunningPrimeNumberTest, setIsRunningPrimeNumberTest] = useState(false);

	const primeNumberTest = async () => {
		const values: number[] = [];

		for (let i = 0; i < 5000; i++) {
			// generate a random number between 0 and Number.MAX_SAFE_INTEGER
			const randomNumber = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

			values.push(randomNumber);
		}

		const primeNumbers: number[] = [];

		function onProcess(data: PrimeNumberTestResult) {
			if (data.isPrime) {
				primeNumbers.push(data.number);
			}
		}

		primeNumberAbortControllerRef.current = new AbortController();
		setIsRunningPrimeNumberTest(true);

		try {
			await concurrentProcessor({
				workerURL: isPrimeWorkerURL,
				values,
				onProcess,
				signal: primeNumberAbortControllerRef.current.signal,
				workerOptions: {
					type: "module",
				},
			});

			setResult(primeNumbers);
		} finally {
			setIsRunningPrimeNumberTest(false);
		}
	};

	const handlePrimeNumberTest = () => {
		setResult([]);

		if (isRunningPrimeNumberTest) {
			primeNumberAbortControllerRef.current.abort();
		} else {
			void primeNumberTest();
		}
	};

	return (
		<div>
			<button onClick={handlePrimeNumberTest}>{isRunningPrimeNumberTest ? "Loading" : "Prime Number test"}</button>
			<pre>{JSON.stringify(result, null, 2)}</pre>
		</div>
	);
}
