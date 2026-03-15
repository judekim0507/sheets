<script lang="ts">
	import { settingsStore, ANTHROPIC_MODELS, GOOGLE_MODELS } from '$lib/stores/settings.svelte';
	import type { AIProvider } from '$lib/data/types';
	import * as Dialog from '$lib/components/ui/dialog';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Separator from '$lib/components/ui/separator/separator.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const models = $derived(
		settingsStore.provider === 'anthropic' ? ANTHROPIC_MODELS : GOOGLE_MODELS
	);

	const activeModel = $derived(
		settingsStore.provider === 'anthropic' ? settingsStore.anthropicModel : settingsStore.googleModel
	);

	function selectProvider(p: AIProvider) {
		settingsStore.provider = p;
		settingsStore.save();
	}

	function selectModel(modelId: string) {
		if (settingsStore.provider === 'anthropic') {
			settingsStore.anthropicModel = modelId;
		} else {
			settingsStore.googleModel = modelId;
		}
		settingsStore.save();
	}

	function handleSave() {
		settingsStore.save();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Settings</Dialog.Title>
			<Dialog.Description>Configure your AI provider, model, and API key</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 py-4">
			<!-- Provider Toggle -->
			<div class="space-y-3">
				<Label>AI Provider</Label>
				<div class="grid grid-cols-2 gap-2">
					<button
						class="rounded-lg border px-4 py-3 text-sm font-medium transition-colors
							{settingsStore.provider === 'anthropic'
							? 'border-primary bg-primary/5 text-primary'
							: 'hover:bg-accent'}"
						onclick={() => selectProvider('anthropic')}
					>
						Anthropic (Claude)
					</button>
					<button
						class="rounded-lg border px-4 py-3 text-sm font-medium transition-colors
							{settingsStore.provider === 'google'
							? 'border-primary bg-primary/5 text-primary'
							: 'hover:bg-accent'}"
						onclick={() => selectProvider('google')}
					>
						Google (Gemini)
					</button>
				</div>
			</div>

			<Separator />

			<!-- Model Selection -->
			<div class="space-y-3">
				<Label>Model</Label>
				<div class="grid gap-2">
					{#each models as model}
						<button
							class="rounded-lg border px-4 py-2.5 text-left text-sm transition-colors
								{activeModel === model.id
								? 'border-primary bg-primary/5 text-primary'
								: 'hover:bg-accent'}"
							onclick={() => selectModel(model.id)}
						>
							{model.label}
							<span class="ml-1 text-xs text-muted-foreground">{model.id}</span>
						</button>
					{/each}
				</div>
			</div>

			<Separator />

			<!-- API Key -->
			<div class="space-y-3">
				<Label for="api-key">
					{settingsStore.provider === 'anthropic' ? 'Anthropic' : 'Google'} API Key
				</Label>
				<Input
					id="api-key"
					type="password"
					placeholder={settingsStore.provider === 'anthropic' ? 'sk-ant-...' : 'AIza...'}
					value={settingsStore.provider === 'anthropic'
						? settingsStore.anthropicApiKey
						: settingsStore.googleApiKey}
					oninput={(e) => {
						const val = e.currentTarget.value;
						if (settingsStore.provider === 'anthropic') {
							settingsStore.anthropicApiKey = val;
						} else {
							settingsStore.googleApiKey = val;
						}
					}}
				/>
				<p class="text-xs text-muted-foreground">
					Stored in your browser's localStorage. Never sent to any server besides the AI provider.
					Use a key with usage limits set.
				</p>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button onclick={handleSave} disabled={!settingsStore.activeApiKey.trim()}>Save</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
