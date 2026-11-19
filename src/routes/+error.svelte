<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="page">
	<h1 class="title">Oups</h1>
	<div class="card">
		<p>{page.status === 404 ? 'Cette page n’existe pas (ou la partie a été supprimée).' : 'Quelque chose a coincé.'}</p>
	</div>
	<a class="btn btn-gold" href="/">Retour à l’accueil</a>
</div>
