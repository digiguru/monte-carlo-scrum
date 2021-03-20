<script lang="ts">
	
	export let title: string;
	let counter = 0;
	let andCounter = 0;

	function handleClick () {
		counter++;
	}
	function handleAndClick () {
		andCounter++;
	}
</script>

<main>
	<h1>{title}!</h1>
	<p>We can count! {counter}</p>
	<button on:click={handleClick} label="button">Standard Button</button>
	
	<p>We can't count! {andCounter}</p>
	<and-button on:click={handleAndClick}  primary=true label="AND Button"></and-button>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>