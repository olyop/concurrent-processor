import { PrimeNumberTestResult } from "./types";

addEventListener("message", event => {
	const data = event.data as number;

	const message: PrimeNumberTestResult = {
		isPrime: isPrime(data),
		number: data,
	};

	postMessage(message);
});

function isPrime(value: number) {
	for (let index = 2, s = Math.sqrt(value); index <= s; index += 1) {
		if (value % index === 0) return false;
	}
	return value > 1;
}
