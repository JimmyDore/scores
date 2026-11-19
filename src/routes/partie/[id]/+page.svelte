<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import CodeForm from '$lib/components/CodeForm.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import { BELOTE_BONUS, BELOTE_CAPOT, BELOTE_ROUND, getGame, roundLabel, skullKingScore } from '$lib/games';
	import { numericDate } from '$lib/format';
	import type { Entry } from '$lib/match';

	let { data, form } = $props();

	const m = $derived(data.match);
	const f = $derived(form as { wrong?: boolean; error?: string } | null);
	const game = $derived(getGame(m.game)!);
	const sideCount = $derived(m.sides.length);

	/* ---------- Quelle manche saisit-on ? ---------- */
	// null = la prochaine manche ; sinon le numéro d'une manche déjà jouée qu'on corrige.
	let editN = $state<number | null>(null);
	const targetN = $derived(editN ?? m.pendingRound ?? m.nextRound);
	const existing = $derived(targetN ? m.rounds.find((r) => r.n === targetN) : undefined);
	const isComplete = (entries: Entry[]) => entries.every((e) => e.points !== null && e.points !== undefined);

	/* ---------- Saisie ---------- */
	let values = $state<string[]>([]);
	let focus = $state(0);
	// Belote : la case tapée en premier remplit l'autre (162 − x). -1 = plus de remplissage automatique.
	let source = $state<number | null>(null);
	let bids = $state<number[]>([]);
	let tricks = $state<(number | null)[]>([]);
	let bonus = $state<number[]>([]);
	let touched = $state(false);
	let confirmDelete = $state(false);

	function reset() {
		const e = existing?.entries;
		values = Array.from({ length: sideCount }, (_, i) => (e && e[i]?.points != null ? String(e[i].points) : ''));
		bids = Array.from({ length: sideCount }, (_, i) => e?.[i]?.bid ?? 0);
		tricks = Array.from({ length: sideCount }, (_, i) => (e && isComplete(e) ? (e[i]?.tricks ?? null) : null));
		bonus = Array.from({ length: sideCount }, (_, i) => e?.[i]?.bonus ?? 0);
		focus = 0;
		source = e ? -1 : null;
		touched = false;
	}

	// On recharge la saisie quand la manche visée change (ou qu'un autre téléphone l'a modifiée).
	const resetKey = $derived(`${m.id}:${targetN}:${JSON.stringify(existing?.entries ?? null)}`);
	$effect(() => {
		void resetKey;
		untrack(reset);
	});

	// Plusieurs téléphones : on recharge toutes les 5 s quand personne ne saisit sur celui-ci.
	$effect(() => {
		const t = setInterval(() => {
			if (document.visibilityState === 'visible' && !touched && editN === null && !confirmDelete) invalidateAll();
		}, 5000);
		return () => clearInterval(t);
	});

	function typeDigit(k: string, i: number) {
		let v = values[i];
		if (k === 'del') v = v.slice(0, -1);
		else if (v.length < 4) v = v === '0' ? k : v + k;
		values[i] = v;
	}

	function beloteKey(k: string) {
		touched = true;
		const f = focus;
		const o = 1 - f;
		if (source === null) source = f;
		typeDigit(k, f);
		if (source === f) {
			const n = Number(values[f]);
			values[o] = values[f] === '' ? '' : n <= BELOTE_ROUND ? String(BELOTE_ROUND - n) : values[o];
		}
	}

	function beloteChip(kind: 'belote' | 'capot' | 'dedans') {
		touched = true;
		const f = focus;
		const o = 1 - f;
		if (kind === 'belote') {
			values[f] = String((Number(values[f]) || 0) + BELOTE_BONUS);
			if (values[o] === '') values[o] = '0';
		} else if (kind === 'capot') {
			values[f] = String(BELOTE_CAPOT);
			values[o] = '0';
		} else {
			values[f] = '0';
			values[o] = String(BELOTE_ROUND);
		}
		source = -1;
	}

	function freeKey(k: string) {
		touched = true;
		typeDigit(k, focus);
	}

	const allFilled = $derived(values.length === sideCount && values.every((v) => v !== ''));

	function nextEmpty() {
		for (let step = 1; step <= sideCount; step++) {
			const i = (focus + step) % sideCount;
			if (values[i] === '') {
				focus = i;
				return;
			}
		}
	}

	/* ---------- Skull King ---------- */
	const skPhase = $derived<'bids' | 'result'>(existing ? 'result' : 'bids');
	const skScores = $derived(
		tricks.map((t, i) => (t === null || targetN === null ? null : skullKingScore(targetN, bids[i] ?? 0, t, bonus[i] ?? 0)))
	);
	const skTricksTotal = $derived(tricks.reduce<number>((s, t) => s + (t ?? 0), 0));
	const skReady = $derived(tricks.length === sideCount && tricks.every((t) => t !== null));

	/* ---------- Ce qu'on envoie ---------- */
	const entries = $derived.by<Entry[]>(() => {
		if (game.entry === 'skullking') {
			if (skPhase === 'bids') return bids.map((b) => ({ points: null, bid: b }));
			return tricks.map((t, i) => ({ points: skScores[i], bid: bids[i], tricks: t, bonus: bonus[i] }));
		}
		return values.map((v) => ({ points: v === '' ? null : Number(v) }));
	});

	const afterSave = () => {
		return async ({ update, result }: { update: () => Promise<void>; result: { type: string } }) => {
			await update();
			if (result.type === 'success') {
				editN = null;
				reset();
			}
		};
	};

	function editRound(n: number) {
		if (!data.canWrite) return;
		const r = m.rounds.find((x) => x.n === n);
		if (!r || !isComplete(r.entries)) return;
		editN = editN === n ? null : n;
		confirmDelete = false;
	}

	/* ---------- Affichage de la grille ---------- */
	const rowCount = $derived(
		game.end === 'rounds' ? m.endValue : Math.max(m.rounds.length + (m.done ? 0 : m.pendingRound ? 0 : 1), 1)
	);
	const rows = $derived(Array.from({ length: rowCount }, (_, i) => i + 1));
	const short = (name: string) => name.replace(' & ', ' · ');
	const cell = (p: number | null | undefined) => (p === null || p === undefined ? '' : game.entry === 'belote' && p === 0 ? '—' : String(p));

	let sheetH = $state(0);
