import App from './App.svelte';
import 'and-component-library/Button'

const app = new App({
	target: document.body,
	props: {
		title: 'Monte Carlo Sim'
	}
});

export default app;