</script>

<svelte:head>
	<title>{game.name} · Les scores de la famille</title>
</svelte:head>

<div class="page" style="padding-bottom: {sheetH + 24}px">
	<div class="top">
		<a class="back" href="/">← Accueil</a>
		<span class="meta">{game.emoji} {game.name} · {numericDate(m.createdAt)}</span>
		{#if data.canWrite && !confirmDelete}
			<button type="button" class="trash" onclick={() => (confirmDelete = true)}>🗑 Supprimer</button>
		{/if}
	</div>

	{#if data.canWrite && confirmDelete}
		<form method="POST" action="?/deleteMatch" use:enhance class="card confirm">
			<p>Supprimer cette partie pour de bon ?</p>
			<button class="btn btn-gold" type="submit">Oui, supprimer la partie</button>
			<button class="btn btn-cream" type="button" onclick={() => (confirmDelete = false)}>Non, la garder</button>
		</form>
	{/if}

	<table class="sheet-grid" class:many={sideCount > 4}>
		<thead>
			<tr>
				<th class="no"></th>
				{#each m.sideNames as name, i}
					<th class:lead={m.leaders.includes(i)}>
						<span class="who">{short(name)}</span>
						<span class="total">{m.totals[i]}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as n (n)}
				{@const r = m.rounds.find((x) => x.n === n)}
				{@const complete = !!r && isComplete(r.entries)}
				{@const current = targetN === n && data.canWrite && !(m.done && editN === null)}
				<tr class:current class:clickable={complete && data.canWrite} onclick={() => editRound(n)}>
					<td class="no">{roundLabel(game, n)}</td>
					{#each m.sides as _, i}
						<td>
							{#if current && game.entry !== 'skullking'}
								<span class="preview">{values[i] || '?'}</span>
							{:else if r && complete}
								{cell(r.entries[i].points)}
								{#if game.entry === 'skullking'}<small class="bt">{r.entries[i].bid}/{r.entries[i].tricks}</small>{/if}
							{:else if r && game.entry === 'skullking'}
								<small class="bt">annonce {r.entries[i].bid}</small>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	{#if data.canWrite && m.rounds.length > 0 && !m.done}
		<p class="tip">Une erreur ? Touchez la ligne pour la corriger.</p>
	{/if}

</div>

<div class="drawer" bind:clientHeight={sheetH}>
	{#if !data.canWrite}
		<CodeForm action="?/code" wrong={f?.wrong} />
	{:else if m.done && editN === null}
		<div class="done">
			<div class="trophy">{m.tie ? '🤝' : '🏆'}</div>
			<div class="winner">{m.result}{m.tie ? '' : ' !'}</div>
			<form method="POST" action="?/rematch" use:enhance>
				<button class="btn btn-gold" type="submit">🔁 Rejouer avec les mêmes</button>
			</form>
			<a class="btn btn-cream" href="/">Accueil</a>
		</div>
	{:else if targetN !== null}
		<div class="head">
			<strong>{editN !== null ? 'Corriger la manche' : 'Manche'} {roundLabel(game, targetN)}</strong>
			{#if editN !== null}
				<form method="POST" action="?/deleteRound" use:enhance={afterSave} class="inline">
					<input type="hidden" name="n" value={editN} />
					<button class="link danger-link" type="submit">Supprimer</button>
				</form>
				<button class="link" type="button" onclick={() => (editN = null)}>Annuler</button>
			{:else if m.pendingRound !== null}
				<form method="POST" action="?/deleteRound" use:enhance={afterSave} class="inline">
					<input type="hidden" name="n" value={m.pendingRound} />
					<button class="link" type="submit">↺ Refaire les annonces</button>
				</form>
			{/if}
		</div>

		{#if f?.error}<p class="error">{f.error}</p>{/if}

		<form method="POST" action="?/round" use:enhance={afterSave} id="roundform">
			<input type="hidden" name="n" value={targetN} />
			<input type="hidden" name="entries" value={JSON.stringify(entries)} />
		</form>

		{#if game.entry === 'belote'}
			<p class="help">Touchez l’équipe à noter, l’autre se calcule toute seule.</p>
			<div class="boxes two">
				{#each m.sideNames as name, i}
					<button type="button" class="box" class:on={focus === i} onclick={() => (focus = i)}>
						<span>{short(name)}</span><b>{values[i] || '·'}</b>
					</button>
				{/each}
			</div>
			<div class="chips">
				<button type="button" onclick={() => beloteChip('belote')}>+20 belote</button>
				<button type="button" onclick={() => beloteChip('capot')}>Capot</button>
				<button type="button" onclick={() => beloteChip('dedans')}>Dedans</button>
			</div>
			<Keypad onkey={beloteKey}>
				{#snippet ok()}
					<button type="submit" form="roundform" disabled={!allFilled}>{editN !== null ? 'Corriger' : 'Noter'}<br />la manche</button>
				{/snippet}
			</Keypad>
		{:else if game.entry === 'free'}
			<div class="boxes" class:two={sideCount <= 2}>
				{#each m.sideNames as name, i}
					<button type="button" class="box" class:on={focus === i} onclick={() => (focus = i)}>
						<span>{name}</span><b>{values[i] || '·'}</b>
					</button>
				{/each}
			</div>
			<Keypad onkey={freeKey}>
				{#snippet ok()}
					{#if allFilled}
						<button type="submit" form="roundform">{editN !== null ? 'Corriger' : 'Noter'}<br />la manche</button>
					{:else}
						<button type="button" onclick={nextEmpty}>Suivant ▶</button>
					{/if}
				{/snippet}
			</Keypad>
		{:else if skPhase === 'bids'}
			<p class="help">Avant de jouer : combien de plis chacun annonce ?</p>
			<div class="sk">
				{#each m.sideNames as name, i}
					<div class="skrow">
						<span class="skname">{name}</span>
						<div class="nums">
							{#each Array.from({ length: targetN + 1 }, (_, k) => k) as k}
								<button
									type="button"
									class:on={bids[i] === k}
									onclick={() => {
										bids[i] = k;
										touched = true;
									}}>{k}</button
								>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<button class="btn btn-gold" type="submit" form="roundform">Annonces notées, on joue ! ▶</button>
		{:else}
			<p class="help">Combien de plis chacun a faits ?</p>
			<div class="sk">
				{#each m.sideNames as name, i}
					<div class="skrow">
						<div class="skline">
							<span class="skname">{name}</span>
							<span class="stepper">
								annonce
								<button type="button" aria-label="Annonce moins" onclick={() => { bids[i] = Math.max(0, bids[i] - 1); touched = true; }}>−</button>
								<b>{bids[i]}</b>
								<button type="button" aria-label="Annonce plus" onclick={() => { bids[i] = Math.min(targetN, bids[i] + 1); touched = true; }}>+</button>
							</span>
							<span class="score">{skScores[i] === null ? '' : (skScores[i]! > 0 ? '+' : '') + skScores[i]}</span>
						</div>
						<div class="nums">
							{#each Array.from({ length: targetN + 1 }, (_, k) => k) as k}
								<button
									type="button"
									class:on={tricks[i] === k}
									onclick={() => {
										tricks[i] = k;
										touched = true;
									}}>{k}</button
								>
							{/each}
						</div>
						<div class="stepper bonus">
							bonus
							<button type="button" aria-label="Bonus moins" onclick={() => { bonus[i] = Math.max(0, bonus[i] - 10); touched = true; }}>−10</button>
							<b>{bonus[i]}</b>
							<button type="button" aria-label="Bonus plus" onclick={() => { bonus[i] = bonus[i] + 10; touched = true; }}>+10</button>
						</div>
					</div>
				{/each}
			</div>
			{#if skReady && skTricksTotal !== targetN}
				<p class="warn">Attention : {skTricksTotal} plis notés pour {targetN} cartes.</p>
			{/if}
			<button class="btn btn-gold" type="submit" form="roundform" disabled={!skReady}>
				{editN !== null ? 'Corriger' : 'Noter'} la manche {targetN}
			</button>
		{/if}
	{/if}
</div>

<style>
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.meta {
		flex: 1;
		font-size: 15px;
		opacity: 0.85;
		text-align: right;
	}

	.sheet-grid {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		background: var(--cream);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 4px 0 var(--cream-edge);
	}
	th {
		background: #e8dfc4;
		color: var(--felt);
		padding: 6px 2px;
		font-size: 15px;
		line-height: 1.15;
		border-bottom: 2px solid var(--felt);
		vertical-align: top;
	}
	th.lead {
		background: var(--gold);
	}
	th .who {
		display: block;
		overflow-wrap: anywhere;
	}
	th .total {
		display: block;
		font-family: var(--title);
		font-size: 28px;
		font-weight: 800;
		margin-top: 2px;
	}
	.no {
		width: 34px;
		background: var(--cream-2);
		font-size: 14px;
		font-weight: 700;
		color: var(--felt);
		text-align: center;
	}
	td {
		border-bottom: 1px solid var(--cream-line);
		height: 36px;
		text-align: center;
		font-family: var(--hand);
		font-size: 27px;
		color: var(--ink);
		line-height: 1;
	}
	td.no {
		font-family: var(--body);
	}
	.many td {
		font-size: 22px;
	}
	.many th {
		font-size: 13px;
	}
	.many th .total {
		font-size: 22px;
	}
	tr.clickable {
		cursor: pointer;
	}
	tr.current td {
		background: var(--gold-soft);
	}
	tr.current td.no {
		background: var(--gold);
	}
	.preview {
		color: #8a6a00;
	}
	small.bt {
		display: block;
		font-family: var(--body);
		font-size: 12px;
		color: #555;
	}
	.tip {
		text-align: center;
		font-size: 15px;
		opacity: 0.8;
	}
	.trash {
		background: rgba(0, 0, 0, 0.25);
		color: var(--cream);
		border: 2px solid rgba(253, 246, 227, 0.4);
		border-radius: 999px;
		min-height: 44px;
		padding: 0 12px;
		font-size: 15px;
		font-weight: 700;
		white-space: nowrap;
	}
	.confirm p {
		text-align: center;
		font-weight: 700;
		margin-top: 4px;
	}
	.confirm .btn:last-child {
		margin-bottom: 0;
	}

	.drawer {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: 100%;
		max-width: 480px;
		max-height: 60vh;
		overscroll-behavior: contain;
		overflow-y: auto;
		background: var(--cream);
		color: var(--text);
		border-radius: 20px 20px 0 0;
		padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
		box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.4);
	}
	.drawer :global(.card) {
		box-shadow: none;
		margin: 0;
		padding: 4px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 6px;
		font-size: 20px;
	}
	.head strong {
		flex: 1;
		color: var(--felt);
	}
	.inline {
		display: inline;
	}
	.link {
		background: none;
		color: var(--felt);
		text-decoration: underline;
		font-size: 17px;
		min-height: 40px;
		padding: 0 4px;
	}
	.danger-link {
		color: var(--red);
	}
	.help {
		margin: 0 0 8px;
		font-size: 16px;
		color: #444;
	}
	.boxes {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 8px;
	}
	.boxes.two {
		grid-template-columns: 1fr 1fr;
	}
	.box {
		border: 3px solid var(--cream-edge);
		border-radius: 12px;
		background: #fff;
		padding: 4px 6px;
		text-align: center;
		color: var(--felt);
		font-size: 14px;
		font-weight: 700;
		min-height: 64px;
	}
	.box span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.box b {
		display: block;
		font-family: var(--hand);
		font-size: 36px;
		color: var(--ink);
		line-height: 1;
	}
	.box.on {
		border-color: var(--gold);
		background: var(--gold-soft);
	}
	.chips {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}
	.chips button {
		flex: 1;
		background: var(--felt);
		color: var(--cream);
		border-radius: 999px;
		min-height: 44px;
		font-size: 16px;
		font-weight: 700;
	}
	.done {
		text-align: center;
	}
	.trophy {
		font-size: 46px;
	}
	.winner {
		font-family: var(--title);
		font-weight: 800;
		font-size: 26px;
		color: var(--felt);
		margin-bottom: 12px;
	}
	.sk {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 10px;
	}
	.skrow {
		border-bottom: 1px solid var(--cream-line);
		padding-bottom: 8px;
	}
	.skline {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}
	.skname {
		font-weight: 700;
		color: var(--felt);
		flex: 1;
	}
	.score {
		font-family: var(--hand);
		font-size: 28px;
		color: var(--ink);
		min-width: 48px;
		text-align: right;
	}
	.nums {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 5px;
	}
	.nums button {
		min-height: 44px;
		border-radius: 10px;
		background: #fff;
		border: 2px solid var(--cream-edge);
		font-size: 20px;
		font-weight: 700;
		color: var(--felt);
	}
	.nums button.on {
		background: var(--gold);
		border-color: var(--gold-edge);
		color: var(--gold-ink);
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: #555;
	}
	.stepper button {
		min-width: 40px;
		min-height: 40px;
		border-radius: 10px;
		background: var(--cream-2);
		color: var(--felt);
		font-weight: 700;
		font-size: 17px;
	}
	.stepper b {
		min-width: 22px;
		text-align: center;
		color: var(--text);
		font-size: 18px;
	}
	.bonus {
		margin-top: 6px;
	}
	.warn {
		color: #8a5a00;
		font-weight: 700;
		font-size: 16px;
	}
</style>
